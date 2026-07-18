# הסרת ערוץ fulfill-system-request (Tier B של ניקוי-האמת)

ערוץ ה-"system resource-request" היה השארית האחרונה של מכונת-הייצור: מנגנון שבו מערכת מוקצית
העלתה בקשת secret/iam/sync דרך Linear → הרשמה עם כרטיס-אישור בטלגרם → מילוי ע"י ה-broker. עם פירוק
ההקצאה (אין יותר מערכות שמוקצות; or-aios מנוהלת עצמאית) הערוץ נותר יתום — אבל שזור בקוד ה-gateway.
הסרה מלאה מקצה-לקצה:

- **נמחקו:** `.github/workflows/fulfill-system-request.yml`, `scripts/fulfill-system-request.sh`,
  `scripts/validate-system-request.sh`, `scripts/tests/validate-system-request.bats`,
  `docs/system-resource-requests.md`, `services/mcp-server/src/system-request.ts` + הבדיקה שלו.
- **`services/mcp-server/src/index.ts`:** הוסרו ה-import, ה-route `/system-request-register`, וענף
  ה-callback ב-`/telegram-webhook`. שאר הערוצים (GCP-approval, repo-delete, chat) נשמרו ללא שינוי.
- **`services/mcp-server/src/oil-autofix.ts`:** הוסר ענף ה-`system.request.` המבודד + ה-import.
  ליבת OIL (triage + auto-fix) ללא שינוי.
- **תיקוני-אמת בהערות:** ב-`gcp-approval.ts`/`repo-approval.ts`/`gcp-action.yml` הוסרו הפניות לערוץ
  שנמחק וגם ל-`oil-approval.ts` (שנמחק ב-batch 5b) — כדי שאף הערה לא תפנה לקובץ שאינו קיים.

`isMergeableSelffixPr` היה פנימי ל-system-request.ts בלבד (שם מטעה — שומר-מיזוג של הערוץ); אין תלות של
OIL או של ערוצי GCP/repo-approval הנשמרים. אומת: `tsc` build נקי + `npm test` 119/119. שער ה-smoke
התלת-משטחי בפריסה מאמת שמסלול גוגל/n8n של or-aios לא נפגע.
