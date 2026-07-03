## greeninvoice-api-{id,secret} — permanent secretAccessor for the or-aios Green Invoice pair

Or created two secrets by hand in the or-aios system's Secret Manager
(GCP `factory-test-8`) for the Green Invoice (morning) invoicing integration —
`greeninvoice-api-id` + `greeninvoice-api-secret` — but neither `runtime-sa` nor
`deploy-sa` had read access, unlike every other per-system secret. Same two-part
close as the `fal-api-key` precedent (2026-06-30):

- **Immediate (live):** ran the existing `grant-secret-accessor.yml` on `main`
  twice — once per secret — with `gcp_project=factory-test-8` and empty `members`
  (defaults to `deploy-sa@factory-test-8` + `runtime-sa@factory-test-8`), granting
  `roles/secretmanager.secretAccessor` to both SAs on both secrets (runs
  28629413804 + 28629429889, both success). IAM only; the secret values are never
  read or printed.
- **Permanent:** added both names to the managed `RUNTIME_SHELLS` list in
  `provision-system.yml`'s "Pre-create runtime secret shells" step — the same
  mechanism that grants `secretAccessor` to runtime-sa + deploy-sa on every other
  managed per-system secret. Idempotent: the create-if-missing guard never
  overwrites a hand-set value, and the binding is re-applied on every
  (re-)provision/adopt, so the grant survives a re-provision rather than being a
  one-off.
