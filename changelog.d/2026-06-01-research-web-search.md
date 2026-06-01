### יכולת חיפוש ומחקר-אינטרנט לבוט הטלגרם (ברמת התבנית)

- **שלב 1 — כלי חיפוש Tavily בסוכן המחקר + ההתקנה.** סוכן המחקר של הבוט
  (`templates/system/workflows/n8n/research-agent.json`) קיבל יכולת חיפוש-אינטרנט. ה-node
  "Research Reply" הומר מ-`@n8n/n8n-nodes-langchain.chainLlm` (1.5) ל-
  `@n8n/n8n-nodes-langchain.agent` (2.2) כדי לתמוך ב-tool-calling (השם נשמר כדי לא לשבור את
  ה-strip של "Read Style Profile"). נוספו שני כלי `toolHttpRequest` (POST ל-
  `https://api.tavily.com/search`): `web_search_quick` (`search_depth=basic`, `max_results=5`)
  ו-`web_search_extended` (`search_depth=advanced`, `max_results=10`), שניהם מאומתים דרך
  credential httpHeaderAuth `@@CRED_TAVILY_ID@@` ומחוברים ב-`ai_tool` לסוכן. ה-system-prompt
  תוקן: המשפט "no web-search or browsing tool" הוסר, ונוספו הוראות מתי להשתמש בכל כלי, איסור
  המצאת URLs, וסימון מקורות בבלוק `[[SOURCES]]` ייעודי בסוף (קישורים מלאים, ייחודיים).
- **התקנה ב-`configure-agent-router.yml`:** נוסף credential "Tavily (factory-master)"
  (httpHeaderAuth, `Authorization: Bearer <tavily-api-key>`) בדפוס "Railway API (Bearer)";
  `CRED_TAVILY_ID` נלכד והוזרק ל-research-agent בלולאת ה-sub-agents; נוסף strip
  graceful-degradation שמסיר את שני כלי החיפוש (ו-connections) כש-`tavily-api-key` חסר ב-SM,
  כך שהסוכן עדיין עונה מהידע הפנימי. הסוד מופץ אוטומטית לכל מערכת חדשה דרך
  `copy-generic-secrets.sh` (דינמי; אינו ב-EXCLUDE). golden רוענן.
- **שלב 2 — תיקון Egress (בלוק "מקורות" לא נחסם).** ה-node "Egress Validation" ב-
  `templates/system/workflows/n8n/agent-router.json` שודרג: בלוק `[[SOURCES]]` בסוף תשובת-מחקר
  פטור מ-redaction של ה-allowlist — הקישורים המלאים שורדים, מנוקים מפיסוק נגרר, מנוכי-כפילויות,
  מוגבלים ל-10, ומוצגים תחת כותרת "מקורות:". **גוף** התשובה ממשיך להיחסם במלואו לפי ה-allowlist
  הקיים (`or-infra.com|openrouter.ai|n8n.io|github.com|railway.app|railway.com`); חסימת
  `exec/eval`, ה-strip של `<script>` ותקרת 4000 התווים נשמרו (התקרה מקצצת את הגוף תוך שמירת
  בלוק המקורות). תשובות ללא marker מתנהגות בדיוק כמקודם (אפס רגרסיה). אומת ב-Node על 3 מקרים
  (מקורות, ללא-marker, exec). golden רוענן.
- **סבב 2 — תיקון חוויה (אחרי אימות חי).** אימות חי על מערכת טרייה הראה 3 כשלים: (1) רק
  `research-agent` קיבל חיפוש, אז הודעות שנותבו ל-`unknown-agent` (סוכן-השיחה הכללי) ענו "אין לי
  גלישה" — "פיצול אישיות"; (2) `research-agent` על `claude-haiku-4.5` סיכם תוצאות שגוי; (3) הבוט
  חשף שמות-כלים פנימיים. תיקון: ל-`templates/system/workflows/n8n/unknown-agent.json` נוספו אותם
  שני כלי Tavily (`web_search_quick`/`web_search_extended`, credential `@@CRED_TAVILY_ID@@`) +
  connections `ai_tool`, וה-system-prompt עודכן (סעיף WEB SEARCH, בלוק `[[SOURCES]]`, איסור
  לטעון "אין לי גלישה", ואיסור לחשוף שמות-כלים). `templates/system/workflows/n8n/research-agent.json`
  עלה ל-`anthropic/claude-sonnet-4.5` וה-prompt הודק (היצמד לתוצאות, אל תחשוף שמות-כלים). ב-
  `configure-agent-router.yml` ה-strip של ה-web-search הורחב לכסות גם `unknown-agent.json`
  (ה-sed של `@@CRED_TAVILY_ID@@` כבר חל על כל הסוכנים). golden רוענן.
- **כלי תומך — `refresh-system-agents.yml` (לולאת אימות חי זולה).** נוסף workflow פקטורי
  (`workflow_dispatch(system_name, run_configure)`) שמחיל תיקון-תבנית על מערכת קיימת **בלי
  re-provision**: הוא ממנה broker App token מצומצם לריפו-היעד (contents+actions write),
  משכפל אותו, מעתיק את `templates/system/workflows/n8n/*.json` מ-main המהימן, דוחף ישירות
  ל-main של המערכת (כמו ה-scaffold של provision; `enforce_admins:false` + broker=admin),
  ואז מפעיל את `configure-agent-router.yml` של המערכת לייבוא מחדש ל-n8n החי. מסרב לריפו
  control/factory, מאמת תבנית-שם, ואידמפוטנטי (אין diff → אין push). נוסף ל-allowlist של
  `dispatch_workflow` ב-`services/mcp-server/src/tools.ts` כדי שהסוכן יוכל להפעילו (דורש
  redeploy של ה-MCP כדי שייכנס לתוקף). זהו "דפוס טסט-030": סבב תיקון ≈ 2 דקות, 0 קליקים,
  0 עלות חדשה, והדרך היחידה לתפוס באגים שה-CI מפספס (תקלות שמתגלות רק חי).
- **תיקון `refresh-system-agents.yml`:** דחיפה ישירה ל-`main` של מערכת קיימת נדחית ע"י הגנת-הענף
  (`GH006: Protected branch update failed` — App אינו admin-bypass). הכלי שונה לדפוס PR: יוצר ענף,
  מוסיף פתק `changelog.d` (כדי לעבור את "Changelog gates" של המערכת), פותח PR, ממתין ל-CI של
  המערכת (`gh pr checks --watch --fail-fast`), ממזג (`gh pr merge --squash`), ואז מפעיל
  `configure-agent-router`. הטוקן הורחב ל-`pull_requests:write`.
