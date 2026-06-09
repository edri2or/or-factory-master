# Changelog fragment — reduce-actions-minutes (2026-06-09)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments are active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## fix: reduce-actions-minutes — cheap Actions-minute safety ceilings (Stage 1/3)

| Type | Summary |
|---|---|
| fix | Stage 1 of the reduce-actions-minutes development, opened after an investigation traced a surprise GitHub charge (677 ₪ ≈ $223.55) to the GitHub receipt's **$215.55 of GitHub Actions usage for May 2026** (+ $8 Team plan) — the 3,000 included minutes were exhausted by May 6, driven by the May consolidation sprint's ~70 throwaway `factory-test-*` provision+deploy cycles (several redeployed many times: `qmode` ×7, `tgbot` ×16). Adds three behavior-preserving guardrails so a heavy sprint can't silently blow the quota again: (1) explicit `timeout-minutes` ceilings on the two heaviest jobs — `provision-system.yml` job `provision` (30) and the system template `deploy-railway-cloudflare.yml` job `deploy` (45) — replacing GitHub's 6-hour default so a stuck run can't burn hours; (2) `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` on all nine per-PR CI gates (the 5 factory + 4 system-template `changelog-check`/`pipeline-tests`/`secret-scan`/`supply-chain-check`/`playground-tests`) so a new push cancels its own superseded run instead of letting both finish; (3) widened the two 6-hourly audits (`factory-health-audit`, `system-runtime-audit`) to daily — downtime is already caught sub-minute by Better Stack + the ~hourly `bs-incidents-to-telegram` relay, so the 6h cadence was a redundant heartbeat. System golden refreshed (`tests/golden/system/MANIFEST.sha256`) for the 5 template-workflow edits; no envsubst variables changed so the allow-list stays byte-identical. Behavioral proof (a live throwaway test-system provision+deploy inside the new ceilings) is Stage 3. An independent GitHub Actions spending limit was set by Or in parallel. |
