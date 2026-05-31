### כיסוי הצד-GitHub של מערכות בשומר-העל

- **שלב 1 — הגנת-ענף של כל מערכת בשומר המרכזי.** נוספה שיטת-הוכחה `system-branch-protection`
  ל-`scripts/run-watchdog.sh`: fan-out דינמי per-system (כמו `n8n-execution`) שמונה את
  המערכות האמיתיות (מדלג `factory-test-25`) ובודק שלכל מערכת הגנת-הענף על `main` עדיין
  אוכפת את כל 4 שערי-ה-CI (`evidence.required_contexts`). שער שהוסר → 🚨; מערכת לא-פתירה
  (אין repo/טוקן/שגיאת API) או 0 מערכות → ❓, לעולם לא 🚨. שימוש חוזר בלוגיקת קריאת
  ה-rules + מסנן ה-`required_status_checks` הקיימים, ו-helper `_enumerate_systems` חדש
  המשותף ל-fan-out. נוספה רשומת פנקס `system-branch-protection` ו-7 בדיקות bats (fixtures).
