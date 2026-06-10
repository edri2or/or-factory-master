## לידה מחוברת (mcp-birth-bundle) — Stage 3: `.mcp.json` — Claude Code sessions born connected

Every newly-provisioned system repo now ships a committed `.mcp.json`, so any
Claude Code session opened on it is born connected to two MCP servers with
zero setup and zero secrets in the repo (auth is the central gateway's own
OAuth/Google browser login on first use):

- **`factory`** → the gateway's main `/mcp` surface (read-only verify/inspect
  tools + the allowlisted `dispatch_workflow`).
- **`n8n-live`** → `/n8n/<system>/mcp`, the live n8n development gateway for
  that system (scratch-only writes; git stays source of truth).

The per-system telemetry route (`/factory/<system>/mcp`) is deliberately NOT
included — it is the n8n agent's bearer-bound surface (Stages 1–2).

**Changes:**
- `templates/system/.mcp.json.template` (new): references only
  `${SYSTEM_NAME}` → no envsubst allow-list change anywhere (renderer /
  provision / validator stay byte-identical).
- `templates/system/AGENTS.md.template`: new "Built-in MCP connections"
  section documenting the two servers (CLAUDE.md.template is an `@AGENTS.md`
  import, so the paragraph lands there — the devplan's "CLAUDE.md paragraph"
  in practice).
- `.github/workflows/provision-system.yml`: the orientation-docs step now also
  renders `.mcp.json.template` (same `${SYSTEM_NAME}`-only envsubst as
  CLAUDE.md) and pushes `.mcp.json` to the system repo root.
- `tests/golden/system/`: refreshed — the golden now renders 119 files
  (`.mcp.json` appears with its rendered hash; `rendered/AGENTS.md` carries
  the new section).

**Proof plan (live):** merge → fresh reuse-mode test provision
(factory-test-047; provision preflight refuses existing repos, so the
"re-provision" is a successor system — the shared-SM wipe makes the previous
round's system unmanageable by design) → `get_file_contents` of `.mcp.json`
byte-compared to the expected render → `probe_endpoint` on `/mcp` without
auth = 401 (the discovery contract is live).
