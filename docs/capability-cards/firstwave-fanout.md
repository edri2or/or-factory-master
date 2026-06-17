# Capability Card — firstwave-fanout

> Capability-first Phase-1 proof for the **First Wave**'s load-bearing new brick:
> **Nachshon's fan-out** — a read-only worker agent-repo that, instead of answering,
> emits a typed **fan-out declaration** (a routing plan addressed to sibling agents);
> a privileged orchestrator reads it, dispatches each sub-task to the named sibling
> **through the existing broker** (`agent-action.yml`), collects the results, and hands
> them back to Nachshon for a final **unify** pass — with **no new privilege** to any
> worker and never agent→agent direct.
>
> NOTE: like `agent-broker-handoff.md`, this is a factory GitHub-Actions/orchestration
> capability, not an n8n mould workflow, so `scripts/check-capability-card.sh` (which
> scans `templates/system/workflows/n8n/`) does **not** gate it. This card is the recorded
> go/no-go evidence per the capability-first *process* rule in `CLAUDE.md` — the analog of
> `e2e-verify` for n8n systems, which does not apply to an agent-repo (no inbound-Telegram
> path; verified: no enforced surface in `e2e-surfaces.json` matches `templates/agent-repo/**`).

| יכולת (capability) | הוכחה גולמית (tool + command, מחוץ לאבסטרקציה) | fixture אמיתי | פלט מצופה | הכרעה | סיכונים / הנחות |
|---|---|---|---|---|---|
| A read-only "router" worker (Nachshon) emits a fan-out declaration; a privileged orchestrator fans the sub-tasks to sibling agents **through the existing broker**, collects the results, and Nachshon unifies them — no new privilege, never agent→agent direct | **SPLIT:** broker `agent-action.yml` → Nachshon-style `zz-` worker → result holds `{"mode":"fanout","plan":[…]}`. **FAN-OUT:** for each `plan[]` entry, broker `agent-action.yml` (`worker_repo=<sibling>`, `requester_repo=<nachshon-zz>`, `correlation_id=<parent>-<sub_id>`) → each `results/<parent>-<sub_id>.json` lands. **UNIFY:** broker `agent-action.yml` → Nachshon (task = original request + collected sub-results) → `results/<parent>-final.json`. Orchestrated by the factory session (Option A), reusing the broker verbatim | three existing `zz-` spike repos: one as "Nachshon" (router prompt applied via `refresh-agent-repo.yml --source_ref=<spike-branch>`, never merged), two as the sibling workers; a real two-domain request handed to the broker | `results/<parent>-final.json` is valid JSON whose unified answer **demonstrably synthesizes both** sibling sub-results | pending | (1) The router prompt rides a throwaway spike branch — the product `templates/agent-repo/**` is untouched. (2) The orchestrator drops any `plan[]` entry outside the sibling allow-list (prompt-injection containment); `subtask` is untrusted DATA to each worker, exactly as today. (3) Every dispatch is an ordinary `agent-action.yml` call (per-call risk-classify + RED gate still apply); no worker gains a broker token. (4) Risk if the model won't reliably emit the declaration, or the unify pass ignores a sub-result → NO-GO/partial, re-scope before spending on real repos. |

verdict: pending

## GO criteria (declare `go` iff ALL hold — filled live in שלב 1)

1. The SPLIT result is valid JSON with a well-formed `plan[]` **restricted to the sibling allow-list** (out-of-set entries dropped).
2. Both sub-tasks were brokered successfully and returned valid JSON results as `results/<parent>-<sub_id>.json` (per-call `factory.agent_action.*` events in Axiom).
3. The UNIFY result is valid JSON and **demonstrably synthesizes both** sub-results (hand-verified: it references content that could only have come from each sibling).
4. **No new privilege:** every dispatch was an ordinary `agent-action.yml` call; no worker minted a broker token or dispatched a workflow; no new privileged code was added.

A **no-go / partial** verdict stops the build and re-scopes (the capability-first feasibility gate) — e.g. tighten the declaration contract, add a deterministic plan-validation step, or reconsider the routing approach — **before** any real repo is provisioned (the cost boundary).

## Evidence

_(to be filled live in שלב 1 — run-ids for SPLIT / fan-out / UNIFY broker calls, the collected result files, and the hand-verified GO/NO-GO verdict)_
