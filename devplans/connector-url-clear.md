<!--
DEVPLAN — connector-url-clear
מנוהל על-ידי /dev-stage. הקובץ הוא הזיכרון של הסוכן (לא חומר קריאה ל-Or).
-->
---
dev_name: כתובת המחבר ל-claude.ai — ברור ובדוק לתמיד
slug: connector-url-clear
opened: 2026-06-16
status: active
---

# תוכנית פיתוח — כתובת המחבר ל-claude.ai

## מטרה

הפיתוח האחרון (`drive-content-edit`) הסתיים — הכלי לעריכת קבצי Drive עובד. מה שגרם
לסיבובים מיותרים זה **לא באג בקוד**, אלא מלכודת תיעודית: ה-deploy מדפיס שכתובת
ה-`mcp_url` היא הכתובת ה"יפה" (Region URL `…140345952904…`), אבל השרת מכריז
ב-`/.well-known/oauth-authorization-server` על `issuer` שונה — הכתובת ה"מכוערת"
(`…risl6twm4a-zf…`). claude.ai נצמד ל-`issuer` בזמן OAuth discovery — לכן מחבר
שמדביקים תחת ה-Region URL נופל באימות. המטרה: מסמך קנוני שאומר את הכתובת הנכונה,
deploy שמדפיס אותה חיה אחרי כל ריצה, סקיל `/prove-connector` שהופך פיתוח-מחבר
בעתיד לתהליך מוכר, ולסיום (שלב 2) קיבוע ה-issuer לכתובת היפה — כתובת אחת לעולם.

> **אין יכולת חדשה.** הפיתוח הוא תיעוד-אמת + הדפסת-CI + סקיל + flip של env-var.
> Step 0 של capability-first **מדולג מפורשות**.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | תיעוד-אמת + מנגנון "המחשב אומר לך את הכתובת" + סקיל `/prove-connector` | in-progress | `docs/mcp-connector-setup.md`, `.github/workflows/deploy-mcp-server.yml`, `services/mcp-server/src/tools.ts`, `CLAUDE.md`, `.claude/commands/prove-connector.md` |
| 2 | קיבוע ה-issuer ל-Region URL (שובר פעם אחת — Or מחבר מחדש) | pending | `.github/workflows/deploy-mcp-server.yml`, `docs/mcp-connector-setup.md`, `CLAUDE.md` |

> **C2 (שער CI חוסם עם `connector-proofs/<slug>.json`)** — לא נבנה. הסיבה הכנה:
> החלק הקריטי ("הכלים נטענו ורצו ב-claude.ai") לא ניתן להוכחה אוטומטית — `probe_endpoint`
> חוסם את claude.ai מתוך כוונה (`services/mcp-server/src/probe.ts:12`). שער כזה בעיקר היה
> אוכף JSON של הצהרה-עצמית. החצי השני (issuer == מתועד) כבר נאכף ב-Stage 1 (שלב B1). נשמר
> כ"עתידי/מייעץ" בלבד; כאן רק נרשם, לא נבנה.

---

### שלב 1 — Layers A + B + C1 (לא שובר, PR יחיד, redeploy יחיד באישור Or)

**Acceptance:**
- [ ] `docs/mcp-connector-setup.md` נוצר עם שורת `EXPECTED_CONNECTOR_ISSUER=https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app` כשורה ניתנת ל-grep.
- [ ] `deploy-mcp-server.yml` קוראת את ה-issuer החי אחרי `/health`, מדפיסה שורה רועשת "claude.ai connector URL (paste THIS): …", ומבליטה drift כ-`::warning::` (לא error) אם לא תואם ל-`EXPECTED_CONNECTOR_ISSUER`.
- [ ] ה-Summary של ה-deploy מציג שתי שורות נפרדות: `Region URL (toolbox mcp_url)` ו-`claude.ai connector URL (issuer)`, וטקסט ה"Operator action" מפריד את שני הצרכנים.
- [ ] `verify_mcp_server` מחזיר check חדש בשם `mcp-oauth-issuer` עם ה-issuer מהגוף שכבר נמשך.
- [ ] `CLAUDE.md` (שורה 149 וקטע ה-connector-gate) מצביעים על המסמך החדש.
- [ ] `.claude/commands/prove-connector.md` קיים עם `audience: factory-only`; `scripts/sync-skills-mirror.sh` רץ; ה-mirror **לא** מכיל אותו; `check-skills-mirror.sh` עובר.
- [ ] `changelog.d/2026-06-16-connector-url-clear.md` נוסף.
- [ ] CI ירוק. Or-gated redeploy מאומת ב-`get_workflow_run`; ה-Summary מציג את ה-issuer הנכון; קריאה עצמאית ב-`probe_endpoint` מאמתת את אותו ערך.

**הוכחה תפקודית (באותו שלב):**
- שלב A (תיעוד) — "תוכן בלבד".
- שלב B (deploy step) — אחרי merge + redeploy, קוראים את לוג השלב ואת ה-Summary; הוכחה חיה ש-`curl …/.well-known/oauth-authorization-server | jq .issuer` חוזר עם הכתובת המכוערת ושהיא מוצגת ל-operator.
- שלב C1 (סקיל) — "תוכן בלבד" (סקיל הוא מסמך מנחה).
- שלב B2 (`verify_mcp_server`) — קריאה לכלי על מערכת קיימת (`or-edri-4`) — הצ'ק החדש `mcp-oauth-issuer` חוזר ב-evidence עם ה-issuer של המערכת ההיא.

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע ב-`workflows/n8n/*.json` או `configure-agent-router.yml`).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — Layer D: קיבוע ה-issuer ל-Region URL (שובר פעם אחת — Or-gated)

**Acceptance:**
- [ ] `.github/workflows/deploy-mcp-server.yml` שורות 684-687: `PUBLIC_BASE_URL` נקבע דטרמיניסטית ל-`https://${SERVICE}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app`, ה-`gcloud … describe status.url` מוסר.
- [ ] `docs/mcp-connector-setup.md`: שורת ה-`EXPECTED_CONNECTOR_ISSUER` והפסקת ה-top-line הופכות ל-Region URL; נוסף קטע "אם המחבר שלך עוד תחת הכתובת המכוערת — תמחק ותוסיף מחדש פעם אחת".
- [ ] `CLAUDE.md` שורה 149: שני הצרכנים מצביעים על אותה כתובת.
- [ ] `changelog.d/2026-06-<DD>-connector-url-clear-stage2.md` נוסף.
- [ ] אחרי redeploy: שלב B1 כבר לא מבליט drift; `probe_endpoint` על `/.well-known/oauth-authorization-server` חוזר עם Region URL.
- [ ] Or-gated reconnect ב-claude.ai (חד-פעמי) + הרצת `/prove-connector` לרישום Connector Card עם verdict `go`.
- [ ] `status: completed` ב-`devplans/connector-url-clear.md`.

**הוכחה תפקודית (באותו שלב):** אחרי redeploy — קריאה ב-`probe_endpoint` ל-`/.well-known/oauth-authorization-server` חייבת להחזיר `issuer` = Region URL. בנוסף, סשן claude.ai חי של Or מציג את כלי ה-Workspace אחרי הוספה מחדש.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- 2026-06-16: התוכנית פתוחה — מצאתי את המלכודת והוכחתי אותה חיה (השרת מכריז כתובת אחרת מזו שמומלצת). שלב 1 בעבודה.
