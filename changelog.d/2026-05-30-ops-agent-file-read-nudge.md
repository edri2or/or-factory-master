# Changelog fragment — ops-agent-file-read-nudge (2026-05-30)

> Per-development changelog fragment. Folded into `CHANGELOG.md` by `scripts/compile-changelog.sh`.

## fix: nudge ops/unknown agents to use read_file for "what's in <file>" questions

| Type | Summary |
|---|---|
| fix | Live test on `factory-test-026` showed the tool-awareness + read_file work landed (the bot now correctly *advertises* GitHub/file/Railway read access), but a casually-phrased "what's in AGENT.md?" still drew a generic "I can't access files from disk" refusal — the model didn't map the repo-file question to the `read_file:<path>` command (confirmed in n8n: that question's agent run never invoked `github_readonly`). Strengthened the systemMessage of both `ops-agent.json` and `unknown-agent.json` (`templates/system/workflows/n8n/`) with an explicit instruction: when the user asks what a file contains or to read/show/open any file (AGENT.md, README, a workflow JSON, any repo path), that is a REPO file — call `github_readonly` with `read_file:<path>`; never reply that you cannot read files (you only lack arbitrary local-disk access outside the repo). Also added `read_file` to the ops-agent's in-prose tool summary. Prompt-only tuning — no code/flow change; both JSONs remain `jq`-valid. Template-only; LLM tool-selection behaviour to be confirmed on the next fresh test system. |
