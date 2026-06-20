#!/usr/bin/env bash
# Render the Knative Service spec for the factory MCP server as a MULTI-container
# Cloud Run service: a public `gateway` ingress (port 3000) + an internal
# `n8nmcp` sidecar (czlonkowski/n8n-mcp, portless, reachable only at localhost).
#
# Applied with `gcloud run services replace` — the deterministic, Google-
# recommended way to run sidecars. `gcloud run deploy --container` was abandoned
# because, against an already-existing single-container service, it produced
# "Revision template should contain exactly one container with an exposed port".
#
# Output goes to stdout (the deploy step redirects to a file). Built with printf
# (not heredocs) so indentation is explicit and immune to YAML-block-scalar
# dedent inside the workflow. Secret values are NEVER touched — only secret
# NAMES are referenced via valueFrom.secretKeyRef.
#
# Required env: SERVICE, GATEWAY_IMAGE, N8N_MCP_IMAGE, WORKSPACE_MCP_IMAGE,
#               RUNTIME_SA_EMAIL, PUBLIC_BASE_URL, N8N_DEV_ALLOWED_SYSTEMS
set -euo pipefail

: "${SERVICE:?}"; : "${GATEWAY_IMAGE:?}"; : "${N8N_MCP_IMAGE:?}"; : "${WORKSPACE_MCP_IMAGE:?}"
: "${RUNTIME_SA_EMAIL:?}"; : "${PUBLIC_BASE_URL:?}"; : "${N8N_DEV_ALLOWED_SYSTEMS:?}"
OAUTH_ALLOWED_EMAILS="${OAUTH_ALLOWED_EMAILS:-}"   # Google-login email allowlist (may be empty)
# Which systems may reach the shared Google Workspace MCP ("*" = any valid name).
WORKSPACE_ALLOWED_SYSTEMS="${WORKSPACE_ALLOWED_SYSTEMS:-*}"
# Which systems' agents may use the tenant-locked factory telemetry subset at
# /factory/<system>/mcp ("*" = any valid system name — each bearer is already
# hard-bound to one system). Set empty to kill-switch the surface (all 404).
FACTORY_TOOLS_ALLOWED_SYSTEMS="${FACTORY_TOOLS_ALLOWED_SYSTEMS:-*}"
# The narrow coordinator dispatch surface at /coordinator/<repo>/mcp. Both
# fail-closed: an EMPTY default admits NOTHING (the route 404s and route_to_agent
# has no allowlisted worker), so the surface is OFF unless deploy-mcp-server.yml
# pins them. REQUESTER = the coordinator path repo(s); WORKER = the
# sibling agent-repos route_to_agent may dispatch agent-action.yml propose to.
COORDINATOR_REQUESTER_REPOS="${COORDINATOR_REQUESTER_REPOS:-}"
COORDINATOR_WORKER_REPOS="${COORDINATOR_WORKER_REPOS:-}"
# The credential-file STORAGE-KEY label: the sidecar files the credential under
# "<this>.json" and callers pass it as user_google_email. It is NOT the token's real
# account — a 2026-06-15 live test proved the deployed token authenticates as
# edri2or@gmail.com (Or's personal account) yet works under the edriorp38 label, so the
# label does NOT constrain the account. Keep this value as-is (changing it breaks
# callers); a prior "shared-google@or-infra.com" was a FICTIONAL label (see docs/google-identities.md).
WORKSPACE_GOOGLE_ACCOUNT_LABEL="${WORKSPACE_GOOGLE_ACCOUNT_LABEL:-edriorp38@or-infra.com}"
# Tool groups the Workspace sidecar serves + the EXACT scopes of the shared
# token's grant. The scopes list must equal the grant byte-for-byte or google-auth
# fails refresh with "Scope has changed", AND must cover everything the sidecar's
# enabled tool groups need or the sidecar reports "Authentication Needed". This is
# the FULL "complete"-tier set: all 12 workspace-mcp tool groups, with the 41-scope
# union derived verbatim from the package's auth/scopes.py @ tag v1.21.1 (granted
# live for edri2or@gmail.com on 2026-06-16). MUST stay byte-equal to the four sites:
# WORKSPACE_SCOPES (services/mcp-server/src/google-oauth.ts), default_scopes
# (services/workspace-mcp/entrypoint.sh), and the test literal
# (services/mcp-server/test/google-oauth.test.mjs).
WORKSPACE_MCP_TOOLS="${WORKSPACE_MCP_TOOLS:-calendar gmail drive docs sheets slides forms tasks chat contacts search appscript}"
WORKSPACE_MCP_SCOPES="${WORKSPACE_MCP_SCOPES:-https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/presentations.readonly https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.body.readonly https://www.googleapis.com/auth/forms.responses.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/chat.messages https://www.googleapis.com/auth/chat.messages.readonly https://www.googleapis.com/auth/chat.spaces https://www.googleapis.com/auth/chat.spaces.readonly https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/cse https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.projects.readonly https://www.googleapis.com/auth/script.deployments https://www.googleapis.com/auth/script.deployments.readonly https://www.googleapis.com/auth/script.processes https://www.googleapis.com/auth/script.metrics https://www.googleapis.com/auth/script.external_request https://www.googleapis.com/auth/script.scriptapp openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile}"

# Gateway env vars sourced from Secret Manager (ENV_NAME=secret-name). The
# gateway already shipped these 19; N8N_MCP_AUTH_TOKEN is the only addition.
GATEWAY_SECRETS=(
  "MCP_ADMIN_SECRET=mcp-server-admin-secret"
  "BEARER_SIGNING_KEY=mcp-server-bearer-signing-key"
  "N8N_MCP_AUTH_TOKEN=n8n-mcp-internal-auth-token"
  # ONE unified OAuth client, ONE SM key-set: both the operator "Login with
  # Google" flow (GOOGLE_OAUTH_CLIENT_*) and the shared workspace consent door +
  # sidecar (WORKSPACE_OAUTH_CLIENT_*) read the single pair gmail-oauth-client-*.
  # The former google-oauth-client-* login pair was retired once the unified
  # client proved out (google-wallet-unify Stage 5, 2026-06-11) — both pairs had
  # held the same client, so collapsing login onto gmail-oauth-client-* is
  # value-identical. They MUST be one client: a refresh token is bound to its
  # issuing client, so the consent door (which mints the refresh token via the
  # WORKSPACE_* env) and login must share it — here they do, by construction.
  "GOOGLE_OAUTH_CLIENT_ID=gmail-oauth-client-id"
  "GOOGLE_OAUTH_CLIENT_SECRET=gmail-oauth-client-secret"
  "WORKSPACE_OAUTH_CLIENT_ID=gmail-oauth-client-id"
  "WORKSPACE_OAUTH_CLIENT_SECRET=gmail-oauth-client-secret"
  "GITHUB_APP_ID=factory-master-broker-app-id"
  "GITHUB_APP_PRIVATE_KEY=factory-master-broker-app-private-key"
  "GITHUB_APP_INSTALLATION_ID=factory-master-broker-app-installation-id"
  "RAILWAY_API_TOKEN=railway-api-token"
  "CLOUDFLARE_API_TOKEN=cloudflare-token-creator"
  "CLOUDFLARE_ZONE_ID=cloudflare-zone-id-or-infra"
  "CLOUDFLARE_ZONES_READ_TOKEN=cloudflare-zones-read-token"
  "SENTRY_DSN=sentry-api-key"
  "BS_WEBHOOK_SECRET=bs-webhook-secret"
  "LINEAR_WEBHOOK_SECRET=linear-webhook-secret"
  "TELEGRAM_APPROVAL_WEBHOOK_SECRET=telegram-approval-webhook-secret"
  "OIL_APPROVER_TELEGRAM_ALLOWLIST=oil-approver-telegram-allowlist"
  "OIL_APPROVER_APP_ID=oil-autofix-approver-app-id"
  "OIL_APPROVER_INSTALLATION_ID=oil-autofix-approver-app-installation-id"
  "OIL_APPROVER_PRIVATE_KEY=oil-autofix-approver-app-private-key"
  "FACTORY_TG_CHAT_ALLOWLIST=factory-telegram-chat-allowlist"
  "FACTORY_TG_CHAT_OPENROUTER_KEY=factory-telegram-chat-openrouter-key"
)

# A plain env var (NAME VALUE) → two indented lines.
emit_env() { printf '        - name: %s\n          value: "%s"\n' "$1" "$2"; }
# A secret-backed env var (ENV_NAME SECRET_NAME) → valueFrom.secretKeyRef.
emit_secret() {
  printf '        - name: %s\n          valueFrom:\n            secretKeyRef:\n              name: %s\n              key: latest\n' "$1" "$2"
}

printf 'apiVersion: serving.knative.dev/v1\n'
printf 'kind: Service\n'
printf 'metadata:\n'
printf '  name: %s\n' "${SERVICE}"
printf '  labels:\n'
printf '    owner: factory-master\n'
printf '    purpose: mcp-server\n'
printf 'spec:\n'
printf '  template:\n'
printf '    metadata:\n'
printf '      annotations:\n'
# Pin to a single always-warm instance. The n8nmcp sidecar is a STATEFUL
# streamable-HTTP MCP server (keeps the mcp-session-id in instance memory), so a
# scale-to-zero (minScale 0) or a second instance (maxScale > 1, no affinity)
# loses the session → "Session not found or expired" on the next call. One warm
# instance keeps every gateway+sidecar request on the same pod. sessionAffinity
# is belt-and-suspenders (cookie-based, best-effort) if maxScale is ever raised.
#
# cpu-throttling "false" = CPU is ALWAYS allocated to the warm instance (not
# throttled to ~zero between requests). This is the other half of session
# stability: with default throttling, the pinned min-instance is still liable to
# mid-session reclaim/replacement, which silently wipes the in-RAM sessions and
# disconnects every connected client. Always-on CPU keeps the one pod genuinely
# alive between calls so sessions survive (it pairs with minScale "1").
printf '        autoscaling.knative.dev/minScale: "1"\n'
printf '        autoscaling.knative.dev/maxScale: "1"\n'
printf '        run.googleapis.com/sessionAffinity: "true"\n'
printf '        run.googleapis.com/cpu-throttling: "false"\n'
printf '    spec:\n'
printf '      serviceAccountName: %s\n' "${RUNTIME_SA_EMAIL}"
printf '      timeoutSeconds: 300\n'
printf '      containers:\n'

# ── Ingress container: gateway (the only container with a port) ──
printf '      - name: gateway\n'
printf '        image: %s\n' "${GATEWAY_IMAGE}"
printf '        ports:\n'
printf '        - containerPort: 3000\n'
printf '        resources:\n'
printf '          limits:\n'
printf '            cpu: "1"\n'
printf '            memory: 512Mi\n'
printf '        env:\n'
emit_env PUBLIC_BASE_URL "${PUBLIC_BASE_URL}"
# DEPLOY_NONCE forces a NEW Cloud Run revision on every deploy. The Workspace
# sidecar reads the shared Google refresh token ONLY at boot; `gcloud run
# services replace` with a byte-identical template is a NO-OP (no new revision,
# no restart), so a freshly re-consented token (a new gmail-oauth-refresh-token
# SM version) would silently NOT load on a same-commit redeploy — the sidecar
# keeps running its boot-time (now-stale/revoked) token. Threading the deploy
# run id through the template guarantees it differs each deploy → the instance
# rolls → the sidecar re-reads :latest. Ignored by the gateway code itself.
emit_env DEPLOY_NONCE "${DEPLOY_NONCE:-0}"
emit_env FACTORY_TG_CHAT_MODEL "anthropic/claude-haiku-4.5"
emit_env N8N_MCP_URL "http://localhost:3001/mcp"
emit_env N8N_DEV_ALLOWED_SYSTEMS "${N8N_DEV_ALLOWED_SYSTEMS}"
emit_env OAUTH_ALLOWED_EMAILS "${OAUTH_ALLOWED_EMAILS}"
# Control project the gateway writes the captured workspace refresh token back to
# (the /workspace/consent/callback door → Secret Manager addVersion).
emit_env CONTROL_PROJECT "or-factory-master-control"
# Google Workspace MCP sidecar endpoint (trailing slash: FastMCP 307-redirects
# the slashless form) + which systems may reach it.
emit_env WORKSPACE_MCP_URL "http://localhost:3002/mcp/"
emit_env WORKSPACE_ALLOWED_SYSTEMS "${WORKSPACE_ALLOWED_SYSTEMS}"
emit_env FACTORY_TOOLS_ALLOWED_SYSTEMS "${FACTORY_TOOLS_ALLOWED_SYSTEMS}"
emit_env COORDINATOR_REQUESTER_REPOS "${COORDINATOR_REQUESTER_REPOS}"
emit_env COORDINATOR_WORKER_REPOS "${COORDINATOR_WORKER_REPOS}"
for pair in "${GATEWAY_SECRETS[@]}"; do
  emit_secret "${pair%%=*}" "${pair#*=}"
done

# ── Sidecar container: n8nmcp (no port → localhost-only) ──
# 1Gi (not 512Mi): n8n-mcp loads its full nodes.db node-reference DB + the MCP
# SDK transport map into RAM. 512Mi was tight enough to OOM-kill the container
# mid-day (observed: a fresh "Database initialized" restart 44 min into a
# revision's life), and every OOM restart wipes the in-RAM sessions → every
# connected client disconnects. The extra headroom stops the OOM-driven churn.
printf '      - name: n8nmcp\n'
printf '        image: %s\n' "${N8N_MCP_IMAGE}"
printf '        resources:\n'
printf '          limits:\n'
printf '            cpu: "1"\n'
printf '            memory: 1Gi\n'
printf '        env:\n'
emit_env MCP_MODE "http"
emit_env ENABLE_MULTI_TENANT "true"
emit_env PORT "3001"
emit_env HOST "0.0.0.0"
emit_env TRUST_PROXY "1"
emit_env LOG_LEVEL "info"
emit_secret AUTH_TOKEN n8n-mcp-internal-auth-token
emit_secret MCP_AUTH_TOKEN n8n-mcp-internal-auth-token

# ── Sidecar container: workspacemcp (Google Workspace MCP; no port → localhost) ──
# Single-user, WRITE-enabled (NOT read-only), shared Google identity — see
# WORKSPACE_MCP_READ_ONLY="0" below. The shared token is write-scoped (incl. Drive
# write via update_drive_file); write safety is the upstream gate
# (OAUTH_ALLOWED_EMAILS + the claude.ai tool/Research controls), not a read-only
# sidecar. The boot shim (entrypoint.sh)
# pre-seeds the credential from the gmail-oauth-* secrets, then launches
# workspace-mcp in streamable-http on :3002. Legacy single-user mode has no
# transport auth of its own, so localhost-only containment is the boundary (same
# posture as n8nmcp); the PUBLIC gate is the gateway's per-system bearer. 512Mi:
# the tool registry is light (no nodes.db like n8n-mcp).
printf '      - name: workspacemcp\n'
printf '        image: %s\n' "${WORKSPACE_MCP_IMAGE}"
printf '        resources:\n'
printf '          limits:\n'
printf '            cpu: "1"\n'
printf '            memory: 512Mi\n'
printf '        env:\n'
emit_env WORKSPACE_MCP_TRANSPORT "streamable-http"
emit_env WORKSPACE_MCP_HOST "0.0.0.0"
emit_env WORKSPACE_MCP_PORT "3002"
emit_env WORKSPACE_MCP_CREDENTIALS_DIR "/creds"
emit_env MCP_SINGLE_USER_MODE "1"
emit_env OAUTHLIB_INSECURE_TRANSPORT "1"
emit_env WORKSPACE_MCP_TOOLS "${WORKSPACE_MCP_TOOLS}"
emit_env WORKSPACE_MCP_SCOPES "${WORKSPACE_MCP_SCOPES}"
# Full mode: the shared token is write-scoped, so --read-only would demand
# readonly scopes it lacks. Write safety is the system's HITL gate (Stage 1).
emit_env WORKSPACE_MCP_READ_ONLY "0"
emit_env WORKSPACE_GOOGLE_ACCOUNT_LABEL "${WORKSPACE_GOOGLE_ACCOUNT_LABEL}"
# Shared Google identity (the gmail-oauth-* app + refresh token already in control
# SM). The boot shim reads these and writes the single-user credential file.
emit_secret GOOGLE_OAUTH_CLIENT_ID gmail-oauth-client-id
emit_secret GOOGLE_OAUTH_CLIENT_SECRET gmail-oauth-client-secret
emit_secret GMAIL_OAUTH_REFRESH_TOKEN gmail-oauth-refresh-token

printf '  traffic:\n'
printf '  - latestRevision: true\n'
printf '    percent: 100\n'
