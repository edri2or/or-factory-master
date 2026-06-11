# Google identities — who is who (authoritative)

> Read this whenever a task touches a Google account: the Cloud Console, an OAuth
> client / consent screen, the gateway "Login with Google", or the Workspace
> (Gmail / Calendar / Drive / Docs) data the factory operates on. There are
> **three distinct Google accounts**, each with one specific job. Conflating them —
> especially defaulting to the personal `edri2or@gmail.com` — has repeatedly caused
> friction and is the reason this doc exists. **Never assume; this is the map.**

## The three accounts

| Account | Type | What it IS / what it's for | Proof |
|---|---|---|---|
| **`edriorp38@or-infra.com`** | Workspace (or-infra.com domain) | **THE operational / admin account.** Owns the cloud projects and manages the OAuth clients + consent screens. This is the account Or is signed into in the **Google Cloud Console** — his console links resolve to **`authuser=1`** = this account. **Any task that needs Or to click in the Cloud Console, or to create/manage an OAuth client or consent screen → it is THIS account.** | `roles/owner` on `or-factory-master-control`; `roles/owner` **+ `roles/oauthconfig.editor`** on `factory-test-7` (IAM, 2026-06-11) — `oauthconfig.editor` = manages the OAuth brand/clients. |
| **`shared-google@or-infra.com`** | Workspace (or-infra.com domain) | **The shared DATA mailbox the AI factory operates on** — the Gmail / Calendar / Drive / Docs that the workspace-mcp sidecar (and every system's n8n) read & write. The `gmail-oauth-refresh-token` represents **this** account's consent. The workspace **consent "Allow"** that mints that token must be performed **signed in as this account**. | `WORKSPACE_GOOGLE_ACCOUNT_LABEL` / `user_google_email` in `scripts/render-mcp-service-yaml.sh:31`, `services/workspace-mcp/entrypoint.sh:16`, `scripts/google-mcp-smoke.py:37`. Has **no** cloud IAM roles (a pure data identity — absent from both project IAM policies). |
| **`edri2or@gmail.com`** | Personal **consumer** Gmail | **Or's personal account** — the original creator/super-admin of the `or-infra.com` org and the **billing.admin**. Also the identity the **Claude.ai Google integration** (this session's Gmail/Calendar/Drive tools) is connected as, and the **current** gateway login allowlist (`OAUTH_ALLOWED_EMAILS`). **NOT the cloud-operator account — do not default to it for console/OAuth work.** | `roles/billing.admin` on the billing account (`docs/external-state.md:71`); only minor BigQuery roles on `or-factory-master-control`; **absent** from `factory-test-7` IAM; Calendar primary id = `edri2or@gmail.com`; `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com` (`.github/workflows/deploy-mcp-server.yml:76`). |

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
