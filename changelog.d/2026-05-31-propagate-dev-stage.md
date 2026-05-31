### Propagate full /dev-stage machinery to new systems

- **Stage 1 — system template: devplan SessionStart hook + CI gate wiring.** Added
  `templates/system/.claude/settings.json` registering a single `SessionStart` hook
  (`scripts/devplan-session-start-hook.sh`) so a new system re-orients on its active
  development plans, and wired a "Check devplan updated" step into the system template's
  existing "Changelog gates" job (`templates/system/.github/workflows/changelog-check.yml`)
  — so each new system enforces the devplan gate under the branch-protection context it
  already requires, with no branch-protection change.
