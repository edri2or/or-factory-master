# Changelog archive — through 2026-05-28

Older `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).

## Stage 99 — fix: db-setup `/run` body also needs `destinationNode` (n8n partial-execution flow)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Stage 98 fixed `body.workflowData.id` but live verification on `factory-test-tgbot5` then surfaced the next layer: n8n 1.121 returned `HTTP 500 — "a destinationNodeName is required for the new partial execution flow"`. The recent `executeManually` flow requires the body to name the node to execute up to, in addition to `startNodes`. Fix: add `destinationNode: "Create Tables"` (the only data node in `db-setup.json`) to the run body — n8n then runs the full chain `Run Once → Create Tables`. PR 1's `db-setup.json` template is unchanged. Still soft-fail; `n8n_chat_histories` still auto-created by the memory node either way. |

## Stage 98 — fix: db-setup `/rest/workflows/:id/run` body must include workflowData + id

| PR | Type | Summary |
|---|---|---|
| TBD | fix | After Stage 97 unblocked the Postgres credential creation, the live verification on `factory-test-tgbot4` exposed the next layer: `configure-agent-router.yml`'s db-setup auto-run POSTed `{}` to `/rest/workflows/${id}/run` and n8n returned `HTTP 500 — Cannot read properties of undefined (reading 'id')`. n8n's manual-run controller (`packages/cli/src/workflows/workflows.controller.ts`, v1.121) reads `req.body.workflowData.id` and tampering-checks it against the URL param; an empty body is unhandled. There is no Public-API equivalent in 1.121 (PR #20234 was closed). Fix: build the run body from the prepped workflow JSON we already have on disk, injecting the id from the upsert response: `{workflowData: ($wf[0] + {id:$id}), runData:{}, startNodes:[{name:"Run Once", sourceData:null}]}`. Still soft-fail (a non-2xx leaves a Hebrew WARN; `n8n_chat_histories` is still auto-created by the memoryPostgresChat node on first chat). PR 1's `db-setup` workflow is otherwise unchanged. Validated on the n8n source (cited in the commit/PR body). |

## Stage 97 — fix: configure-agent-router Railway GraphQL helper dropped its variables (brace-expansion bug)

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Live verification of PR 1/2 (`factory-test-tgbot3`) surfaced that the new Postgres wiring silently skipped: configure logged "could not read POSTGRES_PASSWORD/RAILWAY_PRIVATE_DOMAIN from Railway" and unknown-agent fell back to in-memory window. Root cause: the `_rwgql` helper built its request body with `--argjson v "${2:-{}}"` — bash brace-counting in `${param:-default}` consumes the parameter-expansion's closing brace into the literal `{}` default, appending a **stray `}`** to the variables JSON (`{"pid":"…"}}`), so `jq --argjson` rejected it and every Railway GraphQL call got an empty/malformed body (env-id never resolved → variables never read). This is the exact pitfall `deploy-railway-cloudflare.yml`'s `_gql` documents and avoids. Fix: `_rwgql` now uses an explicit `local v="${2:-}"; [ -n "$v" ] || v='{}'` (proven locally: buggy form → `jq: invalid JSON`, fixed form → well-formed body). The token was never the issue — the deploy writes these same variables with `railway-api-token`, so it can read them. No behaviour change for systems without Postgres (still soft-fall back). Only `configure-agent-router.yml` changed. |

## Stage 96 — feat: Phase F follow-up PR 2/5 — persistent Postgres chat memory

| PR | Type | Summary |
|---|---|---|
| TBD | feature | unknown-agent's conversation memory switches from in-memory **Window Buffer** (wiped on every n8n restart) to **Postgres Chat Memory** (`@n8n/n8n-nodes-langchain.memoryPostgresChat`, session key `tg:<chat_id>`, table `n8n_chat_histories` — auto-created by the node, and also pre-created by PR 1's `db-setup`), using the `Postgres (n8n)` credential wired in PR 1. `configure-agent-router.yml` now substitutes `@@CRED_POSTGRES_ID@@` in the sub-agent install. **Graceful degradation:** if no Postgres credential was wired (PR 1's Railway fetch failed), configure rewrites unknown-agent's memory node back to the in-memory window via `jq` so the chat bot keeps working rather than pointing at an empty credential. No other workflow changed; `agent-router.json` + `tests/router_battery.yaml` untouched. Verified together with PR 1 on a live test system (next batch). |

## Stage 95 — feat: Phase F follow-up PR 1/5 — per-system Postgres credential + table bootstrap

| PR | Type | Summary |
|---|---|---|
| TBD | feature | First of 5 deferred Phase F follow-ups (persistent memory / style / proactive / dedup all need Postgres). The system's Postgres is Railway-private and its password is never in SM, so `configure-agent-router.yml` now fetches the password + private host from Railway's GraphQL API (via this system's own `railway-api-token` + `railway-project-id` + `railway-postgres-service-id`), builds the n8n `Postgres (n8n)` credential (idempotent find-by-name; type `postgres`; `ssl:disable`, matching how n8n itself connects over the private net), and installs + runs once a new `templates/system/workflows/n8n/db-setup.json` (manual trigger → one Postgres node of `CREATE TABLE IF NOT EXISTS` for `n8n_chat_histories`, `style_profile`, `audit_log`, `spend_log`, `tg_updates_seen`, `pending_actions`, `events` + indexes). The DDL runs from inside n8n (the only component that can reach the private Postgres); the one-shot run uses `/rest/workflows/{id}/run` (Caddy permits `/rest/*`; `/webhook/*` is HMAC-gated). Additive + soft-fail: any Railway/PG miss skips Postgres features but leaves the router + chat bot fully working. No change to `deploy-railway-cloudflare.yml` (at the 128 KiB cap) or `provision-system.yml` (it already `cp -r`s the whole `workflows/` dir, so `db-setup.json` ships automatically). `agent-router.json` untouched. Stages 83–88 rotated to the changelog archive. |

---

Template edit reaches newly-provisioned systems only (per CLAUDE.md).
