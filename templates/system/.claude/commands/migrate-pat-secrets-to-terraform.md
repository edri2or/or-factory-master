---
audience: shared
description: Replace a workflow's PyNaCl + classic PAT runtime secret-writing with Terraform `github_actions_secret` resources fed by an App-token-via-WIF chain. Use when retiring `PUSH_TARGET_TOKEN`, PyNaCl, or REST PUT loops that manage repo Actions secrets.
---

# Migrate PAT Secrets to Terraform

## Role

You are a CI/CD migration engineer. Given an existing GitHub Actions workflow that
writes repo Actions secrets at runtime via PyNaCl + REST PUT using a classic PAT,
you replace that mechanism with declarative Terraform `github_actions_secret`
resources fed by a job-time GitHub App installation token (App-token-via-WIF). You
produce the change as a PR, not as direct commits to `main`.

## Context — Read First

1. Your project's ADRs for the shared-identity project and cross-project bootstrap and App-token pattern — confirm the
   org's WIF + App + shared-identity model is in place.
2. Your project's ADR for GitHub Actions secrets via Terraform (if present) — the
   reference implementation this skill encodes.
3. `terraform/versions.tf` — check whether `integrations/github` is already
   declared.
4. `.github/actions/fetch-app-credentials/action.yml` (if present) — reuse;
   otherwise vendor a copy.
5. `docs/adr/README.md` — pick the next sequential ADR number.

## Prerequisites (verify before starting; STOP if any fails)

| Prerequisite | Check |
|---|---|
| Org-level GitHub App with `secrets: write` permission, installed on All repositories | One-time human accept in the App settings UI — out of this skill's scope |
| Shared-identity GCP project with `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` in Secret Manager | Created by the org bootstrap |
| Bootstrap SA (the workflow's auth SA) is listed in the shared-identity project's `var.consumer_service_accounts` | If not, **HALT**: this requires a cross-repo PR on the shared-identity terraform — do not proceed |
| Repo's per-project WIF + `github-actions-sa` already provisioned | Created by `gcp-wif-bootstrap`; this skill assumes it exists |
| Repo's `terraform/` already initialized with `provider "google"` | If absent, this is not a migration target — bootstrap with `gcp-wif-bootstrap` first |

## Instructions

### Step 1: Detect the migration target

Scan `.github/workflows/*.yml` for the runtime-secret-writing pattern:

```bash
grep -lE "(PyNaCl|encrypted_value|/actions/secrets/)" .github/workflows/*.yml
```

For each match, also confirm it references a classic PAT (`secrets.PUSH_TARGET_TOKEN`
or similar). If no workflow matches the pattern, STOP and report — this skill is for
the PyNaCl + REST PUT pattern only.

If multiple workflows match, ask the user which one to migrate first.

### Step 2: Identify the secrets being written

From the workflow's runtime script, extract the names + source values of the secrets
being PUT. They typically come from `terraform output -json` against the repo's
`terraform/`. Map each to its upstream Terraform reference, e.g.:

| Secret name | Likely source |
|-------------|---------------|
| `WIF_PROVIDER` | `google_iam_workload_identity_pool_provider.github.name` |
| `WIF_SERVICE_ACCOUNT` | `google_service_account.github_actions.email` |
| `GCP_PROJECT_ID` | `google_project.app.project_id` |

If a source value is a hardcoded literal or a runtime computation rather than a
Terraform resource ref, flag the secret and ask the user how to source it — do
not invent a Terraform reference.

### Step 3: Wire the GitHub provider into Terraform

Open `terraform/versions.tf`. If the `integrations/github` provider is not already
declared, add:

```hcl
required_providers {
  github = { source = "integrations/github", version = "~> 6.0" }
}
```

Add (in the same file or `locals.tf` adjacent to it — keep close to the provider
config):

```hcl
locals {
  github_owner     = split("/", var.github_repo)[0]
  github_repo_name = split("/", var.github_repo)[1]
}

provider "github" {
  owner = local.github_owner
}
```

The provider's token comes from the `GITHUB_TOKEN` env var supplied by the
workflow. Do not embed any literal token in HCL.

### Step 4: Emit `terraform/github_secrets.tf`

For each secret identified in Step 2, emit a `github_actions_secret` resource using
the **`value`** attribute (not the deprecated `plaintext_value`):

```hcl
resource "github_actions_secret" "<key_in_snake_case>" {
  repository  = local.github_repo_name
  secret_name = "<UPPER_CASE_NAME>"
  value       = <terraform reference>
}
```

If the source value is multi-line (e.g. a PEM), the provider handles it; nothing
special needed at this layer.

### Step 5: Reuse or vendor `.github/actions/fetch-app-credentials/`

If the file already exists, skip this step.

Otherwise, write `action.yml` with the **printf+capture** form (see Safety Rule 4).
Substitute `<SHARED_IDENTITY_PROJECT_ID>` with the org's value:

```yaml
name: Fetch GitHub App credentials from shared-identity Secret Manager
description: |
  Reads GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY from the shared-identity GCP
  project's Secret Manager. Caller must have already authenticated via
  google-github-actions/auth. Pair with actions/create-github-app-token@v1.

inputs:
  shared-identity-project-id:
    description: GCP project hosting the shared GitHub App credentials.
    required: false
    default: <SHARED_IDENTITY_PROJECT_ID>

outputs:
  app_id:
    value: ${{ steps.fetch.outputs.app_id }}
  private_key:
    value: ${{ steps.fetch.outputs.private_key }}

runs:
  using: composite
  steps:
    - id: fetch
      shell: bash
      env:
        SHARED_IDENTITY_PROJECT_ID: ${{ inputs.shared-identity-project-id }}
      run: |
        set -euo pipefail
        # Capture first so $(...) strips any trailing newline, then printf
        # re-adds exactly one — keeps the heredoc delimiter on its own line
        # even when the secret value (e.g. a numeric APP_ID) has none.
        APP_ID="$(gcloud secrets versions access latest \
          --secret=GITHUB_APP_ID \
          --project="${SHARED_IDENTITY_PROJECT_ID}")"
        PRIVATE_KEY="$(gcloud secrets versions access latest \
          --secret=GITHUB_APP_PRIVATE_KEY \
          --project="${SHARED_IDENTITY_PROJECT_ID}")"
        {
          printf 'app_id<<IDEOF\n%s\nIDEOF\n' "$APP_ID"
          printf 'private_key<<PEMEOF\n%s\nPEMEOF\n' "$PRIVATE_KEY"
        } >> "$GITHUB_OUTPUT"
```

### Step 6: Rewrite the target workflow

Preserve the existing `google-github-actions/auth@v2` step at the top, then replace
the runtime-secret-writing step with this sequence:

```yaml
- id: fetch-app-secrets
  uses: ./.github/actions/fetch-app-credentials

- id: app-token
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ steps.fetch-app-secrets.outputs.app_id }}
    private-key: ${{ steps.fetch-app-secrets.outputs.private_key }}
    owner: ${{ github.repository_owner }}
    repositories: ${{ github.event.repository.name }}

# … (existing setup-terraform, terraform init unchanged) …

- name: Terraform apply
  run: terraform apply -auto-approve  …existing args…
  working-directory: terraform
  env:
    # … existing TF_VAR_* env …
    GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

Delete the runtime "Set GitHub Secrets" step (or however it's named) entirely.
Remove the `secrets.<PAT_NAME>` reference from the workflow's `env:`.

### Step 7: Add an auto-trigger chain (optional, recommended)

If the org pattern uses two workflows (e.g. shared-identity-bootstrap + this one),
wire them so the merge itself drives the rollout:

- The upstream workflow gets `push: branches: [main], paths: ['<relevant-paths>']`.
- This workflow gets:
  ```yaml
  workflow_run:
    workflows: ['<Upstream Name>']
    types: [completed]
    branches: [main]
  ```
  plus an `if:` guard on the job:
  ```yaml
  if: ${{ github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success' }}
  ```

This eliminates manual `workflow_dispatch` after merge.

### Step 8: Author the audit-closure ADR

`policy/adr.rego` (or equivalent) requires an ADR for any `terraform/**` change.
Use the audit-closure shape (~30 lines), modeled on existing audit-closure ADRs in
`docs/adr/`:

- **Title:** "Migrate `<workflow-name>` off `<PAT_NAME>` to Terraform-managed secrets"
- **Context:** one paragraph — the deprecation rationale and which org policy/ADR
  this closes.
- **Decision:** one paragraph — the swap performed.
- **Consequences:** 2–3 bullets — what breaks if reverted, what now works that
  didn't.
- **Related:** link to your project's prior bootstrap ADRs (or equivalents).

### Step 9: Update HANDOFF / CLAUDE / JOURNEY

Append session entries (or replace `## Session Handoff` for `CLAUDE.md`) per the
project's established patterns. Capture the diagnosed-bugs section of this skill so
a future agent running on a similar repo benefits.

### Step 10: Commit, push, open PR

Commit in logical chunks (one per concern) or one large commit — match the repo's
history style. Push to a new branch named
`claude/migrate-<workflow>-to-terraform-secrets-<short-hash>`. Open a PR via the
GitHub MCP tool (`mcp__github__create_pull_request`). Do not merge — leave that to
the user.

## Safety Rules

1. **NEVER commit a secret VALUE** (token, PEM, etc.) to the repo. Only attribute
   references (e.g. `google_service_account.github_actions.email`) and resource
   names (e.g. `WIF_PROVIDER`).
2. **NEVER delete the classic PAT** (`PUSH_TARGET_TOKEN` or whichever) from the
   repo's GitHub Actions secrets. That's the operator's final step, gated on any
   cross-repo follow-ups, and is OUT of this skill's scope.
3. **NEVER use `plaintext_value`** on `github_actions_secret`. Always use `value`
   (the non-deprecated attribute name).
4. **NEVER use the inline-heredoc form** (`echo 'DELIM'; gcloud …; echo 'DELIM'`
   with `>> $GITHUB_OUTPUT`) for secret values. Always capture into a shell
   variable first, then `printf '…\n%s\n…\n'`. The inline form silently corrupts
   `$GITHUB_OUTPUT` when the secret value lacks a trailing newline (e.g. numeric
   IDs).
5. **NEVER push directly to `main`** or to a protected branch. Always open a PR.
6. **NEVER proceed past Prerequisites** if the bootstrap SA is missing from
   `consumer_service_accounts`. Continuing would produce a PR whose post-merge run
   will 403 on `fetch-app-credentials`.
7. **NEVER request App-token permissions broader than the target repo.** Use
   `repositories: ${{ github.event.repository.name }}`.

## Examples

**User:** "migrate `skill-sync-reusable.yml` off `PUSH_TARGET_TOKEN`"

**Agent behaviour:**
Confirms prerequisites (shared-identity ADRs) are in place. Detects the PyNaCl pattern in
the workflow. Maps the secrets being written. Verifies that the target repo's
auth SA is in shared-identity's `consumer_service_accounts` — if not, halts and
reports "this requires a cross-repo PR on the shared-identity terraform first; do
that and re-run me." Otherwise proceeds: emits or extends
`terraform/github_secrets.tf`, vendors `.github/actions/fetch-app-credentials/`,
rewrites the workflow with the App-token chain, authors an audit-closure ADR,
updates docs, opens a PR. Reports the PR URL.

**User:** "the workflow uses `gh secret set` from the gh CLI, not PyNaCl — can you
migrate it?"

**Agent behaviour:**
This skill targets the PyNaCl + REST PUT pattern specifically. Reports the
mismatch, acknowledges that the migration shape would be similar but not
identical (the `gh` CLI form is closer to the target Terraform shape already), and
suggests the user either (a) hand-craft the migration using the Terraform secrets ADR in their project as a reference, or (b) extend this skill in a new branch to
handle the `gh`-CLI variant. Does NOT proceed silently with a partial-fit
migration.
