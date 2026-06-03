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
# Required env: SERVICE, GATEWAY_IMAGE, N8N_MCP_IMAGE, RUNTIME_SA_EMAIL,
#               PUBLIC_BASE_URL, N8N_DEV_ALLOWED_SYSTEMS
set -euo pipefail

: "${SERVICE:?}"; : "${GATEWAY_IMAGE:?}"; : "${N8N_MCP_IMAGE:?}"
: "${RUNTIME_SA_EMAIL:?}"; : "${PUBLIC_BASE_URL:?}"; : "${N8N_DEV_ALLOWED_SYSTEMS:?}"

# Gateway env vars sourced from Secret Manager (ENV_NAME=secret-name). The
# gateway already shipped these 19; N8N_MCP_AUTH_TOKEN is the only addition.
GATEWAY_SECRETS=(
  "MCP_ADMIN_SECRET=mcp-server-admin-secret"
  "BEARER_SIGNING_KEY=mcp-server-bearer-signing-key"
  "N8N_MCP_AUTH_TOKEN=n8n-mcp-internal-auth-token"
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
printf '        autoscaling.knative.dev/minScale: "0"\n'
printf '        autoscaling.knative.dev/maxScale: "3"\n'
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
for pair in "${GATEWAY_SECRETS[@]}"; do
  emit_secret "${pair%%=*}" "${pair#*=}"
done

# ── Sidecar container: n8nmcp (no port → localhost-only) ──
printf '      - name: n8nmcp\n'
printf '        image: %s\n' "${N8N_MCP_IMAGE}"
printf '        resources:\n'
printf '          limits:\n'
printf '            cpu: "1"\n'
printf '            memory: 512Mi\n'
printf '        env:\n'
emit_env MCP_MODE "http"
emit_env ENABLE_MULTI_TENANT "true"
emit_env PORT "3001"
emit_env HOST "0.0.0.0"
emit_env TRUST_PROXY "1"
emit_env LOG_LEVEL "info"
emit_secret AUTH_TOKEN n8n-mcp-internal-auth-token
emit_secret MCP_AUTH_TOKEN n8n-mcp-internal-auth-token

printf '  traffic:\n'
printf '  - latestRevision: true\n'
printf '    percent: 100\n'
