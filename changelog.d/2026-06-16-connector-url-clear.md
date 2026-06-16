## כתובת המחבר ל-claude.ai — ברור ובדוק (connector-url-clear) — שלב 1

הפיתוח האחרון (`drive-content-edit`) הסתיים, אך חיבור המחבר ב-claude.ai עלה בריצות
מיותרות בגלל פער תיעודי: ה-deploy summary המליץ על Region URL (`…140345952904…`), אך
השרת מכריז ב-`/.well-known/oauth-authorization-server` על `issuer` שונה — הכתובת
ה"מכוערת" (`…risl6twm4a-zf…`). claude.ai נצמד ל-`issuer` ב-OAuth discovery, ולכן רק
הכתובת ה"מכוערת" הצליחה. הוכחה חיה: `probe_endpoint` ל-Region URL החזיר 200 וגוף עם
ה-issuer של ה-hash URL. שלב 1 פותר את הבלבול בלי לשבור את המחבר הקיים של Or.

- **`docs/mcp-connector-setup.md` (חדש)** — מקור-אמת אחד: הכתובת המדויקת להדבקה,
  הטבלה של שני הצרכנים (Claude Code toolbox `mcp_url` ↔ Region URL; claude.ai
  connector ↔ issuer URL), אופן הכשל, שלוש דרכים לוודא את הערך החי (Summary, `verify_mcp_server`,
  `probe_endpoint`), צ'קליסט-מפעיל בעברית. כולל שורה ניתנת ל-grep:
  `EXPECTED_CONNECTOR_ISSUER=https://factory-master-actions-mcp-risl6twm4a-zf.a.run.app`
  — המקור היחיד לבדיקת drift.
- **`.github/workflows/deploy-mcp-server.yml`** — שלב חדש "Read + assert the live
  connector issuer" אחרי `/health`: `curl …/.well-known/oauth-authorization-server`,
  `jq .issuer`, הדפסה רועשת ("paste THIS"), השוואה ל-`EXPECTED_CONNECTOR_ISSUER`
  במסמך — `::warning::` (לא error) על drift כדי לא לחסום redeploy על תיעוד מתיישן.
  ה-Summary מציג שורה חדשה **"claude.ai connector URL (issuer)"** ומפריד שני
  הצרכנים בטקסט "Operator action".
- **`services/mcp-server/src/tools.ts`** — `verify_mcp_server` מקבל check חדש
  `mcp-oauth-issuer`: parse של הגוף שכבר נמשך לפרובינג ה-OAuth metadata, evidence
  = ערך ה-`issuer`. כל סשן יכול עכשיו לשאול "מה הכתובת למחבר?" ולקבל ערך חי מאומת
  פר-מערכת.
- **`.claude/commands/prove-connector.md` (חדש, `audience: factory-only`)** — תאום
  המבני של `/prove-capability` למחברי claude.ai. Connector Card עם 8 שדות (connector
  name · route · issuer URL · auth · tool exercised · server-side proof · operator
  confirmation · verdict), 6 צעדים (קריאת issuer חי → smoke קיים → מסירת הכתובת
  ל-Or → רישום אישור Or → Card → דוח), עם תקרה מוצהרת: צעדים 1-2 אוטומטיים, צעד 4
  אנושי (`probe.ts:12` חוסם את claude.ai מתוך כוונה — אין דרך אוטומטית להוכיח שכלים
  נטענו ב-UI). הסקיל מקובץ ל-`/mcp` ה-toolbox, `/workspace/<sys>/mcp` (smoke:
  `google-mcp-smoke.py`), `/factory/<sys>/mcp` (smoke: `factory-mcp-smoke.py`).
  `factory-only` — לא משתקף ל-`templates/system/.claude/commands/` (מחברי claude.ai
  הם דאגת הפקטורי).
- **`CLAUDE.md`** — שורת ה-`deploy-mcp-server.yml` בטבלת ה-Workflows: נוסף הסבר חצי-משפט
  שמבחין בין `mcp_url` של ה-toolbox (Region URL) לבין מחבר claude.ai (issuer URL). סעיף
  "Web-session connector gate": נוספה נקודה הצובעת על הקובץ החדש בהקשר של "אל תמליץ
  Region URL כשמדובר במחבר claude.ai".

**שלב 2 (תוכנן, לא בוצע כאן):** קיבוע `PUBLIC_BASE_URL` ל-Region URL ב-`deploy-mcp-server.yml`
שורות 684-687 (במקום `gcloud … status.url`). שובר את המחבר הקיים של Or פעם אחת — redeploy חד-פעמי
+ delete+re-add של המחבר ב-claude.ai. נשמר כשלב נפרד מתוזמן ב-`devplans/connector-url-clear.md`.

**שער CI חוסם** (`connector-proofs/<slug>.json` בסגנון `e2e-proofs/`): **לא נבנה, לא מתוכנן**.
הסיבה הכנה: החלק הקריטי ("הכלים נטענו ורצו ב-claude.ai") לא ניתן להוכחה אוטומטית
(`probe.ts:12` חוסם את claude.ai מתוך כוונה). שער כזה היה אוכף JSON של הצהרה-עצמית. החצי
האוטומטי (issuer חי == מתועד) נאכף כבר ב-Summary של ה-deploy.

יצירת `devplans/connector-url-clear.md` (`status: active`) משחררת את שער ה-devplan; אין שינוי
ב-`templates/system/**` ולכן שער הזהב לא נדרס; אין שינוי בקבצי-התנהגות-בוט ולכן שער ה-E2E
לא דורש artifact.
