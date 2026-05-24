# Changelog archive — through 2026-05-24

Older `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).

## Stage 21 — provision/deploy: per-system Railway project token (parity with old factory)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Port edri2or/factory's Railway project-token step. `.github/workflows/provision-system.yml` adds `railway-project-token` to the `RUNTIME_SHELLS` array so the empty SM shell (and the existing `deploy-sa`/`runtime-sa` `secretAccessor` grants) is created at provision time — no new IAM, since `deploy-sa` already holds project-level `secretVersionManager`. `templates/system/.github/workflows/deploy-railway-cloudflare.yml` gains a `Create Railway project token (idempotent)` step between `Provision Railway` and `Configure Cloudflare DNS` (where `RAILWAY_TOKEN`/`PROJECT_ID_RW`/`ENV_ID` are already in `$GITHUB_ENV`): it mints a project-scoped token via the `projectTokenCreate(input:{projectId,environmentId,name:"github-actions"})` mutation using the account `railway-api-token` (Bearer), masks it, and stores it in the system SM as `railway-project-token`. Idempotent (skips if a version exists). Nothing in this repo consumes the token yet — it is created for parity / future use; a future consumer must read it with the `Project-Access-Token` header, not `Authorization: Bearer` (old-factory `docs/adr/184`). Existing deploy auth is unchanged. |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). Existing systems are not backfilled.

## Stage 20 — MCP: `dispatch_workflow` write tool (agent dispatches without a PAT)

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Add one WRITE tool, `dispatch_workflow`, to the factory MCP server (`services/mcp-server/`) so the agent triggers lifecycle workflows itself instead of an operator clicking "Run workflow" or curling the API with a temporary classic PAT (`$GITHUB_CLASSIC_TOKEN`). `github-client.ts` gains `dispatchWorkflow()` — POSTs `/actions/workflows/{file}/dispatches` via the existing `ghFetchRepo` (already mints the org-wide `factory-master-broker` App token, which has `actions:write` and is installed on all repos) — plus `getLatestWorkflowRun()` for the post-204 run-id lookback (the dispatch API returns 204 with no body). `tools.ts` registers `dispatch_workflow` gated on a hardcoded allowlist (`provision-system.yml`, `register-system-app.yml`, `deploy-railway-cloudflare.yml`); `decommission-system.yml` is intentionally excluded (destructive, written-approval-only). Works cross-repo (pass `repo`, e.g. `factory-test-24`) and returns `{run_id, run_url}`. No new secret / IAM / App-permission — the broker creds are already mounted by `deploy-mcp-server.yml`. `smoke.mjs` gains a side-effect-free check asserting a non-allowlisted id is refused. CLAUDE.md "How to work #3" + the Never list + the MCP table updated (the agent now dispatches via the allowlisted tool; watch-and-verify between stages still required). |

Redeploy via `deploy-mcp-server.yml` to take effect; MCP URL unchanged. Retires the env-var `$GITHUB_CLASSIC_TOKEN` dispatch path.

## Stage 19 — deploy-plane: single-redeploy env upsert + n8n HTTP readiness gate

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Two compounding fixes to `templates/system/.github/workflows/deploy-railway-cloudflare.yml` that made redeploys flaky — a deploy could fail at step 8 "Set up n8n owner account" with `GET /rest/settings` HTTP 404/403 and then pass on an immediate re-dispatch (observed on factory-test-23: run 26331335520 failed → 26331473093 passed). **(A) Collapse the env-var redeploy storm.** `_upsert` issued one Railway `variableUpsert` per variable and step 5 fired 15 in parallel for n8n + 5 for Postgres; the old comment claimed the parallel `&` fan-out "lands a single redeploy" — it does not, each `variableUpsert` triggers its own redeploy (proven: `list_railway_deployments` showed **12 n8n deployments created within ~4 s** on one run, 11 superseded). Replaced with `_upsert_collection` → one `variableCollectionUpsert` per service (all vars in a single `EnvironmentVariables` JSON map; schema verified by introspection: `VariableCollectionUpsertInput{projectId!,environmentId!,serviceId,variables!,replace,skipDeploys}`), so each service redeploys once instead of ~15×. Railway reference values (`${DLR}{{Postgres.X}}`) are preserved verbatim inside the jq map. **(B) HTTP readiness gate.** Step 7 only verifies the TLS cert (`_probe_tls_cn`), which does not imply the edge routes HTTP to a healthy n8n — after a redeploy the edge can return 404/403 ("Host not in allowlist") for minutes while the custom domain re-propagates, and step 8's single no-retry `curl /rest/settings` raced that window. Replaced with a bounded poll loop (36×10 s ≈ 6 min) that waits for HTTP 200 before proceeding, mirroring the cert-wait loop; still fails fast after the cap so a genuinely crash-looping n8n is not masked. The notifier (step 9) runs right after step 8, so it inherits the gate. |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). factory-test-23 gets the same two edits in its frozen copy so its own redeploys are reliable; other existing systems are not backfilled.

## Stage 18 — deploy-plane: idempotent n8n-owner-password (notifier login on redeploy)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Make `n8n-owner-password` idempotent in `templates/system/.github/workflows/deploy-railway-cloudflare.yml` (~line 124): reuse the existing SM `latest` version if present (mirroring the `n8n-owner-email` block just above it); only mint a fresh password when none exists. The old code minted a fresh password every run on the assumption it was "only consumed once at /rest/owner/setup" — true until Stage 15's notifier step began logging into n8n on every deploy. On a redeploy, step 8 skips owner-setup (`showSetupOnFirstLoad=false`) so n8n keeps the first-run password, while the notifier logs in with the freshly-minted one → `POST /rest/login` 401 (surfacing as a confusing `400 emailOrLdapLoginId Required` from the `email` fallback). Surfaced on factory-test-23 deploy run 26330453235, immediately after PR #47's `active:false` fix unmasked it (login is upstream of the workflow-create call that failed before). New systems are correct from first deploy; an existing system whose password already rotated needs a one-time SM resync (re-promote the owner-creation run's version to `latest`). |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). factory-test-23 gets the same fix in its frozen copy plus a one-time SM resync before re-dispatch; not auto-backfilled to other systems.

Stages 6-10 archived to `docs/changelog-archive/CHANGELOG-2026-05-22.md`; Stages 11-17 to `docs/changelog-archive/CHANGELOG-2026-05-23.md`.
