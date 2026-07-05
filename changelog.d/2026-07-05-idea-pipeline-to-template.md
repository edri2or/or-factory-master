# Changelog fragment — idea-pipeline-to-template (2026-07-05)

> Per-development changelog fragment (date + slug ⇒ collision-free), written here instead of
> the head of `CHANGELOG.md` because other developments may be active in parallel. Folded into
> `CHANGELOG.md` with running Stage numbers by `scripts/compile-changelog.sh`.

## feat: idea-pipeline-to-template — every future system born with Or's idea-pipeline (core / light path)

| Type | Summary |
|---|---|
| feat | Back-ports Or's idea-pipeline into the system template so every future provisioned system inherits it (it was absent from the factory entirely — added to or-aios out-of-band, proven live there, now merged in or-aios PRs #373/#374/#375). Adds the three session skills `templates/system/.claude/skills/{raw-input-collection,inbox-organizer,backlog-picker}/SKILL.md` (byte-identical copies of the merged or-aios versions — carrying the parallelizability axis, the `completed` card lifecycle, and the auto re-organize on close-out) — they ride the wholesale `.claude/` copy in `provision-system.yml`. Ships `templates/system/docs/idea-pipeline.md` and wires it into provisioning's docs cherry-pick loop (one new pair line). Adds the "Idea-pipeline close-out" block to `.claude/commands/dev-stage.md` Step 5 (mark card `completed` → archive devplan → append `inbox/completed.md` → re-run `inbox-organizer` so `backlog.md` stays current) and re-synced the shared-command mirror. Golden refreshed (`tests/golden/system/MANIFEST.sha256`). **Scope:** the light path (capture→organize→pick→build→close-out) — all its command deps (`dev-stage`, `dev-status`, `process-card`) were already in the template. The research on-ramp (`aios-research-partner` / `handoffs-dev-stage`) is deferred until it stabilizes (it is or-aios backlog item #1). No `inbox/` scaffold shipped — the skills create it on first use. Not a behavior-bearing change (no n8n/Caddy/deploy surface) → no `or-edri-4` E2E proof required; or-aios is the live proof. Gates run green locally: `check-system-golden.sh` (verify), `check-skills-mirror.sh`. |
