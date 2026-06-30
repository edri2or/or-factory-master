## fal-api-key — permanent secretAccessor for the or-aios fal.ai (LoRA likeness) key

Or added a `fal-api-key` secret by hand to the or-aios system's Secret Manager
(GCP `factory-test-8`) for the trained-likeness / LoRA feature, but neither
`runtime-sa` nor `deploy-sa` had read access, so a WIF-run workflow failed with
"lacks secretAccessor". Two parts close this:

- **Immediate (live):** ran the existing `grant-secret-accessor.yml` on `main`
  with `gcp_project=factory-test-8`, `secret_name=fal-api-key`, empty `members`
  (defaults to `deploy-sa@factory-test-8` + `runtime-sa@factory-test-8`) — granting
  `roles/secretmanager.secretAccessor` to both SAs on the existing secret. IAM only;
  the secret value is never read or printed.
- **Permanent:** added `fal-api-key` to the managed `RUNTIME_SHELLS` list in
  `provision-system.yml`'s "Pre-create runtime secret shells" step — the same
  mechanism that grants `secretAccessor` to runtime-sa + deploy-sa on every other
  managed per-system secret. Idempotent: the create-if-missing guard never overwrites
  a hand-set value, and the binding is re-applied on every (re-)provision/adopt, so
  the grant survives a re-provision rather than being a one-off.
