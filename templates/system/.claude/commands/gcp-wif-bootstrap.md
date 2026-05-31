---
audience: shared
description: Bootstraps WIF + Secret Manager Terraform for a new GCP project. Writes terraform/ files with declarative github_actions_secret resources plus a GitHub Actions workflow using the App-token-via-WIF chain. Use for secure Actions secret setup.
synthesis-required: false
adapted-by: skill-adapter
adapted-on: 2026-05-24
---

# GCP WIF Bootstrap

## Role

You are a GCP Infrastructure Engineer. You provision a complete GCP project with Workload
Identity Federation and Secret Manager by writing Terraform files (including the
`github_actions_secret` resources that propagate WIF outputs back to repo Actions secrets)
plus a GitHub Actions workflow that uses the App-token-via-WIF chain. The workflow's `push`
trigger fires it automatically on commit; you never run `terraform`, `gcloud`, or use a
classic PAT directly — the GitHub Actions runner does all infrastructure work, and the
GitHub App installation token (minted at job time from credentials in shared-identity
Secret Manager) is the only GitHub credential ever used.

## Org constants (hardcoded for [your-domain])

| Constant | Value |
|----------|-------|
| `ORG_ID` | `[your-org-id]` |
| `TF_SA` | `terraform-sa@tf-seed-1776532715.iam.gserviceaccount.com` |
| `TF_BUCKET` | `tf-state-[your-org-id]` |
| `WIF_PROVIDER` | `projects/725011244321/.../github-pool/providers/github-provider` |
| `SHARED_IDENTITY_PROJECT` | `[your-shared-identity-project]` (hosts the org's GitHub App credentials in Secret Manager) |
| `REGION` | `us-central1` |

⚠ If the target org is not `[your-org]` / `[your-domain]`, these values must be replaced before proceeding.

## Prerequisites (one-time per org — verify before running)

| Prerequisite | How to verify | Failure mode if missing |
|---|---|---|
| Org GitHub App with `secrets: write` permission, installed on All repositories of the org | App settings UI → Permissions includes "Repository secrets — Read & write"; Installation → Repository access = "All repositories" | `terraform apply` 403s on `github_actions_secret` create |
| Shared-identity GCP project exists with `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` populated in Secret Manager | `gcloud secrets list --project=<SHARED_IDENTITY_PROJECT>` (run by operator with `secretmanager.viewer`) | `fetch-app-credentials` step 404s |
| Bootstrap SA (`TF_SA`) is in the shared-identity project's `var.consumer_service_accounts` as a `_bootstrap` entry | Inspect `terraform/shared-identity/variables.tf` in the shared-identity-hosting repo (e.g., `[your-repo]`) | `fetch-app-credentials` step 403s on `gcloud secrets versions access` |
| `TF_VAR_BILLING_ACCOUNT` org secret set | GitHub UI → Org → Secrets and variables → Actions | `terraform apply` errors on missing `var.billing_account` |
| `billing.user` on billing account granted to `TF_SA` | `gcloud billing accounts get-iam-policy <BA_ID>` (run by billing admin) | `google_project` create errors |

`PUSH_TARGET_TOKEN` is **not** required (decommissioned — secrets are now written declaratively by Terraform via the `integrations/github` provider, fed by a job-time GitHub App installation token).

If any prerequisite is missing, **HALT** and report — fixing them is outside this skill's per-repo scope.

## Instructions

### Step 1: Auto-detect inputs

Run silently — no prompts. Ask only if a value cannot be resolved.

#### 1a. `github_repo`

```bash
REMOTE=$(git remote get-url origin 2>/dev/null)
# Extract owner/repo from any URL form (https, ssh, local proxy)
GITHUB_REPO=$(echo "$REMOTE" | grep -oE '[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$' | sed 's/\.git$//')
[ -z "$GITHUB_REPO" ] && { echo "FAIL: cannot determine GitHub repo from git remote"; exit 1; }
```

#### 1b. `project_id`

```bash
REPO_NAME=$(echo "$GITHUB_REPO" | cut -d/ -f2)
PROJECT_ID=$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | cut -c1-28)
```

GCP project existence cannot be verified without `gcloud` — proceed with the derived value.
The Terraform apply step will fail with a clear error if the project ID is already taken.

#### 1c. `secret_names`

```bash
SECRET_NAMES=$({
  grep -E '^[A-Z_][A-Z0-9_]*=' .env.example 2>/dev/null | cut -d= -f1
  grep -rhoE 'process\.env\.([A-Z_][A-Z0-9_]+)' src/ 2>/dev/null | grep -oE '[A-Z_][A-Z0-9_]+$'
  grep -rhoE "os\.environ(?:\.get)?\(['\"]([A-Z_][A-Z0-9_]+)" src/ 2>/dev/null | grep -oE '[A-Z_][A-Z0-9_]+'
} | sort -u | grep -vE '^(PORT|NODE_ENV|DEBUG|LOG_LEVEL|HOST|TZ|LANG|PATH|HOME|USER)$')
```

If zero secrets found, proceed with an empty list — Secret Manager is created with no secrets.

#### 1d. Confirm before continuing

Print a summary table:

```text
Auto-detected inputs:
  github_repo  : org/repo
  project_id   : my-repo-name  ⚠ not verified against GCP (no gcloud)
  ORG_ID       : [your-org-id]  (hardcoded — [your-domain])
  TF_SA        : terraform-sa@tf-seed-1776532715.iam.gserviceaccount.com
  TF_BUCKET    : tf-state-[your-org-id]
  BILLING      : ✓ (via TF_VAR_BILLING_ACCOUNT org secret — not shown)
  secret_names : DATABASE_URL, API_KEY  (or "none detected")
```

Ask: **"Proceed with these values?"** — wait for confirmation before Step 2.

If a `terraform/` directory already exists, warn and wait for confirmation before overwriting.

### Step 2: Write Terraform files

Write all files below to `terraform/`, substituting all `<placeholders>`.

**`terraform/versions.tf`**
```hcl
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = { source = "hashicorp/google",      version = "~> 5.0" }
    github = { source = "integrations/github",   version = "~> 6.0" }
  }
  backend "gcs" {
    bucket = "<TF_BUCKET>"
    prefix = "terraform/<project_id>"
  }
}

locals {
  github_owner     = split("/", var.github_repo)[0]
  github_repo_name = split("/", var.github_repo)[1]
}

provider "google" {}

# GitHub App installation token is supplied via GITHUB_TOKEN env var by the
# bootstrap workflow.
provider "github" {
  owner = local.github_owner
}
```

**`terraform/variables.tf`**
```hcl
variable "org_id"          { type = string }
variable "billing_account" { type = string }
variable "project_id"      { type = string }
variable "github_repo"     { type = string }
variable "region"          { default = "us-central1" }
```

**`terraform/main.tf`**
```hcl
resource "google_project" "app" {
  name            = var.project_id
  project_id      = var.project_id
  org_id          = var.org_id
  billing_account = var.billing_account
}

resource "google_project_service" "apis" {
  for_each = toset([
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "sts.googleapis.com",
  ])
  project            = google_project.app.project_id
  service            = each.value
  disable_on_destroy = false
}
```

**`terraform/wif.tf`**
```hcl
resource "google_iam_workload_identity_pool" "github" {
  project                   = google_project.app.project_id
  workload_identity_pool_id = "github-pool"
  depends_on                = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = google_project.app.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "attribute.repository == \"${var.github_repo}\""
}

resource "google_service_account" "github_actions" {
  project      = google_project.app.project_id
  account_id   = "github-actions-sa"
  display_name = "GitHub Actions SA"
}

resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}
```

**`terraform/secrets.tf`**
```hcl
locals {
  secret_names = [<quoted, comma-separated secret names — or empty list []>]
}

resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(local.secret_names)
  project   = google_project.app.project_id
  secret_id = each.value
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "reader" {
  for_each  = google_secret_manager_secret.secrets
  project   = google_project.app.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.github_actions.email}"
}
```

**`terraform/github_secrets.tf`**
```hcl
# WIF + project identity propagated declaratively to repo Actions secrets.
# Replaces the runtime PyNaCl PUT loop. Use `value`
# (not `plaintext_value` — deprecated).
resource "github_actions_secret" "wif_provider" {
  repository  = local.github_repo_name
  secret_name = "WIF_PROVIDER"
  value       = google_iam_workload_identity_pool_provider.github.name
}

resource "github_actions_secret" "wif_service_account" {
  repository  = local.github_repo_name
  secret_name = "WIF_SERVICE_ACCOUNT"
  value       = google_service_account.github_actions.email
}

resource "github_actions_secret" "gcp_project_id" {
  repository  = local.github_repo_name
  secret_name = "GCP_PROJECT_ID"
  value       = google_project.app.project_id
}
```

To add a fourth repo Actions secret in the future, append a fourth resource to
this file — no workflow YAML change needed.

**`terraform/outputs.tf`**
```hcl
# Informational only — the secret-shape source of truth is github_secrets.tf,
# which references the GCP resources directly.
output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
output "service_account_email" {
  value = google_service_account.github_actions.email
}
output "project_id" {
  value = google_project.app.project_id
}
```

### Step 3: Write the composite action + GitHub Actions bootstrap workflow

#### 3a. Vendor the `fetch-app-credentials` composite action

Write `.github/actions/fetch-app-credentials/action.yml`:

```yaml
name: Fetch GitHub App credentials from shared-identity Secret Manager
description: |
  Reads GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY from the shared-identity GCP
  project's Secret Manager. Caller must have already authenticated via
  google-github-actions/auth. Pair with actions/create-github-app-token@v1
  to mint a job-time installation token.

inputs:
  shared-identity-project-id:
    description: GCP project hosting the shared GitHub App credentials.
    required: false
    default: [your-shared-identity-project]

outputs:
  app_id:
    description: GitHub App numeric ID.
    value: ${{ steps.fetch.outputs.app_id }}
  private_key:
    description: GitHub App RSA PEM private key (multi-line).
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

The `printf` (not heredoc) is intentional — see the inline comment. Heredocs
on a value without a trailing newline merge with the closing delimiter and
corrupt `$GITHUB_OUTPUT` (PR #8 root cause).

#### 3b. Write `.github/workflows/gcp-bootstrap.yml`

```yaml
name: GCP Bootstrap

on:
  push:
    paths:
      - "terraform/**"
    branches-ignore:
      - main
  workflow_dispatch:
    inputs:
      project_id:
        description: "GCP project ID to create"
        required: false
      github_repo:
        description: "GitHub repo (owner/repo)"
        required: false

permissions:
  id-token: write
  contents: read

concurrency:
  group: gcp-bootstrap-${{ github.ref }}
  cancel-in-progress: false

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    env:
      PROJECT_ID: ${{ inputs.project_id || github.event.repository.name }}
      GITHUB_REPO: ${{ inputs.github_repo || github.repository }}
    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: "[your-seed-wif-provider]"
          service_account: "[your-terraform-sa]"

      - id: fetch-app-secrets
        uses: ./.github/actions/fetch-app-credentials

      # Scoped to the target repo only (least privilege). The org App is
      # installed on All repositories so the per-repo install is implicit.
      - id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ steps.fetch-app-secrets.outputs.app_id }}
          private-key: ${{ steps.fetch-app-secrets.outputs.private_key }}
          owner: ${{ github.repository_owner }}
          repositories: ${{ github.event.repository.name }}

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9"

      - name: Terraform init
        run: terraform init
        working-directory: terraform

      - name: Terraform apply
        run: |
          terraform apply -auto-approve \
            -var "org_id=[your-org-id]" \
            -var "project_id=${{ env.PROJECT_ID }}" \
            -var "github_repo=${{ env.GITHUB_REPO }}"
        working-directory: terraform
        env:
          TF_VAR_billing_account: ${{ secrets.TF_VAR_BILLING_ACCOUNT }}
          # Feeds the integrations/github provider.
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

No `Set GitHub Secrets` step. The three repo Actions secrets
(`WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`) are written by
`terraform apply` via the `github_actions_secret` resources from Step 2.

> **Optional: chain on `Shared Identity Bootstrap`** — if the same repo also
> hosts the shared-identity Terraform (i.e., this is the org's
> infrastructure repo, like `[your-repo]`), add a `workflow_run`
> trigger so main-branch pushes flow shared-identity → gcp-bootstrap in
> order. New repos using this skill almost never need this — they consume
> the shared-identity project but don't manage it.

### Step 4: Commit, push, and verify

```bash
git add terraform/ .github/actions/fetch-app-credentials/ .github/workflows/gcp-bootstrap.yml
git commit -m "chore: add GCP WIF bootstrap infrastructure"
git push
```

The `push` trigger on `terraform/**` fires automatically. Verify the run via
the GitHub MCP tools (no PAT, no `gh` CLI needed):

1. `mcp__github__list_pull_requests` (or check directly) to find the head commit SHA.
2. `mcp__github__get_commit` with the head SHA to read the combined check status, **or**
   `mcp__github__pull_request_read` with `method: get_check_runs` once a PR exists.
3. Poll every ~30s until the `GCP Bootstrap` check is `completed` + `success`.

If the run fails:
- `success: false` on `terraform apply` with `403 fetch-app-credentials` →
  the bootstrap SA is missing from the shared-identity `_bootstrap` consumer
  list. **HALT** — fix prerequisite, do not retry.
- `403 github_actions_secret` create → the org App is missing
  `secrets: write`, or the App was installed before the permission was
  added (manifest changes don't retroactively update installs — operator
  must accept the new permission in the App settings UI).
- `Argument is deprecated … Use value` warnings on `github_actions_secret` →
  benign on the current provider, but a sign that an older copy of
  `github_secrets.tf` slipped through; rename `plaintext_value` → `value`.

Do not retry automatically — print the failure and stop.

> **Known limitation — `workflow_dispatch`:** GitHub's dispatch API returns 404
> for workflows that exist only on a feature branch. The `push` trigger fires
> automatically on every push that touches `terraform/**`, so no manual
> dispatch is needed for the bootstrap itself. For any *additional* workflow
> added on a feature branch (e.g., the autonomy test in Step 5), use a `push`
> trigger scoped to that branch and file path until the workflow is merged to
> the default branch.

### Step 5 (optional): Autonomy test

After bootstrap succeeds, verify that `github-actions-sa` can perform real Secret Manager
operations via WIF — no static credentials.

**Add to `terraform/secrets.tf`:**

```hcl
# Ensure "TEST_SECRET" is in your existing secret_names list (append, do not replace):
locals {
  secret_names = [/* existing entries, */ "TEST_SECRET"]
}

resource "google_secret_manager_secret_iam_member" "version_adder" {
  for_each  = google_secret_manager_secret.secrets
  project   = google_project.app.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretVersionAdder"
  member    = "serviceAccount:${google_service_account.github_actions.email}"
}
```

**Write `.github/workflows/secret-manager-test.yml`:**

```yaml
name: Secret Manager Autonomy Test

on:
  workflow_dispatch:
  push:
    branches:
      - <your-feature-branch>          # remove after merging to main
    paths:
      - ".github/workflows/secret-manager-test.yml"

permissions:
  id-token: write
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
      SECRET_NAME: TEST_SECRET
    steps:
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Write secret version
        run: |
          echo -n "autonomy-test-$(date -u +%Y%m%dT%H%M%SZ)" | \
            gcloud secrets versions add "$SECRET_NAME" \
              --project="$GCP_PROJECT_ID" \
              --data-file=-
          echo "Write: OK"

      - name: Read secret version back
        run: |
          VALUE=$(gcloud secrets versions access latest \
            --secret="$SECRET_NAME" \
            --project="$GCP_PROJECT_ID")
          echo "Read:  $VALUE"
          [[ "$VALUE" == autonomy-test-* ]] && echo "Assertion: PASS" || { echo "Assertion: FAIL"; exit 1; }
```

Push the changes → `gcp-bootstrap.yml` fires and applies the Terraform delta →
then the test workflow fires (via the scoped `push` trigger) and asserts:

```
Write: OK
Read:  autonomy-test-<timestamp>
Assertion: PASS
```

### Step 6: Document

#### 6a. Update CLAUDE.md

Append or replace the `## GCP Bootstrap` section:

```markdown
## GCP Bootstrap (auto-generated by /gcp-wif-bootstrap)

| Variable | Value |
|----------|-------|
| `GCP_PROJECT_ID` | `<project_id>` |
| `WIF_PROVIDER` | `<workload_identity_provider output>` |
| `WIF_SERVICE_ACCOUNT` | `<service_account_email output>` |
| `TF_SA` | `[your-terraform-sa]` |
| `TF_BUCKET` | `tf-state-[your-org-id]` |
| `ORG_ID` | `[your-org-id]` |

Secret Manager secrets (fill values manually via GCP Console):
<list of secret_names, one per line, or "none">
```

#### 6b. Append to [your-journey-file]

Insert a new entry before `## Entry Template` (or at EOF if no such block):

```markdown
## [<YYYY-MM-DD>] GCP WIF bootstrap — <project_id>

**Operator**: claude-sonnet-4-6 (autonomous agent)
**Scope**: `terraform/`, `.github/workflows/gcp-bootstrap.yml`, `CLAUDE.md`, GitHub Secrets
**Objective**: Provision GCP project `<project_id>` with WIF + Secret Manager

### Actions taken
- Wrote Terraform files (`versions.tf`, `variables.tf`, `main.tf`, `wif.tf`, `secrets.tf`, `github_secrets.tf`, `outputs.tf`)
- Vendored composite action `.github/actions/fetch-app-credentials/action.yml`
- Wrote `.github/workflows/gcp-bootstrap.yml` — App-token-via-WIF chain (no `PUSH_TARGET_TOKEN`)
- Pushed; `push` trigger fired `gcp-bootstrap.yml`; verified completion via MCP
- GitHub Actions secrets created declaratively by Terraform: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`
- Created empty Secret Manager secrets: <secret_names or "none">

### Open items / follow-ups
- [ ] Fill secret values in GCP Console: <secret_names or "none">
```

#### 6c. Print summary

```text
✓ Terraform files written    : terraform/ (7 files)
✓ Composite action vendored  : .github/actions/fetch-app-credentials/
✓ Workflow written           : .github/workflows/gcp-bootstrap.yml
✓ Workflow triggered (push)  : gcp-bootstrap.yml
✓ Workflow completed         : success
✓ GitHub Actions secrets     : WIF_PROVIDER, WIF_SERVICE_ACCOUNT, GCP_PROJECT_ID  (declared in github_secrets.tf)
✓ CLAUDE.md updated
✓ JOURNEY.md updated

Secret Manager secrets created (values are EMPTY — fill via GCP Console):
  <list or "none">
```

## Safety rules

1. **NEVER write `billing_account` to any file** — it flows only via `TF_VAR_BILLING_ACCOUNT` org secret.
2. **NEVER run `terraform` or `gcloud` directly** — the GitHub Actions runner does this.
3. **NEVER create secret versions with production values** — create the secret resource (name) only. The optional autonomy test (Step 5) may write a timestamped test value to `TEST_SECRET`; that is the only permitted exception.
4. **NEVER overwrite an existing `terraform/` directory** without warning the user first.
5. **NEVER pass secret values via CLI args** — use env vars and stdin only.
6. **NEVER print token values** anywhere in output or logs.
7. **NEVER add a `Set GitHub Secrets` step** that PUTs to `/actions/secrets/` via PyNaCl — that pattern is retired. Repo Actions secrets that mirror GCP outputs MUST be `github_actions_secret` resources in `terraform/github_secrets.tf`.
8. **NEVER reference `secrets.PUSH_TARGET_TOKEN`** in any workflow this skill writes — the classic PAT is decommissioned. Use the App-token-via-WIF chain (`fetch-app-credentials` → `actions/create-github-app-token@v1`) instead.
9. **NEVER use `plaintext_value`** on `github_actions_secret` — the attribute is deprecated. Use `value`.
10. **If a prerequisite (org App, shared-identity SM, `_bootstrap` consumer binding) is missing**, HALT and report — do not attempt to provision it from this skill. Those are org-level / cross-repo concerns.
11. **If the workflow fails**, print the error and stop — do not retry automatically.

## Examples

**User:** `/gcp-wif-bootstrap` (standard case)

**Agent behaviour:**
Verifies prerequisites (org App, shared-identity SM, `_bootstrap` consumer binding) — HALTs
if any are missing. Derives `github_repo` from git remote (handles proxy URLs), derives
`project_id` from repo name. Prints summary table, waits for "Proceed?". Writes 7 Terraform
files (incl. `github_secrets.tf`) + the `fetch-app-credentials` composite action +
`gcp-bootstrap.yml`. Commits, pushes — `push` trigger fires automatically. Verifies completion
via `mcp__github__get_commit` / `get_check_runs`. When the workflow succeeds: updates
`CLAUDE.md` and `[your-journey-file]`, prints summary.

**User:** `/gcp-wif-bootstrap` (org is NOT [your-org])

**Agent behaviour:**
Prints summary table with ⚠ on all hardcoded org constants. Prints warning:
"These values are hardcoded for [your-domain] — confirm they are correct before proceeding."
Waits for explicit confirmation.

**User:** `/gcp-wif-bootstrap` (no `.env.example`, no `src/`)

**Agent behaviour:**
`secret_names` scan returns zero results. Proceeds with empty secret list.
`terraform/secrets.tf` contains `local.secret_names = []`. CLAUDE.md notes: "No secrets detected."

**User:** `/gcp-wif-bootstrap` (workflow fails)

**Agent behaviour:**
Prints: "FAIL: workflow failed — check GitHub Actions logs at
https://github.com/<github_repo>/actions/workflows/gcp-bootstrap.yml"
Stops. Does not update CLAUDE.md or [your-journey-file] (no successful bootstrap to document).
