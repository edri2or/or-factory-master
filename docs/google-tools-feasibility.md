# Google tools — feasibility & current state

**Date:** 2026-06-16 · **Development:** `google-workspace-maximize` · **Identity:** Or's personal `edri2or@gmail.com`

This records what Google access the factory's Workspace-MCP sidecar exposes after the
"unify & maximize" development, what is **not** built (and why), and the operational
contract for changing scopes. It exists so a missing capability is never mistaken for a
permission bug — the not-feasible items below are documented dead-ends, not TODOs.

## What is live now (verified)

One sidecar (`workspace-mcp==1.21.1`), one route (`/workspace/<system>/mcp`), proven live
2026-06-16 (`google-mcp-smoke.yml`): **122 tools across all 12 tool groups**, the shared
token refreshes cleanly (live Gmail + Drive reads), and a brand-new group fires end-to-end
(`list_task_lists` → live Tasks data).

| Tool group (`--tools`) | Status | Notes |
|---|---|---|
| gmail | ✅ live | **granular / trash-only** — the package has no `https://mail.google.com/`, so no permanent-delete exists (a package limit, not a choice) |
| calendar | ✅ live | was already enabled |
| drive | ✅ live | incl. the one write tool `update_drive_file` (trash/move/rename/Google-native edit) |
| docs | ✅ live | was already enabled |
| sheets | ✅ live | newly enabled (Sheets API) |
| slides | ✅ live | newly enabled (Slides API) |
| forms | ✅ live | newly enabled (Forms API) |
| tasks | ✅ live | newly enabled (Tasks API) — the verification canary |
| chat | ✅ scopes+API on | newly enabled (Chat API). Google Chat is Workspace-oriented; tool-level behaviour on a consumer account may be limited |
| contacts | ✅ live | newly enabled (People API) |
| search | ✅ scopes+API on | newly enabled (Custom Search API). Functional use also needs a Custom Search Engine (CSE) id — not configured here |
| appscript | ✅ scopes+API on | newly enabled (Apps Script API). **Highest blast radius** — can run code as the account |

**OAuth scope set:** the de-duplicated union of all 12 groups + base = **41 scopes**, derived
verbatim from the package's `auth/scopes.py` @ tag `v1.21.1`. Or accepted the full set
(2026-06-16); Google granted all 41 to the personal account in one consent (no trimming).

## The byte-equal scope contract — FOUR sites (edit together)

Changing the scope set means editing **all four** identically (the consent validator + the
sidecar refresh both enforce an exact match; a mismatch throws "Scope has changed"):

1. `services/mcp-server/src/google-oauth.ts` → `WORKSPACE_SCOPES` (the consent **ASK** + validator)
2. `scripts/render-mcp-service-yaml.sh` → `WORKSPACE_MCP_SCOPES` + `WORKSPACE_MCP_TOOLS` (sidecar **CHECK** + enabled tools)
3. `services/workspace-mcp/entrypoint.sh` → `default_scopes` (+ tools fallback) — dead in prod (env always set), kept consistent
4. `services/mcp-server/test/google-oauth.test.mjs` → the literal scope string + `length` (runs in CI `npm test`)

Zero-downtime ordering for a widening: ship the gateway (ASK) first → re-consent → then the
sidecar (CHECK). A wider token works with a narrow sidecar, never the reverse.

## API enablement (key operational learning)

A granted OAuth scope is **not** enough — the matching Google API must also be **enabled in
the OAuth client's project** (`or-factory-master-control`, project `140345952904`) or live
calls 403 `SERVICE_DISABLED`. The 8 new APIs (Tasks/Sheets/Slides/Forms/Chat/People/
Apps Script/Custom Search) were enabled there on 2026-06-16.

**Permission note:** the broker SA (`factory-master-broker@…`) could **not** enable them at
first — it lacks `serviceusage.services.enable` on the control project, and it cannot
self-grant (it lacks `setIamPolicy` there; the `gcp-action.yml` comment claiming the broker
"executes red ops on control" is inaccurate for IAM bindings — flag for a CLAUDE.md
follow-up). Resolved by Or granting the broker **Service Usage Admin** on the control project
(owner-only action). The broker now enables APIs on control autonomously (single-API
`services enable` is a yellow `gcp-action`); a future new group only needs its API turned on.

## Requested tools that are NOT in this path

| Tool | Verdict | Why |
|---|---|---|
| **Maps** | separate **API-key** track (not built) | Maps Platform uses a billed API key, not user OAuth — outside this sidecar's model |
| **YouTube** | separate track (not built) | public data = API key; channel ops = OAuth `youtube*` — a different integration |
| **Translate** | separate **API-key** track (not built) | Cloud Translation = API key / service account, billed |
| **Keep** | **not feasible** (personal account) | official API is enterprise-only (domain-wide delegation); `gkeepapi` is unofficial/fragile |
| **NotebookLM** | **not feasible** | no public consumer API (enterprise-only, Pre-GA); community tools use browser cookies |
| **Photos** | **severely limited** | Library API broad scopes removed 2025-03-31 — now app-created-data + Picker only; "all your photos" is no longer possible |

These are documented as of 2026-06-16. The three "API-key track" items are an optional future
integration (a billed key + a small adapter), not a permission gap.

## Safety posture (expanded blast radius — unchanged policy, wider surface)

The token is Or's **personal** `edri2or@gmail.com` data, and the maximized set exposes many
more **write** tools (Gmail send/modify, Calendar/Drive/Docs/Sheets/Tasks mutations, and
Apps Script execution). Existing safeguards remain the gate:

- **Operator gate:** `OAUTH_ALLOWED_EMAILS=edri2or@gmail.com` (fail-closed when empty; a deploy preflight enforces it).
- **⚠️ Turn write tools OFF in claude.ai _Research_ mode** — Research auto-calls tools without confirmation; a prompt-injection on the personal account is the risk. Reduce dangerous tools in the claude.ai connector UI; never narrow `WORKSPACE_MCP_SCOPES` (breaks the byte-equal refresh).
- Per-action human-approval (HITL) gates for destructive Google actions are a **separate** effort (Or owns it) — not built here.

**Future hardening (documented, not built):** the package's `--read-only` / `--permissions`
flags (need a readonly-scoped token); a folder-scoped Service Account to shrink Drive blast
radius. See `docs/google-identities.md`.
