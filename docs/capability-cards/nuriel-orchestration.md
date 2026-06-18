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

verdict: go (שלב 1 — מסשן הפקטורי; שלב 5 — מסשן נוריאל עצמו, דרך הערוץ הצר `route_to_agent` + connector — אומת חי 2026-06-18, כל 5 הקריטריונים מתקיימים)

## Evidence — שלב 5 PROVEN ✅ (2026-06-18, criterion 5 met)

Or opened a Claude Code (web) session on `edri2or/nuriel` and asked Nuriel (Hebrew) to research 3 ways
to manage an ADHD day without burnout. **The full loop ran from the nuriel session itself, with the
factory session out of the loop:**
- Nuriel reached the narrow `/coordinator/nuriel/mcp` route via an **Anthropic connector** (routed
  through Anthropic's servers — no per-environment network-egress setting; the platform connector-gate
  did **NOT** block the write tool).
- Nuriel called **`route_to_agent`** → server-side `dispatchWorkflow` (broker App) → `agent-action.yml`
  broker run [`27788706190`](https://github.com/edri2or/or-factory-master/actions/runs/27788706190)
  (`triggering_actor=factory-master-broker[bot]` — objective proof it went through the secure server-side
  tool, not a side path), worker `natan-research`.
- The broker wrote the result back to `edri2or/nuriel` (commit `2347a617`, "agent-action result
  adhd-day-mgmt-3-ways").
- Nuriel read it (`get_file_contents` on the coordinator route) and composed the final Hebrew answer
  (3 methods + a transparency note, offering to deepen via natan or document via sapi).

All 5 GO criteria met, objectively verified server-side. **The connector door works with zero
network setting** — Or did a one-time claude.ai custom-connector add + Google login (the same
mechanism the factory's Drive tools use), reused across all nuriel sessions.

## GO criteria (declare `go` iff ALL hold — filled live in שלב 1, confirmed from the nuriel session in שלב 5)

1. The routing plan is well-formed and **restricted to the sibling allow-list** (out-of-set entries dropped).
2. Each sub-task was brokered successfully via a plain `agent-action.yml` call and returned a valid JSON `results/<parent>-<sub_id>.json` (per-call `factory.agent_action.*` events in Axiom).
3. The unified answer is valid and **demonstrably synthesizes every** sub-result (hand-verified: it references content that could only have come from each sibling).
4. **No new privilege:** every dispatch was an ordinary `agent-action.yml propose` call via the scoped GitHub MCP; no worker minted a broker token or dispatched a workflow; no new privileged code was added.
5. **(שלב 5 only)** The whole loop ran **from a Claude Code session on `edri2or/nuriel`** — Or spoke only to Nuriel, with the factory session out of the loop.

A **no-go / partial** verdict stops the build and re-scopes (the capability-first feasibility gate) — e.g. tighten the routing contract, add a deterministic plan-validation step, or reconsider how the nuriel session reaches the broker — **before** the cost boundary is crossed.

## Evidence — שלב 1 PROVEN ✅ → verdict `go` (2026-06-18)

Proven from the **factory session** (the existing privileged session) over the **three live repos**
(`nachshon` router + `natan-research` + `sapi-docs`). Real two-domain Hebrew request from Or:
*"חקור 3 דרכים מומלצות לתעדף משימות כשיש ADHD, והכן מהן רשימת-בדיקה קצרה ליישום יומי."*
Every step was an ordinary `agent-action.yml` (`phase=propose`, classified **green**) broker call,
dispatched via the scoped GitHub MCP (`mcp__github__actions_run_trigger`).

| Pass | broker run | result file (in `nachshon`) | content |
|---|---|---|---|
| **SPLIT** | [`27775449119`](https://github.com/edri2or/or-factory-master/actions/runs/27775449119) | `results/nuriel-s1.json` | valid JSON `mode:"fanout"`, `plan[]` = 2 entries, **both inside the allow-list** (`natan-research`, `sapi-docs`), + `unify_hint` + routing `trace` |
| **FAN-OUT a** (natan) | [`27775601926`](https://github.com/edri2or/or-factory-master/actions/runs/27775601926) | `results/nuriel-s1-a.json` | valid JSON — 3 methods (MIT, Eisenhower, Eat the Frog) + ADHD-fit reasoning |
| **FAN-OUT b** (sapi, 1st) | [`27775612573`](https://github.com/edri2or/or-factory-master/actions/runs/27775612573) | `results/nuriel-s1-b.json` | valid JSON — **role refusal** ("research/generate is not my role; route to research, then I document") → **Learning L1/L2** |
| **FAN-OUT b2** (sapi, chained) | [`27775853131`](https://github.com/edri2or/or-factory-master/actions/runs/27775853131) | `results/nuriel-s1-b2.json` | valid JSON — full 6-block classified record over natan's findings (Admiralty scales, MECE cat (5), confidence note); declined the embedded "make a checklist" instruction → **Learning L2/L3** |
| **UNIFY** | [`27776102732`](https://github.com/edri2or/or-factory-master/actions/runs/27776102732) | `results/nuriel-s1-final.json` | valid JSON `mode:"unify"` — **synthesizes both**: natan's 3 methods + a daily checklist the unifier **composed** + sapi's reliability note ("שיטות מוכרות; אין מחקר ADHD ייעודי מצוטט") |

GO criteria 1–4, all met: (1) SPLIT valid JSON with `plan[]` restricted to the sibling allow-list;
(2) both sub-tasks brokered green and returned valid JSON; (3) the UNIFY answer **demonstrably draws
on both** — natan's methods AND sapi's reliability classification (hand-verified — the reliability note
could only have come from sapi); (4) no new privilege — every dispatch was a plain `agent-action.yml`
call, workers stayed read-only (`Read,Grep,Glob`), no worker minted a broker token. **Criterion 5
(the loop run from the `nuriel` session itself) is confirmed in שלב 5.**

### Routing learnings (gold for Nuriel's persona — שלב 3 + the routing contract)

- **L1 — chain dependent tasks, don't parallelize them.** sapi (docs) needs research findings as
  **input**; the first parallel fan-out to sapi (no findings) was correctly refused. The coordinator
  must sequence **research → docs** when the doc task depends on the research output.
- **L2 — route to each agent's REAL capability, not an idealized one.** sapi documents+classifies
  ready findings into its fixed 6-block record; it does **not** research or generate arbitrary formats.
  nachshon's SPLIT over-asked ("produce a checklist") — a clean coordinator routes only what the agent
  actually does.
- **L3 — the coordinator composes the final user-facing deliverable in the UNIFY.** The specialists
  supply raw material (research + classified record); **Nuriel/nachshon** assembles the actual
  checklist Or asked for. The system degraded gracefully (sapi documented instead of failing) and the
  unify still produced the deliverable — but by design the format-composition belongs to the unifier.

These refine **how** Nuriel routes and unifies; they do not weaken the capability — the loop ran
end-to-end, safely, with the answer synthesizing both specialists. **Proceed to the cost boundary
(שלב 2 — provision `nuriel`).**
