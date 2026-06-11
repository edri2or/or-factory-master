# Changelog fragment — adopt-deploy-caddy-edge (2026-06-11)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## fix: adopt-mode real systems no longer skip the Caddy HMAC edge

| Type | Summary |
|---|---|
| fix | The system deploy's "Detect throwaway test system (skip HMAC edge)" step matched `GCP_PROJECT_ID` against the broad prefix set `factory-test-*` / `v2-test-*` / `or-test-*`. The assumption — "a real system's project never has that prefix" — is **false for adopt mode**: adopt recovers a soft-deleted *test-named* project (e.g. `factory-test-21`) for a REAL system, so every adopt-mode real system was wrongly classified as throwaway and **silently shipped without its Caddy gateway** (no edge HMAC verification / per-IP rate-limit; n8n kept the public domain). Surfaced live on `or-edri-4` (real system on `factory-test-21`). Fix: skip the edge for **exactly `factory-test-25`** — the single shared reuse backend that every reuse/test system deploys onto (and the only project adopt mode hard-refuses). Normal real systems (project == system_name) and adopt-mode real systems (recovered test-named project) now both keep the Caddy edge; genuine reuse/test systems on `factory-test-25` still skip it. `templates/system/.github/workflows/deploy-railway-cloudflare.yml` + the system golden (`tests/golden/system/MANIFEST.sha256`) refreshed in lock-step. Propagates to systems provisioned after this change; existing real systems get it by re-running their deploy with the synced template. |
