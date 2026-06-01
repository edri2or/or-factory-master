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
