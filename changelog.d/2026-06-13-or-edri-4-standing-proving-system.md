## or-edri-4-standing-proving-system — Stage 1: doctrine (or-edri-4 = standing proving system)

Formalize `or-edri-4` (GCP `factory-test-21`, adopt) as the factory's **permanent standing
proving system**: every provisioning-process change is **first applied and proven live on
`or-edri-4`, and only then locked into the factory template** (merge to `main`). Reframes — does
not merely delete — the retired "reference system" reasoning: `or-edri-4` avoids the old decay
because using it is mandatory + CI-enforced, the proof is fresh per change, and it is
heartbeat-audited; it costs nothing new (already Or's running system). The throwaway reuse-mode
system is retained only for the **Day-0 birth check** (a Day-2 system cannot prove a fresh birth).

- `CLAUDE.md` — rewrote the "Validating provisioning-process changes" paragraph + added a
  **Standing proving system** row to Fixed values; updated the `docs/live-test-loop.md` Key-files
  description.
- `docs/live-test-loop.md` — replaced "Why not a standing reference system" with "`or-edri-4` as
  the standing proving system — and how it avoids the old decay"; reframed the loop to
  or-edri-4-first; added a Day-0-birth-check subsection and a prove→merge reconciliation note
  (the merge-blocking proof must come from `or-edri-4`).
- `.claude/commands/dev-stage-factory.md` — flipped the method to or-edri-4-first, made teardown
  apply only to a throwaway Day-0 system (`or-edri-4` is never torn down), and updated Step 3
  (a.2), Step 5, Safety rules 4–5, the examples, and the frontmatter description.

## or-edri-4-standing-proving-system — Stage 2: the CI brake (pin the E2E proof to or-edri-4)

Give the doctrine teeth: the `E2E verification gate` now requires the live proof for the enforced
per-system surfaces (`telegram-bot`, `deploy-edge`) to come from the standing proving system
`or-edri-4` — a proof from any other system is rejected, so a provisioning-process change cannot
merge until it has been proven on `or-edri-4`. Backward compatible: a surface with no
`proof_systems` accepts any system.

- `e2e-surfaces.json` — added `"proof_systems": ["or-edri-4"]` to the `telegram-bot` and
  `deploy-edge` surfaces; documented the field in the registry `_doc`.
- `scripts/lib.sh` — new `e2e_surface_proof_systems` (reads `proof_systems[]`) and the pure,
  unit-testable `e2e_proof_system_allowed` (allowed-empty ⇒ any; else membership).
- `scripts/check-e2e-proof.sh` — `verify_proof` reads the proof's `.system` and enforces the
  surface's `proof_systems` (clear remediation message); the caller passes the allowlist.
- `scripts/tests/e2e-proof-systems.bats` — 7 unit tests incl. proof that the 10 committed
  `or-edri-4` proofs still pass. Proven additionally by an integration test against the gate
  itself (rejects `factory-test-099`, accepts `or-edri-4`).
- Docs: `e2e-verify` on or-edri-4 needs `gcp_project=factory-test-21` (added to the skill + loop doc).

## or-edri-4-standing-proving-system — Stage 3: anti-decay heartbeat for or-edri-4

Ensure the standing proving system can't decay silently (the failure that retired the old
reference system): the 6-hourly `system-runtime-audit.yml` now ALWAYS probes `or-edri-4`, even
though it lives on a test project (`factory-test-21`, adopt) outside the Systems folder and so is
not returned by `gcloud projects list`. Its `/healthz` probe + `factory.runtime_audit.*` events
(incl. an `error`+`action_required` alert on failure) now cover it.

- `scripts/runtime-audit-targets.sh` — new: merges the folder listing with `ALWAYS_PROBE`
  (default `or-edri-4`), de-duplicated, blanks removed; testable without gcloud via
  `RUNTIME_AUDIT_FOLDER_LIST`.
- `.github/workflows/system-runtime-audit.yml` — builds its probe set from that script
  (`ALWAYS_PROBE=or-edri-4`); documented the exception in the header.
- `monitoring/watchdog-registry.json` — recorded `always_probe:["or-edri-4"]` in the existing
  `system-runtime-audit` entry's evidence (no new entry → no unsupported-method noise in the
  watchdog report).
- `scripts/tests/runtime-audit-targets.bats` — 5 unit tests (always-include, dedup, empty list,
  no blanks, multi-system).


