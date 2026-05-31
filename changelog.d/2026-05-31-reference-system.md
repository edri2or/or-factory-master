# Changelog fragment — reference-system (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: reference-system — standing system descriptor + reader + docs (Stage 1)

| Type | Summary |
|---|---|
| feat | Stage 1 of the reference-system development — registers the standing "reference car" test system that future provisioning-process developments will be tried on (Layer A) before the final from-scratch build on `factory-test-25` (Layer B, unchanged). New `reference-system/config.yml` — the system's single declarative descriptor (flat `key: value` YAML: identity `system_name`/`repo`/`gcp_project_id`/`region`, deterministic `public_url`/`health_url`, and runtime ids `railway_project_id`/`built_from_commit`/`template_version` left blank with `provisioned: false` until the Stage 0 real provision). New `scripts/reference-config.sh` reads/validates it with `sed` (no `yq` on the runner), sourceable as a library by the later reconcile + smoke flows or run directly (`get <key>` / `validate`); `shellcheck --severity=error` clean and functionally verified (`validate` passes, `get` returns the right values incl. blank runtime ids). New `docs/reference-system.md` explains the two-layer model (Day 2 vs Day 0) and the three anti-drift mechanisms (static golden gate, twin CI gate, scheduled reconciliation). Stage 0 (the real, costed provision) is deferred to the end of the development per Or's choice — code gates 1→7 first, at zero cost. |

## feat: reference-system — static golden gate over the templates/system render (Stage 2)

| Type | Summary |
|---|---|
| feat | Stage 2 of the reference-system development — the visible half of the anti-drift mechanism. New `scripts/render-system-golden.sh` re-renders the whole `templates/system/` mould (109 files) with the same fixed 14-var allow-list a real provision uses, replacing each `*.template` with its rendered target name exactly as a provisioned system ends up (deterministic inputs ⇒ no volatile fields to normalise). The committed golden under `tests/golden/system/` is a byte-exact `MANIFEST.sha256` fingerprint of that render plus the two rendered orientation docs (`rendered/AGENTS.md`, `rendered/CLAUDE.md`) stored in full so a deliberate render change shows up as a human-readable diff. New `scripts/check-system-golden.sh` re-renders and compares (`--update` to refresh for an intentional change). Wired as a new **System golden gate** step in the existing **Playground tests** job (`.github/workflows/playground-tests.yml`) — no new required status context. New `scripts/tests/check-system-golden.bats` (5 tests) locks the verdicts. Verified locally: PASS on a clean match; FAIL on an injected change to a normal template file (manifest hash drift) and to a rendered `*.template` (hash + readable diff); `--update` re-greens; full BATS suite 95/95, `validate-templates.sh`, `yamllint`, `shellcheck --severity=error` all clean. The chosen `sha256` manifest (vs a full tree copy) keeps storage light while staying byte-exact and catching 100% of drift. |
