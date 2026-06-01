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

## fix: prove-before-merge — recognise the SA "already exists" conflict on re-run (Stage 1, fix)

| Type | Summary |
|---|---|
| fix | The idempotent re-run then failed at the `service-accounts create` step: the `_create_ok` helper only treated the literal token `ALREADY_EXISTS` as success, but gcloud phrases an existing service account differently (`... is the subject of a conflict: Service account ... already exists within project`), so a second run errored instead of continuing. `_create_ok` now matches `ALREADY_EXISTS`/`already exists`/`subject of a conflict` case-insensitively, so re-runs are truly idempotent across all three resource kinds (pool/provider/SA). `shellcheck --severity=error` clean. |

## fix: prove-before-merge — provision _bind must pass --condition=None on conditional-policy projects (Stage 4 fix)

| Type | Summary |
|---|---|
| fix | Standing up the Stage-4 live test system failed at provision's "Grant project-level IAM" step: `gcloud projects add-iam-policy-binding ... --quiet` errored with *"Adding a binding without specifying a condition to a policy containing conditions is prohibited in non-interactive mode. Run the command again with `--condition=None`."* Root cause is a side-effect of Stage 1: the sandbox toy-key's **conditioned** `secretAccessor` made `factory-test-25`'s project IAM policy contain a condition, and from then on gcloud refuses to add an *unconditional* binding there without an explicit `--condition=None`. Fix: provision-system.yml's `_bind` helper now passes `--condition=None` (a harmless no-op on condition-free policies — i.e. every real system's own project — and the documented requirement on a conditional one). This unblocks every reuse-mode provision onto the shared test backend; no behaviour change for normal/adopt provisions. |

## feat: prove-before-merge — prove-on-test-system apply body + per-system App pull_requests:write (Stage 3)

| Type | Summary |
|---|---|
| feat | Stage 3 — the apply/prove body of `prove-on-test-system.yml`. After authenticating as the sandbox SA (and hard-asserting it is NOT the broker), it reads the test system's own `github-app-*` creds from `factory-test-25` SM (the only secrets the conditioned sandbox grant allows), mints a token scoped to just `edri2or/<system_name>`, clones it, copies **this branch's** `templates/system/<paths>` in, and lands the change through the **same PR + green-CI + squash-merge gate** the test repo enforces — then dispatches the system's `post_apply_workflow` to take it live. Idempotent (no diff → no PR). To make the PR path possible from the sandbox identity, `register-system-app.yml` bumps the per-system App's `pull_requests` scope `read`→`write` (a minimal bump — the App already holds `contents`/`workflows`/`secrets:write` on that one repo; scoped to the system's own repo; provision-only propagation). Also fixes the Stage-2 skeleton's trailing `echo` (`SYSTEM_NAME: unbound variable` under `set -u`). `yamllint` green. The earlier Stage-2 live run already proved a non-main branch authenticates as the sandbox SA (never the broker). |

## feat: prove-before-merge — branch-runnable prove-on-test-system skeleton (Stage 2)

| Type | Summary |
|---|---|
| feat | Stage 2 — the dispatch interface for "prove → merge". New `.github/workflows/prove-on-test-system.yml`: `workflow_dispatch` (inputs `system_name`/`paths`/`post_apply_workflow`) with **no** `if: refs/heads/main` guard — it is the one factory workflow meant to run off a work branch. It authenticates as the minimal `sandbox-tester-sa` via `github-sandbox-provider` (factory repo, any ref) — **never** the broker — validates `system_name` (refusing control/factory targets), and asserts the active credential is the sandbox SA (hard-fails if it sees the broker). The apply/prove body (mint the test repo's token from `factory-test-25` SM, push the branch's `templates/system/<paths>`, dispatch the post-apply workflow) is Stage 3. Landing the skeleton on `main` is what makes it branch-dispatchable (GitHub requires a `workflow_dispatch` file on the default branch). Also adds it to the MCP `dispatch_workflow` allowlist (`services/mcp-server/src/tools.ts`, so it can be dispatched with `ref=<branch>`) and to `monitoring/registry-exempt.txt` (manual tool, no cadence). `yamllint` + `tsc` + `node --test` (40/40) green; needs one MCP redeploy to take effect. |
