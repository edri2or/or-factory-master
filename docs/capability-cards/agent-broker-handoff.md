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
| Broker dispatches a work unit to a worker agent-repo, the worker runs **Claude Code headless read-only**, and the result returns to the requester repo — broker-mediated, worker holds no standing secret | `gh workflow run agent-action.yml` (broker, `workflow_dispatch`) → scoped App token (`generate-app-token.sh`, single-repo `actions:write`) dispatches the worker's `agent-main.yml` → worker runs `anthropics/claude-code-action@v1 --allowedTools Read,Grep,Glob` → broker polls the run, downloads the `agent-result` artifact, commits it to the requester (single-repo `contents:write`) | two `zz-` spike repos: `zz-agentskel-requester` (receives the result) + `zz-agentskel-worker` (seeded `agent-main.yml`); the task is handed to the broker as input | `results/<correlation_id>.json` committed to the requester repo holds the worker's Claude-produced JSON answer | pending | (1) The worker reads `anthropic-api-key` at run time only (WIF, `::add-mask::`) and makes **no** outbound write — its only output is the uploaded artifact. (2) Cross-repo reach is a fresh per-request token scoped to ONE repo, minimal perms. (3) **Channel = files, not GitHub issues**: the broker App lacks `issues`, so the requester's channel is repo files (`contents`); D5′ already de-precedented the issue-comment return. (4) Skeleton uses `phase=execute`; risk-classify + RED approval land in Stage 4. |

verdict: pending

## GO criteria (declare `go` iff ALL hold — filled live in Stage 1)

1. `results/<correlation_id>.json` is committed to the requester repo and holds the worker's Claude-produced answer.
2. The worker repo held **no** standing secret (only the run-time masked `anthropic-api-key`) and made **no** outbound network write — confirmed from its workflow file + run logs.
3. All four `factory.agent_action.{started,dispatched,completed,failed}` events appear in Axiom for the run.
4. Every cross-repo reach used a distinct, minimal, single-repo-scoped token (verified in logs: distinct mint calls, single-repo arrays, least permissions).

A **no-go / partial** verdict stops the build and re-scopes (the capability-first feasibility gate).

## Evidence

**Stage 1a — credential sub-brick (the novel hard brick): PROVEN ✅ (2026-06-17).**
The shared WIF door (`agent-repo-pool`/`github-agent-repo-provider` on `factory-test-25`, SA `agent-repo-runtime-sa`, conditioned `secretAccessor` on control's `anthropic-api-key`) was built (`bootstrap-agent-repo-identity.yml`, verified ACTIVE) and bound to `zz-agentskel-worker`. The worker — a repo with **no GCP project of its own** — ran `cred-probe.yml` (worker run `27686971862`, `conclusion=success`): it authenticated via short-lived GitHub OIDC and read `anthropic-api-key` (`length=108 chars`), **value masked / never printed, no standing secret used**. This proves a GCP-less agent-repo can obtain the Claude credential at run time exactly as the design (D6/D9) intends.

**Stage 1b — full loop (broker → worker runs Claude → result returns to requester):** _pending — fills the GO criteria above + sets the final verdict._
