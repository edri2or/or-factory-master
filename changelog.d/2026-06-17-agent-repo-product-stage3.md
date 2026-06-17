## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 3: ה-provisioner

ה"כפתור" שיוצר ריפו-סוכן מהתבנית — החצי-GitHub-בלבד של provision-system.yml, בלי GCP/n8n/Railway/Caddy.

- **`.github/workflows/provision-agent-repo.yml` (חדש)** — מופעל על or-factory-master (WIF, main-locked,
  כ-broker SA). קלטים: `agent_repo_name`, `agent_name`, `agent_purpose`. (1) יוצר ריפו פרטי דרך
  ה-broker App (`POST /orgs/edri2or/repos`, idempotent); (2) מרנדר את `templates/agent-repo/*.template`
  דרך envsubst עם allow-list **זהה-בייט** ל-`render-agent-repo-golden.sh` (שער ה-parity אוכף זאת),
  ודוחף את ה-scaffold ל-main (ריפו טרי בלי הגנה; push ישיר, token מתוחם עם retry להשהיית-קליטה);
  (3) קושר את הריפו החדש לדלת-ה-WIF המשותפת ע"י שימוש-חוזר אידמפוטנטי ב-`bootstrap-agent-repo-identity.sh`,
  כך שה-`agent-main.yml` שלו יכול לאמת ולקרוא את `anthropic-api-key` בלי סוד קבוע. מסרב שמות control/factory.
- **`monitoring/registry-exempt.txt`** — `provision-agent-repo.yml` נוסף (dispatch-only, אין cadence).

**שינוי תוכנית מתועד — הגנת-main קשוחה נדחתה:** ה-broker מחזיר תוצאה ע"י כתיבת `results/<corr>.json`
ישירות ל-main של ריפו-המבקש (contents). הגנת PR+CI קשוחה הייתה חוסמת את הכתיבה הזו (ה-broker אינו admin
בריפו-סוכן), וצריך נתיב-כתיבה תואם-broker (ref ייעודי או PR ב-0-contexts) — זה hardening נפרד. ה-MVP
משאיר main של ריפו-סוכן כתיב (הריפו פרטי), עם תיעוד מפורש. אין נגיעה ב-`templates/system/**` ולא
בקבצי-התנהגות-בוט.
