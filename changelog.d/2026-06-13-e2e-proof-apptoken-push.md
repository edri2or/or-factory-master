## fix: דחיפת תעודת ה-E2E כ-App (לא GITHUB_TOKEN) — כדי שה-CI ירוץ מחדש לבד

ה-workflow `e2e-verify.yml` דוחף את `e2e-proofs/<slug>.json` ל-branch של ה-PR. הדחיפה
נעשתה עם ה-`GITHUB_TOKEN` האוטומטי של ה-runner — וגיטהאב **לא** מריץ workflows מחדש על
commit שנדחף עם ה-`GITHUB_TOKEN` (הגנת אנטי-רקורסיה). התוצאה: אחרי שהתעודה נדחפה, ה-checks
הנדרשים לא רצו על ה-head החדש וה-PR נשאר "תקוע/ממתין" עד דחיפה אנושית (Re-run). זה אף פעם
לא העביר PR גרוע — רק עלה קליק ידני אחד על PR שכבר ירוק (ה"קוץ" המתועד ב-stage 6 של
`devplans/e2e-verification-gate.md`).

**התיקון:** דוחפים את commit-התעודה בזהות **GitHub App** במקום ה-`GITHUB_TOKEN`. דחיפת
App-token מפעילה `pull_request: synchronize` → ה-checks רצים מחדש לבד, בלי נגיעה אנושית.
דפוס זהה ל-`refresh-system-agents.yml`: `persist-credentials: false` ב-checkout + מינטינג
טוקן + דחיפה דרך `https://x-access-token:<token>@github.com/...` (הטוקן ממוסך ומנוקה
מפלט-שגיאה). הפקטורי משתמש בברוקר (`scripts/generate-app-token.sh`, scope לריפו אחד,
`contents:write`); התבנית מַמְצִיאה inline את ה-App **של המערכת עצמה** (JWT RS256 →
`/app/installations/<id>/access_tokens`, נקרא מ-SM של המערכת) — הסוד לא חוצה גבול-step ואין
תלות ב-action חדש. `e2e-verify.yml` אינו משטח-התנהגות (`e2e-surfaces.json`), לכן שער ה-E2E
הוא no-op לשינוי הזה.

**Changes:** `.github/workflows/e2e-verify.yml`,
`templates/system/.github/workflows/e2e-verify.yml`, `tests/golden/system/MANIFEST.sha256`.
