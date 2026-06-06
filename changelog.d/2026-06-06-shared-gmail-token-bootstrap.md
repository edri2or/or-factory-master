## feat: ship a Gmail-OAuth bootstrap into every system (shared token, no click when possible)

Adds `templates/system/.github/workflows/bootstrap-gmail-oauth.yml` and wires
`provision-system.yml` to copy it into every newly provisioned system repo.

The workflow connects a system's n8n to Gmail + Calendar using the **shared**
`gmail-oauth-*` secrets (now propagated to every system by
`copy-generic-secrets.sh`). It validates the shared refresh token directly
against Google's token endpoint, and when valid pre-loads `oauthTokenData` into
the "Google OAuth2 API" credential so **no consent click** is needed. If the
token can't validate, it falls back to the proven one-click Telegram consent
link — so a system is never worse off. Idempotent, `main`-only, values masked.

Chores: regenerated `tests/golden/system/` (template change) and exempted the
new per-system bootstrap from the watchdog registry (`monitoring/registry-exempt.txt`,
dispatch-only). Part of the `shared-gmail-token` development.
