# Changelog archive — through 2026-05-26

Older `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).

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
