# Changelog fragment — preserve-secret-to-control (2026-06-11)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: preserve-secret-to-control.yml — durable system→control secret copy (teardown-safe)

| Type | Summary |
|---|---|
| feat | New manual `workflow_dispatch` workflow `.github/workflows/preserve-secret-to-control.yml` — the exact reverse of `mirror-secret-to-system.yml`. Copies the LATEST version of one Secret Manager secret **FROM a system's GCP project INTO `or-factory-master-control`**, server-side as the broker SA via WIF, value piped between `gcloud` calls (never echoed, never in a shell var, never logged). Purpose: before a system is torn down / re-provisioned, preserve a runtime value that lives ONLY in that system's SM (e.g. an n8n Telegram bot token set live) so the next system can be seeded from it. Safety by construction: `dest_secret` MUST start with `preserved-` (can never clobber an existing control credential), control super-credential patterns (`*-management-key`/`*-provisioning-key`/`*-master-key`/`factory-master-broker-app-*`) are refused, the source must be a non-control system project, and the broker self-grants `secretAccessor` on the one source secret with an IAM-propagation retry. `permissions: {}` at top with job-level `contents: read` + `id-token: write`; `if: github.ref == 'refs/heads/main'` (broker WIF CEL pins main). Not on the `dispatch_workflow` MCP allowlist — dispatched via the GitHub API. First use: preserve `n8n-telegram-bot-token` from `factory-test-21` (the live `or-edri-4` system) so the same Telegram bot carries into the next build. |
