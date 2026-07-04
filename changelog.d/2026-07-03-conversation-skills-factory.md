### Bring `conversation-handoff` + `conversation-continuity` skills into the factory

- The two conversation skills that lived only in the `or-aios` system repo are now in the factory
  in two places: the factory's own `.claude/skills/` (so they auto-surface in factory sessions —
  the repo's first root `.claude/skills/` directory), and `templates/system/.claude/skills/` so
  **every newly provisioned system is born with them** (`provision-system.yml` already copies the
  whole `.claude/` tree — no workflow change needed).
- They are a complementary pair: `conversation-continuity` keeps a verification-gated context-file
  consistent *within* a conversation; `conversation-handoff` packages the conversation *out* as a
  focused briefing for the next chat/agent. Copied byte-identical from the `or-aios` source; both
  are self-contained single-`SKILL.md` skills (`name:` + `description:` frontmatter, no supporting
  files, no template tokens).
- `.claude/skills/` is not governed by the `.claude/commands/` audience-mirror (no `audience:` tag
  needed), and the workflow↔skill pairing gate is workflow→skill only, so two skills with no
  matching n8n workflow do not trip it. The golden was refreshed (`check-system-golden.sh --update`)
  for the two new `templates/system/**` entries.
