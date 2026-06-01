## secret-clean-optimize

### Stage 1 — Script: add `--reuse` mode + bats tests

- `scripts/clean-project-secrets.sh`: new `--reuse` flag — uses
  `gcloud secrets list --filter="NOT labels.copied-from-factory:true"` to
  delete only test-specific secrets (runtime-shell, openrouter-mint, github-app-*)
  while keeping the 40 generic copied-from-factory secrets intact; saves ~160 API
  calls (~3-5 min) per reuse-mode provision. `--adopt` and `--reuse` are mutually
  exclusive; all existing guards (control-project refusal, test-pattern check)
  unchanged. Old default behaviour (full wipe) is untouched.
- `scripts/tests/clean-project-secrets.bats`: 18 new bats unit tests covering
  all guards, both modes, and the label-filter path (mock gcloud, no GCP calls).

### Stage 2 — Workflow: wire `--reuse` in provision-system.yml

- `.github/workflows/provision-system.yml`: `Clean shared-project secrets (reuse
  mode)` step now passes `--reuse` to `clean-project-secrets.sh`, activating the
  targeted-delete path for every reuse-mode provision. Comment updated to explain
  the savings. No behaviour change to adopt mode or default mode.
