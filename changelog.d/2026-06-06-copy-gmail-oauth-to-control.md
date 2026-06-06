## chore: one-shot workflow to copy Gmail OAuth secrets into control

Adds `copy-gmail-oauth-to-control.yml`, a one-shot operator-dispatched
workflow that copies the Gmail OAuth secrets from `factory-test-7` (the GCP
project behind `edri2or/or-adhd-agent`) into `or-factory-master-control`'s
Secret Manager.

**Why:** the operator asked to mirror the three `gmail-oauth-*` secrets into
the factory control project. Inventory showed only two carry a value:
`gmail-oauth-client-id` and `gmail-oauth-client-secret`. The third,
`gmail-oauth-refresh-token`, is an empty shell (0 enabled versions) — the live
refresh token lives encrypted inside n8n, not in Secret Manager — so there is
nothing to copy. Per the operator's decision the workflow still creates an
empty shell of the same name in control, to be filled later by a fresh Google
consent on the factory side.

**Auth:** WIF as `factory-master-broker`, which already holds `roles/owner` on
`factory-test-7` (read source values) and manages secrets in
`or-factory-master-control` (create + add version). No new IAM is granted.

**Safety:** `main`-only (matches the broker WIF CEL), requires a typed
`confirm=copy` input, idempotent (creates a shell only if absent, adds a
version only if none exists), and secret values are written to a shredded temp
file — never printed or logged.
