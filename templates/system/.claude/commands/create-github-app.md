---
description: Deploy a temporary Cloud Run receiver, register a GitHub App via manifest flow, capture credentials to GCP Secret Manager, then teardown. Vendor floor: 2 operator clicks.
---

# create-github-app

## Role

You are a Platform Engineer. You register a new GitHub App in a GitHub org using
the manifest flow, capture the credentials to GCP Secret Manager, and tear down
the temporary Cloud Run receiver — all autonomously except for the 2 browser clicks
that GitHub's policy requires from the operator.

## Prerequisites

| Prerequisite | How to verify |
|---|---|
| GCP WIF configured for the target repo | WIF provider and service account exist as GitHub Actions variables |
| GCP SA has Cloud Run Admin + Secret Manager Admin | `gcloud projects get-iam-policy {gcp_project_id}` lists the SA roles |
| Operator is an admin of `github_org` | Can view `https://github.com/organizations/{github_org}/settings/apps` |

If any prerequisite is missing, surface it and stop. Do not try to fix WIF
setup — that belongs to the `/gcp-wif-bootstrap` skill.

## Inputs

Collect from operator or context before proceeding:

| Input | Example | Notes |
|---|---|---|
| `app_name` | `my-service-agent` | Display name — globally unique on GitHub |
| `github_org` | `my-org` | Org **login** — never a domain like `my-org.com` |
| `gcp_project_id` | `my-gcp-project` | GCP project where SM secrets will be written |
| `secret_prefix` | `github-app-` | All SM secrets will be named `{prefix}id`, `{prefix}private-key`, etc. |
| `permissions` | `{"contents":"write","metadata":"read"}` | JSON object of GitHub App permissions |
| `webhook_url` | _(optional)_ | Omit for API-only apps |
| `receiver_image` | _(optional)_ | Override the Cloud Run receiver image; defaults to the published image |
| `region` | _(optional)_ | GCP region for Cloud Run; default `us-central1` |
| `wif_provider_var` | _(optional)_ | GitHub Actions variable name holding the WIF provider; default `GCP_WORKLOAD_IDENTITY_PROVIDER` |
| `wif_sa_var` | _(optional)_ | GitHub Actions variable name holding the WIF service account; default `GCP_SERVICE_ACCOUNT_EMAIL` |

**Abort** if `github_org` contains `.com`, `.io`, `.org`, or any dot — that is a
domain name, not a GitHub org login.

## Instructions

### Step 0 — Idempotency check

Before doing anything, check whether `{secret_prefix}id` and
`{secret_prefix}installation-id` both already exist in GCP Secret Manager for
`gcp_project_id`. If both exist, report success and stop — do not re-run.

Use the workflow's idempotency gate (Step 2 below) rather than raw `gcloud` calls.

### Step 1 — Write workflow to target repo

Check whether `.github/workflows/create-github-app.yml` exists in the target repo.
If it does not, write the following workflow YAML there verbatim:

```yaml
name: create-github-app

on:
  workflow_dispatch:
    inputs:
      app_name:
        required: true
        type: string
      github_org:
        required: true
        type: string
      gcp_project_id:
        required: true
        type: string
      secret_prefix:
        required: true
        type: string
        default: github-app-
      permissions:
        required: true
        type: string
        description: JSON object of GitHub App permissions
      events:
        required: false
        type: string
        default: '[]'
        description: JSON array of GitHub App webhook events
      webhook_url:
        required: false
        type: string
        default: ''
      receiver_image:
        required: false
        type: string
        default: ghcr.io/[your-org]/[your-central-repo]/github-app-receiver:latest
        description: Docker image for the Cloud Run receiver
      region:
        required: false
        type: string
        default: us-central1
        description: GCP region for Cloud Run deployment
      wif_provider_var:
        required: false
        type: string
        default: GCP_WORKLOAD_IDENTITY_PROVIDER
        description: GitHub Actions variable name holding the WIF provider
      wif_sa_var:
        required: false
        type: string
        default: GCP_SERVICE_ACCOUNT_EMAIL
        description: GitHub Actions variable name holding the WIF service account

permissions:
  id-token: write
  contents: read

jobs:
  register:
    runs-on: ubuntu-latest
    env:
      SERVICE_NAME: github-app-receiver-${{ github.run_id }}
      REGION: ${{ inputs.region }}
      IMAGE: ${{ inputs.receiver_image }}
      PERMISSIONS_JSON: ${{ inputs.permissions }}
      EVENTS_JSON: ${{ inputs.events }}
    steps:
      - name: Auth GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars[inputs.wif_provider_var] }}
          service_account: ${{ vars[inputs.wif_sa_var] }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Idempotency check
        id: idempotent
        run: |
          PREFIX="${{ inputs.secret_prefix }}"
          PROJECT="${{ inputs.gcp_project_id }}"
          has_id=$(gcloud secrets versions access latest \
            --secret="${PREFIX}id" --project="$PROJECT" > /dev/null 2>&1 && echo true || echo false)
          has_install=$(gcloud secrets versions access latest \
            --secret="${PREFIX}installation-id" --project="$PROJECT" > /dev/null 2>&1 && echo true || echo false)
          if [[ "$has_id" == "true" && "$has_install" == "true" ]]; then
            echo "already_registered=true" >> "$GITHUB_OUTPUT"
            echo "## Already registered" >> "$GITHUB_STEP_SUMMARY"
            echo "Secrets \`${PREFIX}id\` and \`${PREFIX}installation-id\` already exist — nothing to do." >> "$GITHUB_STEP_SUMMARY"
          else
            echo "already_registered=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Deploy Cloud Run receiver
        id: deploy
        if: steps.idempotent.outputs.already_registered != 'true'
        run: |
          PERMS_B64=$(printf '%s' "$PERMISSIONS_JSON" | base64 -w 0)
          EVENTS_B64=$(printf '%s' "$EVENTS_JSON" | base64 -w 0)
          URL=$(gcloud run deploy "$SERVICE_NAME" \
            --image="$IMAGE" \
            --region="$REGION" \
            --platform=managed \
            --allow-unauthenticated \
            --service-account="${{ vars[inputs.wif_sa_var] }}" \
            --project="${{ inputs.gcp_project_id }}" \
            --set-env-vars="GCP_PROJECT_ID=${{ inputs.gcp_project_id }},GITHUB_ORG=${{ inputs.github_org }},APP_NAME=${{ inputs.app_name }},SECRET_PREFIX=${{ inputs.secret_prefix }},APP_PERMISSIONS=${PERMS_B64},APP_EVENTS=${EVENTS_B64},WEBHOOK_URL=${{ inputs.webhook_url }}" \
            --format='value(status.url)')
          echo "service_url=$URL" >> "$GITHUB_OUTPUT"

      - name: Set REDIRECT_URL
        if: steps.idempotent.outputs.already_registered != 'true'
        run: |
          gcloud run services update "$SERVICE_NAME" \
            --region="$REGION" \
            --project="${{ inputs.gcp_project_id }}" \
            --update-env-vars="REDIRECT_URL=${{ steps.deploy.outputs.service_url }}/callback"

      - name: Grant public access
        if: steps.idempotent.outputs.already_registered != 'true'
        run: |
          gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
            --region="$REGION" \
            --project="${{ inputs.gcp_project_id }}" \
            --member=allUsers \
            --role=roles/run.invoker

      - name: Health check
        if: steps.idempotent.outputs.already_registered != 'true'
        run: |
          URL="${{ steps.deploy.outputs.service_url }}"
          for i in $(seq 1 24); do
            if curl -sf -m 8 "${URL}/health" > /dev/null 2>&1; then
              echo "Receiver healthy"; break
            fi
            echo "Waiting for receiver... ($i/24)"; sleep 5
          done

      - name: Print manifest URL
        if: steps.idempotent.outputs.already_registered != 'true'
        run: |
          URL="${{ steps.deploy.outputs.service_url }}"
          echo "## Action required: 2 operator clicks" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "Open this URL — the page auto-redirects to GitHub's App creation form:" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "**[$URL]($URL)**" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "1. Review the pre-filled form and click **Create GitHub App** on GitHub" >> "$GITHUB_STEP_SUMMARY"
          echo "2. On the next page, click **Install**" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "The workflow will continue automatically after both clicks." >> "$GITHUB_STEP_SUMMARY"

      - name: Poll for secrets
        if: steps.idempotent.outputs.already_registered != 'true'
        timeout-minutes: 32
        run: |
          PREFIX="${{ inputs.secret_prefix }}"
          PROJECT="${{ inputs.gcp_project_id }}"

          poll_secret() {
            local secret="$1"
            for i in $(seq 1 64); do
              if gcloud secrets versions access latest \
                  --secret="$secret" --project="$PROJECT" > /dev/null 2>&1; then
                echo "Secret $secret is present"; return 0
              fi
              if [[ $i -eq 64 ]]; then
                echo "::error::Timed out waiting for $secret — operator may not have completed both clicks" >> "$GITHUB_STEP_SUMMARY"
                return 1
              fi
              sleep 30
            done
          }

          poll_secret "${PREFIX}id" &
          PID1=$!
          poll_secret "${PREFIX}installation-id" &
          PID2=$!
          wait $PID1 && wait $PID2

      - name: Teardown receiver
        if: always() && steps.idempotent.outputs.already_registered != 'true'
        run: |
          gcloud run services delete "$SERVICE_NAME" \
            --region="$REGION" \
            --project="${{ inputs.gcp_project_id }}" \
            --quiet || true

      - name: Summary
        if: steps.idempotent.outputs.already_registered != 'true'
        run: |
          PREFIX="${{ inputs.secret_prefix }}"
          echo "## Registration complete" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "Secrets written to GCP project \`${{ inputs.gcp_project_id }}\`:" >> "$GITHUB_STEP_SUMMARY"
          echo "- \`${PREFIX}id\`" >> "$GITHUB_STEP_SUMMARY"
          echo "- \`${PREFIX}private-key\`" >> "$GITHUB_STEP_SUMMARY"
          echo "- \`${PREFIX}webhook-secret\` (if webhook_url was provided)" >> "$GITHUB_STEP_SUMMARY"
          echo "- \`${PREFIX}installation-id\`" >> "$GITHUB_STEP_SUMMARY"
```

### Step 2 — Dispatch workflow

```
POST /repos/{owner}/{repo}/actions/workflows/create-github-app.yml/dispatches
{
  "ref": "main",
  "inputs": {
    "app_name": "{app_name}",
    "github_org": "{github_org}",
    "gcp_project_id": "{gcp_project_id}",
    "secret_prefix": "{secret_prefix}",
    "permissions": "{permissions_json}",
    "events": "[]",
    "webhook_url": "{webhook_url or ''}",
    "receiver_image": "{override or omit for default}",
    "region": "{override or omit for default}",
    "wif_provider_var": "{override or omit for default}",
    "wif_sa_var": "{override or omit for default}"
  }
}
```

Use `return_run_details: true` to capture `run_id` immediately (no race condition).

### Step 3 — Surface manifest URL to operator

Poll `GET /actions/runs/{run_id}` every 15s until `status == in_progress`.
Then read `$GITHUB_STEP_SUMMARY` via `GET /check-runs/{check_run_id}` →
`.output.summary`.

Extract the receiver URL and tell the operator:

> **ACTION REQUIRED — 2 clicks:**
> Open: `{SERVICE_URL}`
> The page will redirect automatically to GitHub's App creation form.
> 1. Review the pre-filled form and click **Create GitHub App** on GitHub
> 2. On the next page, click **Install**
>
> The workflow will complete automatically after both clicks.

### Step 4 — Wait for workflow completion

Continue polling `GET /actions/runs/{run_id}` every 15s until
`status == completed`. Maximum wait: 35 minutes total.

On `conclusion == success`: report which SM secrets were written.
On `conclusion == failure`: surface the failing step from the workflow summary.
Never surface secret values — only confirm existence.

## Hard rules

1. **Never automate the browser clicks** — the 2 clicks are the authorization
   mechanism; automating them violates GitHub's AUP.
2. **Never print secret values** — confirm existence in SM only (secret names
   are safe to show; content is not).
3. **Never accept `github_org` with a dot** — abort and ask for the org login.
4. **Check idempotency first** — if both `{prefix}id` and
   `{prefix}installation-id` exist, declare success without re-running.
5. **Never run `gcloud` locally** — all cloud mutations go through the
   dispatched GitHub Actions workflow authenticated via WIF.
