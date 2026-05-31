### Propagate full /dev-stage machinery to new systems

- **Stage 1 — system template: devplan SessionStart hook + CI gate wiring.** Added
  `templates/system/.claude/settings.json` registering a single `SessionStart` hook
  (`scripts/devplan-session-start-hook.sh`) so a new system re-orients on its active
  development plans, and wired a "Check devplan updated" step into the system template's
  existing "Changelog gates" job (`templates/system/.github/workflows/changelog-check.yml`)
  — so each new system enforces the devplan gate under the branch-protection context it
  already requires, with no branch-protection change.
- **Stage 2 — provision-system.yml ships the machinery.** The scaffold step now copies
  `scripts/check-devplan-updated.sh` + `scripts/devplan-session-start-hook.sh` (the hook
  made executable) into each new system repo, seeds `templates/devplan/DEVPLAN.template.md`
  (single source of truth — the same template the factory uses) so the system's own
  `/dev-stage` can instantiate `devplans/<slug>.md`, adds `templates` to the scaffold
  `git add`, and refreshes the PASS summary (now 11 portable scripts + settings.json +
  devplan template seed).
- **Stage 3 — docs.** Added a "Development workflow (`/dev-stage`)" discovery section to
  `templates/system/AGENTS.md.template` so a system's agent knows the staged-development
  workflow is available locally, and corrected the factory `CLAUDE.md` (the "factory-internal
  — not propagated" note, plus the provision Governance row) to reflect that the full
  machinery now ships to systems provisioned after this change.
