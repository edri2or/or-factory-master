# Changelog fragment — seed-shared-secrets (2026-06-06)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: `seed-shared-secrets.yml` — promote a system's secret to the shared vault + back-fill existing systems

| Type | Summary |
|---|---|
| feat | New manual workflow `.github/workflows/seed-shared-secrets.yml` + `scripts/seed-shared-secrets.sh`. Copies one or more secret VALUES from a source system's Secret Manager into the factory CONTROL vault (so `copy-generic-secrets.sh` then propagates them to every FUTURE provisioned system) and, optionally, into named EXISTING system projects right now (provisioning does not back-fill already-built systems). Broker SA via WIF (same auth block as `grant-secret-accessor.yml`, pinned to `refs/heads/main`); values are read into a `0600` temp file and never printed; idempotent (a destination already holding a version is left untouched); guards refuse control projects + `factory-test-25` as source/destination; grants the destination system's `runtime-sa`+`deploy-sa` per-secret `secretAccessor`. Triggered via `actions_run_trigger` (not on the `dispatch_workflow` allowlist). First use: make the operator's single Gmail OAuth app credentials (`gmail-oauth-client-id`, `gmail-oauth-client-secret`) shared across all systems — seed the control vault + `factory-test-23` (`or-tok`) from `factory-test-7` (`or-adhd-agent`). |
