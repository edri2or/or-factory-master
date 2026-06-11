## תיקון ההרצה של file-catalog (אותו דפוס-n8n-2.x כמו db-setup) (file-catalog-run-fix)

המשך ישיר של `bot-trace-observability` (PR #382). ב-`templates/system/.github/workflows/configure-agent-router.yml`,
בלוק ה-seed של `file-catalog-refresh` הריץ את הוורקפלו עם body שבור של n8n-2.x —
`{"destinationNode":{"nodeName":"Upsert Catalog"}}` — שמריץ רק את הטריגר `Hourly` ועוצר, כך
ש-`Upsert Catalog` לעולם לא רץ והטבלה `file_catalog` לא נזרעת בהקמה, אבל `/run` מחזיר 200
("PASS" שקרי). זה היה המופע האחרון של דפוס-`{destinationNode}` השבור בריפו (db-setup תוקן ב-#382;
grep מאשר ששניהם היחידים).

- **התיקון (מירור מדויק של בלוק db-setup, שורות 578–601):** הבלוק שולח עכשיו את ה-body המוכח
  `{"workflowData":<file-catalog-refresh המלא>,"runData":{},"triggerToStartFrom":{"name":"Hourly"}}`
  (שם-הטריגר כאן הוא `Hourly`, לא "Run Once"), עם fallback ל-`{"triggerToStartFrom":{"name":"Hourly"}}`,
  ומאמת דרך helper `_fcat_ok` ש-`lastNodeExecuted == "Upsert Catalog"` — לא HTTP 200 לבד. נשען על
  שתי עובדות מאומתות מ-`file-catalog-refresh.json`: השרשרת לינארית `Hourly → … → Upsert Catalog`,
  ו-`Upsert Catalog` הוא הצומת הסופי.
- **שתי התאמות מכוונות מול db-setup (מוצדקות בשרשרת הארוכה יותר):** (1) **poll** של עד 6×4ש'
  (~24ש') במקום `sleep 3` יחיד, כי file-catalog-refresh קורא ל-GitHub API (Mint Installation Token,
  Fetch Tree) ולוקח יותר זמן מ-db-setup בן 2 הצמתים; (2) **סינון נוקשה לפי `workflowId` בלבד** (בלי
  ה-fallback הלא-מסונן של `_db_ok`), כי file-catalog רץ *אחרי* db-setup באותה הרצת configure — סינון
  נוקשה + ה-poll (שמתגבר על eventual-consistency) לא יכול לקרוא את ההרצה של db-setup בטעות.
- **השפעה:** מתון. הוורקפלו מותקן `active` עם cron שעתי (`0 * * * *`), אז גם בלי התיקון הטבלה
  מתמלאת לבד עד שעה אחת באיחור — התיקון רק זורע אותה מיד בהקמה (resolver של הקבצים עובד מדקה 0) +
  מדווח PASS מאומת במקום 200 שקרי. מגיע למערכות חדשות בלבד (שינוי-תבנית).
- **golden** רוענן (`tests/golden/system/MANIFEST.sha256`) באותו PR. **מסלול קל** (בבחירת Or):
  הוכחה-חיה על מערכת-טסט מוּוֶתֶרֶת (כמו #389) — נשען על השערים הסטטיים + דפוס שכבר הוכח חי
  (factory-test-061); אימות חי נדחה למערכת הבאה שתוקם.
