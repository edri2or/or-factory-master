# Changelog fragment — reference-system (2026-05-31)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: reference-system — standing system descriptor + reader + docs (Stage 1)

| Type | Summary |
|---|---|
| feat | Stage 1 of the reference-system development — registers the standing "reference car" test system that future provisioning-process developments will be tried on (Layer A) before the final from-scratch build on `factory-test-25` (Layer B, unchanged). New `reference-system/config.yml` — the system's single declarative descriptor (flat `key: value` YAML: identity `system_name`/`repo`/`gcp_project_id`/`region`, deterministic `public_url`/`health_url`, and runtime ids `railway_project_id`/`built_from_commit`/`template_version` left blank with `provisioned: false` until the Stage 0 real provision). New `scripts/reference-config.sh` reads/validates it with `sed` (no `yq` on the runner), sourceable as a library by the later reconcile + smoke flows or run directly (`get <key>` / `validate`); `shellcheck --severity=error` clean and functionally verified (`validate` passes, `get` returns the right values incl. blank runtime ids). New `docs/reference-system.md` explains the two-layer model (Day 2 vs Day 0) and the three anti-drift mechanisms (static golden gate, twin CI gate, scheduled reconciliation). Stage 0 (the real, costed provision) is deferred to the end of the development per Or's choice — code gates 1→7 first, at zero cost. |
