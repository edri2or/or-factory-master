# Google identities — who is who (authoritative)

> Read this whenever a task touches a Google account: the Cloud Console, an OAuth
> client / consent screen, the gateway "Login with Google", or the Workspace
> (Gmail / Calendar / Drive / Docs) data the factory operates on. **Never assume.**
>
> ⚠️ **Correction (2026-06-11).** An earlier version of this doc invented a third
> account, `shared-google@or-infra.com`, and described it as the agents' data
> mailbox. **That account does NOT exist** — it was a fictional
> `WORKSPACE_GOOGLE_ACCOUNT_LABEL` string. There are exactly **TWO** real Google
> accounts. The shared workspace token actually belongs to **`edriorp38@or-infra.com`**
> (confirmed by Or directly). The rebuilt workspace-mcp enforces that the token's
> account matches the label, so the fictional label broke every Google read until
> it was corrected to `edriorp38@or-infra.com` (google-wallet-unify, 2026-06-11).

## The TWO real accounts

| Account | Type | What it IS / what it's for | Proof |
|---|---|---|---|
| **`edri2or@gmail.com`** | Personal **consumer** Gmail | **Or's REAL personal life — the ultimate target the email/calendar automations exist to serve** (his actual day-to-day account). Also the org's original creator/super-admin, the **billing.admin**, the identity the **Claude.ai Google integration** (this session's Gmail/Calendar/Drive tools) is connected as, and the current gateway login allowlist (`OAUTH_ALLOWED_EMAILS`). **NOT the cloud-operator account.** | `roles/billing.admin` (`docs/external-state.md:71`); only minor BigQuery roles on `or-factory-master-control`; absent from `factory-test-7` IAM; Calendar primary id = `edri2or@gmail.com`; `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com` (`.github/workflows/deploy-mcp-server.yml`). |
| **`edriorp38@or-infra.com`** | Workspace (or-infra.com domain) | **The or-infra Workspace account — it plays TWO roles today.** (1) **Operator / admin:** `owner` of `or-factory-master-control`, `owner` + `oauthconfig.editor` of `factory-test-7`; where the GCP projects / Secret Manager and OAuth clients live; the account Or is signed into in the **Cloud Console** (`authuser=1`); all console + OAuth-client/consent-screen work, incl. the consent-screen support/contact email. (2) **The workspace DATA mailbox the AI agents operate on TODAY** — the Gmail / Calendar / Drive / Docs the workspace-mcp sidecar reads & writes; the account the shared `gmail-oauth-refresh-token` belongs to; the value of `WORKSPACE_GOOGLE_ACCOUNT_LABEL`. | IAM (2026-06-11): `roles/owner` on control; `roles/owner` + `roles/oauthconfig.editor` on `factory-test-7`. Confirmed by Or as the real or-infra account **and** the token's account ("shared-google@or-infra.com? the account is edriorp38@or-infra.com"). |

## Purpose frame (Or's WHY)

- **`or-infra.com` (`edriorp38@or-infra.com`) = the INFRASTRUCTURE being built** — the means/scaffolding.
- **`edri2or@gmail.com` = Or's REAL personal life** — the **ultimate target** the email/calendar agents exist to serve (the end).
- **Current state:** the agents operate on the **`edriorp38@or-infra.com`** infra account (its mailbox is the workspace data identity today). Pointing them at Or's real **`edri2or@gmail.com`** is the end goal, and a **separate, deliberate step** — never silently bundled into a plumbing change.

## Per-purpose quick map (use this)

| Purpose | Account |
|---|---|
| Cloud Console clicks; create/manage an OAuth client + consent screen; GCP project ownership; the consent-screen support/contact email | **`edriorp38@or-infra.com`** (`authuser=1`) |
| The Workspace mailbox/calendar/drive the AI reads & writes; `WORKSPACE_GOOGLE_ACCOUNT_LABEL`; the account the OAuth **consent "Allow"** is signed in as | **`edriorp38@or-infra.com`** |
| Billing; org super-admin; current gateway login allowlist; the Claude.ai Google session integration; the ULTIMATE goal the agents serve | **`edri2or@gmail.com`** |

## Background

- A **personal Gmail** (`edri2or@gmail.com`) bootstrapped the `or-infra.com` Workspace / Cloud Identity org (the normal starting path), but Google's own guidance is to run ongoing admin work with a **domain account**, not the personal Gmail — that domain account is **`edriorp38@or-infra.com`**. ([super-admin best practices](https://docs.cloud.google.com/resource-manager/docs/super-admin-best-practices).)
- The browser **`authuser=N`** parameter selects which signed-in account a Google page uses (`authuser=0` = first/default, `authuser=1` = second, …). Or's Cloud Console links resolve to **`authuser=1`** = `edriorp38@or-infra.com`, not `edri2or@gmail.com`. A bare `console.cloud.google.com/...` link can land on the WRONG account; **always aim for `edriorp38@or-infra.com`** for console work. ([account switching](https://support.google.com/cloud/answer/6158849?hl=en).)
- **There is no dedicated "shared" data mailbox.** The agents currently operate on `edriorp38`'s own mailbox. A dedicated service mailbox could be created later, but does not exist today.

## Lesson (why this doc was wrong before)

A prior session set `WORKSPACE_GOOGLE_ACCOUNT_LABEL=shared-google@or-infra.com` as a *label*, on the assumption "Google authenticates by the token, not the label." That held only for the OLD workspace-mcp image; the **rebuilt** image enforces that the token's authenticated account matches the label, so the fictional label broke every Google read. **Don't document an inferred label as if it were a real account; the human (Or) is the authority on which accounts exist.**

## Open flag (state of the config, not yet changed)

- The gateway operator-login allowlist is `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com` (the personal account). If the operator should log into the gateway as `edriorp38@or-infra.com`, that's a one-line config change — **left as-is; raise with Or before changing.**

## Sources

- IAM: `list_iam_bindings` on `or-factory-master-control` + `factory-test-7` (2026-06-11) — proven, not assumed.
- Or (authoritative, 2026-06-11): "shared-google@or-infra.com? the account is edriorp38@or-infra.com".
- Code: `scripts/render-mcp-service-yaml.sh`, `services/workspace-mcp/entrypoint.sh`, `scripts/google-mcp-smoke.py`, `.github/workflows/deploy-mcp-server.yml`, `docs/external-state.md`.
