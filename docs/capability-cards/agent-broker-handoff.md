# Capability Card — agent-broker-handoff

> Capability-first Phase-1 proof for the **agent-repo** product-type's load-bearing brick:
> a central broker (or-factory-master) dispatches a unit of work to a *worker* agent-repo,
> the worker runs **Claude Code headless (read-only)** on the task, and the result returns
> to the *requester* — through the broker, with **no standing secret in the worker** and
> never agent→agent direct.
> NOTE: this is a factory **GitHub Actions** capability, not an n8n mould workflow, so
> `scripts/check-capability-card.sh` (which scans `templates/system/workflows/n8n/`) does
> **not** gate it. This card is the recorded go/no-go evidence per the capability-first
> *process* rule in `CLAUDE.md`, not a CI artifact. It is the **live proof for the
> agent-repo product-type** — the analog of `e2e-verify` for n8n systems, which does not
> apply here (an agent-repo has no inbound-Telegram path; verified: no enforced surface in
> `e2e-surfaces.json` matches `templates/agent-repo/**`).

| יכולת (capability) | הוכחה גולמית (tool + command, מחוץ לאבסטרקציה) | fixture אמיתי | פלט מצופה | הכרעה | סיכונים / הנחות |
|---|---|---|---|---|---|
| Broker dispatches a work unit to a worker agent-repo, the worker runs **Claude Code headless read-only**, and the result returns to the requester's tracking issue — broker-mediated, worker holds no standing secret | `gh workflow run agent-action.yml` (broker, `workflow_dispatch`) → scoped App token (`generate-app-token.sh`, single-repo, `contents:read,actions:write`) dispatches the worker's `agent-main.yml` → worker runs `anthropics/claude-code-action@v1 --allowedTools Read,Grep,Glob` → broker polls the run, downloads the `agent-result` artifact, posts it to the requester issue | two `zz-` spike repos: `zz-agentskel-requester` (tracking issue with a real "summarize/analyze X" task) + `zz-agentskel-worker` (seeded `agent-main.yml`) | The requester's tracking issue shows the worker's Claude-produced JSON result, keyed by `correlation_id` | pending | (1) The worker must read `anthropic-api-key` from control SM at run time only (WIF, `::add-mask::`) and make **no** outbound write — its only output is an uploaded artifact. (2) Cross-repo reach is a fresh per-request token scoped to ONE repo with minimal permissions. (3) The skeleton uses `phase=execute`; risk-classify + RED Telegram approval land in Stage 4. |

verdict: pending

## GO criteria (declare `go` iff ALL hold — filled live in Stage 1)

1. The requester's tracking issue shows the worker's Claude-produced result text.
2. The worker repo held **no** standing secret (only the run-time masked `anthropic-api-key`) and made **no** outbound network write — confirmed from its workflow file + run logs.
3. All four `factory.agent_action.{started,dispatched,completed,failed}` events appear in Axiom for the run.
4. Every cross-repo reach used a distinct, minimal, single-repo-scoped token (verified in logs: distinct mint calls, single-repo arrays, least permissions).

A **no-go / partial** verdict stops the build and re-scopes (the capability-first feasibility gate).

## Evidence

_(to be filled in Stage 1 from the live run — run id, the requester-issue comment link, the worker run conclusion, the Axiom events, and the per-request token mints.)_
