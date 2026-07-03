### Exempt automated factory-refresh branches from the devplan gate

- `scripts/check-devplan-updated.sh` now skips (PASS) on `refresh-system-*` branches — the
  branch `refresh-system-agents.yml` opens for an automated template refresh — mirroring the
  existing `oil-autofix/*` exemption. An automated template sync is not a `/dev-stage`
  development stage, so it correctly never touches a devplan; without this, the refresh PR was
  blocked forever on any system carrying active devplans (the `request-factory-resource`
  backfill to or-aios stalled here, 20/20 merge attempts). The refresh already ships a
  `changelog.d/` fragment for the twin CHANGELOG gate; this is its devplan twin. Propagates to
  new systems via `provision-system.yml` (which ships this script), and the same one-line
  exemption was applied to or-aios's live copy to release its stuck PR #233.
