<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage. הזיכרון/המצפן של הסוכן,
לא חומר קריאה ל-Or. Or לא פותח אותו; הסוכן מסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: שרת n8n-mcp מרכזי רב-דייר (live-write) ברמת המפעל
slug: n8n-mcp-central-gateway
opened: 2026-06-03
status: active
---

# תוכנית פיתוח — שער n8n-mcp מרכזי (live-write)

## מטרה

"שלט-רחוק" מרכזי אחד במפעל שמאפשר לקלוד לכתוב ולתקן workflows ב-n8n **חי** דרך MCP, במקום
לערוך JSON ולפרוס מחדש בכל פעם. כל מערכת ניגשת **רק לשלה**, ושום מפתח לא יושב בסשן — המפתחות
נשארים ב-Secret Manager והשער מזריק אותם רגע לפני הפנייה ל-n8n. הוכחה ראשונה על `or-adhd-agent`.

## ארכיטקטורה (החלטה)

מרחיבים את שירות ה-Cloud Run הקיים `factory-master-actions-mcp` (לא שירות חדש). הוא כבר קורא
את `n8n-api-key` של כל מערכת חוצה-פרויקט בלי שהמפתח נכנס לסשן (`src/n8n-client.ts`). מוסיפים:
מסלול `/n8n/<system>/mcp` שמזריק `x-n8n-url`/`x-n8n-key` שרת-צד ומעביר ל-**sidecar** של
`czlonkowski/n8n-mcp` (`>=2.51.2`, `MCP_MODE=http`, `ENABLE_MULTI_TENANT=true`) הרץ באותו שירות
ונגיש רק ב-`localhost` (לא חשוף לאינטרנט — מימוש נקי יותר של "פנימי-בלבד" מאשר שירות שני).

```
Claude Code / claude.ai  --Bearer-->  /n8n/<system>/mcp (gateway)
   verify bearer + assert system  →  strip client x-n8n-*  →  resolveN8nTarget(system)
   inject x-n8n-url + x-n8n-key (server-side)  →  localhost:3001/mcp (n8n-mcp sidecar)
   →  https://n8n-<system>.or-infra.com/api/v1
```

בידוד: ה-system נמצא גם בנתיב וגם ב-claim חתום בטוקן (`kind:'n8n-dev'`) — טוקן של מערכת אחת
מקבל 403 על נתיב של מערכת אחרת.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | מחקר + אימות גישה + pin גרסה | completed | (קריאה-בלבד; אומת SM+Railway; `N8N_MCP_IMAGE` ל-2.51.2) |
| 1 | קוד השער + sidecar בקובץ הפריסה | code-ready | `services/mcp-server/src/{bearer,n8n-client,n8n-mcp-proxy,index}.ts`, `.github/workflows/deploy-mcp-server.yml`, test |
| 2 | פריסה (Or-gated) — השרת חי | completed | rev 00053 חי; `/health`=200, `/n8n/or-adhd-agent/mcp`=401, מערכת-לא-מורשית=404 |
| 3 | הוכחת לולאה חיה (smoke) — ✅ create+delete חי | completed | `scripts/n8n-mcp-smoke.py` + `.github/workflows/n8n-mcp-smoke.yml`; run 26909246600 PASS |
| 3b | התחברות Google לאופרטור (במקום admin-secret) | code-ready | `src/google-oauth.ts`, `src/index.ts`, `scripts/render-mcp-service-yaml.sh`, `deploy-mcp-server.yml` |
| 3c | התחברות Google — חיה ומאומתת (Or מחובר) | completed | `/oauth/authorize`→Google אומת; Or חיבר connector |
| 4 | הכללה לרב-דייר (`N8N_DEV_ALLOWED_SYSTEMS="*"`) | code-ready | `n8n-mcp-proxy.ts`, `deploy-mcp-server.yml`, test |
| 5 | SA ייעודי least-privilege (read-only) | code-ready | זהות `mcp-gateway-runtime` נוצרה (Or, Cloud Shell); deploy מחליף `RUNTIME_SA` |

## סטטוס נוכחי

שלב 1 מוזג (PR #305). שלב 2 — פריסה (Or אישר), שתי איטרציות תיקון על מכניקת ה-deploy:
1. ריצה 26905243218 נכשלה על `--quiet` (דגל גלובלי) שהונח אחרי ה-`--container` האחרון →
   `unrecognized arguments`. תוקן (PR #306): `--quiet` לפני ה-`--container` הראשון.
2. ריצה 26905606580 נכשלה על `should contain exactly one container with an exposed port` —
   `gcloud run deploy --container` מול שירות חד-קונטיינר קיים השאיר את הקונטיינר הישן. תיקון
   (#307): מעבר ל-`gcloud run services replace` עם spec דקלרטיבי שמרונדר ע"י
   `scripts/render-mcp-service-yaml.sh`. מאומת מקומית.
3. ריצה 26907190322 נכשלה על `containers[1].image ... ghcr.io ... host is one of gcr.io,
   docker.pkg.dev or docker.io` — Cloud Run לא מושך מ-ghcr.io. תיקון: צעד שמשכפל (mirror) את
   image של n8n-mcp ל-Artifact Registry של הפרויקט (bootstrap-images) ופורס את העותק משם.

הסודות, הבנייה והדחיפה עברו בכל הריצות — רק קונפיגורציית הפריסה נדרשה לליטוש, איטרציה אחר
איטרציה. **ריצה 26907493544 הצליחה** — rev 00053 חי עם שני הקונטיינרים. אומת חי: `/health`=200,
`/n8n/or-adhd-agent/mcp` בלי טוקן=401 (מסלול חי + מורשה), מערכת-לא-מורשית=404 (בידוד עובד).

שלב 3 הושלם: `n8n-mcp-smoke.yml` (run 26909246600) הוכיח חי create+delete של workflow `dev-`
ב-n8n של or-adhd-agent דרך MCP, בלי סוד בסשן, בלי שאריות.

שלב 3b (התחברות Google): Or בחר "Login with Google" כדי לא להתעסק בסוד. במקום Cloudflare Access
(שדורש Tunnel always-on — נדחה), השער מנצל את שרת ה-OAuth הקיים: `/oauth/authorize` מפנה ל-Google,
`/oauth/callback` מאמת את ה-email מול allowlist (`OAUTH_ALLOWED_EMAILS`) ואז מנפיק את ה-bearer
הרגיל. ה-PKCE של הלקוח נשמר. נשאר ל-fallback ל-admin-secret אם Google לא מוגדר (deploy בטוח לפני
שה-client קיים). סודות חדשים: `google-oauth-client-{id,secret}` (placeholder עד שייווצר client
ידנית ב-Google Console — הצעד הידני היחיד). **עוצרים לפני re-deploy לאישור Or + ליצירת ה-client.**

## סוד חדש (rotation)

`n8n-mcp-internal-auth-token` (≥32 תווים, נטבע אידמפוטנטית בקובץ הפריסה) — ה-`AUTH_TOKEN` של
ה-sidecar הפנימי. הגנה-בעומק (ה-sidecar ממילא לא חשוף). רוטציה: גרסת-סוד חדשה.
`n8n-api-key` הקיים פר-מערכת לא משתנה (נטבע ע"י `deploy-railway-cloudflare.yml`; השער קורא
`latest`, כך שרוטציה לא דורשת redeploy לשער). תדירות מומלצת 90 יום, ומיידית בחשד לדליפה.

## נקודות Or-gate (עלות/תשתית)

- שלב 2: הקמת sidecar + redeploy (`deploy-mcp-server.yml`).
- שלב 5: שינויי IAM בפרויקט-הניהול.
- כתיבה-חיה ראשונה ל-n8n (מוגבלת ל-`dev-*`).

## גיט = מקור-האמת

כתיבה-חיה היא scratch בלבד: `devNameViolation` חוסם create/update לשם שאינו `dev-*`. השער השני
הוא שער ה-CI הקיים `or-adhd-agent/scripts/check-no-dev-workflows-committed.sh`. קידום לפרודקשן =
re-templatize + PR.
