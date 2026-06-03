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
| 2 | פריסה (Or-gated) + הוכחת לולאה חיה על or-adhd-agent | pending | dispatch `deploy-mcp-server.yml` ← **אישור Or** |
| 3 | אימות #46140 לצ'אט claude.ai + תיעוד fallback | pending | `/debug/recent`, docs |
| 4 | הכללה לרב-דייר (דרישת claim, הסרת hardwire) | pending | `n8n-mcp-proxy.ts`, `index.ts` |
| 5 | SA ייעודי least-privilege (conditioned secretAccessor) | pending | `deploy-mcp-server.yml` ← **אישור Or (IAM)** |

## סטטוס נוכחי

שלב 1 מוזג (PR #305). שלב 2: Or אישר פריסה → מיזוג הפעיל את `deploy-mcp-server.yml`. הריצה
הראשונה (26905243218) נכשלה בצעד הפריסה בלבד (הסודות+בנייה+דחיפה עברו) על באג תחבירי של gcloud
מרובה-קונטיינרים: `--quiet` (דגל גלובלי) הונח אחרי ה-`--container` האחרון → `unrecognized
arguments: --quiet`. תיקון: העברת `--quiet` לבלוק הדגלים הגלובליים לפני ה-`--container` הראשון.
fix-forward ב-PR נפרד; אחרי מיזוג, ה-redeploy ירוץ אוטומטית.

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
