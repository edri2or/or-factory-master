# /new-system — יכולת חוזרת להקמת מערכת אחות נקייה

נוספה הפקודה `/new-system` (`.claude/commands/new-system.md`) + התשתית שמאחוריה, שמתעדת ומתעשת את
התהליך המדויק שבו נבנתה `or-agents` — כדי שהקמת מערכת אחות חדשה תהיה חוזרת, בלי לחקור מחדש ובלי
לגלות שוב את אותם באגים. Or ביקש את היכולת החוזרת (2026-07-19), ולכן המנוע נשמר בריפו (מסגור
ה"one-time / delete after" הקודם בוטל).

**הרכיבים:**
- **`.github/workflows/bootstrap-system-infra.yml`** (הוחזר כקבוע) — המנוע: יוצר פרויקט GCP + WIF +
  runtime/deploy SAs + מעתיק סודות גנריים + מנפיק OpenRouter key + bearers + runtime shells + משתני-ריפו.
  `workflow_dispatch` בלבד, עם preflight שמסרב לרוץ אם הפרויקט כבר קיים (dispatch בטעות = no-op בטוח).
- **`scripts/copy-generic-secrets.sh`** (הוחזר) — העתקת הסודות הגנריים מ-control (עם regex החרגה לזהויות-על).
- **`templates/new-system/`** — תבנית-זהב **קפואה** של קבצי היסוד, מהגרסאות ה**מתוקנות** ב-or-agents main:
  ה-deploy workflow עם `force_caddy_redeploy` + `latestCommit:true`, וה-Caddyfile עם תיקון `GPT_BRIDGE_TOKEN`.
  placeholders: `__SYSTEM_NAME__`, `__GCP_PROJECT_NUMBER__`.
- **`.claude/commands/new-system.md`** — ה-playbook: הרצף המלא (תשתית→יסוד→פריסה→הוכחה), המהמורות
  המוטבעות (propagation, WIF≠gcp-action, Caddy latestCommit, GPT_BRIDGE_TOKEN), נקודות אישור-Or, ומה נדחה לכל מערכת (GitHub App, תכנון סוכנים).

**למה תבנית קפואה ולא הפניה ל-or-agents:** or-agents היא מערכת חיה ש-Or יפתח בה סוכנים וישנה קבצים —
הפניה אליה כ"template" שבירה. תבנית קפואה יציבה וחסינה לסחף.

**היקף:** זהו חידוש רזה ומכוון, לא החייאת מכונת-הייצור הישנה — playbook אחד להקמת **מערכת אחת** נקייה
שממחזרת את ה-backbone המשותף. לא מריצים אותו עכשיו (הרצה אמיתית = מערכת עם עלות); האימות האמיתי בפעם הבאה.
