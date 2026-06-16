## התרעת-טוקן Google אוטומטית (workspace-token-audit)

נוסף `.github/workflows/workspace-token-audit.yml` — heartbeat יומי (06:30 UTC) + dispatch ידני
לטוקן Google המשותף. מריץ את `scripts/google-mcp-smoke.py` החי מול ה-gateway; בהצלחה פולט
`factory.workspace_token.ok` (info → Axiom), ובכשל (הטוקן לא מתרענן — בדרך-כלל בוטל בעקבות שינוי
סיסמת Google שמבטל טוקנים עם הרשאות Gmail) שולח ל-Or **טלגרם עברי ברור אחד עם תיקון 3-שלבי**
(`request-workspace-scopes-consent.yml` → לחיצה על הלינק → `deploy-mcp-server.yml`) ופולט
`factory.workspace_token.revoked` (info + action_required → Axiom + Linear) דרך `scripts/emit-event.sh`.
ה-severity הוא `info` בכוונה כדי ש-`emit-event.sh` לא ישלח טלגרם גנרי כפול — ההתרעה האנושית היא
הטלגרם המותאם. ה-audit הוא soft (exit 0; שבירת-טוקן לא צובעת את הריצה באדום). מנגנון ה-WIF/auth
וקריאת ה-admin-secret מועתקים מ-`google-mcp-smoke.yml`; שלד ה-schedule/emit מ-`factory-health-audit.yml`.

בנוסף, תוקן באג קטן ב-`deploy-mcp-server.yml` (משלב `connector-url-clear`): בדיקת ה-drift של
ה-issuer השתמשה ב-`grep -E '^EXPECTED_CONNECTOR_ISSUER='` מעוגן, שלא תפס את השורה במסמך (עטופה
בגרשיים) — הוחלף ל-`grep -oE 'EXPECTED_CONNECTOR_ISSUER=https://[^\` ]+'` סובלני, כך שה-guard באמת
משווה את ה-issuer החי מול המתועד. עודכנו `CLAUDE.md` (שורת workflow) ו-`docs/google-identities.md`
(runbook לחידוש הטוקן + למה `DEPLOY_NONCE` מבטיח שהחידוש נטען).
