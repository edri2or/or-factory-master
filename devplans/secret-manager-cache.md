---
dev_name: Cache ל-Secret Manager ב-gateway
slug: secret-manager-cache
opened: 2026-07-18
status: completed
---

# תוכנית פיתוח — Cache ל-Secret Manager ב-gateway

## מטרה

חשבון ה-Secret Manager על פרויקט-הבקרה עלה ~‎180 ₪/חודש, כש-~‎165 ₪ מזה הם פעולות-קריאה מיותרות
(~18 מיליון/חודש) — בעיקר נתיב ה-`/factory/:system/emit` שקורא 5 סודות בכל אירוע ללא cache.
המטרה: להוסיף cache-בזיכרון קצר-טווח בנקודת-המחנק היחידה (`getSecretValue`) ולחתוך את העלות ל-~‎15–30 ₪,
בלי לפגוע בשום פונקציונליות. חיסכון צפוי ~‎160 ₪/חודש.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | חקירת-אמת: פירוק אחסון-מול-קריאות + איתור הנתיב החם | completed | (חקירה בלבד — get_billing_costs, list_secret_metadata, מיפוי-קוד) |
| 2 | עטיפת `getSecretValue` ב-cache עם TTL של 60ש' (ערכים מוצלחים בלבד) | completed | `services/mcp-server/src/gcp-client.ts` |
| 3 | בדיקות-יחידה ל-cache (hit/miss/הפרדת-מפתח/אי-שמירת-שגיאות) | completed | `services/mcp-server/test/gcp-client-secret-cache.test.mjs` |

## החלטות מפתח

- **נקודת-מחנק אחת:** כל קריאות-הערך זורמות דרך `getSecretValue` (הקוראת היחידה של `:access`). cache שם תופס הכל.
- **TTL 60ש':** חותך את הנתיב-החם פי ~60; ערך גבוה יותר כמעט לא מוסיף חיסכון ומגדיל staleness.
- **ערכים מוצלחים בלבד ב-cache:** שגיאות ו-payload ריק זורמים ללא cache → `NotFoundError`/soft-fail נשמרים.
- **רעננות בטוחה:** סודות הנתיב-החם ארוכי-חיים; re-consent גורר revision חדש (`DEPLOY_NONCE`) → cache ריק.
- ה-sidecar (Python) ו-`mintSharedAccessToken` (כבר מטמן) — ללא שינוי.

## אימות (מקצה-לקצה)

1. ✅ בדיקות-יחידה: 5 חדשות + כל 124 עוברות מקומית (`npm test` = tsc + node --test).
2. ⏳ אחרי המיזוג/פריסה: `get_billing_costs` — Secret Manager על or-factory-master-control יורד מ-~‎180 ₪ ל-~‎15–30 ₪ (ההוכחה הסופית).
3. ⏳ אי-רגרסיה: `google-mcp-smoke` עובר, `list_n8n_workflows` מחזיר, emit עדיין מגיע ל-Telegram/Axiom/Linear.

## סטטוס

הקוד הושלם ונבדק. פורס אוטומטית עם המיזוג ל-main (`deploy-mcp-server.yml`, paths של `services/mcp-server/**`).
נותר רק לאמת את ירידת-החשבון בימים שאחרי הפריסה (שלב 2 באימות) — תצפית פסיבית, לא שלב-קוד.
