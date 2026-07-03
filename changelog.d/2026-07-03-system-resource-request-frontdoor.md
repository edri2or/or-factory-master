## system resource-request front door — a `/request-factory-resource` command

A provisioned system could already **ask** the factory to open a permission (the
proven `system.request.secret|iam` → Linear → MCP triage → Telegram ✅ → broker
channel, `docs/system-resource-requests.md`), but the system side was
documentation-only: a session inside a system had no discoverable way to raise
the request — the agent had to hand-craft the `emit-event.sh` call.

New shared slash-command **`/request-factory-resource`**
(`.claude/commands/request-factory-resource.md`, `audience: shared`) is that
missing front door. From inside a factory-provisioned system, Or asks in plain
Hebrew ("צור סוד", "פתח הרשאה", "בקש מהפקטורי") and the command: gathers the
request (`secret` id or one `iam` role + a reason), **pre-validates it locally
against the exact broker gate** (`scripts/validate-system-request.sh` — the safe-id
regex, the super-credential/privileged-keyword refusals, the 8-role IAM
allowlist) so a doomed request is never sent, emits the `system.request.*` event
keyed to the system's own project (`EMIT_SM_PROJECT`), and tells Or a Telegram
approval card is on the way. **Nothing is created without Or's ✅** — the command
only asks; the broker fulfills after approval.

Ships into every newly-provisioned system automatically (it's in the
`audience: shared` mirror `templates/system/.claude/commands/`, byte-identical via
`scripts/sync-skills-mirror.sh`; the system golden `tests/golden/system/` is
refreshed). Existing systems are back-filled in place via `refresh-system-agents.yml`
with `paths=.claude/commands/request-factory-resource.md` (no re-provision, no
n8n reimport, no e2e proof — a command file is not a bot-behavior artifact).

Docs: `docs/system-resource-requests.md` updated — the "system side is
documentation-only" limitation is replaced with the command as the system-side
entry point.
