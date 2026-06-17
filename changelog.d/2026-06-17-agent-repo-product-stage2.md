## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 2: תבניות המוצר + golden

לאחר שה-walking-skeleton הוכח חי (שלב 1, verdict `go`), נבנות תבניות-המוצר האמיתיות + שומר
אינטגריטי (golden) מקביל. Or הכריע שערוץ ה-requester הוא **קבצים** (לא GitHub issues), אז המוצר
נבנה סביב ההחלטה הזו (אפס שינוי-הרשאות ל-App המרכזי).

- **`templates/agent-repo/` (חדש) — ה-mould של ריפו-סוכן** (4 קבצי-ליבה, מראה של `templates/system/`):
  - `CLAUDE.md.template` — מצביע דק `@AGENTS.md`.
  - `AGENTS.md.template` — מסמך-האוריינטציה של ריפו-סוכן: מי זה Or, מה הריפו, איך הוא מקבל עבודה
    (ה-broker מ-dispatch את `agent-main.yml` עם task+correlation_id), איך הוא רץ (Claude קריאה-בלבד
    דרך דלת-ה-WIF המשותפת, אפס סוד קבוע, המשימה כדאטה לא-מהימנה), איך התוצאה חוזרת (artifact →
    ה-broker כותב `results/<corr>.json` ל-requester), חיבור ה-MCP (factory read-only), ואיסורים.
    placeholders: `${AGENT_REPO_NAME} ${REPO_URL} ${ISO_TIMESTAMP} ${GITHUB_RUN_ID} ${GITHUB_RUN_URL} ${AGENT_NAME} ${AGENT_PURPOSE}`.
  - `.mcp.json.template` — server `factory` בלבד (`/mcp`, read-only); אין n8n, אפס סודות.
  - `.github/workflows/agent-main.yml` — ה-worker, מקודם מ-`spikes/agent-skeleton/` (גנרי, ללא placeholders).
- **golden אינטגריטי מקביל** (תאומים של מנגנון ה-system golden):
  - `scripts/render-agent-repo-golden.sh` — מרנדר את `templates/agent-repo/` עם allow-list דטרמיניסטי
    של 7 משתנים; קבצי-`*.yml` שאינם `.template` (ה-worker) מועתקים מילולית (ה-`${{ }}`/`${VAR}` נשמרים).
  - `scripts/check-agent-repo-golden.sh` — gate סטטי; `--update` מרענן.
  - `scripts/check-agent-repo-golden-sync.sh` — gate תאום: שינוי `templates/agent-repo/**` חייב לרענן
    את `tests/golden/agent-repo/**` (+ parity של allow-list מול ה-provisioner, פעיל משלב 3 כשהוא קיים).
  - `tests/golden/agent-repo/{MANIFEST.sha256,rendered/AGENTS.md,rendered/CLAUDE.md}` — ה-golden המקובע.
- **חיווט CI:** `check-agent-repo-golden.sh` ב-Playground tests (ליד ה-system golden), `check-agent-repo-golden-sync.sh`
  ב-Changelog gates (ליד ה-system golden-sync), ו-`templates/agent-repo/.github/workflows/` נוסף ל-yamllint.

החלטת-מוצר מתועדת: **ערוץ ה-requester = קבצים** (הוכח עדיף במשתלם/יציב/אמין; issues נשמרים כאופציית
נראוּת-אנושית עתידית בלבד). אין נגיעה ב-`templates/system/**` (ה-system golden לא נדרס).
