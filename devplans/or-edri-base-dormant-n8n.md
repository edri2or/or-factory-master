---
dev_name: or-edri-base — מערכת מלאה עם n8n רדום ברקע
slug: or-edri-base-dormant-n8n
opened: 2026-07-13
status: completed   # הוקם, נפרס ואומת; n8n חי אך רדום (לא הורץ configure-agent-router)
---

# תוכנית פיתוח — or-edri-base (n8n רדום, לא המרכז)

## מטרה

Or ביקש מערכת **מלאה** מהסוג הרגיל של הפקטורי — עם פרויקט GCP + Secret Manager + שרת
Railway + דומיין Cloudflare — אבל שבה **n8n קיים ברקע ואינו "המערכת החיה" / המרכז**. כרגע
לא רץ עליו כלום; הוא זמין ל-Or לבנות בו workflows בעתיד, כשהוא יחליט. בניגוד למערכות קודמות
ש-n8n היה בהן הלב, פה הוא רכיב רדום.

**הושג בלי לשנות את הפקטורי:** provision + deploy הן יכולות קיימות שרק דוּוְחו; נקודת העצירה
היא *לא להריץ* `configure-agent-router.yml` (השלב שהופך את n8n ל"מוח החי").

## מה נעשה (מאומת)

| # | פעולה | סטטוס | תוצאה מאומתת |
|---|---|---|---|
| 1 | provision (מצב רגיל, פרויקט GCP חדש) | completed | `provision-system.yml` ריצה [29274163687](https://github.com/edri2or/or-factory-master/actions/runs/29274163687) → success. `verify_gcp_system`: 11/11 עברו, פרויקט `or-edri-base` ACTIVE. `list_system_secrets`: 75 סודות (כולל `railway-api-token`, `cloudflare-*`). |
| 2 | deploy (n8n + Postgres + Caddy + Cloudflare) | completed | `deploy-railway-cloudflare.yml` בריפו המערכת ריצה [29275361711](https://github.com/edri2or/or-edri-base/actions/runs/29275361711) → success. דוּוְח דרך עטיפת `refresh-system-agents.yml` (dispatch ישיר לריפו המערכת חסום בסשן web). |
| 3 | אימות חיוּת | completed | `probe_endpoint` על `https://n8n-or-edri-base.or-infra.com/healthz` → **200** `{"status":"ok"}`. |
| 4 | השארת n8n רדום | completed | **לא** הורץ `configure-agent-router.yml` → אין Agent Router, אין בוט טלגרם, אין ניתוב. |

## מצב n8n (מאומת, `list_n8n_workflows`)

n8n מכיל **2 workflows דמו** שה-deploy יוצר אוטומטית — `factory-master: n8n ready notifier`
ו-`factory-master: OpenRouter auto-router demo` (webhook על נתיב אקראי, לא-פעילים-בפועל).
מניעה/מחיקה נקייה מהסשן הזה חסומה (אין כלי מחיקת-n8n ב-MCP; חיבור n8n ישיר לא מחובר).
**החלטת Or: להשאיר את השניים** — n8n רדום למעשה. (הערת-אמת: הערכה מוקדמת ש-notifier ידלג
הופרכה בבדיקה — הקוד יוצר אותו גם בלי bot-token; רק השליחה מדולגת.)

## שמירה על "בלי לגעת בפקטורי"

- לא שונו `templates/system/**`, `provision-system.yml`, או קוד/וורקפלו של הפקטורי.
- ה-deploy רץ בתוך הריפו של המערכת; העטיפה (`refresh-system-agents.yml` עם no-op +
  `post_merge_workflow=deploy-railway-cloudflare.yml`) היא יכולת קיימת, לא שינוי.

## יומן ל-Or (עברית)

- הוקמה מערכת מלאה `or-edri-base`: פרויקט GCP + ניהול סודות + שרת Railway + דומיין Cloudflare,
  עם n8n **חי אבל רדום** ברקע (לא המרכז). n8n מוכן ליום שתרצה לבנות בו — אתה מחליט מתי.
