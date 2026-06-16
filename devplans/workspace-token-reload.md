<!--
DEVPLAN — workspace-token-reload. מנוהל על-ידי /dev-stage. זיכרון הסוכן, לא חומר ל-Or.
-->
---
dev_name: טעינת טוקן Google מחדש בכל פריסה
slug: workspace-token-reload
opened: 2026-06-16
status: active
---

# תוכנית פיתוח — טעינת טוקן Google מחדש בכל פריסה

## מטרה

חידוש (re-consent) של טוקן Google המשותף **לא נכנס לתוקף** עד שה-sidecar מאותחל — וה-sidecar
קורא את הטוקן רק ב-boot. אבל `gcloud run services replace` עם אותו commit/config הוא **no-op**
ב-Cloud Run (לא נוצר revision חדש, אין restart), אז פריסה חוזרת על אותו commit משאירה את
ה-sidecar עם הטוקן הישן/המבוטל. כך נוצר מצב חי ב-2026-06-16: Or שינה סיסמת Google (מה שביטל
את הטוקן), חידש פעמיים — אבל אף redeploy לא אתחל את ה-sidecar, אז שום חידוש לא נטען. התיקון:
`DEPLOY_NONCE` ייחודי לכל פריסה ב-template → תמיד revision חדש → ה-sidecar תמיד קורא `:latest`.

> אין יכולת חדשה (plumbing בלבד) → Step 0 של capability-first מדולג.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | DEPLOY_NONCE מאלץ revision חדש בכל פריסה → טוקן מחודש נטען | in-progress | `scripts/render-mcp-service-yaml.sh`, `.github/workflows/deploy-mcp-server.yml` |

---

### שלב 1 — DEPLOY_NONCE

**Acceptance:**
- [ ] `render-mcp-service-yaml.sh` פולט `emit_env DEPLOY_NONCE "${DEPLOY_NONCE:-0}"` ל-template.
- [ ] `deploy-mcp-server.yml` מחשב `DEPLOY_NONCE` פעם אחת (`${GITHUB_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}`) ומעביר אותו ל-render.
- [ ] CI ירוק; אחרי merge + redeploy: revision חדש נוצר (לא 00090), וה-`google-mcp-smoke` המיוצב ירוק על הטוקן הטרי.

**הוכחה תפקודית (באותו שלב):** אחרי merge + deploy, `list_railway`/`get_workflow_run` מראים revision חדש, ו-`google-mcp-smoke.yml` נפרד (אחרי התייצבות) חוזר PASS על `list_gmail_labels` — הוכחה חיה שהטוקן המחודש נטען. כלי ה-Drive של Or ב-claude.ai עובד שוב.

**הוכחת E2E (artifact):** לא-התנהגותי (לא נוגע ב-`workflows/n8n/*.json` או `configure-agent-router.yml`).

**הערת התקדמות אחרונה:** הקוד נכתב; ב-PR. ממתין ל-CI + redeploy לאימות.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- 2026-06-16: נמצא השורש האמיתי — השרת לא טען טוקן מחודש כי פריסה חוזרת לא מאתחלת אותו. תיקון בדרך.
