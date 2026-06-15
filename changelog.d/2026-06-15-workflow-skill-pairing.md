# Changelog fragment — workflow-skill-pairing (2026-06-15)

> Per-development changelog fragment. Folded into `CHANGELOG.md` with running Stage numbers by
> `scripts/compile-changelog.sh`.

## feat: every operable n8n workflow ships a paired Claude skill (capability card), gated by CI

| Type | Summary |
|---|---|
| feat | Every OPERABLE n8n workflow the factory provisions (`templates/system/workflows/n8n/<name>.json`) now ships a paired Claude skill at `templates/system/.claude/skills/<name>/SKILL.md` — the folder name is the `/<name>` slash command. Each is a **static "capability card"** (frontmatter `name`+`description` only, mirroring `operate-this-system`): a *map, not a manual* that routes a session to the live workflow via the `n8n-live`/`factory` MCP servers and `AGENTS.md`, and to the HITL `request_write_action` guardrail — never restating a live id or secret. 14 skills generated (the 5 agents, `agent-router`, `tg-inbound`, `tg-proactive`, `deep-research`, `github-readonly`, `railway-readonly`, `postgres-named-queries`, `mcp-server`, `request-write-action`). |
| feat | New `scripts/gen-workflow-skill.sh` authors the cards from a curated `name → purpose/trigger/keywords` table (deterministic: same table → byte-identical output → stable golden; re-run is a no-op diff). It is an authoring convenience, not a gate — a human may hand-tune any `SKILL.md` body. |
| feat | New CI gate `scripts/check-workflow-skill-pair.sh` fails any non-exempt workflow without a conformant paired skill (asserts the `SKILL.md` exists, frontmatter has `name`+`description`, and `name == folder == workflow`; name-charset + command-collision checks). Dual-tree via `WF_DIR`/`SKILL_DIR` (mimics the single-voice gate): wired into the factory's **Playground tests** over the mould and into each system's **pipeline-tests** over `workflows/n8n`. |
| feat | New `monitoring/workflow-skill-exempt.txt` lists the 10 pure-plumbing workflows + the `agents.manifest` non-workflow that deliberately get no card (crons, the error sink, `db-setup` one-shot, media sub-workflows, the HITL executor). Matched by **basename**, so the one factory-pathed list is authoritative in both the factory and a provisioned system. |
| feat | `provision-system.yml` ships the new gate script (in the portable `for sc` copy list) and the exempt file (like `e2e-surfaces.json`) into every new system, and adds `monitoring` to the scaffold commit — so each system is born self-describing and enforcing the pair. New skills auto-propagate via the existing unfiltered `.claude` copy (no copy change needed). |
| docs | `/build-agent` (Step 3) now requires generating the paired skill (or exempting) for a new agent workflow; `CLAUDE.md` Key-files + `templates/system/docs/CAPABILITIES.md` document the convention. Golden refreshed (`tests/golden/system/MANIFEST.sha256`, 131→144 files). Template-only + CI tooling; no runtime/n8n behavior change, no schema change, no new secret. |
