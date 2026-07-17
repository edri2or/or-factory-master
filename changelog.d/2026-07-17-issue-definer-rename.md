## Rename Issue Definer skill → `/issue-definer-factory`

Renamed the `factory-only` slash-command added in the previous change from
`issue-definer` to `issue-definer-factory` (Or's request). A command's
invocable name is its filename basename, so the skill is now
`/issue-definer-factory`.

**Changes:**
- `.claude/commands/issue-definer.md` → `.claude/commands/issue-definer-factory.md`
  (renamed; H1 updated to "Issue Definer (Factory)"). Body, `audience: factory-only`
  tag, and tool routing unchanged.

Mirror unchanged (factory-only stays excluded); `scripts/check-skills-mirror.sh`
passes.
