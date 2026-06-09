#!/usr/bin/env python3
"""Live tenant smoke for the factory telemetry MCP (/factory/<system>/mcp).

Proves the tenant-locked surface end to end against a REAL system — and, just
as important, proves the walls hold. The admin secret is read by the workflow
from Secret Manager (WIF) and passed in as an env var here; it never enters a
Claude session.

Steps (each asserted):
  1. mint a system-scoped factory-runtime bearer  (POST /factory/<system>/token)
  2. MCP initialize on /factory/<system>/mcp  (stateless per-request server)
  3. tools/list  -> EXACTLY the 8 scoped tools (no org tools, no dispatch, no GCP)
  4. tools/call list_n8n_workflows  -> the system's REAL workflow list (the
     system identity was injected from the signed claim — no system argument)
  5. tools/call probe_endpoint at ANOTHER system's host  -> tenant_blocked
     (guard fires server-side before any network call)
  6. the minted token on ANOTHER system's path  -> HTTP 403 (system_mismatch)
  7. no token  -> HTTP 401

Env: GATEWAY_URL, ADMIN_SECRET, SMOKE_SYSTEM (default or-adhd-agent),
     SMOKE_OTHER_SYSTEM (default other-system-smoke — a syntactically valid
     name that is never contacted; the blocks fire before any resolution).
"""
import json
import os
import sys
import urllib.request
import urllib.error

GATEWAY = os.environ["GATEWAY_URL"].rstrip("/")
ADMIN = os.environ["ADMIN_SECRET"]
SYSTEM = os.environ.get("SMOKE_SYSTEM", "or-adhd-agent")
OTHER = os.environ.get("SMOKE_OTHER_SYSTEM", "other-system-smoke")
MCP_URL = f"{GATEWAY}/factory/{SYSTEM}/mcp"
PROTO = "2025-03-26"

# The exact contract of the v1 surface — must match factory-scope.ts SPECS.
EXPECTED_TOOLS = sorted([
    "list_n8n_workflows",
    "inspect_n8n_execution",
    "inspect_railway_service",
    "list_railway_deployments",
    "tail_railway_deployment_logs",
    "probe_endpoint",
    "list_workflow_runs",
    "get_run_jobs",
])

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
    # SSE: take the last `data:` line.
    last = None
    for line in text.splitlines():
        if line.startswith("data:"):
            last = line[5:].strip()
    if last is None:
        raise ValueError(f"no JSON / data: line in body: {text[:200]}")
    return json.loads(last)


def _rpc_payload(method, params):
    global _rpc_id
    _rpc_id += 1
    payload = {"jsonrpc": "2.0", "id": _rpc_id, "method": method}
    if params is not None:
        payload["params"] = params
    return json.dumps(payload)


def mcp(method, params=None, url=MCP_URL, token=None):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTO,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    status, _, text = _http(url, _rpc_payload(method, params), headers)
    if status >= 400:
        _fail(f"{method} -> HTTP {status}", text)
    obj = _parse_rpc(text)
    if isinstance(obj, dict) and obj.get("error"):
        _fail(f"{method} -> JSON-RPC error", json.dumps(obj["error"]))
    return obj


def tool_call(name, arguments):
    """Returns the parsed JSON payload of the tool's text content."""
    obj = mcp("tools/call", {"name": name, "arguments": arguments}, token=TOKEN)
    result = obj.get("result", {})
    text = ""
    for c in result.get("content", []):
        if c.get("type") == "text":
            text += c.get("text", "")
    try:
        return json.loads(text)
    except Exception:
        _fail(f"{name}: tool content is not JSON", text[:400])


# ── 1. mint a system-scoped factory-runtime bearer ──
st, _, body = _http(f"{GATEWAY}/factory/{SYSTEM}/token", b"", {"X-Admin-Secret": ADMIN})
if st != 200:
    _fail(f"mint token -> HTTP {st}", body)
TOKEN = json.loads(body).get("access_token", "")
if not TOKEN:
    _fail("mint token: no access_token", body)
print(f"PASS [1/7] minted system-scoped factory-runtime bearer for {SYSTEM}")

# ── 2. initialize ──
init = mcp(
    "initialize",
    {"protocolVersion": PROTO, "capabilities": {},
     "clientInfo": {"name": "factory-mcp-smoke", "version": "1.0"}},
    token=TOKEN,
)
server = init.get("result", {}).get("serverInfo", {})
if not server.get("name"):
    _fail("initialize: no serverInfo in response", json.dumps(init)[:400])
print(f"PASS [2/7] MCP initialize ok (server={server.get('name')})")

# ── 3. tools/list -> exactly the 8 scoped tools ──
tl = mcp("tools/list", token=TOKEN)
names = sorted(t.get("name", "") for t in tl.get("result", {}).get("tools", []))
if names != EXPECTED_TOOLS:
    _fail(
        "tools/list != the 8-tool contract",
        f"expected {EXPECTED_TOOLS}\n     got {names}",
    )
print(f"PASS [3/7] tools/list: exactly the {len(EXPECTED_TOOLS)} scoped tools, nothing else")

# ── 4. real read: the system's own n8n workflows, no system argument ──
wf = tool_call("list_n8n_workflows", {})
if wf.get("error"):
    _fail("list_n8n_workflows returned an error", json.dumps(wf)[:400])
if wf.get("system") != SYSTEM or not isinstance(wf.get("count"), int) or wf["count"] < 1:
    _fail("list_n8n_workflows: no real workflow list", json.dumps(wf)[:400])
print(f"PASS [4/7] list_n8n_workflows -> {wf['count']} real workflows of {SYSTEM} "
      f"(identity injected from the signed claim)")

# ── 5. cross-tenant probe -> tenant_blocked (no network call happens) ──
blocked = tool_call("probe_endpoint", {"url": f"https://n8n-{OTHER}.or-infra.com/healthz"})
if blocked.get("error") != "tenant_blocked":
    _fail("cross-tenant probe was NOT blocked", json.dumps(blocked)[:400])
print(f"PASS [5/7] probe to n8n-{OTHER}.or-infra.com -> tenant_blocked")

# ── 6. the token on another system's path -> 403 ──
st, _, body = _http(
    f"{GATEWAY}/factory/{OTHER}/mcp",
    _rpc_payload("tools/list", None),
    {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
     "Accept": "application/json, text/event-stream"},
)
if st != 403:
    _fail(f"token for {SYSTEM} on /factory/{OTHER}/mcp -> HTTP {st} (expected 403)", body)
print(f"PASS [6/7] {SYSTEM}'s token on /factory/{OTHER}/mcp -> HTTP 403 (system_mismatch)")

# ── 7. no token -> 401 ──
st, _, body = _http(
    MCP_URL,
    _rpc_payload("tools/list", None),
    {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
)
if st != 401:
    _fail(f"unauthenticated request -> HTTP {st} (expected 401)", body)
print("PASS [7/7] no bearer -> HTTP 401")

print(f"\nSMOKE PASS 7/7: tenant-locked factory telemetry proven live against {SYSTEM} — "
      "real data through the scoped surface, and both cross-tenant walls held.")
