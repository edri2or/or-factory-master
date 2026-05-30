---
name: github-app-operations
description: >-
  Authenticate to GitHub AS this system's own dedicated GitHub App and mint a short-lived
  installation access token. Use when a task needs to push commits, open a PR, trigger or edit
  a workflow, manage repo secrets, or call the GitHub API as the system's App identity — using
  the github-app-id / github-app-private-key / github-app-installation-id secrets in this
  system's GCP Secret Manager. Triggers on GitHub App, installation token, app token, acting as
  the app, or pushing/PR/workflow/secret operations that need the App identity.
allowed-tools: Bash(gh api:*) Bash(gh auth:*) Bash(openssl:*) Bash(curl:*) Bash(jq:*) Bash(date:*)
---

# GitHub App operations

This system has its **own dedicated GitHub App**, created by the factory and **locked to this one
repo**. It is the identity to use when something must act on GitHub *as the system itself* — push a
commit, open a PR, trigger/edit a workflow, or call the GitHub API with the App's permissions.

## What the App is

- A single GitHub App, installed on **this repo only** (`Only select repositories`).
- Permissions: `contents:write`, `metadata:read`, `actions:write`, `workflows:write`,
  `secrets:write`. It can do nothing outside this repo and nothing outside these scopes.
- Credentials live in **this system's GCP Secret Manager**:
  - `github-app-id`
  - `github-app-private-key`
  - `github-app-installation-id`
- The App ID and installation ID are **also** repo variables `APP_ID` and `APP_INSTALLATION_ID`
  (so you can read those two without touching Secret Manager — only the private key is sensitive).

## How a token is minted (the mechanic)

1. Build a JSON Web Token (JWT) signed **RS256** with the App private key: `iat` backdated ~60s,
   `exp` no more than 10 minutes out, `iss` = the App ID.
2. `POST https://api.github.com/app/installations/{installation-id}/access_tokens` with
   `Authorization: Bearer <JWT>`.
3. The response `.token` is an **installation access token** that **expires after 1 hour**.

> Token format note: installation tokens are now `ghs_`-prefixed and roughly **520 characters** and
> growing. **Never** hardcode a token length or a fixed-length regex — treat the token as an opaque
> string. (If you must match it, use a generous pattern like `ghs_[A-Za-z0-9._]{36,}`.)

## The security model — read before you touch the private key

This repo has **no GCP credentials in interactive runs**. The `gcp-hands-client` skill routes every
GCP operation through the `edri2or/gcp-hands` broker, and **the result returns as a comment on a
GitHub issue**. That means:

> 🚫 **NEVER fetch `github-app-private-key` interactively / via the gcp-hands broker.** The value
> would be posted into an issue comment — a serious leak. The private key may only be read **inside
> a GitHub Actions workflow** that authenticates to GCP via this system's own WIF, where it stays in
> runner memory.

So there are exactly two usage paths:

### PRIMARY (recommended) — inside a GitHub Actions workflow

This is the **only** path that may touch the private key. The workflow authenticates to GCP via the
system's WIF (`vars.GCP_WIF_PROVIDER` + `vars.GCP_DEPLOY_SA`) — exactly as
`.github/workflows/deploy-railway-cloudflare.yml` already reads secrets from Secret Manager — and
then mints the token one of two ways:

**Option A — `actions/create-github-app-token` (preferred).** It mints the token through the same
endpoint, **auto-masks** it in logs, and **auto-revokes** it at job end. By default it scopes to the
current repo; you can narrow permissions further. Read the App ID + private key from SM first:

```yaml
permissions:
  contents: read
  id-token: write   # for WIF
steps:
  - uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
      service_account: ${{ vars.GCP_DEPLOY_SA }}
  - uses: google-github-actions/setup-gcloud@v2
  - id: secrets
    run: |
      {
        echo "app_id<<EOF";  gcloud secrets versions access latest --secret=github-app-id;          echo; echo "EOF"
        echo "pem<<EOF";      gcloud secrets versions access latest --secret=github-app-private-key; echo; echo "EOF"
      } >> "$GITHUB_OUTPUT"
  - id: token
    uses: actions/create-github-app-token@v1
    with:
      app-id: ${{ steps.secrets.outputs.app_id }}
      private-key: ${{ steps.secrets.outputs.pem }}
      # owner/repositories default to the current repo; add `permission-*` inputs to downscope.
  - run: gh api /repos/${{ github.repository }}/...   # uses the minted token
    env:
      GH_TOKEN: ${{ steps.token.outputs.token }}
```

**Option B — the bundled `scripts/generate-app-token.sh`.** Same endpoint, useful when you need the
raw token in a shell step. The private key is passed via the `PRIVATE_KEY` env var and fed to
openssl through **process substitution**, so it never touches disk. **You must `::add-mask::` the
token yourself** (this script does not auto-revoke):

```bash
APP_ID=$(gcloud secrets versions access latest --secret=github-app-id)
INSTALL_ID=$(gcloud secrets versions access latest --secret=github-app-installation-id)
TOKEN=$(PRIVATE_KEY="$(gcloud secrets versions access latest --secret=github-app-private-key)" \
  .claude/skills/github-app-operations/scripts/generate-app-token.sh \
  "$APP_ID" "$INSTALL_ID" \
  '' '{"contents":"write"}' '["'"${GITHUB_REPOSITORY##*/}"'"]')   # scope: this repo, minimal perms
echo "::add-mask::$TOKEN"
gh api /repos/"$GITHUB_REPOSITORY"/... ; # ...use $TOKEN as GH_TOKEN
```

Script contract: `generate-app-token.sh <app-id> <install-id> [repo-ids-json] [permissions-json] [repo-names-json]`
with the key in `PRIVATE_KEY`. The optional `$3`/`$4`/`$5` downscope the token (pass either
repo-ids `$3` **or** repo-names `$5`, plus a permissions object `$4`).

### INTERACTIVE — never touch the private key

When you are running interactively (not inside a workflow), **do not mint a token from the private
key at all.** Instead:

- Use the GitHub tools you already have — the **GitHub MCP server** or `gh` with its existing
  credentials — for reads and ordinary GitHub actions.
- If the action genuinely needs the **App's** identity/permissions, **dispatch a workflow** (or
  extend an existing one) that does it via the PRIMARY path above, and watch the run.

## Least privilege

When you mint a token, scope it to the **current repo** and to the **minimum permissions** the task
needs — not the App's full set. With the script, pass a repo-name/`repository_ids` arg + a small
`permissions` object; with the action, set its `owner` / `repositories` / `permission-*` inputs.

## Security rules

- **Never print, log, echo, or write to disk** the `github-app-private-key` or any minted token.
- **Never fetch the private key outside a GitHub Actions workflow** (it would leak via the
  gcp-hands issue-comment path).
- Prefer `actions/create-github-app-token` so the token is auto-masked and auto-revoked; otherwise
  `::add-mask::` it yourself and rely on the **1-hour** expiry.
