# Google identities — who is who (authoritative)

> Read this whenever a task touches a Google account: the Cloud Console, an OAuth
> client / consent screen, the gateway "Login with Google", or the Workspace
> (Gmail / Calendar / Drive / Docs) data the factory operates on. **Never assume.**
>
> ⚠️ **Correction (2026-06-15) — the workspace DATA token is Or's PERSONAL account.**
> A live ownership test (a file freshly created **through the connector** came back owned
> by `edri2or@gmail.com`, with no sharing) **proved** the deployed workspace token
> (`gmail-oauth-refresh-token`) authenticates as **`edri2or@gmail.com`** (Or's personal
> account) — NOT `edriorp38@or-infra.com`. An earlier note here claimed the data account
> was `edriorp38` and that "the rebuilt workspace-mcp enforces the token's account matches
> the label"; **both are wrong** — live behaviour shows a token authenticating as `edri2or`
> works fine under the `edriorp38` label, so the label does **not** constrain the account.
> `edriorp38@or-infra.com` is real, but it is the **GCP / console / admin** account, and it
> survives in the workspace config only as a **credential-file storage-key / `user_google_email`
> param** — a filename, not the data account. (A still-earlier note invented a third account,
> `shared-google@or-infra.com`, which does NOT exist — it was a fictional label.)

## The TWO real accounts

| Account | Type | What it IS / what it's for | Proof |
|---|---|---|---|
| **`edri2or@gmail.com`** | Personal **consumer** Gmail | **Or's REAL personal life — AND the Google DATA account the AI agents actually read & write today.** The Gmail / Calendar / Drive / Docs the workspace-mcp sidecar operates on; **the account the shared `gmail-oauth-refresh-token` authenticates as** (whoever clicked the workspace consent "Allow" — Or, on his personal account). Also the org's original creator/super-admin, the **billing.admin**, the **Claude.ai Google integration** identity, and the gateway login allowlist (`OAUTH_ALLOWED_EMAILS`). **NOT the cloud-operator/console account.** | A file freshly created via the connector is owned by `edri2or@gmail.com` (2026-06-15 — airtight: a new file has no prior sharing, so its owner = the authenticating account). `roles/billing.admin` (`docs/external-state.md:71`); `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com` (`.github/workflows/deploy-mcp-server.yml`). |
| **`edriorp38@or-infra.com`** | Workspace (or-infra.com domain) | **The or-infra Workspace account — the GCP / console / admin identity.** `owner` of `or-factory-master-control`, `owner` + `oauthconfig.editor` of `factory-test-7`; where the GCP projects / Secret Manager and OAuth clients live; the account Or is signed into in the **Cloud Console** (`authuser=1`); all console + OAuth-client / consent-screen work, incl. the consent-screen support/contact email. **It is NOT the agents' data account** — in the workspace config it survives only as the credential-file storage-key (`WORKSPACE_GOOGLE_ACCOUNT_LABEL`) and the `user_google_email` param: a filename that does not reflect the token's real account. | IAM (2026-06-11): `roles/owner` on control; `roles/owner` + `roles/oauthconfig.editor` on `factory-test-7`. |

## Purpose frame (Or's WHY)

- **`or-infra.com` (`edriorp38@or-infra.com`) = the INFRASTRUCTURE / console-admin identity** — the means/scaffolding (GCP projects, OAuth clients, Secret Manager).
- **`edri2or@gmail.com` = Or's REAL personal life** — the **ultimate target** the email/calendar agents exist to serve (the end).
- **Current state (2026-06-15):** the agents **already operate on Or's real `edri2or@gmail.com`** (proven). This is the stated end-goal account, and Or has **accepted** it as the current state — with the claude.ai write-tool safeguards in place ("Needs approval" on writes; OFF in Research). The credential is still *labelled* `edriorp38@or-infra.com` for historical/storage reasons — a filename, not the account.

## Per-purpose quick map (use this)

| Purpose | Account |
|---|---|
| Cloud Console clicks; create/manage an OAuth client + consent screen; GCP project ownership; the consent-screen support/contact email | **`edriorp38@or-infra.com`** (`authuser=1`) |
| The Workspace mailbox / calendar / drive the AI reads & writes; the account the OAuth **consent "Allow"** is signed in as | **`edri2or@gmail.com`** |
| The `WORKSPACE_GOOGLE_ACCOUNT_LABEL` value / the `user_google_email` param (a credential storage-key, **NOT** the data account) | the literal string `edriorp38@or-infra.com` (**keep as-is** — changing it breaks callers) |
| Billing; org super-admin; gateway login allowlist; the Claude.ai Google session integration | **`edri2or@gmail.com`** |

## Background

- A **personal Gmail** (`edri2or@gmail.com`) bootstrapped the `or-infra.com` Workspace / Cloud Identity org (the normal starting path), but Google's own guidance is to run ongoing **console/admin** work with a **domain account**, not the personal Gmail — that domain account is **`edriorp38@or-infra.com`** (console/admin only; the agents' DATA is Or's personal account). ([super-admin best practices](https://docs.cloud.google.com/resource-manager/docs/super-admin-best-practices).)
- The browser **`authuser=N`** parameter selects which signed-in account a Google page uses (`authuser=0` = first/default, `authuser=1` = second, …). Or's Cloud Console links resolve to **`authuser=1`** = `edriorp38@or-infra.com`. A bare `console.cloud.google.com/...` link can land on the WRONG account; **always aim for `edriorp38@or-infra.com`** for console work. ([account switching](https://support.google.com/cloud/answer/6158849?hl=en).)
- **The workspace credential is *labelled* `edriorp38@or-infra.com`, but the token authenticates as `edri2or@gmail.com`.** The label is the credential-file name / `user_google_email` routing key — it does NOT change which account the token belongs to. **Do not "fix" the label to match the account:** callers (the systems' n8n agents, `google-mcp-smoke.py`) pass `edriorp38@or-infra.com` to locate the credential, so changing it would break them. Realigning the label is a separate, tested change, not a doc fix.

## Drive write tools exposed to claude.ai (write = trash / move / rename / edit)

The Workspace MCP sidecar (`workspace-mcp==1.21.1`, **all 12 tool groups** — `--tools calendar
gmail drive docs sheets slides forms tasks chat contacts search appscript`,
`WORKSPACE_MCP_READ_ONLY=0`; full set + feasibility in `docs/google-tools-feasibility.md`) runs
**write-enabled** on Or's personal **`edri2or@gmail.com`**
Drive (the account the shared token authenticates as — see above). claude.ai reaches it through
the gateway route `/workspace/<system>/mcp` (the operator `oauth` bearer is allowed there). The
official Claude↔Drive connector only surfaces read+create; these write tools were simply never
exposed — connecting the gateway as a custom connector exposes them (no new code; the tools
already ship in the sidecar).

- **`update_drive_file` does four write actions:**
  - **Delete = trash only** (`trashed=true`) — **reversible**, by design. There is **no
    hard-delete** tool in the package; permanent deletion is not possible through this surface.
  - **Move** — `add_parents` / `remove_parents`.
  - **Rename** — `name`.
  - **In-place content edit** — `content`, **limited to Google Docs / Sheets / Slides**
    (Google-native MIME types). Arbitrary binary content is rejected (`ValueError`).
- **Non-native content edit: `edit_drive_file_content`** (gateway-owned, not from the package).
  Rewrites the **content** of a **non-native** file (`.md` / `.txt` / any binary) via the Drive
  API `files.update` media path — the gap `update_drive_file` leaves. It is a **synthetic MCP
  tool** the gateway injects into the workspace `tools/list` and handles itself
  (`services/mcp-server/src/workspace-drive-edit.ts`; facade in `workspace-mcp-proxy.ts`): mints
  the shared token from SM and calls Drive. A **MIME guard refuses Google-native files** (those
  stay on `update_drive_file`). **No scope change** (the shared token already holds `…/auth/drive`)
  and **no package fork**. Same write gate as the rest (`OAUTH_ALLOWED_EMAILS` + HITL). Proven live
  on `or-edri-4` (2026-06-16, `drive-edit-smoke.yml`). Provide `file_id` + exactly one of `content`
  (text) / `content_base64` (binary).
- **The one gate that limits WHO can drive these writes is `OAUTH_ALLOWED_EMAILS`** (the
  gateway Google-login allowlist, `.github/workflows/deploy-mcp-server.yml`). It is set to **Or
  only** (`edri2or@gmail.com`). Empty = **fail-closed** (nobody can log in) — a deploy preflight
  guard fails the deploy loudly if it ever regresses to empty. `WORKSPACE_ALLOWED_SYSTEMS="*"`
  is **not** a write gate (pinning it adds no real security and would 404 other systems'
  legitimate workspace-route access).
- **⚠️ Turn write tools OFF in claude.ai _Research_ mode.** In Research, connector tools are
  called **automatically, without per-call confirmation** (Anthropic's own guidance). Because the
  token is Or's **personal** Drive, a prompt-injection during Research could trash / rename / move
  / edit across all of it. Reduce the dangerous tools (`manage_drive_access`,
  `set_drive_file_permissions`, `transfer_owner`) in the claude.ai connector UI ("Search and
  tools"), and keep write tools disabled for Research tasks.
- **⚠️ Do NOT narrow capability via scopes.** `--permissions drive:readonly` or editing
  `WORKSPACE_MCP_SCOPES` changes the scopes the sidecar requests and breaks the **byte-equal**
  contract — **four sites** must stay identical: `WORKSPACE_SCOPES`
  (`services/mcp-server/src/google-oauth.ts`), `WORKSPACE_MCP_SCOPES`
  (`scripts/render-mcp-service-yaml.sh`), `default_scopes` (`services/workspace-mcp/entrypoint.sh`),
  and the test literal (`services/mcp-server/test/google-oauth.test.mjs`) → otherwise token refresh
  fails with **"Scope has changed"**. The full current set (12 groups / 41 scopes) + the
  API-enablement contract are in `docs/google-tools-feasibility.md`. Tool reduction is done **on the
  claude.ai side only**.
- **Future hardening (documented, not implemented):** a dedicated **Service Account** with
  folder-scoped Drive sharing would shrink the blast radius from "Or's whole personal Drive" to
  "only the shared folders". Tracked as an option, not a current change (Or chose to keep the
  current personal-account setup with the safeguards above).

## Lesson (why this doc was wrong before — TWICE)

Two layers of error compounded here:
1. A prior session invented `shared-google@or-infra.com` and documented it as the data account — it never existed.
2. A later session "corrected" that to `edriorp38@or-infra.com` and asserted the rebuilt workspace-mcp "enforces that the token's account matches the label." A **2026-06-15 live test** (create a file, read its owner) proved the token actually authenticates as **`edri2or@gmail.com`** and works fine under the `edriorp38` label — so there is **no effective `account == label` enforcement**; the label is just a credential filename / routing key.

**Lesson:** prove the live account by **observing real data** (create a file, read its owner; read a message's account) — never infer the account from a label, a config string, or a doc claim, and never document an inferred account as fact. Or is the authority on which accounts exist; the live system is the authority on which account a token belongs to.

## Open flags

- **System-facing templates still say `edriorp38` (follow-up).** `templates/system/AGENTS.md.template`
  (and its golden `tests/golden/system/rendered/AGENTS.md`) and `templates/system/workflows/n8n/ops-agent.json`
  still describe the workspace account as `edriorp38@or-infra.com`. Their functional `user_google_email`
  param is correct (the storage-key); only the prose is stale, and it ships only to **future** systems.
  Correcting them touches the golden re-render + (for `ops-agent.json`) the **E2E verification gate** (a
  live or-edri-4 proof), so it is deferred to the next provisioning-side change that already runs an E2E proof.
- **Operator-login allowlist.** The gateway login allowlist is `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com`
  (the personal account). If the operator should log into the gateway as `edriorp38@or-infra.com` instead,
  that's a one-line config change — **left as-is; raise with Or before changing.**

## Sources

- **2026-06-15 (authoritative for the DATA account):** a file freshly created via the connector is owned by `edri2or@gmail.com` — proves the deployed workspace token authenticates as Or's personal account, regardless of the `edriorp38` label.
- IAM (2026-06-11): `list_iam_bindings` on `or-factory-master-control` + `factory-test-7` — for `edriorp38`'s **console/admin** roles (owner / oauthconfig.editor).
- Note on the 2026-06-11 record ("the account is edriorp38@or-infra.com"): that was correcting the *fictional* `shared-google@` to the real or-infra account **name** — it did not prove the workspace TOKEN's account, which the 2026-06-15 test now shows is `edri2or@gmail.com`.
- Code: `scripts/render-mcp-service-yaml.sh`, `services/workspace-mcp/entrypoint.sh`, `scripts/google-mcp-smoke.py`, `.github/workflows/deploy-mcp-server.yml`, `docs/external-state.md`.
