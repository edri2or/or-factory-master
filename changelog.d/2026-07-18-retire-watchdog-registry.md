## פירוק הפנקס watchdog-registry + שער-ה-CI שלו (קטלוג בלי מנוע)

בקיפול המפעל נמחק המנוע היומי שהריץ את הפנקס `watchdog-registry.json` (meta-monitoring-watchdog +
run-watchdog + ה-heartbeat — אצוות 1/5א). נשארו הפנקס עצמו, `registry-exempt.txt`, ושער-ה-CI
`check-watchdog-registry-updated.sh` — כלומר קטלוג שאיש כבר לא מריץ, ושער שמכריח לתחזק אותו. עכשיו הם מפורקים.

- **נמחקו:** `monitoring/watchdog-registry.json`, `monitoring/registry-exempt.txt`, `monitoring/README.md`
  (התיקייה `monitoring/` רוקנה), `scripts/check-watchdog-registry-updated.sh`, והטסט
  `scripts/tests/check-watchdog-registry-updated.bats`.
- **`.github/workflows/changelog-check.yml`:** הוסר הצעד "Check watchdog registry updated". ה-job
  `Changelog gates` (context נדרש ב-protect-main) נשאר עם 3 שעריו האחרים — protect-main לא נשבר.
- **`CLAUDE.md`:** הוסרו ההפניות ל-`check-watchdog-registry-updated.sh` (רשימת ה-CI gates + טבלת key-files).
- **מה נאבד:** המשמעת "כל workflow עם cron/hook חדש חייב להירשם בפנקס". מאחר שאיש לא הריץ את הפנקס,
  זו הייתה תחזוקה ללא צרכן.
- לא נגעו: 3 שערי ה-Changelog האחרים, `lib.sh`, protect-main, וכל היסטוריית devplans/changelog.
