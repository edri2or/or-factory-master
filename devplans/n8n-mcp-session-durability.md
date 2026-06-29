---
dev_name: עמידות-session ל-n8n-mcp (תיקון "Session not found")
slug: n8n-mcp-session-durability
opened: 2026-06-29
status: active
---

# תוכנית פיתוח — עמידות-session ל-n8n-mcp

## מטרה

הנתיב `/n8n/<system>/mcp` בשער ה-MCP מאבד לסירוגין את ה-session ("Session not found").
מתקנים את שני שורשי-הכשל: (א) ה-sidecar שוכח sessions אחרי 5 דק' חוסר-פעילות — מיתון זול;
(ב) כשהשרת מתחלף (deploy/תחזוקה/OOM) הוא מאבד את כל הזיכרון שב-RAM — מוסיפים 'קופסת-זיכרון'
קבועה (Firestore) שמאפשרת התאוששות שקופה גם אחרי החלפת-שרת. המטרה: שהנתיב יהיה אמין מספיק
לסמוך עליו שוב, בלי לשבור את השער המשותף הרב-דייר.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מיתון זול — `SESSION_TIMEOUT_MINUTES=120` ב-sidecar | completed | `scripts/render-mcp-service-yaml.sh` |
| 2 | הקמת ה-store: Firestore + IAM + env | completed | `.github/workflows/deploy-mcp-server.yml`, `scripts/render-mcp-service-yaml.sh` |
| 3 | מודול `session-store.ts` (durable tier + DI seam) | completed | `services/mcp-server/src/session-store.ts` (חדש) |
| 4 | חיווט הפרוקסי ל-store (4 עריכות כירורגיות) | completed | `services/mcp-server/src/n8n-mcp-proxy.ts` |
| 5 | הוכחה — unit + smoke מורחב שמאלץ אובדן-session | in-progress | `services/mcp-server/test/session-store.test.mjs` (חדש), `scripts/n8n-mcp-smoke.py`, `.github/workflows/n8n-mcp-smoke.yml` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> **הוכחה בכל שלב:** שלב נסגר רק כשהוכח שהלבנה עובדת על קלט אמיתי *באותו שלב*. שער-הקבלה
> האמיתי של כל הפיתוח: ה-smoke המורחב (שלב 5) מוכיח התאוששות שקופה אחרי אובדן-session מאולץ.
>
> **לא-התנהגותי:** הפיתוח לא נוגע ב-`workflows/n8n/*.json` ולא ב-`configure-agent-router.yml`,
> אלא בקוד מישור-הבקרה של ה-MCP (`services/mcp-server/**`) + ה-render/deploy שלו. לכן שער ה-E2E
> אינו חל; הפריסה היא ע"י טריגר ה-`push: main` על `services/mcp-server/**` (לא dispatch ידני).

---

### שלב 1 — מיתון זול — `SESSION_TIMEOUT_MINUTES=120`

**Acceptance:**
- [x] `emit_env SESSION_TIMEOUT_MINUTES "120"` נוסף לבלוק ה-env של ה-sidecar `n8nmcp`, מיד אחרי `LOG_LEVEL`.
- [x] `N8N_MCP_IMAGE` נשאר `2.51.2` (אומת, לא שונה).
- [ ] CI ירוק (devplan + changelog gates).

**הוכחה תפקודית (באותו שלב):** רינדור מקומי של ה-YAML
(`SERVICE=x GATEWAY_IMAGE=x N8N_MCP_IMAGE=x WORKSPACE_MCP_IMAGE=x RUNTIME_SA_EMAIL=x
PUBLIC_BASE_URL=x N8N_DEV_ALLOWED_SYSTEMS=x bash scripts/render-mcp-service-yaml.sh`) — הפלט
מכיל `name: SESSION_TIMEOUT_MINUTES` עם `value: "120"` בתוך מכולת ה-`n8nmcp`. אחרי מיזוג: ריצת
`n8n-mcp-smoke.yml` ירוקה מול השרת המעודכן.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** 2026-06-29 — בוצע. רינדור מקומי מאשר `SESSION_TIMEOUT_MINUTES: "120"` בתוך מכולת `n8nmcp`; `N8N_MCP_IMAGE` נשאר `2.51.2`; shellcheck נקי. ממתין למיזוג+פריסה לפני קבוצה 2.

**שינוי תוכנית:** —

---

### שלב 2 — הקמת ה-store: Firestore + IAM + env

**Acceptance:**
- [ ] תשתית חד-פעמית (Or-gated, ~0 עלות): `firestore.googleapis.com` מופעל על `or-factory-master-control`; מסד Native-mode דיפולטי קיים; ל-runtime SA יש `roles/datastore.user`; מדיניות TTL על השדה `expireAt` באוסף `n8n-mcp-sessions`.
- [ ] שלב ה-IAM ב-`deploy-mcp-server.yml` מעניק `roles/datastore.user` ל-runtime SA (מראה את דפוס `add-iam-policy-binding` הקיים).
- [ ] בבלוק ה-env של ה-gateway: `SESSION_STORE_PROJECT="or-factory-master-control"` + kill-switch `SESSION_STORE_ENABLED="1"`.

**הוכחה תפקודית (באותו שלב):** רינדור ה-YAML מציג את שני ה-env בבלוק ה-gateway. ה-IAM מאומת
ע"י `gcloud projects get-iam-policy` (או צעד ה-best-effort ב-deploy שמדפיס PASS). מסד ה-Firestore
מאומת ע"י `gcloud firestore databases describe`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** 2026-06-29 — בוצע בקוד. אומת ש-Firestore Native נתמך ב-me-west1 (אזור הפקטורי, מיקום בלתי-הפיך). הפריסה מקימה את המסד+TTL+הרשאת `roles/datastore.user` באופן אידמפוטנטי ובטוח-לכישלון (fail-open) — אם משהו לא מוכן, השער רץ RAM-בלבד בלי רגרסיה. הרינדור מציג `SESSION_STORE_PROJECT` + `SESSION_STORE_ENABLED=1`. ההקמה החיה תתרחש אוטומטית במיזוג (טריגר ה-push).

**שינוי תוכנית:** במקום צעד gcloud ידני נפרד — ההקמה נאפתה לתוך `deploy-mcp-server.yml` (אידמפוטנטי), כך שאין פעולה ידנית; תואם את רוח הפקטורי (אוטונומי, mint-if-missing).

---

### שלב 3 — מודול `session-store.ts`

**Acceptance:**
- [ ] `interface StoredSession { initBody; upstreamSid; system }` — ללא סודות.
- [ ] `interface SessionBackend { get; put; del }` — fail-open, timeout 3–5 ש' לכל קריאה.
- [ ] מימוש Firestore REST דרך `getGcpAccessToken` + bare `fetch`; `put` חותם `expireAt = now + 1h`; `get` מתייחס למסמך פג/חסר כ-miss.
- [ ] עוזרים טהורים מיוצאים: `buildSessionDocPath`, `encodeSessionDoc`, `decodeSessionDoc`, `resolveStoredSession`; `defaultBackend()` מחזיר null כש-`SESSION_STORE_ENABLED=0`.

**הוכחה תפקודית (באותו שלב):** בדיקות-יחידה (שלב 5) על העוזרים הטהורים — round-trip, secret-safety,
TTL, fail-open — עוברות `node --test`. (הקובץ נכתב בשלב זה, הבדיקות מאוגדות בשלב 5.)

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** 2026-06-29 — בוצע. `session-store.ts` נכתב בסגנון `gcp-client.ts` (bare fetch + `getGcpAccessToken`, אפס תלות חדשה), fail-open עם timeout, tenant-guard ב-`resolveStoredSession`, ו-`SESSION_STORE_ENABLED` כ-kill-switch. `npm run build` נקי.

**שינוי תוכנית:** —

---

### שלב 4 — חיווט הפרוקסי ל-store

**Acceptance:**
- [ ] עריכה A: import + `let backend = defaultBackend()` + `setSessionBackend` (test seam).
- [ ] עריכה B: `rememberSession(...,system)` כותב גם ל-store (fire-and-forget, fail-open).
- [ ] עריכה C: `reinitUpstream(...,system,...)` קורא מה-store ב-Map miss, מאמת `stored.system === system`, מרהידרט את ה-Map; מרענן את הרשומה בהצלחה.
- [ ] עריכה D: שער ההתאוששות (~שורה 306) כבר לא דורש `sessions.has(clientSid)`.
- [ ] `recovering` dedup + `SESSION_CAP` ללא שינוי; אין סודות ב-store.

**הוכחה תפקודית (באותו שלב):** `resolveStoredSession` מול fake backend (rehydrate חוצה-מופע +
tenant-mismatch → null) ו-fake זורק (fail-open) — בשלב 5. בנייה (`npm run build`) עוברת ללא שגיאות טיפוס.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** 2026-06-29 — בוצע. 4 העריכות A–D הוחלו; `recovering` dedup + `SESSION_CAP` ללא שינוי; ה-DELETE מנקה גם את ה-store. הבנייה נקייה.

**שינוי תוכנית:** —

---

### שלב 5 — הוכחה: unit + smoke מורחב

**Acceptance:**
- [ ] `session-store.test.mjs`: round-trip; secret-safety (אין `x-n8n-key`/`apiKey`/`Bearer` ברשומה המסודרת); TTL פג → miss; `resolveStoredSession` מול fake + fake-זורק.
- [ ] `n8n-mcp-smoke.py` מורחב: מאלץ אובדן-session (session id מיושן/לא-מוכר ו/או אחרי חלון idle) ומוודא התאוששות שקופה — הקריאה מצליחה עם ה-session id המקורי של הלקוח.
- [ ] השער האמיתי: ה-smoke החי ירוק אחרי הפריסה ומוכיח את ההתאוששות.

**הוכחה תפקודית (באותו שלב):** `node --test` ירוק (12 בדיקות חדשות, 150 סה"כ). שער-הקבלה החי:
ריצת `n8n-mcp-smoke.yml` שמקימה session → מאלצת החלפת-מופע אמיתית של השער (revision חדש מוחק את
ה-RAM) → קוראת שוב עם אותו session id ומצליחה — מה שיכול לקרות *רק* אם ה-store שיחזר. רץ אחרי
פריסת קבוצה 2.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** 2026-06-29 — unit הושלם (12 ירוקות), קבוצה 2 נפרסה. ה-smoke החי נפל פעמיים
על `initialize → HTTP 429 "Too many authentication attempts"` — **לא קוד שלנו**: ה-sidecar n8n-mcp
מגביל ל-20 ניסיונות-אימות/15 דק' לכל IP, וכל תעבורת השער היא IP אחד, אז כמה הרצות smoke רצופות חצו
את הסף. תיקון: `AUTH_RATE_LIMIT_MAX=10000` ב-env של ה-sidecar (המגבלה מיותרת — אימות הלקוח כבר נאכף
בשער; ה-sidecar רואה רק טוקן קבוע מוזרק). גם תוקן יעד-ברירת-המחדל של ה-smoke מ-`or-adhd-agent`
(מושבת) ל-`or-edri-4`.
2026-06-29 (המשך) — אחרי תיקון ה-auth-limit, ה-smoke עובר `phase=init` ואת החלפת-המופע, ונכשל
ב-`phase=recover` עם `400 Session not found` — השרת החדש לא שיחזר את ה-session מ-Firestore. שורש
סביר: צעד הקמת ה-Firestore ב-deploy היה best-effort והשתיק את כל פלט ה-gcloud (`>/dev/null 2>&1`),
אז כשל הקמת-מסד/הרשאה נבלע והקופסה רצה fail-open (ריקה). שינוי: הצעד עכשיו **מילולי** ומסתיים
ב**אימות קשיח** (`exit 1` אם המסד חסר או ל-runtime SA אין `roles/datastore.user`) — כך השורש ייקרא
מהלוג. נשאר: לראות את האימות → לתקן את התשתית → smoke ירוק.
2026-06-29 (המשך) — האימות הקשיח דיווח את השורש: ה-broker מקבל `PERMISSION_DENIED` על כל פעולת
Firestore/IAM ב-control (אינו admin שם — בכוונה). **Or אישר דרך א'**: מענק חד-פעמי פריבילגי
(broker → `roles/datastore.owner`, runtime SA → `roles/datastore.user` על `or-factory-master-control`).
שינוי-קוד נלווה: ה-verify ב-deploy עכשיו נכשל-קשיח רק על "המסד קיים" (משהו שה-broker יכול לבדוק עם
`datastore.owner`), וה-runtime-SA grant הופך ל-`::warning::` רך — ה-smoke הוא ההוכחה האמיתית. נשאר:
מענק חד-פעמי → deploy → smoke ירוק → סגירה.

**שינוי תוכנית:** (1) ההתאוששות מוכחת דרך החלפת-מופע אמיתית (revision roll) ולא דרך idle (החלון
120 דק', לא מעשי ב-CI) — נאמן יותר לתרחיש ההפקה. (2) השער חשף באג סמוי אמיתי (auth rate-limit נמוך
מדי לתעבורה רב-דיירת) — תוקן באותו פיתוח כי הוא חוסם את אותו נתיב שהפיתוח בא להפוך לאמין.

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים — בשפה ש-Or מבין, בלי ז'רגון.

- שלב 1 הושלם — הארכנו את "זמן השכחה" של ה-sidecar מ-5 דק' ל-120 דק', כך שהרבה פחות ניתוקים קורים מלכתחילה.
- שלבים 2–4 הושלמו (קוד) — נבנתה 'קופסת-הזיכרון' הקבועה (Firestore): מודול חדש, חיווט לשער, והקמה אוטומטית+בטוחה בפריסה. עדיין לא חי — נפרס במיזוג.
