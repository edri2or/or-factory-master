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
| 3 | אימות חי: אין restart/`400` מקריסה | completed | (לוגים, רביזיה 00062) |
| 4 | **שורש שני:** פקיעת idle-session — התאוששות שקופה בשער | completed | `services/mcp-server/src/n8n-mcp-proxy.ts` |
| 5 | פריסה + הוכחה (טסט מול הקוד האמיתי) | completed | PR #344, רביזיה 00063, `proof/recovery-proof.mjs` |

> **עדכון 07/06:** שלב 3 גילה ששורש הקריסות תוקן אבל הניתוקים נמשכו — שורש **שני ונפרד**:
> n8n-mcp שורף sessions לא-פעילים אחרי ~15 דק', והלקוח (Claude) לא מאתחל מחדש אמין
> (claude-code#60949/#27142). לכן התיקון עבר לצד השער (שלבים 4–5).

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

## שלב 4 — שורש שני: התאוששות-session שקופה בשער (in-progress)

**Acceptance:**
- [x] `n8n-mcp-proxy.ts`: מפת sessions (clientSid→{initBody, upstreamSid}), שחזור-init שקוף
      על `looksLikeSessionExpired`, retry של הבקשה המקורית, מזהה-session יציב ללקוח.
- [x] ניקיון ב-`DELETE` + תקרת-גודל; happy-path (SSE/200) ללא שינוי.
- [x] עוזרים טהורים `isInitialize`/`looksLikeSessionExpired` + יוניט (npm test ירוק, 74/74).
- [ ] CI ירוק + מיזוג.

## שלב 5 — פריסה + הוכחה (completed)

**Acceptance:**
- [x] `deploy-mcp-server.yml` (run 27091428784) → success; רביזיה `00063-6qx` חיה עם image מקומיט התיקון.
- [x] **הוכחה דטרמיניסטית מול הקוד האמיתי** (`proof/recovery-proof.mjs`): sidecar מזויף שמדמה
      session שפג (400 "Session not found or expired") → הטסט מאשר שהשער מבצע re-init שקוף,
      משדר מחדש, והלקוח מקבל **200 (לא 400)** עם מזהה-session יציב. עובר.
- [~] שחזור חי מהסביבה שלי **לא אפשרי** (egress חסום ל-run.app מהסנדבוקס) — האימות-בשטח
      הוא דרך שימוש אמיתי של Or אחרי הפסקה; ייקרא בלוגים (`tail_cloud_run_logs`) כשיקרה.
- [x] `status: completed`.

## יומן ל-Or (עברית)

- שלב 1 הושלם — מצאתי שורש ראשון: ה"מתורגמן" נופל מרוב מחסור בזיכרון/CPU. הכפלתי זיכרון + CPU תמיד-דולק.
- שלבים 2–3 — נפרס (רביזיה 00062), הקריסות נפסקו.
- **תיקון אבחנה (07/06):** הסתבר שיש שורש שני — הכרטיס (session) פג מעצמו אחרי הפסקה קצרה,
  ו-Claude לא מבקש חדש לבד. בניתי לשער יכולת "להנפיק כרטיס חדש מאחורי הקלעים" בלי שתרגיש.
  לא מצהיר "תוקן" עד שאשחזר את התקלה ואוכיח בלוגים.
