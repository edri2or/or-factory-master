<!--
תוכנית פיתוח (DEVPLAN) — מנוהלת ע"י /dev-stage. הקובץ הוא הזיכרון/המצפן של הסוכן,
לא חומר קריאה ל-Or. status: active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI).
-->
---
dev_name: הכרחת התווית המשותפת של Google בשער
slug: workspace-user-email-override
opened: 2026-07-21
status: active
---

# תוכנית פיתוח — הכרחת התווית המשותפת של Google בשער (סוף ל-mלכודת localhost:3002)

## מטרה

סוכן שקורא לכלי Google עם `user_google_email` שגוי או ריק נופל למלכודת ה-OAuth של
workspace-mcp ומקבל לינק מת ל-`localhost:3002` (בדיוק מה שקרה ב-Cowork, שאובחן בטעות
כ"טוקן נפל"). התיקון: השער (gateway) יכריח בעצמו את התווית המשותפת הנכונה
(`edriorp38@or-infra.com`) על כל `tools/call` של Workspace — בדיוק כמו שהוא כבר מזריק את
האימות server-side. פתרון במקום אחד, לכל סוכן/ממשק, לתמיד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הלפר טהור + חיווט בשער | completed | `services/mcp-server/src/workspace-drive-edit.ts`, `services/mcp-server/src/workspace-mcp-proxy.ts` |
| 2 | חיווט ה-env לשער (מקור-אמת אחד) | completed | `scripts/render-mcp-service-yaml.sh` |
| 3 | פריסה + הוכחת קבלה חיה | pending | (deploy-mcp-server.yml — post-merge, אחרי ✅ של Or) |

> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי באותו שלב.

---

### שלב 1 — הלפר טהור + חיווט בשער

**Acceptance:**
- [x] `forceWorkspaceUserEmail(body, label)` — מכריח את התווית על `tools/call` אמיתי,
      מדלג על batches / non-tools-call / הכלי הסינתטי `edit_drive_file_content`.
- [x] השער קורא לו לפני ה-pass-through ומרענן את `rawBody` (כי `forwardToSidecar`
      מעדיף את הבייטים המקוריים — אחרת ההזרקה הייתה no-op שקט).
- [x] בדיקות יחידה עוברות מקומית.

**הוכחה תפקודית (באותו שלב):** `cd services/mcp-server && npm test` → 132/132 עוברות,
כולל 4 חדשות: override של מייל שגוי (הבאג של Cowork), set כשחסר, seed של arguments
כשאין, ודילוג על הכלי הסינתטי / tools/list / batch / null. הבנייה (`tsc`) נקייה.

**הוכחת E2E (artifact):** לא-התנהגותי (אין נגיעה ב-`workflows/n8n/*.json` או
`configure-agent-router.yml` — זה קוד שער, לא התנהגות בוט).

**הערת התקדמות אחרונה:** הושלם — הקוד כתוב, נבנה, ונבדק מקומית (132/132).

**שינוי תוכנית:** —

---

### שלב 2 — חיווט ה-env לשער (מקור-אמת אחד)

**Acceptance:**
- [x] `WORKSPACE_GOOGLE_ACCOUNT_LABEL` מוזרק גם על קונטיינר ה-gateway (עד כה רק על
      ה-sidecar), מאותו משתנה-shell אחד — כך ששני הקונטיינרים לא יכולים להיפרד.

**הוכחה תפקודית (באותו שלב):** `shellcheck scripts/render-mcp-service-yaml.sh` נקי.
המשתנה כבר מוגדר בסקריפט (ברירת מחדל `edriorp38@or-infra.com`); נוספה שורת `emit_env`
בבלוק ה-gateway ליד `WORKSPACE_MCP_URL`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם.

**שינוי תוכנית:** —

---

### שלב 3 — פריסה + הוכחת קבלה חיה

**Acceptance:**
- [ ] CI ירוק על ה-PR (Playground tests / shellcheck+yamllint / Changelog gates / secret-scan / supply-chain).
- [ ] מיזוג ל-main → `deploy-mcp-server.yml` נפרס אוטומטית (DEPLOY_NONCE → revision טרי). **לא לשגר ידנית בנוסף.**
- [ ] הוכחת קבלה חיה: קריאה לכלי Google עם המייל **השגוי** `edri2or@gmail.com` — לפני התיקון נופלת ל-localhost:3002, אחרי התיקון מחזירה דאטה אמיתי (השער תיקן בשקט).

**הוכחה תפקודית (באותו שלב):** ריצה חיה מהסשן: `list_calendars` / `list_gmail_labels` /
`search_drive_files` עם `user_google_email=edri2or@gmail.com` → כולן מצליחות. בנוסף
`google-mcp-smoke.yml` נשאר ירוק (מסלול התווית הנכונה לא השתנה).

**הוכחת E2E (artifact):** לא-התנהגותי (deploy + probe, לא שינוי התנהגות בוט).

**הערת התקדמות אחרונה:** ממתין — פריסה חיה רק אחרי ✅ נוסף מפורש של Or.

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 1 הושלם — השער עכשיו יודע למלא בעצמו את השם הנכון של חשבון Google בכל קריאה; נבדק מקומית.
- שלב 2 הושלם — השם מועבר לשער מאותו מקום שהסיידקאר משתמש בו, כדי ששניהם תמיד מסונכרנים.
