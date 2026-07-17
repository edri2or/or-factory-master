# Retire "Number 1" in the system template (future systems)

Package F of the "retire Number 1" work — the factory-template half. Documentation/script prose
only; provision-only (reaches systems built after this change; no back-fill), no new capability, no
bot behavior, no E2E.

- `templates/system/docs/language-boundary.md`: reframed the 8 "Number 1" occurrences → "the
  coordinator", keeping the single-coordinator-broker meaning. So a newly-provisioned system's
  language-boundary doctrine no longer ships the retired label.
- `scripts/language-session-start-hook.sh`: reframed the session-start echo line (`The edge is
  'Number 1' …` → `The edge is the coordinator (this session) …`). This script is copied into every
  new system by `provision-system.yml`, so new systems' session hook no longer prints "Number 1".
- Refreshed the system golden (`tests/golden/system/`) via
  `bash scripts/check-system-golden.sh --update` — its `MANIFEST.sha256` tracks
  `docs/language-boundary.md`, satisfying the golden-sync path-coupling gate.

Note: the factory's `AGENTS.md.template` has no "#1" (its Purpose is `${SYSTEM_PURPOSE}`), so it was
not touched — the doc-fact-check anchor at `AGENTS.md.template:167` is unaffected. Mirrors the
or-aios change merged in PR #550 (ADR-0027).
