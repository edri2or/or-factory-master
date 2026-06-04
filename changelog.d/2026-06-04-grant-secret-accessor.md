# Changelog fragment — grant-secret-accessor (2026-06-04)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: `grant-secret-accessor.yml` — autonomous per-secret read grant for hand-created secrets

| Type | Summary |
|---|---|
| feat | New manual workflow `.github/workflows/grant-secret-accessor.yml`. Grants `roles/secretmanager.secretAccessor` on **one existing** Secret Manager secret to one or more service accounts, authenticating as the broker SA via WIF (same auth block as `provision-system.yml`). Inputs: `gcp_project`, `secret_name`, optional `members` (defaults to `deploy-sa@<proj>` + `runtime-sa@<proj>`). Idempotent; retries the IAM eventual-consistency window; hard-refuses control projects + `factory-test-25`; verifies the secret exists before granting; never reads or prints the secret value (touches IAM policy only). Closes the gap where a secret created **by hand after** provisioning (e.g. `supadata-api-key`, `cloudflare-access-token`) lacks the per-secret binding that provisioning normally adds, so a system's deploy reads it as empty and skips the feature. First use: unblock `youtube-insight-agent` go-live on `or-adhd-agent` (grant read on `supadata-api-key` in `factory-test-7`). Pinned to `refs/heads/main` (broker WIF CEL); triggered via `actions_run_trigger` (not on the `dispatch_workflow` allowlist). |
