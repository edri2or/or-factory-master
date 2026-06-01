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
