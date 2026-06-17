## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 4b: חיווט שער-הסיכון ל-broker + גשר-אישור-טלגרם ב-MCP

המשך ל-4a (ה-classifier). 4b מחבר את הסיווג ל-broker החי וסוגר את לולאת ה-RED עם אישור-טלגרם
human-in-the-loop — אותו invariant של OIL / system-request / gcp-action: משימת-סוכן אדומה
לא רצה בלי ✅ מפורש של Or.

- **`services/mcp-server/src/agent-approval.ts` (חדש)** — תאום-רוח של `gcp-approval.ts`. אבל
  בעוד פקודת-GCP היא מחרוזת אחת מוגבלת-charset, יחידת-עבודת-סוכן היא **ארבעה שדות**
  (`worker_repo`, `requester_repo`, `task`, `correlation_id`) וה-`task` הוא **טקסט חופשי** —
  אז כל היחידה נוסעת כ-**base64(JSON) בתוך טקסט-הכרטיס** (בין הסנטינלים `⟦AGENT⟧…⟦/AGENT⟧`).
  טלגרם מחזיר את הטקסט מילה-במילה ב-callback, אז החלפת-instance של Cloud Run לא יכולה לאבד
  אישור ממתין — בלי DB/issue/Linear. ה-alphabet של base64 לא יכול להכיל את גליפי-הסנטינל אז
  הגבולות חד-משמעיים, ובלחיצת ✅ ה-`correlation_id` שמשוחזר מה-blob **חייב להיות שווה** ל-corr
  שבכפתור (כובל כפתור↔blob). אישור = אותה allowlist (`OIL_APPROVER_TELEGRAM_ALLOWLIST`).
- **`services/mcp-server/src/index.ts`** — route `POST /agent-action-register` (admin-gated,
  `X-Admin-Secret`) + ניתוב ה-callback (`agentok:`/`agentno:`) ב-`/telegram-webhook`.
- **`services/mcp-server/src/tools.ts`** — `agent-action.yml` נוסף ל-`DISPATCHABLE_WORKFLOWS`
  **ל-`phase=propose` בלבד**: הכלי מסרב dispatch של `phase=execute`, כך ש-execute נגיש **רק**
  דרך callback-הטלגרם (שער-ה-RED לא ניתן לעקיפה). ההקבלה ל-`gcp-action.yml` שכולו מחוץ ל-allowlist.
- **`.github/workflows/agent-action.yml`** — שוכתב ל-`phase=propose|execute`: צעד `Classify`
  (`scripts/agent-classify.sh` על ה-task ה-freeform) → `green`/`yellow` מתווכים מיד (dispatch
  worker → poll → כתיבת תוצאה ל-requester); `red` → POST `/agent-action-register` ולא רץ;
  `execute` (אחרי ✅) מתווך ללא-תלות-tier + שולח אישור-טלגרם בסיום. ברירת-המחדל היא `propose`.
- **`services/mcp-server/test/agent-approval.test.mjs` (חדש)** — 10 בדיקות-יחידה לפונקציות
  הטהורות (parse/encode/recover): round-trip, task עם סנטינלים/שורות-חדשות שורד דרך base64,
  כבילת corr↔blob, סירוב ריפויי control/factory, סירוב task ריק, base64 פגום → null.
- **`docs/agent-repo-product.md` (חדש)** + רשומת binding ב-**`monitoring/doc-bindings.json`**
  (`templates/agent-repo/AGENTS.md.template` ↔ הדוק) — התיעוד הקנוני של טיפוס-המוצר.

נבדק מקומית: `tsc` נקי, 128/128 בדיקות עוברות, yamllint נקי, ה-classifier מסווג נכון
green/yellow/red. אין נגיעה ב-`templates/system/**` ולא בקבצי-התנהגות-בוט-n8n. ה-redeploy של
ה-MCP + ההוכחה החיה (כרטיס-red → ✅ → execute) הם הצעד הבא (costed, Or-gated).
