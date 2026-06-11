# Google identities — who is who (authoritative)

> Read this whenever a task touches a Google account: the Cloud Console, an OAuth
> client / consent screen, the gateway "Login with Google", or the Workspace
> (Gmail / Calendar / Drive / Docs) data the factory operates on. There are
> **three distinct Google accounts**, each with one specific job. Conflating them —
> especially defaulting to the personal `edri2or@gmail.com` — has repeatedly caused
> friction and is the reason this doc exists. **Never assume; this is the map.**

## The purpose / directionality (Or's frame — the WHY, read this first)

Or, the owner, frames the accounts by **purpose**, and the docs + agents must hold this:

- **`or-infra.com` (`edriorp38`, `shared-google`) = the INFRASTRUCTURE we are building** — the
  system, the scaffolding, the plumbing. The *means*, not the end.
- **`edri2or@gmail.com` = Or's REAL personal life** — his actual day-to-day Gmail / Calendar.
  This is the **ultimate purpose** the email/calendar agents exist to serve: automating *his* life.

**Current state vs. that end goal (be honest about the gap):** today the workspace agents
operate on the infrastructure mailbox **`shared-google@or-infra.com`** — a deliberate, safe
sandbox so automations are built and proven *without* touching Or's real inbox. Pointing the
agents at Or's real **`edri2or@gmail.com`** is the end goal, and a **separate, deliberate step**
— never silently bundled into a plumbing change. So in Or's model `shared-google` sits inside the
"infrastructure" box; `edri2or@gmail.com` is the destination.

## The three accounts

| Account | Type | What it IS / what it's for | Proof |
|---|---|---|---|
| **`edriorp38@or-infra.com`** | Workspace (or-infra.com domain) | **THE operational / admin account** — **created by `edri2or@gmail.com`**, tied to the `or-infra.com` domain (Cloudflare-managed). It is where **all the GCP projects / Secret Manager and the OAuth 2.0 Client IDs live**. Owns the cloud projects and manages the OAuth clients + consent screens. This is the account Or is signed into in the **Google Cloud Console** — his console links resolve to **`authuser=1`** = this account. **Any task that needs Or to click in the Cloud Console, or to create/manage an OAuth client or consent screen → it is THIS account.** | `roles/owner` on `or-factory-master-control`; `roles/owner` **+ `roles/oauthconfig.editor`** on `factory-test-7` (IAM, 2026-06-11) — `oauthconfig.editor` = manages the OAuth brand/clients. |
| **`shared-google@or-infra.com`** | Workspace (or-infra.com domain) | **The INFRASTRUCTURE / sandbox mailbox the AI agents operate on TODAY** — the Gmail / Calendar / Drive / Docs that the workspace-mcp sidecar (and every system's n8n) currently read & write, so automations are proven without touching Or's real inbox. The `gmail-oauth-refresh-token` represents **this** account's consent; the workspace **consent "Allow"** that mints it is performed **signed in as this account** (until/unless the deliberate switch to `edri2or@gmail.com` — see Purpose above — is made). ⚠️ **The exact account the live workspace token represents must be verified before the next consent step** — it may already be `edri2or` itself (a Google security alert in Or's `edri2or@gmail.com` inbox shows the gateway app `factory-master-actions-mcp…run.app` already holds access to some of that account's data), with `shared-google` possibly only a cosmetic single-user label. | `WORKSPACE_GOOGLE_ACCOUNT_LABEL` / `user_google_email` in `scripts/render-mcp-service-yaml.sh:31`, `services/workspace-mcp/entrypoint.sh:16`, `scripts/google-mcp-smoke.py:37`. Has **no** cloud IAM roles (a pure data identity — absent from both project IAM policies). |
| **`edri2or@gmail.com`** | Personal **consumer** Gmail | **Or's REAL personal life — the ultimate target the email/calendar automations exist to serve** (his actual day-to-day account). Also the org's original creator/super-admin and the **billing.admin**; the identity the **Claude.ai Google integration** (this session's Gmail/Calendar/Drive tools) is connected as; and the **current** gateway login allowlist (`OAUTH_ALLOWED_EMAILS`). **NOT the cloud-operator account — do not default to it for console/OAuth work**, even though it is the eventual *data* destination. | `roles/billing.admin` on the billing account (`docs/external-state.md:71`); only minor BigQuery roles on `or-factory-master-control`; **absent** from `factory-test-7` IAM; Calendar primary id = `edri2or@gmail.com`; `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com` (`.github/workflows/deploy-mcp-server.yml:76`). |

## Per-purpose quick map (use this)

| Purpose | Account to use |
|---|---|
| Cloud Console clicks; create/manage an OAuth client + consent screen; GCP project ownership | **`edriorp38@or-infra.com`** (`authuser=1`) |
| The Workspace mailbox/calendar/drive the AI reads & writes; the OAuth **consent "Allow"** that mints `gmail-oauth-refresh-token`; `WORKSPACE_GOOGLE_ACCOUNT_LABEL` | **`shared-google@or-infra.com`** |
| Billing; org super-admin of last resort; current gateway login allowlist; the Claude.ai Google session integration | **`edri2or@gmail.com`** |

## Why it's structured this way (background)

- A **personal Gmail** (`edri2or@gmail.com`) was the initial super-admin when the
  `or-infra.com` Google Workspace / Cloud Identity org was bootstrapped — the normal
  starting path — but Google's own guidance is to run ongoing admin work with a
  **domain account**, not the personal Gmail. That domain operator account is
  **`edriorp38@or-infra.com`**. ([Cloud Identity super-admin best practices](https://docs.cloud.google.com/resource-manager/docs/super-admin-best-practices).)
- The browser **`authuser=N`** URL parameter selects which of several signed-in
  accounts a Google page uses (`authuser=0` = the first/default account,
  `authuser=1` = the second, …). Or's Cloud Console links resolve to **`authuser=1`**
  = his operator account `edriorp38@or-infra.com`, **not** the default
  `authuser=0` = `edri2or@gmail.com`. So a bare `console.cloud.google.com/...` link
  can silently land on the WRONG account; **always expect/aim for
  `edriorp38@or-infra.com`** for console work. ([Manage OAuth Clients / account switching](https://support.google.com/cloud/answer/6158849?hl=en).)

## Open flag (state of the config, not yet changed)

- The gateway operator-login allowlist is `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com`
  (the personal account). If the intent is for the operator to log into the gateway
  as the domain account `edriorp38@or-infra.com`, that is a one-line config change —
  **left as-is for now; raise with Or before changing.**

## Sources

- IAM evidence: `list_iam_bindings` on `or-factory-master-control` + `factory-test-7` (2026-06-11) — proven, not assumed.
- Code: `scripts/render-mcp-service-yaml.sh`, `services/workspace-mcp/entrypoint.sh`, `scripts/google-mcp-smoke.py`, `.github/workflows/deploy-mcp-server.yml`, `docs/external-state.md`.
- Google docs: [authuser / OAuth client management](https://support.google.com/cloud/answer/6158849?hl=en); [super-admin best practices](https://docs.cloud.google.com/resource-manager/docs/super-admin-best-practices).
