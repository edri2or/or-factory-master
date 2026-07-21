# השער מכריח את התווית המשותפת של Google — סוף למלכודת localhost:3002

התראת טלגרם טענה שהטוקן המשותף של Google נפל. הוא **לא**: הנתיב הוכח חי (Gmail / Calendar /
Drive החזירו דאטה אמיתי) וה-`workspace-token-audit` היומי עבר באותו בוקר. הכשל האמיתי היה
בסשן **Cowork** שקרא לכלי Workspace עם `user_google_email` **שגוי** (ניחש את
`edri2or@gmail.com`). ב-single-user mode ה-sidecar מתייק את הקרדנציאל היחיד תחת התווית
`edriorp38@or-infra.com` ומחפש לפי המייל שהעביר הקורא — ערך שגוי/חסר מחטיא ומפיל את
workspace-mcp ל-OAuth fallback (הלינק המת `http://localhost:3002/oauth2callback`), ש-Cowork
אבחן בטעות כ"קונקטור לא מאושר". זה בדיוק התרחיש המתועד ב-CLAUDE.md.

**התיקון (פתרון שורשי):** השער כבר מזריק את האימות server-side, אבל השאיר לכל סוכן לספק את
התווית — השדה היחיד שסוכן יכול לטעות בו. עכשיו השער **מכריח** את התווית המשותפת על כל
`tools/call` של Workspace לפני ה-forward:

- **`services/mcp-server/src/workspace-drive-edit.ts`** — הלפר טהור חדש `forceWorkspaceUserEmail(body, label)`:
  מכריח את התווית על `tools/call` אמיתי; מדלג על batches, מתודות שאינן `tools/call`, והכלי
  הסינתטי `edit_drive_file_content` (המייל בו נעלם server-side ממילא).
- **`services/mcp-server/src/workspace-mcp-proxy.ts`** — קורא להלפר לפני ה-pass-through, ומרענן
  את `rawBody` אחרי המוטציה (כי `forwardToSidecar` מעדיף את הבייטים המקוריים — בלי הריענון
  ההזרקה הייתה no-op שקט). התווית נקראת מ-`WORKSPACE_GOOGLE_ACCOUNT_LABEL` עם fallback לברירת
  המחדל המוכחת.
- **`scripts/render-mcp-service-yaml.sh`** — `WORKSPACE_GOOGLE_ACCOUNT_LABEL` מוזרק עכשיו גם על
  קונטיינר ה-gateway (עד כה רק על ה-sidecar), מאותו משתנה-shell אחד — כך שהכרחת-השער וזריעת-
  הסיידקאר לא יכולות להיפרד.
- **בדיקות** (`services/mcp-server/test/workspace-drive-edit.test.mjs`) — 4 מקרים חדשים: override
  של מייל שגוי (הבאג של Cowork), set כשחסר, seed של arguments, ודילוג על הכלי הסינתטי /
  tools/list / batch / null. 132/132 עוברות.

מסלול התווית-הנכונה לא השתנה; ענפי הכלי-הסינתטי ו-`tools/list` לא נגעו. rollback = revert +
redeploy. אפס נגיעה בטוקן/סוד/דאטה.
