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
| A read-only "router" worker (Nachshon) emits a fan-out declaration; a privileged orchestrator fans the sub-tasks to sibling agents **through the existing broker**, collects the results, and Nachshon unifies them — no new privilege, never agent→agent direct | **SPLIT:** broker `agent-action.yml` → Nachshon-style `zz-` worker → result holds `{"mode":"fanout","plan":[…]}`. **FAN-OUT:** for each `plan[]` entry, broker `agent-action.yml` (`worker_repo=<sibling>`, `requester_repo=<nachshon-zz>`, `correlation_id=<parent>-<sub_id>`) → each `results/<parent>-<sub_id>.json` lands. **UNIFY:** broker `agent-action.yml` → Nachshon (task = original request + collected sub-results) → `results/<parent>-final.json`. Orchestrated by the factory session (Option A), reusing the broker verbatim | **one** throwaway `zz-fanout-spike` repo (the old `zz-` demos were deleted at product cleanup; Or approved the cheapest 1-repo path) playing router + both siblings + unifier via a trusted first-line `[MODE:SPLIT\|WORKER\|UNIFY]` tag; router worker applied via `refresh-agent-repo.yml --source_ref=spike/firstwave-fanout` (never merged); a real two-domain Hebrew request handed to the broker | `results/<parent>-final.json` is valid JSON whose unified answer **demonstrably synthesizes both** sibling sub-results | **go** | (1) The router prompt rides a throwaway spike branch — the product `templates/agent-repo/**` is untouched. (2) The orchestrator drops any `plan[]` entry outside the sibling allow-list (prompt-injection containment); `subtask` is untrusted DATA to each worker, exactly as today. (3) Every dispatch is an ordinary `agent-action.yml` call (per-call risk-classify + RED gate still apply); no worker gains a broker token. (4) Risk if the model won't reliably emit the declaration, or the unify pass ignores a sub-result → NO-GO/partial, re-scope before spending on real repos. |

verdict: go

## GO criteria (declare `go` iff ALL hold — filled live in שלב 1)

1. The SPLIT result is valid JSON with a well-formed `plan[]` **restricted to the sibling allow-list** (out-of-set entries dropped).
2. Both sub-tasks were brokered successfully and returned valid JSON results as `results/<parent>-<sub_id>.json` (per-call `factory.agent_action.*` events in Axiom).
3. The UNIFY result is valid JSON and **demonstrably synthesizes both** sub-results (hand-verified: it references content that could only have come from each sibling).
4. **No new privilege:** every dispatch was an ordinary `agent-action.yml` call; no worker minted a broker token or dispatched a workflow; no new privileged code was added.

A **no-go / partial** verdict stops the build and re-scopes (the capability-first feasibility gate) — e.g. tighten the declaration contract, add a deterministic plan-validation step, or reconsider the routing approach — **before** any real repo is provisioned (the cost boundary).

## Evidence — PROVEN ✅ → verdict `go` (2026-06-17)

Proven on one throwaway repo `edri2or/zz-fanout-spike` (provision run `27699801099`, bound to the WIF
door; router worker applied via `refresh-agent-repo.yml` run `27699855772` from branch
`spike/firstwave-fanout`). Real two-domain request: *"מצא 3 שיטות עבודה מומלצות לכתיבת תיעוד טכני, והכן מהן צ'קליסט קצר."*
Every step was an ordinary `agent-action.yml` (`phase=propose`, classified **green**) broker call.

| Pass | broker run | worker run | result file | content |
|---|---|---|---|---|
| **SPLIT** | [`27699916209`](https://github.com/edri2or/or-factory-master/actions/runs/27699916209) | `27699951517` | `results/fw-spike-1.json` | valid JSON `mode:"fanout"`, `plan[]` = 2 entries, **both `worker_repo:"zz-fanout-spike"` (allow-list only)**, sub_id a (research) + b (docs), + `unify_hint` |
| **FAN-OUT a** | [`27700084230`](https://github.com/edri2or/or-factory-master/actions/runs/27700084230) | `27700131724` | `results/fw-spike-1-a.json` | valid JSON — the 3 best-practices answer |
| **FAN-OUT b** | [`27700296647`](https://github.com/edri2or/or-factory-master/actions/runs/27700296647) | `27700327239` | `results/fw-spike-1-b.json` | valid JSON — the 7-item checklist |
| **UNIFY** | [`27700474510`](https://github.com/edri2or/or-factory-master/actions/runs/27700474510) | `27700506145` | `results/fw-spike-1-final.json` | valid JSON `mode:"unify"` — **synthesizes both**: restates the 3 best practices AND the 7-point checklist, cross-linking them (e.g. "עדכן בכל PR (ביקורת עמית)") |

GO criteria, all met: (1) SPLIT is valid JSON with a well-formed `plan[]` restricted to the sibling
allow-list; (2) both sub-tasks brokered green and returned valid JSON; (3) the UNIFY answer
demonstrably draws on **both** sub-results (hand-verified — it could only have come from each
sibling); (4) no new privilege — every dispatch was a plain `agent-action.yml` call, the worker
stayed read-only (`Read,Grep,Glob`), no worker minted a broker token.

### Learning — parallel fan-out to the SAME repo races (fixed for the real build)

The two fan-out sub-tasks were first dispatched **in parallel** to the one spike repo. Both worker
runs upload an artifact named `agent-result` in the same repo, and the broker discovers "the worker
run" by recency — so the two brokers cross-attached and `results/fw-spike-1-b.json` first received
sub-task **a**'s content (broker runs `27700084230` + `27700092146`). Re-dispatching sub-task b
**sequentially** (broker `27700296647`, no concurrent worker) produced the correct checklist result.

**Why this does not block the real build:** the spike collapsed all three roles onto one repo, so the
two siblings shared a repo. In the First Wave the siblings are **distinct** repos (`natan-research`
vs `sapi-docs`), so the broker discovers each worker run in its own repo — no collision. As a belt-and-suspenders rule, the orchestrator should still **serialize broker dispatches that target the same worker repo** (and only fan out in parallel across distinct repos). Recorded for Stage 5.

**Conclusion:** Nachshon's fan-out (declare → fan-out → unify) is feasible and safe — proceed to build
the First Wave (provision the 3 real repos, seed personas, prove each alone, then the live fan-out).
