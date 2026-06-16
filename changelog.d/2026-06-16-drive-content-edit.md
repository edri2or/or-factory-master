- **Drive non-native content edit (capability-first, Phase 1):** added a raw Drive
  API capability probe (`scripts/probe-drive-content-edit.mjs` + `tests/fixtures/drive-content-edit/`
  + `.github/workflows/drive-content-edit-probe.yml`) that proves `files.update` with a media
  upload can rewrite the *content* of a non-native Drive file (`.md` + binary) using the shared
  Google token — the path `update_drive_file` refuses. De-risks the planned gateway-side
  `edit_drive_file_content` MCP tool. See `docs/agent-specs/drive-content-edit.md` (Capability Card)
  and `devplans/drive-content-edit.md`. **Probe GO (run `27636636406`):** `.md` + binary read-back
  matched live on the shared Drive.
- **Drive non-native content edit (Stage 1 — gateway tool):** added the gateway-owned synthetic MCP
  tool `edit_drive_file_content` on the `/workspace/<system>/mcp` route — a facade
  (`services/mcp-server/src/workspace-drive-edit.ts` + interception in `workspace-mcp-proxy.ts`) that
  augments `tools/list` with the tool and handles its `tools/call` by minting the shared Google token
  from Secret Manager and calling Drive `files.update` (media). Refuses Google-native files (MIME
  guard) so Docs/Sheets/Slides still go through `update_drive_file`. No scope change (the shared token
  already holds `…/auth/drive`); no `workspace-mcp` fork. 15 new unit tests (118/118 green). Live
  deploy + or-edri-4 proof is Stage 2.
- **Drive non-native content edit (Stage 2 — live smoke):** added `scripts/drive-edit-smoke.mjs` +
  `.github/workflows/drive-edit-smoke.yml`, a manual live proof that drives `edit_drive_file_content`
  end-to-end through the deployed gateway's `/workspace/<system>/mcp` route (mint bearer → initialize
  → tools/list asserts the tool → tools/call rewrites a real `.md` → Drive read-back matches → trash)
  on `or-edri-4`. Exempt from the watchdog registry (manual, no cadence). **Proven live (run
  `27638068121`):** `tools/list` carried the tool (123 tools) and a real `.md` was edited through
  the gateway with a matching read-back.
- **Drive non-native content edit (Stage 3 — docs + lock):** documented the new tool and removed the
  ".md/.txt not supported" limitation across `docs/google-tools-feasibility.md`,
  `docs/google-identities.md`, and the shared `.claude/commands/google-workspace-guide.md` (mirrored
  into `templates/system/.claude/commands/` + golden refreshed). The Phase-1 probe + Stage-2 live
  smoke are kept as exempt manual proofs. Development complete.
