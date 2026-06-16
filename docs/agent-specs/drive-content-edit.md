# Capability Card — Drive non-native content edit

> Phase-1 capability card (`docs/capability-first.md` §0). Filled before any build.

## §0 Capability Card

| Field | Value |
|---|---|
| **Capability (verb + real input)** | Rewrite the *content* of a non-native Drive file — replace the body of a real `.md` file (and a real binary PNG) already in Or's Drive. |
| **External proof (tool + command)** | Raw Drive REST API, no SDK: `files.create` (multipart) → `files.update?uploadType=media` (PATCH) → `files.get?alt=media`. Driven by `scripts/probe-drive-content-edit.mjs`, run by `.github/workflows/drive-content-edit-probe.yml` (WIF→broker→SM→Google, outside n8n and outside the gateway/sidecar). |
| **Fixture** | `tests/fixtures/drive-content-edit/sample.md` (real `.md`) + an inline 1×1 PNG (binary). |
| **Expected** | After `files.update(media)`, `files.get?alt=media` returns the NEW bytes exactly (text equality for `.md`; `Buffer.compare === 0` for PNG). Temp files trashed after. |
| **Verdict (go/no-go)** | **PENDING** — awaiting the probe run (`drive-content-edit-probe.yml`). |
| **Risks & assumptions** | The shared token already holds `https://www.googleapis.com/auth/drive` (proven from `google-oauth.ts:114`) — no scope change. `משוער`: exact response framing of the multipart create; the binary path proven end-to-end (not by pinning) per the capability-first binary caveat. |

## Why this is the right path

The Drive API `files.update` with a media body supports **any** file type, including
`.md`/`.txt`/binary. The current `update_drive_file` tool (in the `workspace-mcp==1.21.1`
Python package) guards the MIME type and rejects non-native content with a `ValueError`.
We do **not** fork the package — we add a gateway-side synthetic MCP tool that makes the raw
call. The probe de-risks exactly that raw call before any gateway code is written.

## Verdict log

- 2026-06-16 — card created; probe built; awaiting dispatch.
