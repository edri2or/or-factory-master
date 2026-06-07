---
dev_name: יציבות ה-MCP של n8n — להפסיק את הניתוקים
slug: mcp-session-stability
opened: 2026-06-07
status: active
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
| 2 | מיזוג ל-main + פריסה מחדש (`deploy-mcp-server.yml`) | pending | (דיספאצ' workflow) |
| 3 | אימות חי: אין restart/`400`, אור עובד רצוף בלי ניתוק | pending | (לוגים + בדיקת אור) |

## שלב 1 — תיקון config (הושלם)

**Acceptance:**
- [x] `render-mcp-service-yaml.sh`: annotation `run.googleapis.com/cpu-throttling: "false"`.
- [x] sidecar `memory: 512Mi → 1Gi`.
- [x] YAML תקין (נבדק `yaml.safe_load_all`) + shellcheck נקי.

**הערת התקדמות:** השינוי בוצע ומאומת מקומית מול ה-gates. ממתין למיזוג ופריסה.

## שלב 2 — פריסה מחדש (ממתין)

**Acceptance:**
- [ ] PR מוזג ל-main.
- [ ] `deploy-mcp-server.yml` רץ → `success`; `/health=200`.
- [ ] `inspect_cloud_run` → רביזיה חדשה חיה.

## שלב 3 — אימות חי (ממתין)

**Acceptance:**
- [ ] `tail_cloud_run_logs` לאורך זמן → **אין** `Database initialized` חוזר באמצע חיי הרביזיה
      (=אין restart) ו**אין** `400` של session-expired.
- [ ] אור עובד מול `mcp-tok` רצוף בלי ניתוק.
- [ ] בסגירה: `status: completed`.

## יומן ל-Or (עברית)

- שלב 1 הושלם — מצאתי את השורש: ה"מתורגמן" של n8n נופל וקם כי הוקצה לו מעט מדי זיכרון
  וה-CPU שלו נחנק. הכפלתי לו את הזיכרון ונתתי לו CPU שתמיד דולק, כדי שלא ייפול יותר באמצע.
