## language-boundary-hook-factory — every new system is born with the language-boundary reminder

Propagated the **language-boundary SessionStart hook** into the factory template, so every
system provisioned from now on is born knowing the rule up front — **English internally,
Hebrew only at the edge Or sees** — instead of discovering it only when a skill happens to
trigger. Modeled on the sibling `capability-session-start-hook.sh`.

- New `scripts/language-session-start-hook.sh` (factory root): read-only, self-guarding
  (`trap 'exit 0' EXIT`, no `set -e`), prints the `[language-boundary]` orientation only when
  `docs/language-boundary.md` or `AGENTS.md` is present. Carries the A/B/C/D categories, the
  "Number 1 is the edge, not each specialist" rule, and "if Or dictates in Hebrew, write it in
  English and give HIM the answer in Hebrew".
- New generic policy doc `templates/system/docs/language-boundary.md`, shipped to every system
  beside `docs/CAPABILITIES.md` — a system-agnostic version of the boundary policy (no
  per-system paths or identifiers). The hook's authoritative-source line points at it.
- Registered the hook as the third `SessionStart` command in
  `templates/system/.claude/settings.json`.
- `provision-system.yml`: added `language-session-start-hook` to the hook-ship list + a
  matching `chmod +x`, and `templates/system/docs/language-boundary.md` to the doc-ship loop.
- Refreshed the system golden (`tests/golden/system/`) for the new doc + the settings.json
  change.

Template-only: existing systems are not back-filled (edits here reach systems provisioned
after this change). The factory's own `.claude/settings.json` is intentionally untouched — this
is a shipped-to-systems artifact, not a factory-session hook.
