#!/usr/bin/env python3
"""Live smoke test for the central n8n-mcp live-write gateway.

Proves the full loop end to end — gateway auth -> internal n8n-mcp sidecar
(multi-tenant) -> the system's OWN live n8n — without any secret in a Claude
session: the admin secret is read by the workflow from Secret Manager (WIF) and
passed in as an env var here; it never leaves CI.

Steps (each asserted):
  1. mint a system-scoped n8n-dev bearer  (POST /n8n/<system>/token, X-Admin-Secret)
  2. MCP initialize  (capture mcp-session-id; tolerate SSE or JSON)
  3. tools/list  -> must include n8n_* tools  (proves gateway->sidecar->multi-tenant
     accepted the injected x-n8n-url / x-n8n-key)
  4. tools/call n8n_health_check  -> proves the sidecar reaches the injected n8n
  5. write path: create a `dev-<runid>` workflow, then delete it (scratch-only;
     a non-dev- name is independently refused by the gateway's devNameViolation)

Env: GATEWAY_URL, ADMIN_SECRET, SMOKE_SYSTEM (default or-adhd-agent),
     SMOKE_RUN_ID (optional, for a unique dev- name).
"""
import json
import os
import sys
import urllib.request
import urllib.error

GATEWAY = os.environ["GATEWAY_URL"].rstrip("/")
ADMIN = os.environ["ADMIN_SECRET"]
SYSTEM = os.environ.get("SMOKE_SYSTEM", "or-adhd-agent")
RUN_ID = os.environ.get("SMOKE_RUN_ID", "smoke")
MCP_URL = f"{GATEWAY}/n8n/{SYSTEM}/mcp"
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
    # SSE: take the last `data:` line.
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
    if result.get("isError"):
        text = ""
        for c in result.get("content", []):
            text += c.get("text", "")
        return False, text
    text = ""
    for c in result.get("content", []):
        if c.get("type") == "text":
            text += c.get("text", "")
    return True, text


# ── 1. mint token ──
st, _, body = _http(
    f"{GATEWAY}/n8n/{SYSTEM}/token", b"", {"X-Admin-Secret": ADMIN}
)
if st != 200:
    _fail(f"mint token -> HTTP {st}", body)
TOKEN = json.loads(body).get("access_token", "")
if not TOKEN:
    _fail("mint token: no access_token", body)
print(f"PASS [1/5] minted system-scoped bearer for {SYSTEM}")

# ── 2. initialize ──
_, init = mcp(
    "initialize",
    {
        "protocolVersion": PROTO,
        "capabilities": {},
        "clientInfo": {"name": "n8n-mcp-smoke", "version": "1.0"},
    },
)
server = init.get("result", {}).get("serverInfo", {})
print(f"PASS [2/5] MCP initialize ok (server={server.get('name','?')} "
      f"session={'yes' if session_id else 'stateless'})")
mcp("notifications/initialized", notify=True)

# ── 3. tools/list ──
_, tl = mcp("tools/list")
names = [t.get("name", "") for t in tl.get("result", {}).get("tools", [])]
n8n_tools = [n for n in names if n.startswith("n8n_")]
if not n8n_tools:
    _fail("tools/list returned no n8n_* tools", json.dumps(names)[:600])
print(f"PASS [3/5] tools/list: {len(names)} tools, {len(n8n_tools)} n8n_* "
      f"(gateway->sidecar->multi-tenant headers accepted)")

# ── 4. health check (sidecar -> injected system n8n) ──
ok, text = tool_call("n8n_health_check", {})
if not ok:
    _fail("n8n_health_check failed (sidecar could not reach the system n8n)", text)
print(f"PASS [4/5] n8n_health_check ok -> reached {SYSTEM}'s live n8n")

# ── 5. live write: create + delete a dev- scratch workflow ──
wf_name = f"dev-smoke-{RUN_ID}"
created_id = None
ok, text = tool_call(
    "n8n_create_workflow",
    {
        "name": wf_name,
        "nodes": [
            {
                "id": "trigger",
                "name": "When clicking Test",
                "type": "n8n-nodes-base.manualTrigger",
                "typeVersion": 1,
                "position": [0, 0],
                "parameters": {},
            }
        ],
        "connections": {},
    },
)
if not ok:
    _fail(f"n8n_create_workflow({wf_name}) failed", text)
try:
    for tok in text.replace('"', " ").replace(",", " ").split():
        pass
    obj = json.loads(text) if text.strip().startswith("{") else {}
    created_id = obj.get("id") or obj.get("data", {}).get("id")
except Exception:
    created_id = None
print(f"PASS [5/5] created live scratch workflow '{wf_name}'"
      + (f" (id={created_id})" if created_id else ""))

# cleanup — best effort
if created_id:
    ok, text = tool_call("n8n_delete_workflow", {"id": str(created_id)})
    print(f"cleanup: deleted '{wf_name}' -> {'ok' if ok else 'FAILED: ' + text[:200]}")
else:
    print(f"cleanup: NOTE — could not parse created id; remove '{wf_name}' manually if it lingers")

print("\nSMOKE PASS: full loop proven (gateway auth -> sidecar -> live n8n write), "
      "no secret in session.")
