## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 0

פתיחת פיתוח מדורג (`/dev-stage-factory`) לטיפוס-מוצר **נוסף** בפקטורי: "ריפו-סוכן" — ריפו
פרטי קל (`CLAUDE.md`=@AGENTS.md + `AGENTS.md` + `.claude/` + `.mcp.json` + workflow דק), מופעל
ע"י Claude Code, ששולח/מקבל יחידות-עבודה מריפו-סוכנים אחרים אוטומטית ובבטחה דרך broker
מרכזי. בלי GCP/n8n/Railway. מודל ה-n8n הקיים ({reply}/agent-router) לא נוגעים בו.

שלב 0 הוא scaffolding-תיעוד בלבד (קבצי-md), ולכן אף שער-קוד (changelog/devplan/golden/
watchdog/doc-drift) לא מופעל מלבד שער ה-devplan שזה הקובץ שמשחרר אותו.

- **`devplans/agent-repo-product.md` (חדש, `status: active`)** — תיק-הפיתוח החי: מטרה, 6 שלבים
  (0–5), Acceptance + הוכחה-תפקודית פר-שלב, יומן ל-Or. מעוגן על **הצורה החיה** אחרי ה-drift:
  ה-broker = or-factory-master (ה-MCP + `agent-action.yml` בסגנון `gcp-action.yml`), בונים על
  `gcp-action.yml` + `publish-static-site` + ה-MCP — לא על repository_dispatch/issue-comment
  של `gcp-hands` (נמחק ב-PR #506). מצהיר במפורש: **יש יכולת חדשה**, לכן capability-first
  Step 0 לא מדולג — שלב 1 (walking-skeleton) הוא ההוכחה-החיה, לא `e2e-verify` של or-edri-4.
- **`docs/capability-cards/agent-broker-handoff.md` (חדש, skeleton, `verdict: pending`)** —
  כרטיס היכולת לפי תקדים `publish-static-site.md`: היכולת הגולמית (broker מנפיק token מתוחם →
  dispatch ל-worker → Claude headless read-only → תוצאה חוזרת דרך ה-broker), ה-fixture
  המתוכנן, הפלט המצופה, וקריטריוני ה-go/no-go. יתמלא בשלב 1 מהריצה החיה.

הפיתוח רץ על branch `claude/amazing-mayer-qnrm9x`; כל שלב costed (יצירת ריפו/הרצת Claude/
redeploy) נעצר לאישור Or — אף שרשור.
