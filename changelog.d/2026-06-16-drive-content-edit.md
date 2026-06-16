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
