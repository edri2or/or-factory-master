# Capability Card — nuriel-orchestration

> Capability-first proof for the **Nuriel coordinator**'s load-bearing element:
> **a Claude Code session running in the `nuriel` agent-repo can drive the broker
> fan-out** — split Or's request, dispatch each sub-task to a sibling agent
> **through the existing broker** (`agent-action.yml`), collect the result files, and
> synthesize one unified Hebrew answer back to Or **in the same chat window** — with
> **no new privilege** to any worker and never agent→agent direct.
>
> This is **not a brand-new capability** — "a privileged session runs the broker
> fan-out and unifies" is already proven (`docs/capability-cards/firstwave-fanout.md`,
> verdict `go`). The single new element is **relocating that session** from the factory
> repo onto `edri2or/nuriel` (Or's single point of contact), dispatching via the
> **GitHub MCP scoped to `or-factory-master`** (`mcp__github__actions_run_trigger`,
> `workflow_id=agent-action.yml`, `phase=propose`) rather than the broad `dispatch_workflow`.
>
> NOTE: like `firstwave-fanout.md`, this is a factory GitHub-Actions/orchestration
> capability, not an n8n mould workflow, so `scripts/check-capability-card.sh` (which
> scans `templates/system/workflows/n8n/`) does **not** gate it. This card is the recorded
> go/no-go evidence per the capability-first *process* rule in `CLAUDE.md`.

| יכולת (capability) | הוכחה גולמית (tool + command, מחוץ לאבסטרקציה) | fixture אמיתי | פלט מצופה | הכרעה | סיכונים / הנחות |
|---|---|---|---|---|---|
| A coordinator session (Nuriel) splits Or's request, fans the sub-tasks to sibling agents **through the existing broker**, collects the results, and synthesizes one unified answer to Or — no new privilege, never agent→agent direct, RED gate intact | **SPLIT:** the session decides the routing plan (Nachshon's `[MODE:SPLIT]` machinery reused). **FAN-OUT:** for each plan entry, `mcp__github__actions_run_trigger` → `agent-action.yml` (`worker_repo=<sibling>`, `requester_repo=<nuriel/nachshon>`, `correlation_id=<parent>-<sub_id>`, `phase=propose`) → each `results/<parent>-<sub_id>.json` lands. **UNIFY:** the session reads the collected sub-results and synthesizes one Hebrew answer to Or | a real two-domain Hebrew request from Or — **שלב 1:** driven from the factory session over the 3 live repos (`natan-research`/`sapi-docs`, unify via `nachshon`); **שלב 5:** driven from the live `nuriel` session itself | the unified answer **demonstrably synthesizes both** sibling sub-results, returned to Or in one window; every dispatch is a plain `agent-action.yml` call | **pending** (שלב 1 → fill; שלב 5 → confirm from the nuriel session) | (1) The session dispatches only `agent-action.yml propose` via the scoped GitHub MCP — not the broad `dispatch_workflow`; RED tasks still gate on Telegram ✅. (2) The orchestrator drops any plan entry outside the sibling allow-list; `subtask` is untrusted DATA to each worker. (3) Serialize broker dispatches that target the **same** worker repo (the parallel-same-repo race learned in `firstwave-fanout.md`); fan out in parallel only across distinct repos. (4) Risk: the nuriel web-session environment may need a one-time connector configuration to expose the GitHub MCP → proven in שלב 5, not assumed. |

verdict: pending

## GO criteria (declare `go` iff ALL hold — filled live in שלב 1, confirmed from the nuriel session in שלב 5)

1. The routing plan is well-formed and **restricted to the sibling allow-list** (out-of-set entries dropped).
2. Each sub-task was brokered successfully via a plain `agent-action.yml` call and returned a valid JSON `results/<parent>-<sub_id>.json` (per-call `factory.agent_action.*` events in Axiom).
3. The unified answer is valid and **demonstrably synthesizes every** sub-result (hand-verified: it references content that could only have come from each sibling).
4. **No new privilege:** every dispatch was an ordinary `agent-action.yml propose` call via the scoped GitHub MCP; no worker minted a broker token or dispatched a workflow; no new privileged code was added.
5. **(שלב 5 only)** The whole loop ran **from a Claude Code session on `edri2or/nuriel`** — Or spoke only to Nuriel, with the factory session out of the loop.

A **no-go / partial** verdict stops the build and re-scopes (the capability-first feasibility gate) — e.g. tighten the routing contract, add a deterministic plan-validation step, or reconsider how the nuriel session reaches the broker — **before** the cost boundary is crossed.

## Evidence

_(To be filled live in שלב 1 — the orchestration loop proven from the factory session over the three live repos — and confirmed in שלב 5 from the live `nuriel` session. Record broker run-ids, worker run-ids, and the result files per pass, mirroring `firstwave-fanout.md`.)_
