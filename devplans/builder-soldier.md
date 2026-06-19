---
dev_name: חייל-הבנאי (the builder-soldier)
slug: builder-soldier
opened: 2026-06-19
status: active   # active בזמן פיתוח → completed בסיום
---

# תוכנית פיתוח — חייל-הבנאי (the builder-soldier)

## מטרה

להוסיף לצוות-הסוכנים חייל חדש בעל-יכולת-כתיבה ("הבנאי") שיכול לבנות קוד לתוך
`edri2or/personal-life` — אבל **בלי לשבור את חוק האבטחה מס' 1 של הפקטורי**: הכל עובר דרך
דלת אחת שמורה (הברוקר), שום סוכן לא כותב ישירות. בפועל: החייל רק *מציע* קבצים (בארגז-חול,
בלי שום מפתח GitHub), והברוקר הקיים פותח PR-טיוטה ל-personal-life — עם ✅ של Or בטלגרם בכל
ריצה. הצעד האחרון (חובה): רישום הבנאי כחייל ש-Nuriel יכול לנתב אליו (`route_to_agent`).

> **תיקון-עיגון מול הבלופרינט של נוריאל:** הבלופרינט הניח שה-worker יחזיק מפתח-כתיבה משלו
> (GitHub App ייעודי + SA חדש `agent-builder-sa@`) וידחוף בעצמו. זה סותר את מודל-הברוקר
> ("רק הברוקר כותב; הכל דרך הדלת האחת"). העיצוב המעוגן: **אין App חדש, אין SA חדש, אין WIF
> חדש** — ה-worker מציע קבצים, הברוקר (App ארגוני קיים, טוקן מצומצם ל-personal-life לכל ריצה)
> מיישם כ-PR-טיוטה. בטוח יותר וגם פחות תשתית. 4 נקודות-הלברור הוכרעו בהתאם (ראו למטה).

### 4 נקודות-הלברור — הוכרעו
1. **SA חדש?** לא. ה-worker משתמש ב-SA המשותף `agent-repo-runtime-sa@factory-test-25`
   (קורא רק `anthropic-api-key`), כמו כל agent-repo. הכתיבה ל-GitHub היא של הברוקר.
2. **אחסון audit?** אין bucket חדש. ה-trail = אירועי `factory.agent_action.*` ב-Axiom +
   ה-PR-טיוטה עצמו + commits עם trailer `[builder-agent]` + `results/<corr>.json`.
3. **סף-קבצים?** השער ממילא RED→טלגרם לכל ריצה; בלם-בטיחות קשיח בברוקר: מסרב מעל
   **50 קבצים או ~256KB**, ומציג את מספר-הקבצים בכרטיס הטלגרם.
4. **מיקום allowlist?** נאכף **אצל הברוקר** (הכותב האמיתי), 3 שכבות: L3 טוקן מצומצם
   ל-`edri2or/personal-life` (GitHub API דוחה כל ריפו אחר) > L1 בדיקת `builder_allowed_targets`
   ב-`policy/agent-risk-tiers.yml` (fail-closed) > L2 איסור מפורש ב-AGENTS.md.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | הוכחת-יכולת (capability-first) — הלבנה הקשה | completed | spike (local scaffold + live PR #540 + isolation probe) |
| 1 | מדיניות-סיכון: builder כ-write + allowlist + סף | completed | `policy/agent-risk-tiers.yml`, `scripts/agent-classify.sh`, `tests/agent-classify-fixtures.yml` |
| 2 | נתיב-כתיבה בברוקר (apply→draft PR), שער RED | completed | `.github/workflows/agent-action.yml`, `scripts/builder-apply.sh` |
| 3 | תבנית worker כותב (Write/Edit לתוך `out/`, בלי Bash/טוקן) | completed | `templates/agent-repo-builder/**`, `provision-agent-repo.yml`, `pipeline-tests.yml` |
| 4 | הקמת ריפו-הבנאי `edri2or/agent-builder` 🔴 | completed | `provision-agent-repo.yml`, `refresh-agent-repo.yml` |
| 5 | יצירת `edri2or/personal-life` + הגנת-main 🔴 | in-progress | `scripts/ensure-protect-main-ruleset.sh` |
| 6 | dry-run → ריצה אמיתית ראשונה 🔴 | pending | (תפעולי — dispatch דרך הברוקר) |
| 7 | רישום ב-`route_to_agent` (חובה אחרון) 🔴 | pending | `deploy-mcp-server.yml`, `policy/…`, `docs/agent-specs/nuriel.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`. 🔴 = עוצר לאישור-Or בטלגרם.

---

### שלב 0 — הוכחת-יכולת (capability-first) — הלבנה הקשה

**Acceptance:**
- [ ] Claude Code בארגז-חול (Write/Edit, בלי Bash, בלי טוקן) מייצר scaffold תקין לתוך `out/`.
- [ ] טוקן App מצומצם לריפו-זרוק יחיד פותח branch+PR-טיוטה שם — ונדחה (403) על כל ריפו אחר.
- [ ] רשומת go/no-go.

**הוכחה תפקודית (באותו שלב):** spike על ריפו-זרוק — צפייה בעיניים ב-PR שנוצר ובדחיית 403.

**הוכחת E2E (artifact):** לא-התנהגותי (agent-repo, לא n8n).

**הערת התקדמות אחרונה:** ✅ GO (2026-06-19). לבנה 1 (ייצור scaffold בארגז-חול) הוכחה מקומית — 3 קבצים ל-`out/`. לבנה 2 (זהות-הברוקר פותחת PR) הוכחה חיה — PR #540 עצמו נפתח ע"י אינטגרציית-הברוקר (כולל הרשאת `pull_requests:write`). לבנה 3 (בידוד): הזהות נחסמה על ריפו אחר (`create_branch` על `edri2or/nuriel` → refused; וגם יצירת-ריפו בארגון → 403) — בידוד הוכח בשכבת-ה-connector. הוכחת-הבידוד ברמת-טוקן-ה-App (`generate-app-token.sh` עם `repository_ids` → 403 מ-GitHub API) **נעוצה כשער-הכניסה הראשון של שלב 2 על main**, כי סשן לא יכול לנפק טוקן-ברוקר (בכוונה — הכוח הזה חי רק ב-workflow על main). אין חוב-ניקיון (לא נוצר ריפו-זרוק).

**שינוי תוכנית:** ויתור על ריפו-זרוק (Or אישר את החלופה "להוכיח חסימה מול ריפו קיים בלי לגעת בו"). הוכחת-הבידוד ברמת-הטוקן הועברה לשער-הכניסה של שלב 2 על main — שם הקוד באמת חי, וההוכחה טרייה וקבועה.

---

### שלב 1 — מדיניות-סיכון

**Acceptance:**
- [ ] `worker_capabilities` כולל את הבנאי כ-`write`; `builder_allowed_targets: [edri2or/personal-life]`.
- [ ] דפוסי cross-repo-write = RED; סף 50-קבצים/256KB.
- [ ] `agent-classify.sh` לא מוריד RED→yellow ל-worker כותב (אימות).

**הוכחה תפקודית (באותו שלב):** הרצת `agent-classify.sh` על משימת-בנאי לדוגמה → tier=red, worker_capability=write.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם (2026-06-19). `policy/agent-risk-tiers.yml`: נוסף `agent-builder: write`, `builder_allowed_targets: [edri2or/personal-life]`, `builder_limits` (50 קבצים / 256KB), ו-`always_red_workers: [agent-builder]`. `agent-classify.sh`: נוסף override "always-red" (גובר על ה-cap ועל verdict-הטקסט) — כך **כל** משימת-בנאי נכפית ל-red→טלגרם, גם אם הטקסט נקי. נוספו 2 fixtures; כל 8 ה-fixtures עוברים; shellcheck+yamllint נקי.

**שינוי תוכנית:** —

---

### שלב 2 — נתיב-כתיבה בברוקר

**Acceptance:**
- [ ] `agent-action.yml` מושך `out/`, מאמת target∈allowlist + סף, מנפק טוקן מצומצם, פותח DRAFT PR, כותב `results/<corr>.json`.
- [ ] כתיבה cross-repo עוברת בשער RED→טלגרם הקיים לפני execute.

**הוכחה תפקודית (באותו שלב):** יחידתית הושלמה — `builder-apply.sh` ב-DRY_RUN (offline, בלי רשת): יעד-מותר→JSON תקין, יעד-אסור→כשל, מעל-50-קבצים→כשל, ריק→כשל, path-traversal/.git→נדחה. הברוקר עבר `bash -n` + `shellcheck -S error`. **ההוכחה החיה המורכבת** (PR-טיוטה אמיתי + חסימת-403 ברמת-טוקן-ה-App) היא הלבנה האחרונה — שלב 6 (אין ריפו-יעד עד שלבים 4–5).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ קוד הושלם (2026-06-19). `scripts/builder-apply.sh`: validate (allowlist L1 + בלם `builder_limits` + דחיית path-traversal/.git/ריק) → ב-apply: ענף `builder/<corr>` מ-default, push כל קובץ (trailer `[builder-agent]`), פתיחת **DRAFT PR**, idempotent (422 על ענף/PR קיים = שימוש-חוזר). `agent-action.yml`: input `dry_run`; זיהוי builder-mode (`.target_repo` במניפסט + `dl/out/`); ב-execute (אחרי ✅) מנפק טוקן מצומצם `{contents,pull_requests}:write` ליעד ומריץ apply; ב-propose+dry_run מריץ preview בלי PR ובלי כרטיס (אין כתיבה ליעד). התוצאה ממוזגת ל-`results/<corr>.json` של ה-requester + emit `factory.agent_action.builder_applied`.

**שינוי תוכנית:** dry_run פטור משער-הכרטיס (הוא לא כותב ליעד — preview בלבד), כדי שתוכל לראות את רשימת-הקבצים לפני ה-✅ האמיתי.

**Acceptance:**
- [ ] worker variant עם `--allowedTools Read,Grep,Glob,Write,Edit`, בלי Bash, בלי טוקן GitHub, מעלה `out/`.
- [ ] שערי golden / skills-mirror ירוקים.

**הוכחה תפקודית (באותו שלב):** render של התבנית (אותו envsubst allow-list של provision) → 4 קבצים, אפס tokens שנותרו, mcp.json תקין; ה-worker עבר `bash -n`+`shellcheck -S error`; סימולציית בניית-המניפסט מפיקה בדיוק את הצורה ש-`builder-apply.sh` מצפה לה. הרצת ה-worker החיה היא שלב 6.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם (2026-06-19). נוצרה `templates/agent-repo-builder/**` (4 קבצים): worker עם `--allowedTools Read,Grep,Glob,Write,Edit` (בלי Bash, בלי טוקן GitHub) שכותב הצעות **רק** ל-`result/out/` ובונה מניפסט `result/<corr>.json`, מעלה כ-`agent-result`; `AGENTS.md.template` עם persona-בנאי (שרשרת-פיקוד, allowlist personal-life בלבד + 3 שכבות + איסורים); `CLAUDE.md.template`+`.mcp.json.template`. `provision-agent-repo.yml`: input `template_dir` (enum: agent-repo / agent-repo-builder, fail-closed). `templates/agent-repo/` הזהב לא נגע (gate נשאר ירוק); הוספתי כיסוי yamllint לתבנית-הבנאי.

**שינוי תוכנית:** תבנית נפרדת (`agent-repo-builder`) במקום לשנות את `agent-repo` — שומר על golden-הזהב נקי ומבדל את ה-worker הכותב לבדיקה.

---

### שלב 4 — הקמת ריפו-הבנאי 🔴

**Acceptance:**
- [ ] `edri2or/agent-builder` קיים, WIF-bound, עם worker כותב + AGENTS.md מותאם (allowlist + איסור).

**הוכחה תפקודית (באותו שלב):** `verify_github_system` + קריאת AGENTS.md החי.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** ✅ הושלם (2026-06-19). דיספאטץ' `provision-agent-repo.yml` (ref=main, `template_dir=templates/agent-repo-builder`) דרך GitHub MCP (לא על ה-allowlist) — run [27849594236](https://github.com/edri2or/or-factory-master/actions/runs/27849594236) ✅ success. אומת: `edri2or/agent-builder` קיים, **פרטי**, default=main; ה-AGENTS.md החי = אישיות-הבנאי (שרשרת-פיקוד, יעד יחיד `personal-life` ב-3 שכבות, איסור כתיבה מחוץ ל-`result/out/` + אין טוקן); הריצה כללה את שלב ה-WIF-bind המשותף (אין סוד קבוע בריפו).

**שינוי תוכנית:** —

---

### שלב 5 — יצירת personal-life + הגנת-main 🔴

**Acceptance:**
- [ ] `edri2or/personal-life` קיים (פרטי) עם ruleset `protect-main` (PR-required, no force-push/deletion).

**הוכחה תפקודית (באותו שלב):** `list_branch_protection_rules` / `verify_github_system`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** 🔄 בתהליך (2026-06-19). `edri2or/personal-life` נוצר (פרטי, auto_init→יש `main`) דרך זהות-המכונה `edri2or-commits` (הברוקר ב-MCP מצומצם ל-or-factory-master ולכן 403 על יצירת-ריפו-ארגון; היצירה היא שק ריק חד-פעמי, הברוקר נשאר הכותב-היחיד של קוד לתוכו). החלת ההגנה דרך `protect-system-main.yml` (`required_contexts_json='[]'`) **נכשלה** (run 27850037543, exit 22): `ensure-protect-main-ruleset.sh` שלח חוק `required_status_checks` עם רשימה ריקה → GitHub דחה (4xx). **תיקון בקוד** (בתוך PR #541): כשהרשימה ריקה החוק מושמט לגמרי — נשאר חובה-PR + אין force-push + אין מחיקה. נשאר: למזג את התיקון ל-main ואז להריץ מחדש את ההגנה + לאמת.

**שינוי תוכנית:** היצירה נעשתה דרך `edri2or-commits` (לא הברוקר) כי אין נתיב-ברוקר-on-main ליצירת ריפו בשם שרירותי (`create-throwaway-repo.yml` נעול ל-`zz-`, `provision-agent-repo` מסקפלד אישיות-סוכן). זו יצירת-שק חד-פעמית בלבד; כל כתיבת-קוד עתידית ל-personal-life עוברת רק דרך הברוקר.

---

### שלב 6 — dry-run → ריצה אמיתית ראשונה 🔴

**Acceptance:**
- [ ] DRY_RUN: Or רואה את רשימת-הקבצים בכרטיס; ואז ריצה אמיתית פותחת PR-טיוטה ל-personal-life; Or ממזג ידנית.
- [ ] אומת: `results/<corr>.json`, ה-PR, אירועי Axiom, trailer `[builder-agent]`.

**הוכחה תפקודית (באותו שלב):** צפייה ב-PR החי + תוצאת ה-broker.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — רישום ב-route_to_agent (חובה אחרון) 🔴

**Acceptance:**
- [ ] `agent-builder` נוסף ל-`COORDINATOR_WORKER_REPOS` + capability ב-policy + שורה ברוסטר `nuriel.md`.
- [ ] לאחר redeploy של ה-MCP: `route_to_agent(worker_repo=agent-builder)` מ-Nuriel מצליח (broker run + result).

**הוכחה תפקודית (באותו שלב):** קריאת `route_to_agent` חיה → broker run + `results/<corr>.json`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- 2026-06-19: הוקם הפיתוח. תיקנתי את הבלופרינט של נוריאל לעיצוב מאובטח (בלי App/SA חדשים — הברוקר כותב).
- 2026-06-19: שלב 0 (הוכחת-יכולת) ✅ GO — הוכחתי שהלבנים עובדות (ייצור-קבצים בארגז-חול, פתיחת-PR ע"י הברוקר, חסימה על ריפו אחר). לא נוצר ריפו-זרוק.
- 2026-06-19: שלב 1 ✅ — מדיניות-הסיכון עודכנה כך שכל ריצת-בנאי תמיד דורשת ✅ שלך בטלגרם, ועם בלם-בטיחות (50 קבצים) ורשימת-יעד מותרת (personal-life בלבד).
- 2026-06-19: שלבים 2–3 ✅ נעולים ב-main (PR #540) — נתיב-הכתיבה בברוקר (פותח PR-טיוטה) ותבנית החייל-הכותב מוכנים.
- 2026-06-19: שלב 4 ✅ — הוקם החייל עצמו: ריפו פרטי `edri2or/agent-builder` עם אישיות-הבנאי. עדיין בלי מפתחות לכלום — "שולחן וכיסא".
