## feat(ci): prove Gmail SEND in google-mcp-smoke + audit or-edri-4 liveness (dev-stage)

**Overview.** An honest liveness audit of or-edri-4 (the standing proving system)
found that the Google Workspace integration is wired and live for READS, but the
**email-SEND path was never proven** end to end, and the workspace smoke still
defaulted to the decommissioned `or-adhd-agent`. This PR (stage 1 of
`devplans/or-edri-4-liveness-anti-drift.md`) closes the send-proof gap.

| Type | Summary |
|---|---|
| feat | **Stage 1 — real Gmail send proof.** `scripts/google-mcp-smoke.py` gains an optional step 7: when `SEND_TEST_TO` is set it calls `send_gmail_message` (user_google_email = the shared `edriorp38@or-infra.com`) and asserts a real send, the WRITE counterpart to the existing read steps 4/6. Gated on the env var so routine smoke runs never email anyone. `.github/workflows/google-mcp-smoke.yml` gains a `send_test_to` dispatch input wired to `SEND_TEST_TO`. |
| fix | **Correct the stale smoke default.** The workspace smoke's default `system` was `or-adhd-agent` (decommissioned 2026-06-11); changed to `or-edri-4`, the standing proving system, in both the workflow input default and the script's `SMOKE_SYSTEM` fallback. |
