## Voice-to-Text עברית — Telegram → Deepgram Nova-3

Every system the factory provisions now handles Hebrew voice notes from Telegram. When a
user sends a voice message to the bot, n8n downloads the OGG file, sends it to
Deepgram Nova-3 for Hebrew transcription, and delivers the text to the agent as if it
had been typed.

### Changes

**New n8n workflow templates:**
- `tg-voice-stt.json` — sub-workflow (5 nodes): receives a `file_id`, downloads the
  audio from Telegram, sends it to Deepgram Nova-3 (`model=nova-3&language=he`), and
  returns the transcript text.
- `db-vacuum.json` — weekly scheduled `VACUUM ANALYZE` on the n8n Postgres database to
  prevent binary-audio execution history from bloating the DB.

**tg-inbound.json:** voice detection added to Extract & Normalize (reads
`msg.voice.file_id` + `msg.voice.duration`); guard updated to allow voice-only messages;
Route Update gets a new `voice` rule; two new nodes `Prep Voice Input` (Set) and
`Call tg-voice-stt` (executeWorkflow) route voice through the STT sub-workflow before
reaching the agent; Call Agent Router jsonBody updated to accept transcript from either
path.

**configure-agent-router.yml:** creates a Deepgram `httpHeaderAuth` credential from
`deepgram-api-key` in Secret Manager; imports `tg-voice-stt` (inactive sub-workflow) and
`db-vacuum` (active, scheduled); substitutes `@@WF_TG_VOICE_STT_ID@@` into tg-inbound
before upsert; graceful degradation — if `deepgram-api-key` is absent the voice branch
is stripped from tg-inbound so the system starts without it.

**deploy-railway-cloudflare.yml:** added `EXECUTIONS_DATA_PRUNE=true`,
`EXECUTIONS_DATA_MAX_AGE=48`, `EXECUTIONS_DATA_PRUNE_MAX_COUNT=1000` to prevent n8n
Postgres from accumulating large binary execution payloads.

### Fix — Deepgram credential POST used an undefined variable (live-test catch)

The stage-6 live test (on a throwaway test system) surfaced a real bug in the stage-3
code: the Deepgram credential creation block in `configure-agent-router.yml` POSTed to
`${N8N_BASE}/rest/credentials` — a variable that is never defined (the step uses `$BASE`).
Under `set -u` this aborted the whole "Create Agent Router" step with
`N8N_BASE: unbound variable`, so no n8n workflows were imported. The block also deviated
from every sibling credential by using a raw `curl` with `X-N8N-API-KEY` header auth
against a `/rest/` endpoint (which authenticates by session cookie, not API key). Fixed by
routing the POST through the shared `_napi POST "$BASE/rest/credentials"` helper — identical
to the Tavily/Railway/Postgres credential blocks — which both resolves the unbound variable
and uses the proven cookie-auth + curl-level retry path. Golden refreshed.

### Propagation

Changes to `templates/system/**` propagate to NEW systems provisioned after this merge.
Existing systems receive the update via `refresh-system-agents.yml` (n8n workflows) +
a one-time env-var upsert for the pruning vars.
