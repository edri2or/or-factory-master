### Reference-system overhaul — retire the standing reference system, adopt the live-test-system loop

Replaces the never-used standing reference system ("מערכת-ייחוס") + two-layer
`/dev-stage-factory` validation with the proven live-test-system loop as the factory's
standing, generic, documented method for validating provisioning changes.

- **Stage 1 — teardown of the live reference system.** Tore down `or-factory-reference`
  (adopted on `factory-test-18`) via `decommission-test-system.yml`: deleted its Railway
  project (stopping the ongoing cost), removed its Cloudflare CNAME + `_railway-verify`
  TXT, revoked its OpenRouter inference key, and archived `edri2or/or-factory-reference`.
  Verified: no Railway project, `/healthz` unreachable. The empty `factory-test-18` GCP
  project is soft-deleted separately via the operator-run `decommission-test-projects.yml`.
- **Stage 2 — removed the reference-system core.** Deleted `reference-system/config.yml`,
  `docs/reference-system.md`, `scripts/reference-config.sh`, `scripts/reference-system-smoke.sh`,
  `scripts/tests/reference-system-smoke.bats`, and `.github/workflows/reference-system-reconcile.yml`,
  and removed the `reference-system-reconcile` entry from `monitoring/watchdog-registry.json` in the
  same change (so the watchdog gate stays green on the workflow removal).
- **Stage 3 — detached the golden gate from the "reference" naming.** Renamed
  `scripts/check-reference-sync.sh` → `scripts/check-golden-sync.sh` (and its bats), reworded
  its internal "reference golden" wording to "template golden", and pointed the
  `changelog-check.yml` step at the new name. The golden gate (renderer + `check-system-golden.sh`
  + `tests/golden/system/` + the Playground "System golden gate" step) is unchanged and stays as
  an independent template-integrity guard.
