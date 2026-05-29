## feat: OIL Stage 5 — post-merge verification + Linear auto-close (verifier)

| Type | Summary |
|---|---|
| feat | OIL auto-fix Stage 5 (verifier): a new post-merge verifier `oil-autofix-verify.yml` (triggered by `push: main`, recognises an OIL merge by the `oil-autofix:` squash subject) re-runs the fix's reproducer on the merged `main` via `scripts/oil-verify.sh` (a pure gate: whitelisted `bash <file>`, scrubbed `env -i`, run only after cloud creds are revoked). On pass it moves the Linear issue to a `completed` state + posts a closing comment + pings Or on Telegram; on fail it comments + alerts "נכשל באימות" and leaves the issue OPEN; a no-reproducer case escalates softly without a false alarm. It uses **no GitHub API token** in its logic — the OIL identifier + PR number come from the commit subject and the reproducer from the merge diff; Linear/Telegram creds are read from Secret Manager via WIF. Proven by `scripts/tests/oil-verify-selftest.sh` (verified / failed / malformed / missing / empty), wired into `pipeline-tests.yml`; `scripts/tests/oil-verify-failmode.sh` is a fixture for exercising the failure path live via `workflow_dispatch`. |

## chore: OIL Stage 5 — live-verify success-path fixture

| Type | Summary |
|---|---|
| chore | Add `scripts/tests/oil-verify-passmode.sh` — a trivially passing reproducer fixture (the success-path companion to `oil-verify-failmode.sh`). Merging this PR (an `oil-autofix: OIL-22` commit) is itself the Stage-5 controlled live verification: `oil-autofix-verify` re-runs the fixture on merged `main`, posts a closing comment, and moves OIL-22 to a completed state. |
