# Changelog

## Initial — system scaffolded by or-factory-master

| PR | Type | Summary |
|---|---|---|
| - | chore | Repository scaffolded by `or-factory-master` (n8n + Postgres on Railway behind a Caddy gateway, Cloudflare DNS, per-system GCP Secret Manager). Ships with branch protection on `main` (PR required, no direct push) and CI gates that must pass before merge: shellcheck + yamllint, committed-secret scan, supply-chain checks (SHA-pinned actions, no `write-all`, no `pull_request_target`, no `id-token:write` in PR workflows), and this documentation policy. Any change to `.sh` / `.json` / `.yml` / `.yaml` must add a CHANGELOG.md entry; this file must stay under 20 KB (rotate older entries to `docs/changelog-archive/` when it grows). |
| - | feat | The `ops-agent` ships with live read-only telemetry: a `github_readonly` tool (recent CI runs / commits / open PRs, via this system's own GitHub App) and a `railway_readonly` tool (latest deploy status / recent deployment logs). Both are secret-gated and `jq`-stripped from the agent when their secrets are absent; GitHub/Railway links are allowed through the router's egress. Read-only — no writes. See `changelog.d/` for detail. |
| - | feat | `github_readonly` also reads repo **file contents** via `read_file:<path>` (e.g. `read_file:AGENT.md`), and the agent's authoritative SYSTEM-INFO capability card lists its live GitHub/Railway read sources so the bot describes them accurately instead of denying them. Read-only. See `changelog.d/` for detail. |
