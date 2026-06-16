- **Drive non-native content edit (capability-first, Phase 1):** added a raw Drive
  API capability probe (`scripts/probe-drive-content-edit.mjs` + `tests/fixtures/drive-content-edit/`
  + `.github/workflows/drive-content-edit-probe.yml`) that proves `files.update` with a media
  upload can rewrite the *content* of a non-native Drive file (`.md` + binary) using the shared
  Google token — the path `update_drive_file` refuses. De-risks the planned gateway-side
  `edit_drive_file_content` MCP tool. See `docs/agent-specs/drive-content-edit.md` (Capability Card)
  and `devplans/drive-content-edit.md`.
