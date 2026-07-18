## פירוק מכונת-המפעל — אצווה 5ג (מחיקת הסוד היתום bs-telegram-watermark) + סגירת התוכנית

אצווה 5ג היא הצעד האחרון בפירוק מכונת-המפעל: מחיקת הסוד היתום `bs-telegram-watermark` ב-Secret Manager
של `or-factory-master-control`. הכותב היחיד שלו, `bs-incidents-to-telegram.yml`, נמחק ב-5א → הסוד נשאר
יתום עם 100 גרסאות פעילות (~22 ₪/חודש עלות-אחסון). זו פעולה תפעולית **בלתי-הפיכה** — לא PR — שעברה דרך
שער-הטלגרם של Or.

- **סריקת-אימפקט (לפני פעולה בלתי-הפיכה):** 0 הפניות חיות ל-`bs-telegram-watermark` ב-`.github/`,
  `services/`, `scripts/`, `monitoring/`, `policy/`. ההפניות היחידות הן docs/היסטוריה. הסוד מחזיק
  חותם-dedup (timestamp/id), לא קרדנצ'ל.
- **מנגנון:** `gcp-action.yml` `phase=propose` → המסווג `secrets delete` = **red** → כרטיס אישור לטלגרם →
  Or ✅ → `phase=execute` (`--quiet`) מחק את הסוד.
- **אימות (read-only):** ריצת execute = success; `list_secret_metadata(control)` → הסוד **נעדר**,
  `secretCount` **53→52**; ללא נגיעה ב-runtime (`or-aios /healthz`=200, אין redeploy).
- **סגירת התוכנית:** כל אצוות הפירוק (1–7 + 5א/5ב/5ג) הושלמו → `devplans/factory-dismantle.md` נסגר
  (`status: completed`). **Phase 3** (איחוד `factory-test-8`→control כפרויקט GCP יחיד) הוא שלב-המשך
  נפרד ו-Or-gated — ייפתח ב-devplan ייעודי.
- ה-backbone (broker/WIF/SA), ה-gateway, מסלול Google, ושערי-ה-CI — לא נגעו.
