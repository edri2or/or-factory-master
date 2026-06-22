- **README in every agent-folder, baked into the factory (`agent-folder-readmes`).** Every new
  system the factory provisions is now born with a hybrid `README.md` in each agent-folder
  (`agents/<name>/`) — human prose (role + boundaries) plus a machine-managed metadata block,
  the same pattern proven in `or-aios`, adapted to the factory's YAML agent-folder format. New:
  `scripts/build-agent-readme.sh` regenerates the deterministic block (Intent / Architecture /
  Model / Temperature / Confidence threshold / Fallback / Tools) from `agent.yaml` + `tools.yaml`
  via `python3`+`pyyaml` (the same YAML→JSON bridge `check-agent-folder.sh`/`compile-agent.sh`
  use — the repo deliberately avoids `yq`), injecting it between the
  `<!-- BEGIN_AGENT_HOME -->`/`<!-- END_AGENT_HOME -->` markers and leaving the prose untouched;
  `scripts/check-agent-readme.sh` is a fail-closed CI gate (a structural twin of
  `check-agent-folder.sh`: same layout auto-detect, same no-op when there is no `agents/` dir)
  that fails if any agent's README is missing, lacks the marker pair, or its managed block drifted
  from the YAML. Authored the five READMEs (`templates/system/agents/{code,ops,infra,research,unknown}/README.md`)
  and a scaffold `templates/system/agents/_spec/README.template.md` for future agents. Wired the
  gate into the **Changelog gates** job of BOTH `.github/workflows/changelog-check.yml` (factory
  mould) and `templates/system/.github/workflows/changelog-check.yml` (every system), and shipped
  `build-agent-readme.sh` + `check-agent-readme.sh` into new systems via `provision-system.yml`'s
  portable check-scripts set — so each provisioned system enforces the same README-sync gate over
  its own `agents/`. Documented the README as a required agent-folder file in
  `agents/_spec/agent-folder.spec.md`. Refreshed the system golden (`tests/golden/system/`).
  CI/docs-only — it adds no new capability and changes nothing a running system executes (no
  `workflows/n8n/*.json` or `configure-agent-router.yml` touched; not behavior-bearing). The live
  proof is the Day-0 birth check: a freshly provisioned system carries the READMEs and its
  Changelog gates pass.
