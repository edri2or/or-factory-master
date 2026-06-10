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
# Stable local key the sidecar files the shared credential under; the n8n agent
# passes this exact string as user_google_email (Google auths by the token).
WORKSPACE_GOOGLE_ACCOUNT_LABEL="${WORKSPACE_GOOGLE_ACCOUNT_LABEL:-shared-google@or-infra.com}"
# Tool groups the Workspace sidecar serves + the EXACT scopes of the shared
# token's grant (rotated 2026-06-10 to 6: the original 4 + Drive + Docs). The
# scopes list must equal the grant byte-for-byte or google-auth fails refresh
# with "Scope has changed".
WORKSPACE_MCP_TOOLS="${WORKSPACE_MCP_TOOLS:-calendar gmail drive docs}"
WORKSPACE_MCP_SCOPES="${WORKSPACE_MCP_SCOPES:-https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/gmail.settings.sharing https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents}"

# Gateway env vars sourced from Secret Manager (ENV_NAME=secret-name). The
# gateway already shipped these 19; N8N_MCP_AUTH_TOKEN is the only addition.
GATEWAY_SECRETS=(
  "MCP_ADMIN_SECRET=mcp-server-admin-secret"
  "BEARER_SIGNING_KEY=mcp-server-bearer-signing-key"
  "N8N_MCP_AUTH_TOKEN=n8n-mcp-internal-auth-token"
  "GOOGLE_OAUTH_CLIENT_ID=google-oauth-client-id"
  "GOOGLE_OAUTH_CLIENT_SECRET=google-oauth-client-secret"
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
# Single-user, read-only (v1), shared Google identity. The boot shim (entrypoint.sh)
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
