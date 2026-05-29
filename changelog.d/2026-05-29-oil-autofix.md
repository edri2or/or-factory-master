## feat: OIL Stage 5 — post-merge verification + Linear auto-close (verifier)

| Type | Summary |
|---|---|
| feat | OIL auto-fix Stage 5 (verifier): a new post-merge verifier `oil-autofix-verify.yml` (triggered by `push: main`, recognises an OIL merge by the `oil-autofix:` squash subject) re-runs the fix's reproducer on the merged `main` via `scripts/oil-verify.sh` (a pure gate: whitelisted `bash <file>`, scrubbed `env -i`, run only after cloud creds are revoked). On pass it moves the Linear issue to a `completed` state + posts a closing comment + pings Or on Telegram; on fail it comments + alerts "נכשל באימות" and leaves the issue OPEN; a no-reproducer case escalates softly without a false alarm. It uses **no GitHub API token** in its logic — the OIL identifier + PR number come from the commit subject and the reproducer from the merge diff; Linear/Telegram creds are read from Secret Manager via WIF. Proven by `scripts/tests/oil-verify-selftest.sh` (verified / failed / malformed / missing / empty), wired into `pipeline-tests.yml`; `scripts/tests/oil-verify-failmode.sh` is a fixture for exercising the failure path live via `workflow_dispatch`. |

## chore: OIL Stage 5 — live-verify success-path fixture

| Type | Summary |
|---|---|
| chore | Add `scripts/tests/oil-verify-passmode.sh` — a trivially passing reproducer fixture (the success-path companion to `oil-verify-failmode.sh`). Merging this PR (an `oil-autofix: OIL-22` commit) is itself the Stage-5 controlled live verification: `oil-autofix-verify` re-runs the fixture on merged `main`, posts a closing comment, and moves OIL-22 to a completed state. |

## test: OIL Stage 5 — failure-path live demo (temporary)

| Type | Summary |
|---|---|
| test | Add `scripts/tests/oil-stage5-failsmoke.sh` — a TEMPORARY deliberately-failing reproducer to prove the verify FAILURE path live (OIL-23): `oil-autofix-verify` re-runs it on merged `main`, sees it fail, posts a "verification failed" comment, alerts on Telegram, and leaves the issue OPEN (no auto-close). Removed in the very next PR. |

## fix: OIL Stage 5 — verify failure path aborted under `bash -e`

| Type | Summary |
|---|---|
| fix | The live failure demo (OIL-23) caught a real bug: GitHub runs `run:` steps with `bash -e`, so the verify step's `out=$(bash scripts/oil-verify.sh …); rc=$?` capture aborted the step the instant the reproducer exited non-zero — `outcome=failed` was never written, so the failure comment + "🚨 נכשל באימות" Telegram silently never fired (the success path was unaffected — that is why OIL-22 worked). Fixed with `set +e` in the verify step (it does its own exit-code handling) and hardened a latent `&&`-abort in the prep step's identifier assignment. Re-demoed live on OIL-23 with `scripts/tests/oil-stage5-failsmoke-2.sh`. |

## chore: OIL Stage 5 — close + remove live-verify failure fixtures

| Type | Summary |
|---|---|
| chore | Stage 5 complete and verified live end-to-end (success: OIL-22 auto-closed; failure: OIL-23 left open + alerted). Remove the two temporary `scripts/tests/oil-stage5-failsmoke*.sh` demo fixtures (the permanent `oil-verify-{passmode,failmode}.sh` pair stays); throwaway test issues OIL-22/OIL-23 canceled. DEVPLAN Stage 5 → completed. |

## docs: OIL Stage 6 — document the loop + the scoped exception

| Type | Summary |
|---|---|
| docs | New `docs/oil-autofix.md` — full reference for the loop (end-to-end flow, components, safety model, triggering/testing, v1 limits). `CLAUDE.md`: add `oil-autofix-investigate.yml` + `oil-autofix-verify.yml` to the Workflows table, and a note that the OIL loop is the one sanctioned, verified, human-gated exception to "no auto-chain / no issue-based reporting". `docs/roadmap.md`: new "Phase G — OIL auto-fix loop (done)" + annotate the two "deliberately not building" bullets. Closes the development (DEVPLAN `status: completed`; Stage 7 deferred to its own `/dev-stage`). |
