# Observability — תשתית התיעוד וההתראות (Phase A)

מסמך זה מתאר את שכבת ה-Observability של ה-factory: איך נפלטים אירועים, לאן הם
זורמים, ואיך סוכן (Claude Code) חוקר אותם. **Phase A** היא התשתית בלבד —
ה-emitter המשותף ופיילוט מבודד שמוכיח שהצינור עובד. אף workflow קיים לא נוגעים בו;
ההטמעה ב-workflows הקיימים היא Phase B ואילך (ראו בסוף).

המנגנון היחיד לפליטת אירועים הוא `scripts/emit-event.sh`. כל קורא עתידי משתמש בו,
וכל יעד נכשל בנפרד (**soft-fail**) — יעד מת לעולם לא מפיל את ה-workflow הקורא.

---

## 1. ארכיטקטורה

**שלושה יעדים, שלושה תפקידים.** כל אירוע נבנה פעם אחת בפורמט תואם
OpenTelemetry Semantic Conventions, ואז מפוזר לשלושה יעדים לפי החומרה:

- **Axiom** — *הזיכרון ההיסטורי*. כל אירוע, בכל חומרה, תמיד נשלח ל-dataset
  `factory-events`. זה ה-event store המתמיד שאליו חוזרים כדי לחקור בדיעבד. שאילתות
  ב-APL (שפה דמוית Kusto) שסוכנים מתמודדים איתה היטב.
- **Telegram** — *ההתראה בזמן אמת*. ערוץ ההתראות הקיים (לא שונה). מקבל הודעה רק
  כאשר החומרה היא `warning`, `error` או `critical` — כדי לא להציף.
- **Linear** — *תיק העבודה*. issue נפתח רק כאשר נדרשת תשומת לב: חומרה
  `error`/`critical`, או `action_required=true`. dedup של 24 שעות מונע הצפה
  ב-issues כפולים על אותה תקלה חוזרת.

**זרימת הנתונים.** קורא (workflow) מריץ את `emit-event.sh` עם פרמטרים → הסקריפט קורא
את הסודות מ-Secret Manager, בונה JSON אחד, ומפזר:

```
workflow ──► scripts/emit-event.sh ──► format_otel_event  (JSON אחד, שורה אחת)
                                          │
                 ┌────────────────────────┼─────────────────────────┐
                 ▼                        ▼                          ▼
              Axiom                   Telegram                    Linear
            (תמיד)              (warning|error|critical)   (error|critical או
         factory-events                                      action_required)
                 └────────────── soft-fail לכל יעד בנפרד ──────────────┘
                                          │
                                          ▼
                          שורת [event] מובנית ל-stdout (תמיד)
```

**רשת ביטחון.** גם אם שלושת היעדים נכשלים, הסקריפט תמיד מדפיס שורת `[event] …` מובנית
ל-stdout ויוצא עם קוד 0. סוכן יכול תמיד לשחזר את האירוע מלוג ה-GitHub Actions גם בלי
אף יעד חיצוני.

---

## 2. סכמת האירוע

`format_otel_event` (ב-`scripts/lib/event-formatter.sh`) מחזיר מסמך JSON קומפקטי בשורה
אחת. השדות, בסדר הזה:

| שדה | מקור / ערכים מותרים | חובה | דוגמה |
|---|---|---|---|
| `_time` | `date -u +%Y-%m-%dT%H:%M:%S.%3NZ` | כן | `2026-05-26T22:30:00.123Z` |
| `service.name` | קבוע `"factory"` | כן | `factory` |
| `service.version` | `${GITHUB_SHA}` מקוצר ל-7 תווים (`unknown` אם חסר) | כן | `e9b3f98` |
| `otel.event.name` | `--name` | כן | `factory.pilot.test` |
| `severity_text` | `--severity`: `info`\|`warning`\|`error`\|`critical` | כן | `error` |
| `factory.system_name` | `--system` — מושמט אם ריק | לא | `factory-test-26` |
| `factory.workflow` | `--workflow` | כן | `provision-system.yml` |
| `factory.run_id` | `--run-id` | כן | `26478720579` |
| `factory.layer` | `--layer`: `factory`\|`system` | כן | `factory` |
| `factory.action_required` | `--action-required` כ-boolean אמיתי (לא מחרוזת) | כן | `true` |
| `event.body` | `--body` כ-JSON object (ברירת מחדל `{}`) | כן | `{"pilot":true}` |

הפונקציה מחזירה קוד שגיאה (ולא פולטת כלום) אם `severity` או `layer` לא חוקיים, או אם
`--body` אינו JSON תקין. השמות נושאים נקודות (`service.name`, `otel.event.name`) — הם
שמות-תכונה שטוחים, לא אובייקטים מקוננים.

דוגמת אירוע מלא:

```json
{"_time":"2026-05-26T22:30:00.123Z","service.name":"factory","service.version":"e9b3f98","otel.event.name":"factory.pilot.test","severity_text":"error","factory.system_name":"factory-test-26","factory.workflow":"provision-system.yml","factory.run_id":"26478720579","factory.layer":"factory","factory.action_required":true,"event.body":{"reason":"smoke test","pilot":true}}
```

---

## 3. קריאה ל-emit-event מתוך workflow

ה-job חייב להיות מאומת מול GCP (WIF + broker SA) כדי שהסקריפט יוכל לקרוא את הסודות.
דוגמה מינימלית (ראו `.github/workflows/observability-pilot.yml` לדוגמה החיה):

```yaml
- name: Authenticate to GCP via WIF
  uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093  # v3.0.0
  with:
    workload_identity_provider: "projects/140345952904/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
    service_account: "factory-master-broker@or-factory-master-control.iam.gserviceaccount.com"
- name: Set up gcloud
  uses: google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db  # v3.0.1
- name: Emit event
  run: |
    bash scripts/emit-event.sh \
      --name="factory.provision.completed" \
      --severity="info" \
      --layer="factory" \
      --workflow="${GITHUB_WORKFLOW}" \
      --run-id="${GITHUB_RUN_ID}" \
      --system="factory-test-26" \
      --action-required="false" \
      --body='{"duration_s":142}'
```

פרמטרי חובה: `--name --severity --layer --workflow --run-id`. אופציונליים:
`--system` (ברירת מחדל ריק), `--action-required` (ברירת מחדל `false`), `--body`
(ברירת מחדל `{}`).

---

## 4. שאילתות לסוכן

**Axiom (APL)** — חיפוש אירועי הפיילוט בשעה האחרונה:

```kusto
['factory-events']
| where ['otel.event.name'] == "factory.pilot.test"
| where _time > ago(1h)
| project _time, severity_text, ['factory.system_name'], ['factory.run_id']
| sort by _time desc
```

כל התקלות הפתוחות (חומרה גבוהה) ב-24 השעות האחרונות:

```kusto
['factory-events']
| where severity_text in ("error", "critical")
| where _time > ago(24h)
| summarize count() by ['otel.event.name'], ['factory.system_name']
```

**Linear** — דרך ה-MCP, `list_issues` עם פילטר על ה-team והכותרת/תווית:

```
list_issues(team="or-infra-linear", query="factory.pilot.test")
# או לפי תווית: label="auto-created", state=open
```

**לוג מובנה (GitHub Actions)** — קריאת שורות ה-stdout המובנות דרך ה-MCP:

```
read_github_actions_run_logs(job_id=<id>, grep="\[event\]")   # רשת הביטחון + תוצאות Axiom/Telegram
read_github_actions_run_logs(job_id=<id>, grep="\[linear\]")  # תוצאת Linear (created/updated/failed)
```

---

## 5. הסודות ב-`or-factory-master-control`

ה-emitter קורא ב-runtime שישה סודות מ-Secret Manager (ה-broker SA קורא אותם; הערכים
ממוסכים מיד עם `::add-mask::` ולעולם לא נדפסים):

| סוד | תפקיד |
|---|---|
| `axiom-api-key` | טוקן ingest ל-Axiom (יעד ה-event store) |
| `better-stack-api-key` | טוקן Better Stack (שמור ל-Phase C/D; לא בשימוש ב-Phase A) |
| `linear-api-key` | מפתח ה-API האישי של המפעיל ל-Linear |
| `linear-team-id` | מזהה ה-team היעד ב-Linear (`or-infra-linear`, ה-UUID) |
| `telegram-bot-token` | בוט ה-Telegram הקיים (לא שונה) |
| `telegram-chat-id` | ה-chat של Telegram הקיים (לא שונה) |

אם קריאת סוד נכשלת, היעד התלוי בו פשוט מדולג (`[event] secret='X' read='failed'`) —
הסקריפט לא נעצר.

---

## 6. התנהגות soft-fail

הסקריפט רץ עם `set -uo pipefail` אבל **בלי** `set -e` — קוד היציאה של כל קריאה חיצונית
נבדק במפורש, כך שכישלון אחד לא קוטע את השאר. השורות שמופיעות ב-stdout:

| מצב | שורה |
|---|---|
| נדחה (קלט לא חוקי) | `[event] action='rejected' reason='…'` |
| Axiom הצליח / נכשל / דולג | `[event] axiom='ok' http='200'` / `axiom='failed' http='…'` / `axiom='skipped' reason='no-key'` |
| Telegram הצליח / נכשל / דולג | `[event] telegram='ok'` / `telegram='failed' http='…'` / `telegram='skipped' reason='no-secret'` |
| Linear נוצר / עודכן / נכשל | `[linear] action='created'…` / `action='updated'…` / `action='failed' error='…'` |
| רשת ביטחון (תמיד, אחרונה) | `[event] name='…' severity='…' layer='…' system='…' workflow='…' run_id='…' action_required='…'` |

לאיתור כשל: חפש `failed` בשורות `[event]`/`[linear]`. היעדר שורת `axiom='ok'` עם שורת
`axiom='failed'` מצביע על תקלת ingest (בדוק את קוד ה-HTTP).

---

## 7. חלון ה-dedup (24 שעות)

ל-Linear, מחושב `dedup_key = sha256("<otel.event.name>::<factory.system_name|_global>")`
מקוצר ל-12 תווים hex. הוא מוטמע בתיאור ה-issue (שורה ראשונה: `<!-- dedup:KEY -->`).
בפליטה הבאה:

- אם קיים issue פתוח (state `backlog`/`unstarted`/`started`) עם אותו dedup key
  ש**עודכן בפחות מ-24 שעות** → מתווסף **comment** עם ה-JSON החדש, לא נוצר issue חדש.
- אם לא קיים, או שקיים אבל ישן (>24h) → נוצר issue חדש.

כדי לאלץ issue חדש ביוזמה: סגור/ארכב את ה-issue הקיים (כך הוא יוצא מ-state פתוח),
או המתן שיחלפו 24 שעות מאז העדכון האחרון.

---

## 8. הערה על זהות Linear

אנו משתמשים ב-`linear-api-key` **האישי הקיים** של המפעיל, ולא יוצרים משתמש `factory-bot`
ייעודי. ההפרדה בין issues אוטומטיים לידניים נעשית דרך התווית **`auto-created`** (לצד
`factory`, `severity-*`, `source-*`), לא דרך זהות משתמש נפרדת. זו החלטה מכוונת — אין
להציע לשנותה. התוויות הניהוליות נוצרות אוטומטית בריצה הראשונה אם אינן קיימות; `Bug`
(הקיימת) מצורפת לחומרה `error`/`critical`.

מיפוי `source-*` נגזר מ-`factory.workflow`: `provision-system.yml`→`source-provision`;
כל workflow שמכיל `deploy`→`source-deploy`; `audit-*`→`source-audit`;
`system-runtime-*`→`source-runtime`; אחרת `source-other`. מיפוי עדיפות:
`critical`→1, `error`→2, `warning`→3, `info`→4.

---

## 9. מתווה Phase B/C/D

- **Phase B — Coverage** (✅ הושלם):
  - ✅ `audit-openrouter-orphan-keys.yml` פולט `factory.openrouter_audit.{clean,action_needed,deletions}`
    בכל ריצה (Axiom תמיד; Linear על ממצא שדורש פעולה). ה-Telegram העשיר בעברית נשמר כפי שהיה;
    ה-emit ב-severity `info` כדי לא לשלוח Telegram כפול.
  - ✅ חדש `factory-health-audit.yml` — heartbeat ברמת ה-factory כל 6 שעות:
    `factory.health.ok` (info → Axiom) או `factory.health.degraded` (error+action → Axiom+Telegram+Linear).
  - ✅ קריאות emit ב-`provision-system.yml` (`factory.provision.{started,completed,failed}`, soft-fail).
- **Phase C — Generated systems visibility** (בעבודה):
  - ✅ חדש `system-runtime-audit.yml` — heartbeat runtime למערכות פרוסות כל 6 שעות: probe ל-`/healthz`
    הציבורי, ופליטת `factory.runtime_audit.{ok,failed,summary}` (per-system, `layer=system`).
  - ⬜ קריאות emit ב-`deploy-railway-cloudflare.yml` (template; מגיע למערכות חדשות) + Better Stack
    monitor אוטומטי לכל מערכת — PR נפרד (PR-C2).
- **Phase D — Refinement**: ניתוב Telegram דרך Better Stack; כלי MCP `emit_event`; הוספת
  Sentry לקוד JS/TS.

per-system runtime health שייך ל-Phase C, לא ל-Phase B.
