# Changelog fragment — restore-secret-from-control (2026-06-11)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: restore-secret-from-control.yml — re-inject a preserved secret into a (rebuilt) system

| Type | Summary |
|---|---|
| feat | New manual `workflow_dispatch` workflow `.github/workflows/restore-secret-from-control.yml` — the completion of the preserve/restore pair (twin of `preserve-secret-to-control.yml`). Copies a PRESERVATION secret **FROM `or-factory-master-control` INTO a system's GCP project** under a chosen dest id, server-side as the broker SA via WIF, value piped between `gcloud` calls (never echoed, never in a shell var, never logged). Purpose: after a system is rebuilt, re-inject a runtime value preserved before the previous teardown (e.g. an n8n Telegram bot token) so the bot/identity carries across rebuilds — supports renaming (e.g. `preserved-n8n-telegram-bot-token-or-edri-4` → `n8n-telegram-bot-token`), which `mirror-secret-to-system.yml` (same-id only) cannot do. Safety by construction: `source_secret` MUST start with `preserved-` (can only read preservation copies, never an arbitrary control credential), the dest must be a non-control system project (control + `factory-test-25` refused), the broker self-grants `secretVersionManager` on the one dest secret with an IAM-propagation retry. `permissions: {}` + job-level `contents: read` / `id-token: write`; `if: github.ref == 'refs/heads/main'`. Not on the `dispatch_workflow` MCP allowlist — dispatched via the GitHub API. |
