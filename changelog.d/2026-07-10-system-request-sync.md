## 2026-07-10 — System resource-request: `sync` type (system-initiated shared-secret pull)

Staged development (`devplans/system-self-sufficiency-channels.md`, Stage A) — the factory side of
the "or-aios self-sufficiency" effort. Extends the proven `request-factory-resource` ask-bus with a
third `request_type`, **`sync`**: a system can now ASK the broker (Telegram-gated) to pull the latest
value of an allowlisted **shared** secret from control SM into its own SM — the system-initiated twin
of the broker's `mirror-secret-to-system.yml` push. Closes the gap where a rotated shared secret only
propagated when the factory pushed it.

- `scripts/validate-system-request.sh`: new `sync` case gated by a curated `SYNC_ALLOWLIST`
  (default-deny) plus the same super-credential / privileged-keyword refusals as `secret`.
- `.github/workflows/fulfill-system-request.yml`: `sync` accepted in input validation; a dedicated
  broker step does the value-piped `control -> system` copy (dest shell must pre-exist). The existing
  fulfiller step is narrowed to `secret`/`iam`.
- `services/mcp-server/src/system-request.ts`: `sync` accepted in the three type-guards + a dedicated
  Telegram approval-card `actionLine`.
- Tests: 8 new `sync` cases in `scripts/tests/validate-system-request.bats` (38/38 green); MCP
  `system-request.test.mjs` still 6/6; `tsc` clean.

**Decision:** `sync` moves a real secret VALUE (a higher risk class than `secret`/`iam`, which never
touch a value), so it is deliberately NOT routed through `fulfill-system-request.sh` (which must stay
value-free) — the value-piped copy lives directly in the workflow as a broker step, gated to the
allowlist + Or's ✅. **Proof:** live-verified post-merge by a Telegram-gated round-trip from or-aios
(a rotated allowlisted secret lands as a new enabled version in the system SM); the MCP change
redeploys the Cloud Run service on merge.
