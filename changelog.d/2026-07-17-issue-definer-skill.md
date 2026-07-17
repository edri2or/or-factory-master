## Issue Definer skill (`/issue-definer`, `/define`)

New `factory-only` slash-command that investigates and **defines** a problem
in a GitHub repo — read-only, and deliberately never proposes or hints at a
fix. Given a repo + a fault signal (error, log, description, screenshot), it
reads the repo, researches the web, pinpoints the root cause, and emits a
4-field Hebrew problem definition (`בעיה / היכן / הקשר / ממצאי מחקר`) written
for a *later* agent (Claude Code, the OIL loop) to act on.

**Changes:**
- `.claude/commands/issue-definer.md` (new): the skill. Tagged
  `audience: factory-only` — it routes to the factory org-read tools
  (`mcp__factory__get_file_contents`, `search_code`, `list_issues`,
  `list_commits`, …) that read across `edri2or/*` and don't exist in
  provisioned systems, so it is not shipped to systems.

Tool routing adapts to this repo: local checkout → `Read`/`Grep`/`Glob`;
`edri2or/*` → `mcp__factory__*`; `or-factory-master` → `mcp__factory__*` or
`mcp__github__*`; external repos → `WebFetch`/`WebSearch` or `add_repo`.

The `templates/system/.claude/commands/` mirror is unchanged (factory-only is
excluded by `scripts/sync-skills-mirror.sh`); `scripts/check-skills-mirror.sh`
passes with the file counted among factory-only.
