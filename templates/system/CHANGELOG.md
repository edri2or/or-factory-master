# Changelog

## Initial — system scaffolded by or-factory-master

| PR | Type | Summary |
|---|---|---|
| - | chore | Repository scaffolded by `or-factory-master` (n8n + Postgres on Railway behind a Caddy gateway, Cloudflare DNS, per-system GCP Secret Manager). Ships with branch protection on `main` (PR required, no direct push) and CI gates that must pass before merge: shellcheck + yamllint, committed-secret scan, supply-chain checks (SHA-pinned actions, no `write-all`, no `pull_request_target`, no `id-token:write` in PR workflows), and this documentation policy. Any change to `.sh` / `.json` / `.yml` / `.yaml` must add a CHANGELOG.md entry; this file must stay under 20 KB (rotate older entries to `docs/changelog-archive/` when it grows). |
