## feat: mirror-secret-to-system workflow (propagate a control secret value to an existing system)

| Type | Summary |
|---|---|
| feat | New manual `mirror-secret-to-system.yml` copies the latest version of one or more Secret Manager secrets from `or-factory-master-control` into an existing system's GCP project, server-side as the broker SA (value piped, never logged). Closes the value-propagation gap left by `copy-generic-secrets.sh` (which only seeds at provision time) — the twin of `grant-secret-accessor.yml`, which closes the IAM half. |

Guards: destination must be a real system project (refuses control projects + `factory-test-25`, validates GCP project-id shape); secret ids are shape-checked; control-only super-credentials (`factory-master-broker-app-*`, `*-management-key`, `*-provisioning-key`, `*-master-key`) are refused, mirroring the `copy-generic-secrets.sh` EXCLUDE policy. Idempotent. Used to re-sync `google-oauth-client-id` / `google-oauth-client-secret` into `factory-test-23` (or-tok) after the source was updated post-provision.
