# set-repo-visibility — utility אוטומטי לשינוי נראות-ריפו דרך ה-broker App

נוסף workflow חדש `.github/workflows/set-repo-visibility.yml` שמאפשר לסוכן להפוך ריפו בארגון edri2or
לפרטי/ציבורי **אוטונומית**, בלי פעולה ידנית של Or. הצורך: or-aios נמצא ציבורי (בבדיקת `verify_github_system`),
ו-Or ביקש להפוך אותו לפרטי דרך מסלול אוטומטי. אין כלי-MCP שמשנה נראות, אבל ל-broker App יש כבר
`administration:write` (אותה הרשאה שבה `protect-main.yml` מיישם את ה-ruleset).

- **`workflow_dispatch` בלבד** (לא רץ אוטומטית), inputs: `repo` + `visibility` (private/public).
- דפוס זהה ל-`protect-main.yml`: WIF → broker SA → הנפקת token של ה-broker App דרך `scripts/generate-app-token.sh`,
  **מצומצם לריפו-היעד בלבד + הרשאת `administration` בלבד** (least-privilege), ממוסך (`::add-mask::`).
- מבצע `PATCH /repos/edri2or/<repo> {"private": …}`, ואז **מאמת בתוך ה-run** ב-`GET` שהשינוי אכן נכנס;
  כישלון רועש על HTTP≥300 (למשל אם מדיניות-ארגון חוסמת שינוי-נראות ע"י App) — מדפיס רק את שדה ה-message, לעולם לא את ה-token.
- אבטחה: WIF-only (אין מפתחות-SA), מפתח ה-App נמחק (`shred`) אחרי ההנפקה, ולעולם לא מודפס.

עלות: הפיכת ריפו לפרטי מתחילה לצרוך מכסת GitHub Actions (הובהר ל-Or). לא נוגע ב-gateway/backbone/מסלול גוגל.
