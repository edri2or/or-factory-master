# Changelog archive — through 2026-05-26

Older `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).

## Stage 48 — ops: audit emits per-key classification to stdout

| PR | Type | Summary |
|---|---|---|
| TBD | chore | `audit-openrouter-orphan-keys.yml`: the per-key classification table was only written to `$GITHUB_STEP_SUMMARY`, which GitHub exposes via no REST API — so the full result couldn't be read back from a finished run (only the aggregate counts were on stdout). Added a per-key `echo` to stdout (status, name, hash prefix, created, project, disabled, action) plus a `BREAKDOWN:` line carrying all five counts (live/orphan/stale/uncertain/total), so the complete audit is recoverable from the run logs. Also reset `GCP_PROJECT_ID` at the top of each loop iteration so the log line never reports a stale project for an orphan key. No classification or deletion behavior changed. |

## Stage 47 — ops: daily OpenRouter orphan-key audit

| PR | Type | Summary |
|---|---|---|
| TBD | feature | New `.github/workflows/audit-openrouter-orphan-keys.yml`: runs daily at 06:00 UTC (dry-run; reports only) and on manual dispatch (with `dry_run=false`+`confirm=DELETE` for real cleanup). Lists all OpenRouter keys via the management key, classifies each as **Live** (repo exists + SM hash matches), **Orphan** (no repo), **Stale** (repo exists but SM hash mismatch — leftover from a reuse-mode re-provision), or **Uncertain** (can't read SM hash — broker SA not yet granted access on pre-Stage-47 systems). Renders a table in the job summary; Telegram notification when issues are found. Deletion is opt-in via manual dispatch only (scheduled runs are always read-only). |
| TBD | fix | `provision-system.yml` "Mint per-system OpenRouter inference key" step: after storing `openrouter-key-hash`, now also grants `roles/secretmanager.secretAccessor` to the broker SA (`factory-master-broker@or-factory-master-control`) on that secret — enabling the audit workflow to do hash reconciliation for systems provisioned going forward. Pre-Stage-47 systems remain Uncertain until re-provisioned or manually backfilled. |

## Stage 46 — deploy: patient TLS-cert wait fixes the recurring first-deploy failure

| PR | Type | Summary |
|---|---|---|
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the first deploy of a new system almost always failed at "Wait for Railway TLS cert" (step 8), needing a manual re-dispatch (4 of 6 first-deploys this session). Root cause (from `factory-test-40`'s failed step-8 log): the cert needs ~8-15 min on a stable domain, but the step polled only 5 min then **recreated the customDomain** — which changes the CNAME target and **resets verification progress**, and whose `customDomainCreate` itself intermittently returns Railway `INTERNAL_SERVER_ERROR` (500), killing the step (seen on test-36 + test-40). Replaced the symmetric `2×5min + recreate-between` loop with a **patient ~15-min poll on the stable domain (no recreate)**, falling back to **one last-resort recreate (+~8-min poll)** only if that fails; and **guarded `_recreate_custom_domain`'s `customDomainCreate` with a 6× retry** on the flaky 500 (returns instead of `exit 1`). Wall-clock cap ~23 min. Most first-deploys should now pass without a manual retry. |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).

## Stage 45 — feat: bundle the gcp-hands-client skill into every scaffolded system

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Vendor `templates/system/.claude/skills/gcp-hands-client/{SKILL.md,README.md}` (byte-identical to `edri2or/gcp-hands@main`); `provision-system.yml` now scaffolds the whole `.claude` tree (commands + skills) so each new repo can dispatch GCP ops to `edri2or/gcp-hands` out of the box. Cross-repo dispatch-token requirement is documented in the vendored README (per-system App stays single-repo), not provisioned. Periodic re-sync deferred (gcp-hands PLAN.md "SKILL.md drift"). |

Template edit reaches newly-provisioned systems only (per CLAUDE.md).
