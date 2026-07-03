## system resource-request front door — `/request-factory-resource` command + per-system workflow

A provisioned system could already **ask** the factory to open a permission (the
proven `system.request.secret|iam` → Linear → MCP triage → Telegram ✅ → broker
channel, `docs/system-resource-requests.md`), but the system side was
documentation-only: a session inside a system had no discoverable way to raise
the request.

New shared slash-command **`/request-factory-resource`**
(`.claude/commands/request-factory-resource.md`, `audience: shared`) is that front
door. From inside a factory-provisioned system, Or asks in plain Hebrew ("צור סוד",
"פתח הרשאה", "בקש מהפקטורי"); the command gathers the request (`secret` id or one
`iam` role + a reason), **pre-validates it locally against the exact broker gate**
(`scripts/validate-system-request.sh` — safe-id regex, super-credential /
privileged-keyword refusals, 8-role IAM allowlist), and raises it. **Nothing is
created without Or's ✅.**

**Why a companion workflow (learned from a live proof on `or-edri-4`):** raising the
request means running `emit-event.sh`, which reads the system's Secret Manager
(Linear/Telegram keys) — a read that needs GCP credentials. An interactive Claude
Code session has none (WIF works only inside GitHub Actions), so the first cut
(command runs the emitter directly) silently no-opped from a session. The command
therefore **dispatches a new per-system workflow**
**`templates/system/.github/workflows/request-factory-resource.yml`** (WIF as the
system's `deploy-sa`) that runs the emitter in a permissioned environment.
Dispatching a workflow is a plain GitHub call a session can make; the privileged
emit happens in Actions.

Both artifacts ship into every newly-provisioned system automatically (the command
via the `audience: shared` mirror `templates/system/.claude/commands/`, byte-identical
via `scripts/sync-skills-mirror.sh`; the workflow lives under `templates/system/`;
the system golden `tests/golden/system/` is refreshed). Existing systems are
back-filled in place via `refresh-system-agents.yml` with
`paths=".github/workflows/request-factory-resource.yml,.claude/commands/request-factory-resource.md"`
(no re-provision, no n8n reimport, no e2e proof — neither artifact is a bot-behavior
change).

Docs: `docs/system-resource-requests.md` updated — the "system side is
documentation-only" limitation is replaced with the command + workflow as the
system-side entry point, including why the workflow indirection is required.
