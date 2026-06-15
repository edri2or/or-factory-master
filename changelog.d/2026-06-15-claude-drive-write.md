## חשיפת כלי-כתיבה ל-Google Drive דרך claude.ai (claude-drive-write)

חיווט + אבטחה + תיעוד שחושפים ל-Claude (דרך claude.ai) יכולת מחיקה-לסל, עריכת-תוכן
(Google Docs/Sheets/Slides בלבד), העברה ושינוי-שם ב-Drive המשותף — **בלי כלי חדש**: הכלי
`update_drive_file` כבר פרוס ב-sidecar `workspace-mcp==1.21.1` של ה-gateway (מצב כתיבה).
ארבעה שינויי-ריפו; חיבור ה-connector וכיבוי כלים/Research הם צעדי-UI ש-Or מבצע ב-claude.ai.

- **שלב 1 — הידוק שער-הגישה (חוסם):** `.github/workflows/deploy-mcp-server.yml` — חיזוק
  ההערה על `OAUTH_ALLOWED_EMAILS` (זהו השער היחיד על כלי-הכתיבה; = Or בלבד; ריק = fail-closed),
  הוספת preflight-step שמפיל את ה-deploy בקול (`::error::`) אם ה-allowlist ריק/רווחים בלבד
  (silent-lockout → loud fail; שום smoke לא היה תופס זאת — הוא מתאמת ב-admin-secret, לא ב-OAuth),
  ותיעוד מפורש למה `WORKSPACE_ALLOWED_SYSTEMS` נשאר `*` (זהות גוגל משותפת → ה-bearer הוא הגבול;
  נעילה לפרויקט יחיד תחזיר 404 למערכות אחרות ולא מוסיפה אבטחה). הוכחה: `yamllint` ירוק +
  בדיקת ה-guard (עובר על לא-ריק, תופס ריק/רווחים).
- **שלב 2 — הוכחת חשיפת כלי-הכתיבה:** `scripts/google-mcp-smoke.py` — assertion חדש `[5b/6]`
  שמוודא ש-`update_drive_file` מופיע ב-`tools/list` החי (בדיקת **נוכחות בלבד** — אין `tool_call`
  הרסני שישנה את ה-Drive האמיתי), + עדכון ה-docstring. סוגר את הפער "presence-in-code ≠
  presence-in-runtime". הוכחה: `python3 -m py_compile` ירוק; אין קריאת-כתיבה ל-`update_drive_file`.
- **שלב 3 — תיקון הערה ישנה:** `scripts/render-mcp-service-yaml.sh` — ההערה על ה-`workspacemcp`
  sidecar שאמרה "Single-user, read-only (v1)" תוקנה ל-WRITE-enabled, מיושרת להערה הנכונה
  שכבר קיימת ליד `WORKSPACE_MCP_READ_ONLY="0"`. הוכחה: `shellcheck` ירוק.
- **שלב 4 — תיעוד:** `docs/google-identities.md` קיבל תת-פרק "Drive write tools exposed to
  claude.ai" (כלי `update_drive_file` יחיד: סל הפיך/העברה/שינוי-שם/עריכת-Google-native בלבד;
  השער = `OAUTH_ALLOWED_EMAILS`=Or; ⚠️ לכבות ב-Research; צמצום כלים מסוכנים ב-UI של claude.ai;
  אסור לגעת ב-scopes; הקשחה עתידית = Service Account ממוקד-תיקייה). `CLAUDE.md` קיבל הערה
  תמציתית ליד פסקת ה-Workspace sidecar + עדכון "6-step" שמציין גם את בדיקת `update_drive_file`.
  אזהרה קריטית שנשמרה: לא נגענו ב-`WORKSPACE_MCP_SCOPES` (שינוי scopes שובר את חוזה ה-byte-equal
  מול `WORKSPACE_SCOPES` ב-`google-oauth.ts` → "Scope has changed").
- **סיכום:** היכולת כבר חיה בשרת הרץ (הכלי טעון דרך `--tools drive`, השער מכוון ל-Or) — **אין
  צורך ב-redeploy**. ההוכחה החיה: ריצת `google-mcp-smoke.yml` על `main` (ה-WIF נעוץ ל-main)
  שמראה `[5b/6]` ירוק. שינויי-ה-UI שנותרו ל-Or: לחבר connector ל-`/workspace/<system>/mcp`,
  לצמצם כלים מסוכנים, ולכבות כלי-כתיבה ב-Research.
