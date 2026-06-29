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

Phases (SMOKE_PHASE env, default "full"):
  full     — the steps above, end to end (the original behavior).
  init     — mint + initialize + health, then SAVE {token, session, system} to
             SMOKE_STATE_FILE. Used before a forced gateway instance replacement.
  recover  — LOAD that state and, reusing the SAME client session id, drive a
             tool call. It must succeed transparently: a fresh gateway instance
             has an empty RAM session map, so success PROVES the durable session
             store (Firestore) rehydrated the session and the proxy re-initialized
             upstream under the hood. This is the Layer-B acceptance gate.

Env: GATEWAY_URL, ADMIN_SECRET, SMOKE_SYSTEM (default or-adhd-agent),
     SMOKE_RUN_ID (optional, for a unique dev- name),
     SMOKE_PHASE (full|init|recover), SMOKE_STATE_FILE (for init/recover).
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
PHASE = os.environ.get("SMOKE_PHASE", "full")
STATE_FILE = os.environ.get("SMOKE_STATE_FILE", "")
MCP_URL = f"{GATEWAY}/n8n/{SYSTEM}/mcp"
PROTO = "2025-03-26"

TOKEN = ""
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
    # n8n-mcp signals application-level failure with `"success": false` in the
    # content text (not the MCP isError flag), so inspect the parsed payload too.
    parsed = _maybe_json(text)
    if isinstance(parsed, dict) and parsed.get("success") is False:
        return False, text
    return True, text


def _walk_id_name(node, out):
    """Recursively collect every {id, name} pair from an arbitrary structure."""
    if isinstance(node, dict):
        if "id" in node and "name" in node and isinstance(node.get("name"), str):
            out.append((str(node["id"]), node["name"]))
        for v in node.values():
            _walk_id_name(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk_id_name(v, out)


def _maybe_json(text):
    text = (text or "").strip()
    for candidate in (text, text[text.find("{"):text.rfind("}") + 1] if "{" in text else "",
                      text[text.find("["):text.rfind("]") + 1] if "[" in text else ""):
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except Exception:
            continue
    return None


def ids_for_name_prefix(prefix):
    """Return [(id, name), ...] of workflows whose name starts with `prefix`,
    by parsing n8n_list_workflows output robustly (id/name pairs, any shape)."""
    ok, text = tool_call("n8n_list_workflows", {})
    if not ok:
        return []
    obj = _maybe_json(text)
    pairs = []
    if obj is not None:
        _walk_id_name(obj, pairs)
    # de-dupe, keep only matching names that look like real workflow ids
    seen, result = set(), []
    for wid, name in pairs:
        if name.startswith(prefix) and wid not in seen and wid.lower() != name.lower():
            seen.add(wid)
            result.append((wid, name))
    return result


def delete_workflow(wid, name):
    ok, text = tool_call("n8n_delete_workflow", {"id": str(wid)})
    print(f"  deleted '{name}' (id={wid}) -> {'ok' if ok else 'FAILED: ' + text[:160]}")
    return ok


def mint_token():
    """POST /n8n/<system>/token with the admin secret → system-scoped bearer."""
    global TOKEN
    st, _, body = _http(f"{GATEWAY}/n8n/{SYSTEM}/token", b"", {"X-Admin-Secret": ADMIN})
    if st != 200:
        _fail(f"mint token -> HTTP {st}", body)
    TOKEN = json.loads(body).get("access_token", "")
    if not TOKEN:
        _fail("mint token: no access_token", body)


def do_initialize():
    """MCP initialize + the initialized notification; returns serverInfo name."""
    _, init = mcp(
        "initialize",
        {
            "protocolVersion": PROTO,
            "capabilities": {},
            "clientInfo": {"name": "n8n-mcp-smoke", "version": "1.0"},
        },
    )
    mcp("notifications/initialized", notify=True)
    return init.get("result", {}).get("serverInfo", {}).get("name", "?")


def run_full():
    # ── 1. mint token ──
    mint_token()
    print(f"PASS [1/5] minted system-scoped bearer for {SYSTEM}")

    # ── 2. initialize ──
    server = do_initialize()
    print(f"PASS [2/5] MCP initialize ok (server={server} "
          f"session={'yes' if session_id else 'stateless'})")

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

    # ── pre-sweep: remove any leftover dev-smoke-* scratch from earlier runs ──
    leftovers = ids_for_name_prefix("dev-smoke-")
    if leftovers:
        print(f"pre-sweep: removing {len(leftovers)} leftover dev-smoke-* workflow(s):")
        for wid, name in leftovers:
            delete_workflow(wid, name)

    # ── 5. live write: create a dev- scratch workflow, then delete it ──
    wf_name = f"dev-smoke-{RUN_ID}"
    ok, text = tool_call(
        "n8n_create_workflow",
        {
            "name": wf_name,
            # n8n-mcp rejects a single non-webhook node, so wire a 2-node workflow:
            # manual trigger -> no-op.
            "nodes": [
                {
                    "id": "trigger",
                    "name": "Start",
                    "type": "n8n-nodes-base.manualTrigger",
                    "typeVersion": 1,
                    "position": [0, 0],
                    "parameters": {},
                },
                {
                    "id": "noop",
                    "name": "NoOp",
                    "type": "n8n-nodes-base.noOp",
                    "typeVersion": 1,
                    "position": [260, 0],
                    "parameters": {},
                },
            ],
            "connections": {
                "Start": {"main": [[{"node": "NoOp", "type": "main", "index": 0}]]}
            },
        },
    )
    if not ok:
        _fail(f"n8n_create_workflow({wf_name}) failed", text)
    print(f"PASS [5/5] created live scratch workflow '{wf_name}'")

    # ── cleanup: find it by name and delete (asserted — no scratch may linger) ──
    created = ids_for_name_prefix(wf_name)
    if not created:
        _fail(f"cleanup: could not locate '{wf_name}' to delete (it would linger live)", text[:300])
    all_deleted = all(delete_workflow(wid, name) for wid, name in created)
    if not all_deleted:
        _fail("cleanup: failed to delete the scratch workflow")
    # verify gone
    if ids_for_name_prefix(wf_name):
        _fail(f"cleanup: '{wf_name}' still present after delete")
    print(f"PASS cleanup: '{wf_name}' created and deleted — nothing lingers")

    print("\nSMOKE PASS: full loop proven (gateway auth -> sidecar -> live n8n create + "
          "delete), no secret in session, no scratch left behind.")


def run_init():
    """Phase 'init': establish a session and persist it for the recover phase."""
    if not STATE_FILE:
        _fail("phase=init requires SMOKE_STATE_FILE")
    mint_token()
    server = do_initialize()
    if not session_id:
        _fail("phase=init: gateway returned no mcp-session-id (stateless?) — "
              "cannot prove session recovery")
    # Prove the session is live BEFORE the forced instance replacement.
    ok, text = tool_call("n8n_health_check", {})
    if not ok:
        _fail("phase=init: n8n_health_check failed pre-restart", text)
    with open(STATE_FILE, "w", encoding="utf-8") as fh:
        json.dump({"token": TOKEN, "session_id": session_id, "system": SYSTEM}, fh)
    print(f"PASS phase=init: live session {session_id[:12]}… on {server} saved "
          f"for recovery (state -> {STATE_FILE})")


def run_recover():
    """Phase 'recover': reuse the saved session against a FRESH gateway instance.

    The instance was replaced between init and now, so its RAM session map is
    empty. A successful tool call here can ONLY mean the durable store rehydrated
    the session and the proxy transparently re-initialized upstream — the Layer-B
    fix. If the store is absent/broken, the gateway surfaces the original session
    error and mcp() fails the smoke."""
    global TOKEN, session_id
    if not STATE_FILE:
        _fail("phase=recover requires SMOKE_STATE_FILE")
    try:
        with open(STATE_FILE, encoding="utf-8") as fh:
            state = json.load(fh)
    except OSError as e:
        _fail("phase=recover: could not read state file", str(e))
    TOKEN = state["token"]
    session_id = state["session_id"]
    saved = session_id
    # Reuse the SAME session id — NO re-initialize. On a fresh instance this is a
    # session the new process never minted; recovery must come from the store.
    ok, text = tool_call("n8n_health_check", {})
    if not ok:
        _fail("phase=recover: tool call failed — the gateway could NOT recover the "
              "session after instance replacement (durable store not working?)", text)
    if session_id != saved:
        _fail(f"phase=recover: client session id changed ({saved[:12]}… -> "
              f"{str(session_id)[:12]}…) — recovery was not transparent")
    print(f"PASS phase=recover: session {saved[:12]}… survived a gateway instance "
          f"replacement — transparent recovery from the durable store proven.")


_PHASES = {"full": run_full, "init": run_init, "recover": run_recover}
if PHASE not in _PHASES:
    _fail(f"unknown SMOKE_PHASE '{PHASE}' (expected full|init|recover)")
_PHASES[PHASE]()
