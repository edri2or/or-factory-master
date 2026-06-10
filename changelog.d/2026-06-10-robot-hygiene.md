## fix: devplan gate exempts oil-autofix/* branches (follow-up #9)

| Type | Summary |
|---|---|
| fix | `scripts/check-devplan-updated.sh` now skips (PASS) when the branch is `oil-autofix/*` (read from `GITHUB_HEAD_REF`, falling back to `GITHUB_REF_NAME`). OIL auto-fix PRs are automated, safety-gated fixes — not dev stages — so they correctly never touch a devplan and must not be blocked by the devplan gate even while a development is active (this is how OIL-49 stalled this morning). No workflow change needed (both are GitHub default env vars). New `check-devplan-updated.bats` tests prove the exemption via both env vars plus a hermetic `setup()`; fail-before/pass-after demonstrated. |
