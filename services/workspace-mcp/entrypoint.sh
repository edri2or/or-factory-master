#!/usr/bin/env bash
# Boot shim for the Google Workspace MCP sidecar (headless "mode-C").
#
# Pre-seeds a single-user authorized-user credential file from the SHARED
# gmail-oauth-* secrets (mounted as env), then launches workspace-mcp in
# single-user streamable-http mode. No interactive consent: google-auth refreshes
# the access token from the shared refresh token on first tool call. The secret
# values are read from env and written ONLY into the 0600 credential file — never
# echoed. Proven end-to-end in the Stage 0a spike (devplans/google-mcp-systems.md).
set -euo pipefail

CREDS_DIR="${WORKSPACE_MCP_CREDENTIALS_DIR:-/creds}"
# The credential-file STORAGE-KEY label: single-user mode files the cred under
# "<this>.json" and callers pass it as user_google_email. It is NOT the token's real
# account — a 2026-06-15 live test proved the deployed token authenticates as
# edri2or@gmail.com (Or's personal account) yet works fine under the edriorp38 label,
# so the label does NOT constrain the account (no effective account==label enforcement;
# the prior "shared-google@or-infra.com" was a fictional label). Keep this value as-is
# (callers pass it to locate the credential); see docs/google-identities.md.
LABEL="${WORKSPACE_GOOGLE_ACCOUNT_LABEL:-edriorp38@or-infra.com}"
PORT="${WORKSPACE_MCP_PORT:-3002}"
read -r -a TOOLS_ARR <<< "${WORKSPACE_MCP_TOOLS:-calendar gmail drive docs}"

mkdir -p "${CREDS_DIR}"
chmod 700 "${CREDS_DIR}" || true

# Build the credential file with python3 (base image) so JSON is encoded safely
# and the token is never logged. A missing/placeholder refresh token still writes
# a dormant file so the server boots and /health stays green — Google calls just
# fail until a real token is mounted (mirrors the deploy's placeholder pattern).
CRED_PATH="${CREDS_DIR}/${LABEL}.json" python3 - <<'PY'
import json, os, sys
refresh = os.environ.get("GMAIL_OAUTH_REFRESH_TOKEN", "")
if not refresh or refresh == "__NOT_CONFIGURED__":
    sys.stderr.write("WARN: GMAIL_OAUTH_REFRESH_TOKEN absent/placeholder; seeding DORMANT credential "
                     "(Google calls fail until a real token is mounted)\n")
    refresh = "DORMANT-NOT-CONFIGURED"
# EXACTLY the scopes the shared token was consented for (the SCOPE string in
# bootstrap-gmail-oauth.yml / request-workspace-scopes-consent.yml). Must match
# the grant precisely: any superset/subset makes google-auth raise "Scope has
# changed" on refresh. Env-driven (space-separated WORKSPACE_MCP_SCOPES) so a
# scope rotation is a deploy-time change; the default is the FULL set the --tools
# calendar/gmail/drive/docs sidecar requires (rotated 2026-06-11 — a curated
# 6-scope set only worked on the old client via accumulated grants; the fresh
# unified client granted exactly 6 and the sidecar then reported "Authentication
# Needed"). These are write-capable scopes — the server runs full mode (not
# --read-only); per-action write safety is the system's HITL gate.
default_scopes = (
    "https://www.googleapis.com/auth/gmail.readonly "
    "https://www.googleapis.com/auth/gmail.compose "
    "https://www.googleapis.com/auth/gmail.modify "
    "https://www.googleapis.com/auth/gmail.send "
    "https://www.googleapis.com/auth/gmail.labels "
    "https://www.googleapis.com/auth/gmail.settings.basic "
    "https://www.googleapis.com/auth/calendar "
    "https://www.googleapis.com/auth/calendar.readonly "
    "https://www.googleapis.com/auth/calendar.events "
    "https://www.googleapis.com/auth/drive "
    "https://www.googleapis.com/auth/drive.readonly "
    "https://www.googleapis.com/auth/drive.file "
    "https://www.googleapis.com/auth/documents "
    "https://www.googleapis.com/auth/documents.readonly "
    "openid "
    "https://www.googleapis.com/auth/userinfo.email "
    "https://www.googleapis.com/auth/userinfo.profile"
)
scopes = os.environ.get("WORKSPACE_MCP_SCOPES", "").split() or default_scopes.split()
data = {
    "token": None,
    "refresh_token": refresh,
    "token_uri": "https://oauth2.googleapis.com/token",
    "client_id": os.environ.get("GOOGLE_OAUTH_CLIENT_ID", ""),
    "client_secret": os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", ""),
    "scopes": scopes,
    "expiry": None,
}
path = os.environ["CRED_PATH"]
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    json.dump(data, f)
sys.stderr.write(f"INFO: seeded single-user credential at {path}\n")
PY

ARGS=(--single-user --transport streamable-http --tools "${TOOLS_ARR[@]}")
# Full mode by default: the shared token is WRITE-scoped (gmail.modify +
# calendar.events), so --read-only would demand readonly scopes the token lacks
# (Google then refuses every call). Per-action write safety is the system's own
# HITL ✅ gate (Stage 1), not this flag. A true-read-only follow-up needs a
# readonly-scoped shared token. Set WORKSPACE_MCP_READ_ONLY=1 only with such a token.
if [ "${WORKSPACE_MCP_READ_ONLY:-0}" = "1" ]; then
  ARGS+=(--read-only)
fi
echo "INFO: launching workspace-mcp on :${PORT} tools=[${TOOLS_ARR[*]}] read_only=${WORKSPACE_MCP_READ_ONLY:-1}"
exec workspace-mcp "${ARGS[@]}"
