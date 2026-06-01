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

### Propagation

Changes to `templates/system/**` propagate to NEW systems provisioned after this merge.
Existing systems receive the update via `refresh-system-agents.yml` (n8n workflows) +
a one-time env-var upsert for the pruning vars.
