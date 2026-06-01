# Changelog fragment — prove-before-merge (2026-06-01)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: prove-before-merge — sandbox toy-key identity on factory-test-25 (Stage 1)

| Type | Summary |
|---|---|
| feat | Stage 1 of the prove-before-merge development — flips the live-test loop from "merge → prove" toward "prove → merge" by building a separate, minimal, sandbox-only GCP identity ("toy key") that is safe to expose to a NON-main work branch because, even if leaked, it cannot touch anything real. New `scripts/bootstrap-sandbox-tester.sh` + `.github/workflows/bootstrap-sandbox-tester.yml` (broker-authed, main-locked, idempotent) create on `factory-test-25` ONLY: a dedicated `sandbox-pool`/`github-sandbox-provider` whose CEL pins the factory repo by immutable owner-id+repo-id with **any ref** (the unlock — deliberately not pinned to main), a `sandbox-tester-sa` service account, a `workloadIdentityUser` binding for the factory-repo principalSet, and a **conditioned** project-level `secretmanager.secretAccessor` restricted by IAM Condition to secret names starting with `github-app-` (so the toy key can read ONLY the per-test App-credential secrets — never Railway/Cloudflare/management keys, and the grant survives the per-provision secret wipe+reseed). The powerful broker SA and the existing main-locked `github-pool`/test_pool are left byte-for-byte untouched. No `templates/system/**` change (golden gate is a no-op). `shellcheck --severity=error` + `yamllint` clean. |
