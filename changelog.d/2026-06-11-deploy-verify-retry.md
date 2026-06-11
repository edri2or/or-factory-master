# Changelog fragment — deploy-verify-retry (2026-06-11)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## fix: deploy gateway-verify retries `/healthz` after the Caddy domain swap (no more false-fail race)

| Type | Summary |
|---|---|
| fix | The deploy's "Verify gateway end-to-end + summary (Phase D PR 3)" step probed `/healthz` through Caddy **once**, **immediately** after migrating the public domain onto Caddy — before Caddy's first Railway rollout starts serving — so it raced the swap, got `404`, and failed an otherwise-successful deploy (observed on `or-edri-4`'s first Caddy deploy: domain migrated + HMAC gate live, but the verify step false-failed; emitted `factory.deploy.failed` and skipped "Persist Railway IDs to SM"). Fix: wrap the `/healthz`-via-Caddy probe in a 12×10s retry loop (break on 200), reusing the deploy's existing propagation-retry idiom (cert-wait step). The webhook 401/HMAC checks in the same step run only after `/healthz` passes, so the one retry fixes the whole step. Byte-identical steady state — when Caddy is already serving (re-runs, non-adopt deploys) the first probe returns 200 and the loop breaks immediately, adding no delay. `templates/system/.github/workflows/deploy-railway-cloudflare.yml` + system golden (`tests/golden/system/MANIFEST.sha256`) refreshed in lock-step. Propagates to systems provisioned after this change; existing systems pick it up on their next deploy with the synced template. |
