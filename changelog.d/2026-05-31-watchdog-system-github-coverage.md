### כיסוי הצד-GitHub של מערכות בשומר-העל

- **שלב 1 — הגנת-ענף של כל מערכת בשומר המרכזי.** נוספה שיטת-הוכחה `system-branch-protection`
  ל-`scripts/run-watchdog.sh`: fan-out דינמי per-system (כמו `n8n-execution`) שמונה את
  המערכות האמיתיות (מדלג `factory-test-25`) ובודק שלכל מערכת הגנת-הענף על `main` עדיין
  אוכפת את כל 4 שערי-ה-CI (`evidence.required_contexts`). שער שהוסר → 🚨; מערכת לא-פתירה
  (אין repo/טוקן/שגיאת API) או 0 מערכות → ❓, לעולם לא 🚨. שימוש חוזר בלוגיקת קריאת
  ה-rules + מסנן ה-`required_status_checks` הקיימים, ו-helper `_enumerate_systems` חדש
  המשותף ל-fan-out. נוספה רשומת פנקס `system-branch-protection` ו-7 בדיקות bats (fixtures).
- **שלב 2 — ריצות שערי-CI + deploy של כל מערכת + סגירה.** נוספה שיטת-הוכחה `system-ci-runs`
  ל-`scripts/run-watchdog.sh` (התאום-בזמן-ריצה של `system-branch-protection`): fan-out דינמי
  per-system שלכל מערכת בודק שהריצה האחרונה על `main` של כל אחד מ-5 ה-workflows (`changelog-check`,
  `pipeline-tests`, `secret-scan`, `supply-chain-check`, `deploy-railway-cloudflare`) אינה כשל —
  בשימוש חוזר בלוגיקת `_conclusion_is_failing` (skipped/neutral=תקין). כשל → 🚨; אין-ריצות/לא-פתיר
  או 0 מערכות → ❓, לעולם לא 🚨. נוספה רשומת פנקס `system-ci-runs`, תיעוד שתי שיטות ה-system-github
  ב-`monitoring/README.md`, ו-8 בדיקות bats (success→ok / failure→red / skipped→ok / no-runs→❓ /
  aggregate). הפיתוח נסגר (`status: completed`).
