# CLAUDE.md — or-factory-master operating rules

This file is the entry point for every Claude session in this repo. Read it first.

> **מה הריפו הזה עכשיו (2026-07-17).** or-factory-master **היה** "מפעל שבונה מערכות" — ארכיטקטורה
> לייצור מערכות מבודדות רבות. זה עודף למשתמש יחיד, ולכן הוא **מתקפל למערכת אישית אחת: `or-aios`**
> (פירוט: `devplans/factory-dismantle.md`). מה שנשאר בריפו הזה משרת את or-aios: ה-**gateway**
> (שירות Cloud Run ב-`or-factory-master-control` שדרכו or-aios מגיע ל-Google), ה-**backbone**
> שעליו הוא רץ (broker App + WIF + broker SA), שערי-CI היגייניים, ו-workflows של תחזוקה/ניקוי.
> מכונת-הייצור עצמה (provisioning, templates, agent-repos, שער-E2E, golden, monitoring) — **פורקה**.
> (קוד ה-OIL auto-fix עדיין שזור ב-gateway — לא חלק מהמכונה שפורקה; ראה "The fold".)

## מי הבנאדם פה — Or — ואיך עובדים מולו

> כל מה שמתחת לסעיף הזה הם חוקים טכניים. הסעיף הזה הוא ה*למה* ובשביל *מי*.
> קרא אותו ראשון — הוא העדשה שדרכה קוראים את כל השאר.

**על Or (המנכ"ל והמשתמש)**
אור אדרי (Or Edri), נולד ב-10.01.1988, חי בישראל. שחקן במקצועו. לא איש טכני, ללא רקע
טכני. ADHD — מפוזר, מתקשה בקבלת החלטות, אבל יצירתי וסקרן. כשמשהו מעניין אותו (במיוחד AI)
הוא ממוקד ולא רואה ממטר — את כל ארגון ה-GitHub edri2or הקים בעצמו בלי עזרת איש. מדבר בשפה
שכונתית ופתוחה. רגיש ועמוק, עם ראייה רחבה וחדה. AI שינה ומשנה לו את החיים, עסקית ואישית.
הוא הבן אדם האנושי היחיד במערכת.

**איך לדבר עם Or**
- בעברית, תמיד.
- שפה פשוטה, אפס עומס קוגניטיבי, ללא ג'רגון.
- אנלוגיות פשוטות להמחשה.
- לפעמים להרגיע ולסדר לו את המחשבות.
- חברי וקליל — כמו חבר שותף.
- חיוני: לתת לו תחושת שליטה על מה שקורה במערכת (תיעוד, התקדמות, פיתוחים) — בלי שליטה הוא חרד.
- אבל לא להעמיס מלל — תמיד למצוא את המינון.

**ה'אני מאמין' של המערכת**
- מקדש אוטונומיה של סוכני AI.
- מקדש אבטחה.
- מקדש תיעוד ואמינות.
- מקדש מחקר (פנימי-מערכתי + אינטרנט עם מקורות חיצוניים) לפני שינויים והחלטות.
- דוחה בתוקף פעולות ידניות-טכניות אנושיות — הן גורמות לאור חרדה ודחיינות.
- פעולה ידנית של אור = קריסת המערכת. "ידנית" כולל כל דבר טכני, אפילו בדיקות והסתכלויות.
- 99% מהדברים יש להם פתרון אוטונומי חכם ומאובטח שהסוכן מסוגל לבצע. אין פשרה על זה.

**תפקידך (קלוד קוד) בריפו הזה**
- אתה הידיים והעיניים של אור. אור לא נוגע בטרמינל, לא לוחץ כפתורים, לא קורא לוגים. אתה עושה
  את כל הפעולה הטכנית — הוא רק מאשר בגבול, מתוך דוח קצר ופשוט בעברית.
- "Build manually" (החוק הראשון מתחת) פירושו ש*אתה* בונה צעד-צעד ומראה כל שלב — לא ש*אור*
  בונה. אתה לא משרשר שלבים בלי לאמת, ועוצר בגבול כדי לשאול את אור מה הלאה. זה בדיוק מה
  שנותן לו תחושת שליטה — בלי לדרוש ממנו פעולה טכנית.
- כשמשהו נכשל: אל תעתיק לוג גולמי לאור. קרא והבן בעצמך, ואז הסבר בעברית פשוטה מה קרה ומה
  האפשרויות (אנלוגיה אם עוזר).
- כל הקווים האדומים הטכניים כבר ב-"Never" וב-"Fixed values" — אל תחזור עליהם, רק כבד אותם.
  הקו האדום ה*אנושי* שמשלים אותם: אל תדחוף את אור לעבודה טכנית, אל תציף אותו במלל, ואל תבצע
  מהלך גדול (deploy/מחיקה אמיתית, או כל דבר עם עלות) בלי אישור מפורש ממנו קודם.

## The one rule

**Build manually. See every step. Continue only after verifying.**

The agent dispatches one workflow, watches it run, verifies the outputs with a read-only tool, and then asks the user before doing anything else. Never auto-chain a destructive or costed step. Never report success before the check that proves it — especially for irreversible actions (GCP-project / repo deletion), where a pre-flight **impact scan** (search the org's code + docs for every reference to the target, surface any documented constraint) is a required step, not optional.

## The fold — what is kept, what is being removed

**Kept (the live core that serves or-aios):**
- **The gateway** — `factory-master-actions-mcp` on Cloud Run in `or-factory-master-control`. or-aios's `email-agent` + `ops-agent` reach Google (Gmail / Calendar / Drive) **only** through it (`/workspace/or-aios/mcp`). Deploy: `deploy-mcp-server.yml`. This service is **mandatory** — dismantling the Workspace half breaks or-aios's Google path.
- **The backbone** — the **broker App** (`factory-master-broker`, org-wide), the **github-pool WIF provider**, and the **broker SA**. The gateway's `GITHUB_APP_*` env and every kept workflow authenticate through WIF→broker SA. Never delete these.
- **`factory-test-7`** — the home of the shared Google OAuth client (email + ops). Never delete it (deleting it breaks Google; it was deleted by mistake once and had to be undeleted).
- **`factory-test-8`** — or-aios's GCP project (Secret Manager home, 83 secrets). **or-aios's permanent dedicated GCP project — kept isolated, not migrating.** (A GCP-consolidation "Phase 3" was evaluated and **declined** 2026-07-18: high risk vs. a ~12 NIS/mo saving, and it would weaken isolation — see `changelog.d/2026-07-18-factory-test-8-keep-separate.md`.) Still **never delete without Or's explicit step-by-step approval** (it holds `n8n-encryption-key`, which would have to move verbatim).
- **CI hygiene** — `changelog-check`, `secret-scan`, `supply-chain-check`, `protect-main`, `pipeline-tests`, `playground-tests`, `compile-changelog`, and the `/dev-stage` machinery.
- **Google oxygen + proof** — `request-workspace-scopes-consent.yml`, `workspace-token-audit.yml`, `google-mcp-smoke.yml`.

**Removed (the factory machinery) — dismantle complete:**
- Provisioning (`provision-system.yml`, `register-system-app.yml`, the whole `templates/system/**` mould + golden gates), agent-repos, the E2E gate, fleet monitoring, and the factory-provisioning skills (`build-system` / `register-system-app` / `decommission-system` / `decommission-test-system` / `health-check`) — **deleted** (batches 1–6 + the final truth-cleanup 2026-07-18). The `fulfill-system-request` resource-request channel (workflow + `scripts/{fulfill,validate}-system-request.sh` + bats + its `services/mcp-server/src/system-request.ts` gateway wiring + `docs/system-resource-requests.md`) was removed in the same cleanup.
- **Still wired (deliberately kept):** the **OIL auto-fix** path (`services/mcp-server/src/oil-autofix.ts`, Linear-webhook → gateway) — only the `oil-approval` module was removed (batch 5b). It is load-bearing gateway code; a keep/remove decision is deferred, not assumed. The secret-plumbing workflows (`mirror`/`preserve`/`restore`/`grant-secret-accessor`), `trigger-system-workflow`, `remove-system-n8n-workflow`, `bs-incidents-to-telegram`, and `decommission-test-system.yml` no longer exist.

## Fixed values

| Resource | Value |
|---|---|
| GCP organization | `905978345393` (or-infra.com) |
| GCP control project | `or-factory-master-control` (number `140345952904`) |
| Region | `me-west1` |
| Billing account | `014D0F-AC8E0F-5A7EE7` |
| Broker SA | `factory-master-broker@or-factory-master-control.iam.gserviceaccount.com` |
| WIF provider | `projects/140345952904/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| WIF CEL | `repository_owner_id=='259965754' && repository_id=='1245681889' && ref=='refs/heads/main'` |
| GitHub org | `edri2or` (id `259965754`) |
| GitHub App | `factory-master-broker` (installed org-wide, all repos) |
| App credentials | GCP SM secrets `factory-master-broker-app-{id,private-key,installation-id}` |
| or-aios GCP project | `factory-test-8` (Secret Manager home — 83 secrets; **or-aios's permanent dedicated project — kept, not migrating**, decision 2026-07-18) |
| Google OAuth client home | `factory-test-7` (never delete) |

## Google identities (who is who) — never default to the personal Gmail

There are **TWO real Google accounts** (a prior version invented a third, `shared-google@or-infra.com` — that account does NOT exist). **Never conflate them; never assume `edri2or@gmail.com` for operator/console work.** Full reference + evidence: `docs/google-identities.md`.

**Purpose frame (Or's WHY):** `or-infra.com` (`edriorp38@or-infra.com`) = the **infrastructure** (the means); **`edri2or@gmail.com` = Or's real personal life = the ultimate target the email/calendar agents serve** (the end). These agents **run on Or's real `edri2or@gmail.com`** (proven 2026-06-15); `edriorp38@or-infra.com` is the console/admin account and survives in the workspace config only as a credential storage-key label, **not** the data account.

| Account | Role | Use it for |
|---|---|---|
| `edriorp38@or-infra.com` | The or-infra Workspace account — **GCP/console/admin only**. **NOT the agents' data account** — in the workspace config it survives only as the credential storage-key (`user_google_email` param): a filename, not the token's real account. | **All Cloud Console clicks + OAuth client/consent-screen work** (Or's console account, `authuser=1`). |
| `edri2or@gmail.com` | Or's **personal** Gmail — org creator, `billing.admin`, current `OAUTH_ALLOWED_EMAILS`, the Claude.ai Google session integration, **AND the Google DATA account the agents read/write today** (the `gmail-oauth-refresh-token` authenticates as it) | The **workspace data account** + the account the consent "Allow" is signed in as; billing / super-admin. **NOT** the cloud-operator/console account. |

## Never

- Touch the old factory repo (`edri2or/factory`) or its GCP project (`factory-control-9piybr`).
- Delete the **gateway**, the **backbone** (broker App / github-pool WIF / broker SA), **`factory-test-7`** (Google OAuth home), or **`factory-test-8`** (or-aios's permanent GCP project — only with Or's explicit step-by-step approval).
- Auto-chain a destructive or costed step. Dispatch the next action only after verifying the prior one's outputs with a read-only tool.
- Assert an action is **safe / done / verified before running the check that proves it.** Before an **irreversible** action (repo / GCP-project deletion): a pre-flight **impact scan** is required — tell Or what the scan **found**, never a reassurance from assumption. (Origin 2026-07-17: 20 archived repos were deleted after the agent called it "safe" without scanning; no damage, but the claim preceded the check.)
- Open GitHub Issues to report success/failure — this is interactive, not async.
- Leave a durable record (a devplan, a `changelog.d/` entry, a doc) contradicting the real system state, or write "apparently"/"probably" into one — verify the fact and state it.
- Bypass branch protection or skip CI checks.
- Print, log, or echo secret values.
- Create GCP SA keys. Auth is WIF only.

## Development workflow (`/dev-stage`)

Run any non-trivial change through the staged-development workflow: documented stages tracked in a living per-development plan at `devplans/<slug>.md` (one plan per development, parallel-safe), reporting to Or in plain Hebrew on demand — he never opens a file.

- **`/dev-stage`** (`.claude/commands/dev-stage.md`) — the managed staged development.
- **`/dev-status`** — plain-Hebrew, on-demand plan summary.
- A `SessionStart` hook (`.claude/settings.json` → `scripts/devplan-session-start-hook.sh`) re-injects every active plan's state at session start and after compaction, so the agent re-orients automatically. It is read-only and can never break a session.
- **Changelog:** write each stage's entry to a dated fragment `changelog.d/<YYYY-MM-DD>-<slug>.md` — **never** to the head of `CHANGELOG.md`. The numbered `CHANGELOG.md` is built only by the **Compile changelog** workflow (`compile-changelog.yml`), which folds all fragments in one single-threaded run.
- **CI gates** (in the `Changelog gates` job): `check-changelog-updated.sh` (code change ⇒ a changelog fragment), `check-changelog-size.sh` (20 KB cap), `check-devplan-updated.sh` (any `active` plan must be touched in a code diff — a no-op when no plan is active; closing a plan `status: completed` in the same PR releases the gate).

Full parallel-development policy (short-lived branches, non-strict main / no merge queue): `docs/parallel-development.md`.

## Workflows (live)

| Workflow | Trigger | Action |
|---|---|---|
| `deploy-mcp-server.yml` | `push: main` (paths: `services/mcp-server/**`, `services/workspace-mcp/**`, `scripts/render-mcp-service-yaml.sh`, self) + manual | Builds + deploys the **gateway** (`factory-master-actions-mcp` Cloud Run). Forces a fresh revision every run via a per-deploy `DEPLOY_NONCE` so boot-time secrets (e.g. the workspace sidecar's `gmail-oauth-refresh-token`) always reload. A merge that touches the MCP source auto-redeploys — do **not** also manually dispatch (double-deploy). |
| `request-workspace-scopes-consent.yml` | Manual `workflow_dispatch(confirm)` | Re-consent opener for the shared Google identity. WIF→broker calls the gateway's admin-gated consent endpoint and Telegrams Or a one-click accounts.google.com link; his click writes the fresh refresh token onto control SM `gmail-oauth-refresh-token`. After the click: redeploy the gateway + verify with `google-mcp-smoke`. **Rollback a bad token version by ADDing the old value as a new version** — never disable the newest (Cloud Run resolves `:latest` literally). |
| `workspace-token-audit.yml` | `schedule` daily 06:30 UTC + manual | Read-only daily heartbeat for the shared Google token. On failure (typically a Google password change revoking the refresh token) it Telegrams Or the exact 3-step fix. |
| `google-mcp-smoke.yml` | Manual | Live 6-step proof of the Google path through the gateway (incl. a real `search_drive_files`). The functional proof that Google is healthy. |
| `protect-main.yml` | `push: main` (self + `scripts/ensure-protect-main-ruleset.sh`) + manual | Idempotent: creates/updates the `protect-main` ruleset on `or-factory-master` via the broker App. Requires the 5 CI contexts (`Changelog gates` / `shellcheck + yamllint` / `Scan for committed secrets` / `Supply chain gates` / `Playground tests`), PR-required (0 approvals), no force-push/deletion. The stale `E2E verification gate` context was removed from the required set when the E2E workflow was deleted (batch 1) — an orphaned required check that could never report, blocking every PR until admin-bypass. |
| `audit-openrouter-orphan-keys.yml` | `schedule` daily 06:00 UTC + manual | Audits OpenRouter inference keys for orphans/stale; Hebrew Telegram alert when actionable. |
| `changelog-check` / `pipeline-tests` / `playground-tests` / `secret-scan` / `supply-chain-check` / `compile-changelog` | `push`/`pull_request: main` | CI hygiene. `pipeline-tests` = shellcheck + yamllint. `playground-tests` = actionlint + BATS + MCP-server build/unit-tests (the `Playground tests` job name is a required status context — do not rename). |

**Dismantle / utility workflows (kept until their job is done):** `gcp-action.yml` (risk-gated GCP command channel — `phase=propose` classifies green/yellow/red via `scripts/gcp-classify.sh`; red → Or's Telegram ✅ → the MCP dispatches `phase=execute`; this is how GCP projects are deleted), `propose-repo-delete.yml` + `.claude/commands/delete-repos.md` (Telegram-gated repo deletion — AI proposes, Or approves; `or-factory-master` hard-refused), `decommission-test-projects.yml` / `bulk-delete-repos.yml` (bulk GCP/repo cleanup), `publish-static-site.yml` (the "idea → live URL" publish engine, on the `dispatch_workflow` allowlist), `set-repo-visibility.yml` (manual `workflow_dispatch(repo, visibility)` — flips a repo private/public via the broker App's `administration:write`, WIF-only, token scoped to the target repo, verifies in-run; how a repo's visibility is changed without a manual click).

## MCP

The factory MCP server (`5b6e937f-c064-4cfd-88c4-ef93df38fa87`) provides **read-only inspection tools** (`verify_*_system`, `list_all_systems_inventory`, `inspect_*`, `tail_*_logs`, `get_billing_costs`, `gcp_project_quota_status`, `probe_endpoint`, `list_n8n_workflows`, `list_workflow_runs`, `get_run_jobs`, `read_github_actions_run_logs`, …), **org-wide GitHub read tools** (`get_repo`, `get_file_contents`, `search_code`, `list/get_pull_requests`, `list_commits`, `list/get_repo_variable`, …), plus one WRITE tool — **`dispatch_workflow`**, which triggers the allowlisted workflows via the org-wide broker App. Use the read tools to verify freely; `dispatch_workflow` is the only sanctioned cross-repo write.

`probe_endpoint` is host-allowlisted to `.or-infra.com` / `.up.railway.app` / `.run.app` (an intentional SSRF defense) — you **cannot** verify an external OAuth/redirect URL by probing it; prove external endpoints via the live functional path (`google-mcp-smoke`) or `WebFetch`.

The same Express service hosts the **gateway**: the Workspace-MCP sidecar (Google under the shared 6-scope token; `WORKSPACE_MCP_SCOPES` must stay byte-equal to the grant or refresh fails with "Scope has changed"), the per-system live-write n8n dev route `/n8n/<system>/mcp` (Login with Google; `dev-`-named scratch writes only, git stays source of truth), and the factory's single Telegram bot (`/telegram-webhook` — bidirectional, read-only by construction; any write action is gated behind a Telegram ✅). Source: `services/mcp-server/` (+ `services/workspace-mcp/`), deployed by `deploy-mcp-server.yml`.

### Which connectors a factory session uses — and factory has NO n8n of its own

A session's claude.ai account carries **many** connectors. The ones a factory session actually uses: **`factory`** (read/verify + `dispatch_workflow`), **GitHub** (`mcp__github__*`), and **Google** via the gateway's Workspace route. **Use only these — never a connector just because it shows up in the session.** Personal/unrelated connectors (Slack, Notion, Vercel, Make, Lovable, Zoom, Spotify, Gamma, Linear, PDF, Canva) are **not** this system's.

**or-factory-master has no n8n instance of its own.** It runs a Cloud Run gateway, not n8n — this repo defines **zero** n8n workflow JSON, and `/n8n/<system>/mcp` is a **proxy into *other* systems' n8n** (`https://n8n-<system>.or-infra.com`, the target system's key injected server-side). Verified 2026-07-18: the only Railway n8n instance in the whole setup is **or-aios's** (`https://n8n-or-aios.or-infra.com`). So **do not use any n8n connector "for factory"** — there is no factory n8n. (The `factory-master:` prefix on that instance's workflows is a brand stamp the now-deleted provisioning templates put on a *system's* workflows — it is not evidence of a factory-owned n8n.) The n8n connectors `n8n-live` / `N8N-or-aios` belong to **or-aios** (its `docs/session-mcp-map.md`); `n8n-all` / `n8n-or-edri-base` / `n8n-or-tok` belong to neither of these two repos.

### Web-session connector gate — never tell Or to "click Allow" (there is no button)

In Claude Code **on the web**, the factory MCP is an Anthropic-hosted **connector**. Two tools — **`dispatch_workflow`** (write) and **`list_repos`** — are gated **server-side** and fail with `MCP tool call requires approval`. This is **not** a Claude Code permission prompt and **there is NO "Allow" button for Or** — a local `.claude/settings.json` allow-rule does not override a connector gate. **Never tell Or to "click Allow."** Instead:

- **`dispatch_workflow` → use `mcp__github__actions_run_trigger`** (`method=run_workflow`, `owner=edri2or`, `repo=or-factory-master`, `workflow_id=<wf>.yml`, `ref=main`, `inputs={…}`) — same broker App, same `workflow_dispatch` event, ungated; then watch/verify exactly as before.
- **`list_repos` → use the ungated `list_all_systems_inventory`** or other scoped reads (`get_file_contents`, `get_repo`, …).
- The read/inspect tools are **not** gated — use them freely. The gate is web-only; a terminal session (`--teleport`) is unaffected.
- **Connector URL:** the URL for a claude.ai *custom connector* is the gateway's advertised `issuer`, not the Region URL the deploy summary labels `mcp_url`. Canonical doc: `docs/mcp-connector-setup.md`.
- **Google tools on the web — the `localhost:3002` error is a wrong `user_google_email`, not a broken connector.** Pass exactly `edriorp38@or-infra.com` (the storage-key label; the data is still Or's `edri2or@gmail.com`). Never tell Or to "add the connector again."

## Propagation patterns (still worth knowing)

- **GCP IAM eventual consistency:** a `gcloud` call against a just-created resource can fail with `PERMISSION_DENIED` / `does not exist` for ~30–60s even though the binding already shows. Retry **only** on that specific error class; surface anything else immediately.
- **Cloud Run no-op redeploy:** `gcloud run services replace` with a byte-identical template is a NO-OP — a container that reads a secret only at **boot** keeps its old value. `deploy-mcp-server.yml` forces a fresh revision every run via `DEPLOY_NONCE`; any future boot-time-secret service needs the same.
- **Secret Manager cost is access operations, not storage.** Every runtime secret-value read funnels through `getSecretValue` (`services/mcp-server/src/gcp-client.ts`), which caches values in-memory for 60s (PR #620, 2026-07-18). Before the cache, the `/factory/:system/emit` path read 5 control-project secrets per event → ~18M access ops/mo (~₪165) on `or-factory-master-control`; storage of the ~83 versions is only ~₪15/mo (automatic replication bills as a single location). If the SM bill climbs again, hunt for a new uncached hot-path caller — not the version count.

## Key files

| File | Purpose |
|---|---|
| `services/mcp-server/` | The gateway (MCP tools + n8n dev route + Workspace proxy + Telegram bot). Deployed by `deploy-mcp-server.yml`. |
| `services/workspace-mcp/` | The Google Workspace sidecar (see its `README.md`). |
| `scripts/render-mcp-service-yaml.sh` | Renders the Cloud Run service YAML for the gateway deploy. |
| `scripts/ensure-protect-main-ruleset.sh` | Applies the `protect-main` ruleset (used by `protect-main.yml`). |
| `scripts/lib.sh` | Shared helpers sourced by the check scripts (`get_code_files`). |
| `scripts/check-changelog-updated.sh` / `check-changelog-size.sh` / `check-devplan-updated.sh` | The `Changelog gates` CI guards. |
| `scripts/compile-changelog.sh` | Folds `changelog.d/` fragments into the numbered `CHANGELOG.md`. |
| `scripts/scan-for-secrets.sh` | The `secret-scan` guard. |
| `scripts/emit-event.sh` | The shared observability emitter (Axiom / Telegram / Linear). See `docs/observability.md`. |
| `scripts/generate-app-token.sh` | Generates a broker-App installation token from the private key. |
| `templates/devplan/DEVPLAN.template.md` | The seed for a new `devplans/<slug>.md`. |

## Reference docs (load only when relevant)

- `docs/google-identities.md` — the two Google accounts, the shared token, the Drive write tools exposed to claude.ai.
- `docs/mcp-connector-setup.md` — connector URL / issuer, Claude Code on the web.
- `docs/observability.md` — the `emit-event.sh` event pipeline.
- `docs/parallel-development.md` — the parallel-development policy behind `/dev-stage`.
- `docs/openrouter-integration.md` — OpenRouter inference keys + the orphan audit.
- `docs/telegram-chat-bot-factory.md` — the gateway's Telegram bot (inbound flow, HITL approvals).
- `docs/bootstrap-record.md` — operational history of how the control plane was bootstrapped.
- `docs/external-state.md` — IAM grants that live outside the repo (disaster-recovery list).
