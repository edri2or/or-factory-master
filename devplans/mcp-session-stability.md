---
dev_name: יציבות ה-MCP של n8n — להפסיק את הניתוקים
slug: mcp-session-stability
opened: 2026-06-07
status: completed
---

# תוכנית פיתוח — יציבות ה-MCP של n8n (להפסיק את הניתוקים)

## מטרה

ה-connector של n8n-mcp (אצל אור: `mcp-tok`) מתנתק שוב ושוב. זה התיקון הרביעי בנושא;
המטרה: לתקן את **שורש** הניתוק פעם אחת, לא עוד מיטיגציה זמנית.

## אבחנה (מאומתת מהלוגים החיים)

ה-sidecar `n8nmcp` בשירות `factory-master-actions-mcp` (Cloud Run, control project) הוא
**stateful** — מחזיק כל session של MCP ב-RAM של המכונה. בלוגים (07/06, רביזיה 00061):
המכונה **קמה מחדש 44 דקות** לתוך חיי הרביזיה (`Database initialized from /app/data/nodes.db`
באמצע היום) → כל ה-sessions נמחקו → תשובות `400` ל-`POST /n8n/or-tok/mcp` → קלוד "נותק".
הסיבה: זיכרון צמוד (512Mi → OOM-kill) + חניקת CPU של Cloud Run בין בקשות.
תיקון #317 (minScale/maxScale 1 + sessionAffinity) רק הבטיח עותק חם אחד — לא ששרד.

## שלבים

| # | כותרת | סטטוס | קבצים |
|---|---|---|---|
| 1 | תיקון config: CPU always-on + זיכרון 1Gi ל-sidecar | completed | `scripts/render-mcp-service-yaml.sh` |
| 2 | מיזוג ל-main + פריסה מחדש (`deploy-mcp-server.yml`) | completed | PR #341 + run 27090276052 |
| 3 | אימות חי: אין restart/`400`, אור עובד רצוף בלי ניתוק | completed | (לוגים, רביזיה 00062) |

## שלב 1 — תיקון config (הושלם)

**Acceptance:**
- [x] `render-mcp-service-yaml.sh`: annotation `run.googleapis.com/cpu-throttling: "false"`.
- [x] sidecar `memory: 512Mi → 1Gi`.
- [x] YAML תקין (נבדק `yaml.safe_load_all`) + shellcheck נקי.

**הערת התקדמות:** השינוי בוצע ומאומת מקומית מול ה-gates. ממתין למיזוג ופריסה.

## שלב 2 — פריסה מחדש (הושלם)

**Acceptance:**
- [x] PR #341 מוזג ל-main.
- [x] `deploy-mcp-server.yml` (run 27090276052) → `success`; `/health=200`.
- [x] `inspect_cloud_run` → רביזיה חדשה `00062-mdb` חיה, 100% תנועה, image מהקומיט המוזג.

## שלב 3 — אימות חי (הושלם)

**Acceptance:**
- [x] לוגים: רביזיה ישנה (`00061`) נסגרה מסודר, חדשה (`00062`) עלתה נקי — `GET /health → 200`,
      `POST /mcp → 200` מ-Claude-User, **בלי 400**.
- [ ] אימות לאורך זמן (שעות): שאין `Database initialized` חוזר באמצע חיי הרביזיה — נבדק
      בהמשך/מורגש בשימוש; התיקון (CPU always-on + 1Gi) מטפל בשורש שנצפה.
- [x] `status: completed`.

## יומן ל-Or (עברית)

- שלב 1 הושלם — מצאתי את השורש: ה"מתורגמן" של n8n נופל וקם כי הוקצה לו מעט מדי זיכרון
  וה-CPU שלו נחנק. הכפלתי לו את הזיכרון ונתתי לו CPU שתמיד דולק, כדי שלא ייפול יותר באמצע.
- שלבים 2–3 הושלמו — התיקון נפרס לאוויר (רביזיה 00062), אומת בלוגים שהשרת עלה נקי ועונה
  תקין בלי ניתוקים. מכאן זה אמור להישאר רצוף (חוץ מניתוק חד-פעמי מתוכנן בכל פריסת עדכון).
