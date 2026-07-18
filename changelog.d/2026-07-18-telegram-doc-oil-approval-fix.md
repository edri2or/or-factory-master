# תיקון-אמת: docs/telegram-chat-bot-factory תיאר את oil-approval.ts המחוק כקיים

אימות-אמת של שני הריפוז (20/20 שערי or-aios PASS; מכונת-המפעל ב-or-factory-master מחוקה פיזית) חשף
פער-תיעוד יחיד: `docs/telegram-chat-bot-factory.md` עדיין תיאר את `services/mcp-server/src/oil-approval.ts`
כקובץ קיים ("unchanged"), אך המודול נמחק ב-batch 5b (ה-callback `oilapprove:`/`oilreject:` אינו מנותב עוד).

- **דיאגרמת ה-routing** (שורה ~26): הוחלף ענף `oil-approval.ts` בגשרי-האישור הקיימים היום —
  `gcp-approval.ts` / `repo-approval.ts` (GCP red-ops + repo-delete).
- **טבלת הקבצים** (שורה ~45): הוחלפה שורת `oil-approval.ts` בשורת גשרי ה-HITL הקיימים, עם הערה מפורשת
  שגשר `oil-approval.ts` הוסר בקיפול (batch 5b).
- **שורת ה-intro** (שורה ~18): "watchdog / OIL approval prompts" (שניהם הוסרו) → "incidents / HITL approval
  prompts for GCP red-ops + repo-delete".

תיקון-מסמך בלבד — אפס נגיעה ב-gateway/קוד/פריסה. אזכורי `oil-approval` שנותרו הם ב-`docs/changelog-archive/`
(רשומה היסטורית לגיטימית של מתי המודול נבנה) וב-`CLAUDE.md` (הערת-ההסרה) — שניהם נכונים.
