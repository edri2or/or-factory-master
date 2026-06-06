## docs: system resource-request channel — document + close the development

| Type | Summary |
|---|---|
| docs | New `docs/system-resource-requests.md` — full reference for the system → broker resource-request channel (why it exists, v1 `secret`/`iam` types, end-to-end flow, components, security invariants, known v1 limits, and the live-proof record). Pointer added to `CLAUDE.md` (Key files). Closes the development (`devplans/system-resource-request-channel.md` → `status: completed`). The channel was proven live end-to-end on the real `tokile` system (project `factory-test-18`): success path created a secret shell after Or's Telegram ✅; refusal path blocked a forbidden super-credential at the gate with no card sent. |
