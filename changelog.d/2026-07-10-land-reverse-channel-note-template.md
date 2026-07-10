## feat(template): land `docs/reverse-channel-note.md` into the system template (real promote)

| Type | Summary |
|---|---|
| feat | Adds `templates/system/docs/reverse-channel-note.md` so every **future** provisioned system is born with the reverse-channel explainer — the real landing of the doc or-aios promoted (docs-only, not behavior-bearing → no `or-edri-4` E2E proof needed, like #577). This is the same doc + golden refresh the `promote` channel produces (proven live in #583/#586); it was landed via a direct factory PR because a fresh promote request within 24h **deduped** onto the still-open earlier promote Linear ticket (`sha256("system.request.promote::or-aios")`) and so never generated a new approval card. Golden refreshed (192 → 193 rendered). Follow-up worth doing: the promote fulfiller should resolve/close its Linear ticket on completion (or the MCP triage should ignore already-fulfilled dedup hits) so back-to-back promotes each get a card. |
