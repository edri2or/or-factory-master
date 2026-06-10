#!/usr/bin/env python3
"""Live smoke test for the central Google Workspace MCP gateway.

Proves the full loop end to end — gateway auth -> internal Google Workspace MCP
sidecar (shared single-user identity) -> the real Google account — without any
secret in a Claude session: the admin secret is read by the workflow from Secret
Manager (WIF) and passed in as an env var; it never leaves CI.

Steps (each asserted):
  1. mint a system-scoped 'workspace-runtime' bearer
     (POST /workspace/<system>/token, X-Admin-Secret)
  2. MCP initialize  (capture mcp-session-id; tolerate SSE or JSON)
  3. tools/list  -> must include Google tools (e.g. list_gmail_labels)
  4. tools/call list_gmail_labels(user_google_email=<label>)  -> must return real
     Gmail data, NOT an "authentication needed" prompt (proves the pre-seeded
     shared token refreshed against Google and the read reached the live account).
     We read GMAIL labels (covered by the token's gmail.modify scope); list_calendars
     would need calendar.readonly, which this write-scoped token deliberately lacks.
  5. tools/list also carries the Drive + Docs tool groups (search_drive_files,
     search_docs) — proves WORKSPACE_MCP_TOOLS="calendar gmail drive docs" landed.
  6. tools/call search_drive_files(...)  -> real Drive data, NOT an auth prompt —
     proves the rotated 6-scope shared token (auth/drive + auth/documents added
     2026-06-10) refreshes cleanly and the new scopes are live.

Env: GATEWAY_URL, ADMIN_SECRET, SMOKE_SYSTEM (default or-adhd-agent),
     GOOGLE_ACCOUNT_LABEL (default shared-google@or-infra.com).
"""
import json
import os
import sys
import urllib.request
import urllib.error

GATEWAY = os.environ["GATEWAY_URL"].rstrip("/")
ADMIN = os.environ["ADMIN_SECRET"]
SYSTEM = os.environ.get("SMOKE_SYSTEM", "or-adhd-agent")
LABEL = os.environ.get("GOOGLE_ACCOUNT_LABEL", "shared-google@or-infra.com")
MCP_URL = f"{GATEWAY}/workspace/{SYSTEM}/mcp"
PROTO = "2025-03-26"

session_id = None
_rpc_id = 0


def _fail(msg, detail=""):
    print(f"FAIL: {msg}")
    if detail:
        print(str(detail)[:800])
    sys.exit(1)


def _http(url, data=None, headers=None, method="POST"):
    body = data.encode() if isinstance(data, str) else data
    req = urllib.request.Request(url, data=body, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


def _parse_rpc(text):
    """Return the JSON-RPC object from a body that's either raw JSON or SSE."""
    text = text.strip()
    if not text:
        return {}
    if text.startswith("{") or text.startswith("["):
        return json.loads(text)
    last = None
    for line in text.splitlines():
        if line.startswith("data:"):
            last = line[5:].strip()
    if last is None:
        raise ValueError(f"no JSON / data: line in body: {text[:200]}")
    return json.loads(last)


def mcp(method, params=None, notify=False):
    global _rpc_id, session_id
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTO,
    }
    if session_id:
        headers["mcp-session-id"] = session_id
    payload = {"jsonrpc": "2.0", "method": method}
    if not notify:
        _rpc_id += 1
        payload["id"] = _rpc_id
    if params is not None:
        payload["params"] = params
    status, rheaders, text = _http(MCP_URL, json.dumps(payload), headers)
    sid = rheaders.get("mcp-session-id") or rheaders.get("Mcp-Session-Id")
    if sid:
        session_id = sid
    if notify:
        return status, {}
    if status >= 400:
        _fail(f"{method} -> HTTP {status}", text)
    obj = _parse_rpc(text)
    if isinstance(obj, dict) and obj.get("error"):
        _fail(f"{method} -> JSON-RPC error", json.dumps(obj["error"]))
    return status, obj


def tool_call(name, arguments):
    _, obj = mcp("tools/call", {"name": name, "arguments": arguments})
    result = obj.get("result", {})
    text = ""
    for c in result.get("content", []):
        if c.get("type") == "text":
            text += c.get("text", "")
    return (not result.get("isError")), text


# ── 1. mint token ──
st, _, body = _http(
    f"{GATEWAY}/workspace/{SYSTEM}/token", b"", {"X-Admin-Secret": ADMIN}
)
if st != 200:
    _fail(f"mint token -> HTTP {st}", body)
TOKEN = json.loads(body).get("access_token", "")
if not TOKEN:
    _fail("mint token: no access_token", body)
print(f"PASS [1/6] minted system-scoped workspace-runtime bearer for {SYSTEM}")

# ── 2. initialize ──
_, init = mcp(
    "initialize",
    {
        "protocolVersion": PROTO,
        "capabilities": {},
        "clientInfo": {"name": "google-mcp-smoke", "version": "1.0"},
    },
)
server = init.get("result", {}).get("serverInfo", {})
print(f"PASS [2/6] MCP initialize ok (server={server.get('name','?')} "
      f"session={'yes' if session_id else 'stateless'})")
mcp("notifications/initialized", notify=True)

# ── 3. tools/list ──
_, tl = mcp("tools/list")
names = [t.get("name", "") for t in tl.get("result", {}).get("tools", [])]
if "list_gmail_labels" not in names:
    _fail("tools/list did not include list_gmail_labels", json.dumps(names)[:600])
print(f"PASS [3/6] tools/list: {len(names)} Google tools "
      f"(incl. list_gmail_labels; gateway->sidecar reachable)")

# ── 4. real read against the shared Google account ──
ok, text = tool_call("list_gmail_labels", {"user_google_email": LABEL})
needs_auth = ("ACTION REQUIRED" in text) or ("Authentication Needed" in text) \
    or ("authorize" in text.lower() and "oauth" in text.lower())
if not ok or needs_auth:
    _fail("list_gmail_labels did not return real data — the shared token did not "
          "refresh against Google (check gmail-oauth-* secrets are real, not "
          "placeholders)", text)
print(f"PASS [4/6] list_gmail_labels returned real Gmail data for the shared "
      f"account ({len(text)} bytes)")

# ── 5. Drive + Docs tool groups are served (WORKSPACE_MCP_TOOLS landed) ──
missing = [t for t in ("search_drive_files", "search_docs") if t not in names]
if missing:
    _fail(f"tools/list missing Drive/Docs tools {missing} — "
          "WORKSPACE_MCP_TOOLS does not include drive+docs", json.dumps(names)[:600])
print("PASS [5/6] tools/list carries the Drive + Docs groups "
      "(search_drive_files, search_docs)")

# ── 6. real Drive read — proves the rotated 6-scope token is live ──
ok, text = tool_call("search_drive_files",
                     {"user_google_email": LABEL, "query": "trashed=false"})
needs_auth = ("ACTION REQUIRED" in text) or ("Authentication Needed" in text) \
    or ("authorize" in text.lower() and "oauth" in text.lower()) \
    or ("Scope has changed" in text)
if not ok or needs_auth:
    _fail("search_drive_files did not return real data — the rotated 6-scope "
          "token did not refresh (scope mismatch between the grant and "
          "WORKSPACE_MCP_SCOPES?)", text)
print(f"PASS [6/6] search_drive_files returned real Drive data "
      f"({len(text)} bytes) — the Drive+Docs scopes are live")

print("\nSMOKE PASS 6/6: full loop proven (gateway bearer -> Workspace MCP sidecar -> "
      "live Google reads incl. Drive), no secret in session.")
