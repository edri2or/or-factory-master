# Changelog fragment — exclude-preserved-from-generic-copy (2026-06-11)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## fix: exclude `preserved-*` secrets from the per-system generic-secret copy

| Type | Summary |
|---|---|
| fix | `preserve-secret-to-control.yml` stages a system's runtime value in control SM under a `preserved-*` id (re-injected explicitly by `restore-secret-from-control.yml`). But the provision-time generic-secret copy enumerates **all** non-excluded control secrets, so every `preserved-*` backup was being bulk-copied into **every** newly provisioned system — spreading one system's preserved bot token to unrelated systems. Fix: add `preserved-.*` to the `EXCLUDE` allow-list in **both** `scripts/copy-generic-secrets.sh` (the actual copy) and `.github/workflows/provision-system.yml` (the AGENTS.md enumeration) — the two are kept byte-in-sync by contract. `preserved-*` are per-system teardown backups, never generic. No behaviour change for any non-`preserved-*` secret; the stray copy a pre-fix provision left in a system's own project is harmless (right system) and is cleared by that system's next adopt-wipe. |
