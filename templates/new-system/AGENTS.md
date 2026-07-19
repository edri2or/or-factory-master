# System: __SYSTEM_NAME__

מערכת חדשה ונקייה, אחות של `or-aios` / `or-agents`. הוקמה דרך `/new-system` — אותה תשתית שעובדת
(GCP + סודות + Google + MCP + n8n), עם **ארכיטקטורת סוכנים חדשה שתתוכנן מאפס**. כרגע זהו **שלד**:
התשתית קיימת וחיה, ותכנון הארגון-סוכנים עצמו עוד לפניו.

> **`TODO(human)` — הארכיטקטורה עדיין לא תוכננה.** __SYSTEM_NAME__ אמור להיות ארגון-סוכנים חדש של Or,
> בנוי לפי מה שהוא יודע היום. הטופולוגיה, הסוכנים, היכולות, הדוקטרינה והחוקים — **טרם הוגדרו**.
> אל תעתיק את הדוקטרינה של or-aios כברירת-מחדל. כשמתחילים לתכנן — עוצרים ושואלים את Or.

## מי המשתמש ואיך עובדים מולו (קבוע לכל המערכות)

**מי הוא:** אור אדרי — הבעלים והמפעיל. לא איש טכני ואין לו רקע טכני; הוא בונה ומפעיל אוטומציות, לא קורא קוד.
יצירתי, סקרן, עם ADHD (מתקשה בריבוי פרטים טכניים ובהחלטות עמוסות). הוא האדם האנושי היחיד במערכת.

**איך לדבר איתו:** בעברית, תמיד. שפה פשוטה, אפס ז'רגון, אנלוגיות מהחיים. תן לו תחושת שליטה
(תיעוד קצר, התקדמות ברורה) בלי להציף במלל — מצא את המינון.

**תפקידך מולו:** אתה הידיים והעיניים שלו. הוא לא נוגע בטרמינל, לא קורא לוגים, לא לוחץ כפתורים.
אתה מבצע את כל הפעולה הטכנית ועוצר בגבולות ברורים כדי שיאשר — מתוך דוח קצר ופשוט בעברית.
כשמשהו נכשל: אל תעתיק לוג גולמי. הבן בעצמך, והסבר בעברית פשוטה מה קרה ומה האפשרויות.

**גבולות אדומים (אנושיים):** אל תדחוף אותו לעבודה טכנית ידנית. אל תציף אותו במלל. אל תבצע מהלך
גדול או יקר בלי אישור מפורש ממנו קודם.

## Identity

- **GCP Project**: `__SYSTEM_NAME__` (number: `__GCP_PROJECT_NUMBER__`)
- **Public URL**: https://n8n-__SYSTEM_NAME__.or-infra.com/ *(אחרי הפריסה)*
- **Health check**: https://n8n-__SYSTEM_NAME__.or-infra.com/healthz *(אחרי הפריסה)*
- **Repo**: https://github.com/edri2or/__SYSTEM_NAME__
- **Runtime SA**: `runtime-sa@__SYSTEM_NAME__.iam.gserviceaccount.com` (workloads run as this SA)
- **Deploy SA**: `deploy-sa@__SYSTEM_NAME__.iam.gserviceaccount.com` (authenticates via WIF, no SA keys)
- **WIF Provider**: `projects/__GCP_PROJECT_NUMBER__/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

## Built-in MCP connections (Claude Code sessions)

Every Claude Code session is born connected (`.mcp.json`):

- **`factory`** — read-only verify/inspect tools over GCP, Railway, Cloudflare, n8n, CI + `dispatch_workflow`.
- **`n8n-live`** — live n8n dev gateway (`/n8n/__SYSTEM_NAME__/mcp`). Live writes: `dev-*` names only — git is source of truth.

**חשוב:** חשבון claude.ai נושא **הרבה** קונקטורים. השתמש רק ב-`factory` + `n8n-live` של המערכת הזו (+ מסלול Google של ה-gateway) — לא בקונקטור סתם כי הוא מופיע בסשן. ה-n8n של המערכת הוא מופע נפרד משלו (`n8n-__SYSTEM_NAME__.or-infra.com`).

## Factory-gateway (Google path) — GCP = Secret Manager only

מסלול Google (Gmail/Calendar/Drive) עובר דרך ה-**Workspace-MCP gateway** המשותף
(`factory-master-actions-mcp…run.app/workspace/__SYSTEM_NAME__/mcp`), עם bearer מערכתי (`workspace-mcp-bearer`).
זהות Google היא **המשותפת** — החשבון האישי של Or (`edri2or@gmail.com`); `user_google_email` שמועבר הוא
`edriorp38@or-infra.com` (רק תווית-אחסון, לא חשבון-הנתונים). תפקיד GCP כאן = **Secret Manager בלבד**.

## What was provisioned (the shell)

- פרויקט GCP `__SYSTEM_NAME__` + runtime-sa/deploy-sa + WIF (נעול לריפו זה).
- ~73 סודות ב-Secret Manager: מפתחות API גנריים (ממוחזרים מ-factory-control), מפתח OpenRouter ייעודי,
  bearers של ה-MCP (`workspace-mcp-bearer`/`factory-mcp-bearer`/`n8n-mcp-server-token`), ו-runtime shells.
- משתני-ריפו: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `SYSTEM_NAME`, `QUEUE_MODE`.
- n8n/Postgres/Caddy/DNS נפרסו ע"י `deploy-railway-cloudflare.yml`.
- **טרם קיים:** GitHub App ייעודי (יוקם כשסוכן צריך GitHub), וכל תוכן הסוכנים.

## External Resources

- [GCP Console](https://console.cloud.google.com/home/dashboard?project=__SYSTEM_NAME__) | [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=__SYSTEM_NAME__) | [Cloud Run](https://console.cloud.google.com/run?project=__SYSTEM_NAME__) | [IAM](https://console.cloud.google.com/iam-admin/iam?project=__SYSTEM_NAME__)

## Forbidden Actions

- **Never echo, print, or log values from Secret Manager.** Reference by name only.
- **Never run `gcloud projects delete`** against this project.
- **Never commit `.env*`, `*.pem`, or `*.key` files.**
- **Never disable branch protection** on the `main` branch. `main` is governed by a `protect-main`
  ruleset (installed by the factory's `protect-system-main.yml`): PR required, the CI checks
  (`shellcheck + yamllint` + `Scan for committed secrets`) required, force-push and deletion blocked.
  The repo also has `delete_branch_on_merge` on, so every merged branch is auto-deleted.
- **Never print, log, or write to disk** any minted GitHub-App installation token; never fetch a private key outside a GitHub Actions workflow.

## Deploy

- **`deploy-railway-cloudflare.yml`** (manual `workflow_dispatch`) — provisions Railway (n8n + Postgres),
  the Caddy HMAC gateway, and Cloudflare DNS `n8n-__SYSTEM_NAME__.or-infra.com`; fills the runtime secret shells.
  First deploy of a fresh system: pass `force_caddy_redeploy=true` so the Caddy edge builds from the latest commit.
- CI safety-net: `pipeline-tests.yml` (shellcheck + yamllint) + `secret-scan.yml`. Minimal by design.

---

*__SYSTEM_NAME__ — a clean sibling system built by `/new-system`. The infra shell is live; the agent organization is Or's to design.*
