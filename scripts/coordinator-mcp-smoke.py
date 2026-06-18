#!/usr/bin/env python3
"""Live smoke for the narrow coordinator MCP (/coordinator/<repo>/mcp).

Proves the secure "hands" of the coordinator agent (Nuriel) end to end — and,
just as important, proves the surface is NARROW: the broad dispatch_workflow is
absent, and route_to_agent dispatches ONLY agent-action.yml (propose) to an
allowlisted worker. The admin secret is read by the workflow from Secret Manager
(WIF) and passed in as an env var; it never enters a Claude session.

Steps (each asserted):
  1. mint an admin bearer                       (POST /token, X-Admin-Secret)
  2. MCP initialize on /coordinator/<repo>/mcp  (stateless per-request server)
  3. tools/list -> EXACTLY the narrow set; dispatch_workflow is ABSENT
  4. tools/call route_to_agent {allowlisted worker} -> dispatched:true + a run_id
     (a REAL agent-action.yml propose dispatch — fires one broker run)
  5. tools/call route_to_agent {non-allowlisted worker} -> worker_not_allowlisted
  6. an UNKNOWN coordinator path -> HTTP 404
  7. no token -> HTTP 401

Env: GATEWAY_URL, ADMIN_SECRET, SMOKE_REQUESTER (default nuriel),
     SMOKE_WORKER (default natan-research, must be allowlisted),
     SMOKE_BAD_WORKER (default zz-not-a-worker), SMOKE_RUN_ID (for the corr id).
"""
import json
import os
import sys
import urllib.request
import urllib.error

GATEWAY = os.environ["GATEWAY_URL"].rstrip("/")
ADMIN = os.environ["ADMIN_SECRET"]
REQUESTER = os.environ.get("SMOKE_REQUESTER", "nuriel")
WORKER = os.environ.get("SMOKE_WORKER", "natan-research")
BAD_WORKER = os.environ.get("SMOKE_BAD_WORKER", "zz-not-a-worker")
RUN_ID = os.environ.get("SMOKE_RUN_ID", "manual")
MCP_URL = f"{GATEWAY}/coordinator/{REQUESTER}/mcp"
PROTO = "2025-03-26"

# The exact contract of the coordinator surface — must match coordinator-scope.ts
# COORDINATOR_SCOPED_TOOL_NAMES.
EXPECTED_TOOLS = sorted([
    "get_file_contents",
    "get_pull_request",
    "get_repo",
    "get_run_jobs",
    "get_workflow_run",
    "list_commits",
    "list_pull_request_files",
    "list_workflow_runs",
    "route_to_agent",
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
        resp = urllib.request.urlopen(req, timeout=90)
        return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


def _parse_rpc(text):
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


def tool_call(name, arguments, token):
    obj = mcp("tools/call", {"name": name, "arguments": arguments}, token=token)
    result = obj.get("result", {})
    text = ""
    for c in result.get("content", []):
        if c.get("type") == "text":
            text += c.get("text", "")
    try:
        return json.loads(text)
    except Exception:
        _fail(f"{name}: tool content is not JSON", text[:400])


# ── 1. mint an admin bearer ──
st, _, body = _http(f"{GATEWAY}/token", b"", {"X-Admin-Secret": ADMIN})
if st != 200:
    _fail(f"mint admin token -> HTTP {st}", body)
TOKEN = json.loads(body).get("access_token", "")
if not TOKEN:
    _fail("mint token: no access_token", body)
print("PASS [1/7] minted an admin bearer")

# ── 2. initialize ──
init = mcp(
    "initialize",
    {"protocolVersion": PROTO, "capabilities": {},
     "clientInfo": {"name": "coordinator-mcp-smoke", "version": "1.0"}},
    token=TOKEN,
)
server = init.get("result", {}).get("serverInfo", {})
if not server.get("name"):
    _fail("initialize: no serverInfo in response", json.dumps(init)[:400])
print(f"PASS [2/7] MCP initialize ok on /coordinator/{REQUESTER}/mcp (server={server.get('name')})")

# ── 3. tools/list -> exactly the narrow set; dispatch_workflow ABSENT ──
tl = mcp("tools/list", token=TOKEN)
names = sorted(t.get("name", "") for t in tl.get("result", {}).get("tools", []))
if names != EXPECTED_TOOLS:
    _fail("tools/list != the coordinator contract", f"expected {EXPECTED_TOOLS}\n     got {names}")
if "dispatch_workflow" in names:
    _fail("the BROAD dispatch_workflow is present on the coordinator surface", names)
print(f"PASS [3/7] tools/list: exactly the {len(EXPECTED_TOOLS)} narrow tools; dispatch_workflow ABSENT")

# ── 4. real route_to_agent to an allowlisted worker -> dispatched:true + run_id ──
corr = f"coord-smoke-{RUN_ID}"
disp = tool_call(
    "route_to_agent",
    {"worker_repo": WORKER, "task": "[smoke] no-op probe from coordinator-mcp-smoke — please ignore.", "correlation_id": corr},
    TOKEN,
)
if not disp.get("dispatched") or not disp.get("run_id"):
    _fail("route_to_agent did not dispatch to the allowlisted worker", json.dumps(disp)[:400])
print(f"PASS [4/7] route_to_agent -> dispatched agent-action.yml propose to {WORKER} "
      f"(run_id={disp.get('run_id')}, corr={corr})")

# ── 5. route_to_agent to a NON-allowlisted worker -> refused ──
bad = tool_call("route_to_agent", {"worker_repo": BAD_WORKER, "task": "should be refused"}, TOKEN)
if bad.get("error") != "worker_not_allowlisted":
    _fail("non-allowlisted worker was NOT refused", json.dumps(bad)[:400])
print(f"PASS [5/7] route_to_agent to {BAD_WORKER} -> worker_not_allowlisted")

# ── 6. an unknown coordinator path -> 404 ──
st, _, body = _http(
    f"{GATEWAY}/coordinator/zz-not-a-coordinator/mcp",
    _rpc_payload("tools/list", None),
    {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
     "Accept": "application/json, text/event-stream"},
)
if st != 404:
    _fail(f"unknown coordinator path -> HTTP {st} (expected 404)", body)
print("PASS [6/7] unknown coordinator path -> HTTP 404")

# ── 7. no token -> 401 ──
st, _, body = _http(
    MCP_URL,
    _rpc_payload("tools/list", None),
    {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
)
if st != 401:
    _fail(f"unauthenticated request -> HTTP {st} (expected 401)", body)
print("PASS [7/7] no bearer -> HTTP 401")

print(f"\nSMOKE PASS 7/7: the narrow coordinator surface is proven live for {REQUESTER} — "
      "exactly the scoped tools (dispatch_workflow absent), a real propose dispatch to an "
      "allowlisted worker, and a non-allowlisted worker / unknown path / no-bearer all refused.")
