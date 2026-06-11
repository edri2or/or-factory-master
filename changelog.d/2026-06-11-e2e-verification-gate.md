## בלם אימות E2E אכיף (e2e-verification-gate) — שלב 1: מחקר ותיעוד הפער

סוכן הכריז "מאומת חי" על סמך לוג קונפיגורציה בלבד (`tools/list`) והמשיך לשלב הבא בלי
לשלוח הודעה אמיתית דרך מסלול ה-`Telegram → agent-router` ולבדוק תשובה — בדיוק דפוס
ה"כשל השקט" שגרם לבאג המקורי. השלב הזה ממפה היכן בפקטורי "ריצה ירוקה" מתחזה ל"הפיצ'ר
עובד", מתעד את הסטנדרט המקצועי לאכיפת E2E (עם מקורות מתוארכים), ומגדיר את ארכיטקטורת
הבלם (driver שמריץ התנהגות אמיתית → proof חתום → שער אכיף ברמת השרת).

**Changes:**
- `docs/e2e-verification-gate.md` — מסמך הייחוס: מפת "ירוק מתחזה לעובד" (עם ציטוטי
  `configure-agent-router.yml` / `docs/live-test-loop.md` / smoke workflows), הסטנדרט
  המקצועי המתוארך, שלושת רכיבי הבלם, וה"מבחן-העל".
- `devplans/e2e-verification-gate.md` — תוכנית הפיתוח החיה (6 שלבים, `/dev-stage-factory`).

## שלב 2 — ה-driver (`scripts/e2e-verify-inbound.sh`)

מנוע ההוכחה ההתנהגותי: שולח Telegram update סינתטי ל-`/webhook/telegram-in/inbound`
האמיתי (עם header הסוד), ואז — כי ה-webhook הוא `onReceived` (200 = "התקבל", לא "עובד")
— עושה poll ל-n8n Public API, מוצא את ה-execution לפי nonce, ומאמת **התנהגות**: הריצה
הסתיימה בהצלחה, **אף node לא נכשל** (תפיסת "כשל שקט"), והתשובה לא ריקה ולא נראית כשגיאה
(ועם `EXPECT_SUBSTR` — מכילה טוקן מצופה). הסקריפט generic וסוד-אגנוסטי (ה-workflow מזריק
סודות ב-env; לעולם לא מדפיס ערכים). shellcheck נקי; נבדק מקומית על execution סינתטי.

**Changes:** `scripts/e2e-verify-inbound.sh` (חדש).
