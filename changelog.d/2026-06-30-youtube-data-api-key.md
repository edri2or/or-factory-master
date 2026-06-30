## provision-youtube-data-api-key — provision a YouTube Data API v3 key into a system

New manual workflow `.github/workflows/provision-youtube-data-api-key.yml` that
provisions a Google API key into a system's GCP project, server-side as the broker
SA via WIF (the broker holds `roles/owner` on system projects). Fulfils the or-aios
request `docs/agent-specs/youtube-search-key-request.md`.

End to end, in one run:
- Enables `youtube.googleapis.com` + `apikeys.googleapis.com` on the project.
- Creates (or reuses, by display name) an API key **restricted to YouTube Data API
  v3 only** (`--api-target`), with **no application restriction** — read server-side
  (n8n on Railway + the CI probe), so an HTTP-referrer restriction would break it.
- Pipes the key string straight into Secret Manager (`youtube-data-api-key`) —
  never echoed, stored in a shell var, or logged (the mirror-secret-to-system.yml
  pattern).
- Grants `roles/secretmanager.secretAccessor` on the secret to `deploy-sa` +
  `runtime-sa`, then a value-free verify step (key restriction + enabled versions +
  IAM bindings).

Defaults target factory-test-8 / `youtube-data-api-key` so it dispatches zero-arg,
but inputs keep it reusable. Idempotent. Listed in `monitoring/registry-exempt.txt`
(workflow_dispatch only, no cadence). Guards: refuses control projects + factory-test-25.
