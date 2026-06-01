# Changelog fragment — prove-before-merge (2026-06-01)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: prove-before-merge — sandbox toy-key identity on factory-test-25 (Stage 1)

| Type | Summary |
|---|---|
| feat | Stage 1 of the prove-before-merge development — flips the live-test loop from "merge → prove" toward "prove → merge" by building a separate, minimal, sandbox-only GCP identity ("toy key") that is safe to expose to a NON-main work branch because, even if leaked, it cannot touch anything real. New `scripts/bootstrap-sandbox-tester.sh` + `.github/workflows/bootstrap-sandbox-tester.yml` (broker-authed, main-locked, idempotent) create on `factory-test-25` ONLY: a dedicated `sandbox-pool`/`github-sandbox-provider` whose CEL pins the factory repo by immutable owner-id+repo-id with **any ref** (the unlock — deliberately not pinned to main), a `sandbox-tester-sa` service account, a `workloadIdentityUser` binding for the factory-repo principalSet, and a **conditioned** project-level `secretmanager.secretAccessor` restricted by IAM Condition to secret names starting with `github-app-` (so the toy key can read ONLY the per-test App-credential secrets — never Railway/Cloudflare/management keys, and the grant survives the per-provision secret wipe+reseed). The powerful broker SA and the existing main-locked `github-pool`/test_pool are left byte-for-byte untouched. No `templates/system/**` change (golden gate is a no-op). `shellcheck --severity=error` + `yamllint` clean. |

## feat: prove-before-merge — allowlist bootstrap-sandbox-tester for autonomous dispatch (Stage 1, follow-up)

| Type | Summary |
|---|---|
| feat | Adds `bootstrap-sandbox-tester.yml` to the MCP `dispatch_workflow` allowlist (`services/mcp-server/src/tools.ts` — the `DISPATCHABLE_WORKFLOWS` set + the tool description), so the agent runs the one-time sandbox-identity bootstrap autonomously rather than via an operator click (Or's explicit choice). The workflow is broker-authed + main-locked like every dispatchable workflow; the identity it BUILDS is the weak, sandbox-only one, and its script hard-refuses any project other than `factory-test-25`. Requires an MCP redeploy (`deploy-mcp-server.yml`) to take effect. `tsc` build + `node --test` (40/40) green. |

## fix: prove-before-merge — retry IAM bindings against SA-propagation in bootstrap (Stage 1, fix)

| Type | Summary |
|---|---|
| fix | The first live bootstrap run (factory-test-25) created the pool, provider, and `sandbox-tester-sa` fine, but the final project-level `secretAccessor` binding failed with `INVALID_ARGUMENT: Service account ... does not exist` — the documented IAM eventual-consistency window between SA creation and the SA being visible as a policy member (CLAUDE.md "Propagation patterns", "SA → IAM policy member ~5-30s"). `scripts/bootstrap-sandbox-tester.sh` now wraps both SA-member bindings (workloadIdentityUser + the conditioned secretAccessor) in a `_bind_retry` helper that retries only the `does not exist`/`PERMISSION_DENIED` class (12×10s), mirroring the `_bind` retry already used in `provision-system.yml`. Idempotent re-run completes the binding. `shellcheck --severity=error` clean. |
