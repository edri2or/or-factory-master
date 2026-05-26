# External state — IAM and permissions not in the workflow

This file lists every IAM grant and permission setting that lives **outside** the repo. Disaster recovery: if you have to rebuild from scratch, this is the list. Every entry has the exact command you'd run in Cloud Shell.

The workflow assumes all of these are already in place. None of them are granted from inside `provision-system.yml` (because doing so would require even higher privileges, which we don't want the broker SA to have).

## GCP

### Org policy override on the control project

The org-wide `iam.allowedPolicyMemberDomains` policy is restrictive; Cloud Run with `--allow-unauthenticated` (used by the bootstrap receiver in stage 4) needs an override on the control project.

```bash
cat > /tmp/policy.yaml <<'EOF'
constraint: constraints/iam.allowedPolicyMemberDomains
listPolicy:
  allValues: ALLOW
EOF

gcloud org-policies set-policy /tmp/policy.yaml \
  --project=or-factory-master-control
```

### One-time API enables on the control project

`provision-system.yml` calls `gcloud services enable` against new system projects, but the broker SA does **not** have `serviceUsageAdmin` on the control project itself (and shouldn't — APIs are a one-time bootstrap, not a per-run concern). Enable manually:

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com \
  secretmanager.googleapis.com \
  --project=or-factory-master-control
```

### Broker SA grants on the systems folder

These let the broker create, manage, and delete projects under `folders/123180924297`, and create WIF pools/providers in those projects.

```bash
FOLDER=123180924297
BROKER=factory-master-broker@or-factory-master-control.iam.gserviceaccount.com

for role in \
    roles/resourcemanager.projectCreator \
    roles/resourcemanager.projectDeleter \
    roles/billing.projectManager \
    roles/iam.workloadIdentityPoolAdmin; do
  gcloud resource-manager folders add-iam-policy-binding "$FOLDER" \
    --member="serviceAccount:${BROKER}" \
    --role="$role"
done
```

`iam.workloadIdentityPoolAdmin` is not implied by `roles/owner`, which the broker also picks up on every project it creates. Both are required — folder-level is the primary path, project-level (the in-workflow self-bind in `Grant project-level IAM`) is a fallback if the folder grant is ever removed.

### Broker SA grants on the billing account

`gcloud beta billing projects link` needs `billing.user` on the billing account, not just on the folder.

```bash
gcloud billing accounts add-iam-policy-binding 014D0F-AC8E0F-5A7EE7 \
  --member="serviceAccount:factory-master-broker@or-factory-master-control.iam.gserviceaccount.com" \
  --role="roles/billing.user"
```

Requires `roles/billing.admin` on the billing account to apply. In this org, only `edri2or@gmail.com` has it (verify with `gcloud billing accounts get-iam-policy 014D0F-AC8E0F-5A7EE7`); switch to that account before running.

### Broker SA grants on the control project itself

These let the broker manage its own credentials, deploy its own infrastructure, and read/write secrets stored alongside it.

```bash
PROJECT=or-factory-master-control
BROKER=factory-master-broker@or-factory-master-control.iam.gserviceaccount.com

for role in \
    roles/secretmanager.admin \
    roles/run.admin \
    roles/artifactregistry.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${BROKER}" \
    --role="$role"
done

# Self-actAs (needed when the broker deploys Cloud Run as itself)
gcloud iam service-accounts add-iam-policy-binding "$BROKER" \
  --project="$PROJECT" \
  --role="roles/iam.serviceAccountUser" \
  --member="serviceAccount:${BROKER}"
```

`roles/run.admin` and `roles/artifactregistry.admin` are only needed for the bootstrap-receiver in stage 4 (`register-broker-app.yml`); once that workflow is retired they can be removed.

## GitHub App permissions

The App `factory-master-broker` (app ID 3800903) was registered via the manifest flow in stage 4. The Manifest API rejects the `variables` permission, so it has to be added in the UI after the fact.

**Required permissions** (verify at https://github.com/organizations/edri2or/settings/apps/factory-master-broker → Permissions):

| Permission | Level | Why |
|---|---|---|
| `actions` | Write | dispatch workflows, read runs |
| `actions_variables` | Write | set repo variables in `provision-system.yml` |
| `administration` | Write | create repos, set branch protection |
| `contents` | Write | push files, read repo content |
| `metadata` | Read | required by GitHub |
| `pull_requests` | Write | open PRs for scaffold sync |
| `secrets` | Write | reserved for future use |
| `workflows` | Write | update workflow files in system repos |
| `organization_administration` | Write | create repos under the org |

Installation scope: **All repositories** (`repository_selection = "all"`). Newly-created repos are auto-added; no per-repo install step needed.

To verify both the permissions and the install scope at any time:

```bash
APP_ID=$(gcloud secrets versions access latest --secret=factory-master-broker-app-id --project=or-factory-master-control)
INSTALL_ID=$(gcloud secrets versions access latest --secret=factory-master-broker-app-installation-id --project=or-factory-master-control)
gcloud secrets versions access latest --secret=factory-master-broker-app-private-key --project=or-factory-master-control > /tmp/key.pem
chmod 600 /tmp/key.pem

NOW=$(date +%s)
b64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }
HDR=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
PLD=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$((NOW-60))" "$((NOW+540))" "$APP_ID" | b64url)
SIG=$(printf '%s' "${HDR}.${PLD}" | openssl dgst -sha256 -sign /tmp/key.pem | b64url)
JWT="${HDR}.${PLD}.${SIG}"

curl -sS \
  -H "Authorization: Bearer ${JWT}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/app/installations/${INSTALL_ID}" \
  | jq '{repository_selection, permissions}'

shred -u /tmp/key.pem
```

## Secrets in `or-factory-master-control`

Source of truth: `gcloud secrets list --project=or-factory-master-control`.

Three buckets:

1. **App credentials + super-credentials (never copied to system projects)** —
   - `factory-master-broker-app-{id,installation-id,private-key}`. The broker SA reads them at the start of every workflow run to mint an installation token.
   - `openrouter-management-key` — the OpenRouter **management (provisioning) key**, which can mint/list/revoke inference keys for the entire OpenRouter account. It lives **only** in control SM and is used solely inside `provision-system.yml` (to mint a per-system inference key) and `decommission-test-system.yml` (to revoke one). It must never reach a tenant SM. The per-system `openrouter-api-key` (the actual `sk-or-v1-…` inference key) and its `openrouter-key-hash` are **minted per system** into each tenant SM by provision — they do not exist in control SM.
2. **Generic API keys (15, copied to every system project)** — `anthropic-api-key`, `openai-api-key`, `perplexity-api-key`, `opencode-api-key`, `deepseek-api-key`, `google-api-key`, `linear-api-key`, `linear-team-id`, `stripe-api-key`, `telegram-chat-id`, `telegram-bot-token`, `railway-api-token`, `cloudflare-token-creator`, `cloudflare-account-id`, `cloudflare-zone-id-or-infra`. Copied by `scripts/copy-generic-secrets.sh` during `provision-system.yml`.
3. **Control-only seed defaults (excluded from the bulk copy)** —
   - `n8n-telegram-bot-token-test` — the durable default for the per-system **test** bot. `provision-system.yml` reads it directly from control SM and seeds it into a test system's `n8n-telegram-bot-token` (reuse mode only, and only when that secret is empty). Real systems get their own distinct bot and are unaffected. Captured once from the value the operator had been re-pasting on every test provision.

   The `EXCLUDE` regex in the copy script is `^(factory-master-broker-app-.*|.*-management-key|.*-provisioning-key|.*-master-key|n8n-telegram-bot-token-test)$`: broker App creds, any management/provisioning/master key (so a future super-credential is never copied without a point fix), plus the seed default above. Any **other** new secret added to control SM will still be copied to every system unless the regex is widened.

### Cloudflare API token scopes (`cloudflare-token-creator`)

The token stored as `cloudflare-token-creator` in control SM (and copied to every system SM) is consumed by the deploy workflow to manage one CNAME per system on `or-infra.com`. It must have, on the `or-infra.com` zone:

- `Zone:Zone:Read`
- `Zone:DNS:Edit`

Verify:

```bash
TOKEN=$(gcloud secrets versions access latest --secret=cloudflare-token-creator --project=or-factory-master-control)
curl -sS -H "Authorization: Bearer ${TOKEN}" \
  https://api.cloudflare.com/client/v4/user/tokens/verify | jq '.success, .result.status'
```

The deploy workflow calls `/user/tokens/verify` up-front and fails fast if the token is invalid or revoked. Scope changes happen in the Cloudflare dashboard (Profile → API Tokens); the token value in SM stays the same.

## Recovery checklist

If you ever need to rebuild this factory from scratch, do these in order:

1. Create the GCP control project under the systems folder.
2. Apply the org policy override (above).
3. Enable the APIs (above).
4. Create the broker SA, the WIF pool/provider on the control project (with the `repository_id` CEL pin), and grant the broker SA `workloadIdentityUser` on itself.
5. Grant the broker SA all the folder-level, billing-account-level, and control-project-level roles (above).
6. Copy the 16 generic secrets into the control SM.
7. Run `register-broker-app.yml` to create the App via the Cloud Run receiver.
8. Add the `actions_variables` permission to the App in the UI; accept the new permission on the org installation.
9. Verify with the JWT-based check above.

The repo content (`CLAUDE.md`, skills, `provision-system.yml`, scripts) is just files in git — `git clone` and you have it.
