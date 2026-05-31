---
dev_name: כיסוי הצד-GitHub של מערכות בשומר-העל
slug: watchdog-system-github-coverage
opened: 2026-05-31
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — כיסוי הצד-GitHub של מערכות בשומר-העל

## מטרה

השומר-העל מכסה היום את ה-factory במלואו ואת המערכות רק בשכבת ה-n8n. הפיתוח הזה מרחיב
את השומר המרכזי כך שלכל מערכת אמיתית ייבדק גם הצד-GitHub שלה — שהגנת-הענף שלה עדיין
אוכפת את שערי-ה-CI, ושהריצות האחרונות של שערי-ה-CI וה-deploy שלה ירוקות. הכל מהמרכז,
דרך ה-broker App (שכבר מורשה לקרוא כל repo בארגון), באותו דפוס fan-out דינמי כמו ה-n8n.
מבוסס על מחקר סטנדרט-תעשייה (OpenSSF Scorecard branch-protection, autodiscovery, ניטור
מרכזי של הצי). מערכות שלא ניתן לפתור → ❓ ולא 🚨.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הגנת-הענף של כל מערכת (`system-branch-protection`) | completed | `scripts/run-watchdog.sh`, `monitoring/watchdog-registry.json`, `scripts/tests/run-watchdog.bats` |
| 2 | ריצות שערי-CI + deploy של כל מערכת (`system-ci-runs`) + סגירה | completed | `scripts/run-watchdog.sh`, `monitoring/watchdog-registry.json`, `monitoring/README.md`, `scripts/tests/run-watchdog.bats` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — הגנת-הענף של כל מערכת

**Acceptance:**
- [x] שיטת הוכחה חדשה `system-branch-protection` ב-`run-watchdog.sh` (fan-out דינמי כמו `proof_n8n_execution`): מונה מערכות אמיתיות (`gcloud projects list --filter=parent.id=<folder>`, מדלג `factory-test-25`), ולכל מערכת בודקת `GET /repos/edri2or/<system>/rules/branches/main` (broker App token) שה-required-status-checks עדיין כוללים את 4 שערי ה-CI.
- [x] מערכת שאיבדה context נדרש → 🚨; מערכת שלא ניתן לפתור (אין repo/אין הגנה/שגיאת API) → ❓; 0 מערכות → ❓. מאוגד לשורה אחת בדוח.
- [x] רשומת `system-branch-protection` בפנקס (`type: system-github`, `layer: system`, `stage: 4`, `enabled: true`).
- [x] בדיקות bats (fixtures + `WATCHDOG_SYSTEMS_OVERRIDE`): all-present→ok / missing-context→red / unresolvable→❓ / 0-systems→❓.
- [x] shellcheck נקי; Playground ירוק על ה-PR.

**הערת התקדמות אחרונה:** הושלם ונבדק מקומית — `shellcheck` נקי, 49 בדיקות bats עוברות (7 חדשות), וריצת-עשן מול הפנקס המלא מראה ❓ ל-0 מערכות ו-🚨 למערכת סינתטית עם הגנה שנחלשה. ממתין ל-Playground ירוק על ה-PR ולאישור Or לשלב 2.

**שינוי תוכנית:** הקובץ `monitoring/README.md` נדחה לשלב 2 (תיעוד שתי השיטות יחד בסוף הפיתוח). שדה ה-`stage` בפנקס הוא 4 (לא 1) — תואם את `CURRENT_STAGE=4` הקיים כך שהרשומה פעילה מיד.

---

### שלב 2 — ריצות שערי-CI + deploy של כל מערכת + סגירה

**Acceptance:**
- [x] שיטת הוכחה `system-ci-runs` (fan-out דינמי): לכל מערכת בודקת שהריצה האחרונה על main של כל אחד מ-4 שערי ה-CI (`changelog-check`/`pipeline-tests`/`secret-scan`/`supply-chain-check`) + `deploy-railway-cloudflare` ירוקה — בשימוש חוזר בלוגיקת `_conclusion_is_failing` (skipped/neutral=תקין).
- [x] כשל אמיתי → 🚨; אין ריצות/לא-פתיר → ❓; 0 מערכות → ❓. מאוגד לשורה אחת.
- [x] רשומת `system-ci-runs` בפנקס.
- [x] בדיקות bats (success→ok / failure→red / skipped→ok / no-runs→❓).
- [x] `monitoring/README.md` מתעד את שתי שיטות ה-system-github; shellcheck נקי; Playground ירוק.
- [x] סגירה: `status: completed` בתוכנית (משחרר את שער ה-CI).

**הערת התקדמות אחרונה:** הושלם ונבדק מקומית — `shellcheck` נקי, 41 בדיקות bats עוברות (8 חדשות ל-`system-ci-runs`), וריצת-עשן מול הפנקס המלא מראה ❓ ל-0 מערכות ו-🚨 למערכת סינתטית עם ריצת-deploy שנכשלה. הפיתוח נסגר (`status: completed`).

**שינוי תוכנית:** ה-helper `_system_ci_status` קורא היסטוריית-ריצות per-workflow per-system (אובייקט fixture `_syscir_<sys>.json` הממפה `workflow_file`→`{workflow_runs}`), בשימוש חוזר ב-jq של `proof_gh_run_freshness` ובלוגיקת `_conclusion_is_failing` — מערכת היא 🚨 אם הריצה האחרונה של *כל* workflow היא כשל, ✅ אם לפחות אחת נפתרה וכולן לא-כושלות, ❓ אם אף ריצה לא נפתרה.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — השומר המרכזי בודק עכשיו שלכל מערכת הגנת-הענף עדיין שומרת על 4 שערי-האיכות; אם מישהו פתח פרצה במערכת — נדע (🚨). מערכת שעוד לא נפרסה פשוט מסומנת "לא ידוע" (❓), בלי אזעקת-שווא.
- שלב 2 הושלם — השומר גם בודק שהבדיקות-האוטומטיות וה-deploy של כל מערכת באמת *רצו ועברו* בפעם האחרונה, לא רק שהן "נדרשות". אם משהו נשבר בשקט במערכת — נדע (🚨). הפיתוח הזה סגור: עכשיו לכל מערכת יש שמירה מלאה גם מצד-GitHub, מהמרכז.
