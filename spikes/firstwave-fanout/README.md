# spike: firstwave-fanout (throwaway, Phase-1 capability proof)

> Proves **Nachshon's fan-out** — the new brick of `agent-repo-first-wave` — on **one** throwaway
> test repo (`zz-fanout-spike`) before any real repo is provisioned. go/no-go recorded in
> `docs/capability-cards/firstwave-fanout.md`. Deleted on stage close.

## What it proves

Most of the loop is already proven (`agent-broker-handoff.md`, `verdict: go`): the broker
dispatch → read-only worker → result-to-requester channel, and the WIF door. The **only**
unproven new behavior is:
1. a read-only worker emitting a well-formed **fan-out declaration** (SPLIT), and
2. a final pass that **synthesizes multiple** sub-results (UNIFY).

The orchestrator (the factory Claude session — Option A) drives the loop by calling the
**existing, unchanged** `agent-action.yml` once per pass/sub-task. One repo plays router +
both siblings + unifier, so the full SPLIT → fan-out(×2) → collect → UNIFY loop is exercised
end-to-end with a single repo.

## Setup

1. `provision-agent-repo.yml` → create `zz-fanout-spike` (private repo + WIF-door binding).
2. `refresh-agent-repo.yml` (`agent_repo_name=zz-fanout-spike`,
   `paths=.github/workflows/agent-main.yml`, `source_ref=spike/firstwave-fanout`) → push the
   tri-mode router worker (the spike branch is never merged; the product template stays generic).

## Run (every dispatch = the existing broker `agent-action.yml`, `phase=propose`)

Fixture request (two-domain, real): **"מצא 3 שיטות עבודה מומלצות לכתיבת תיעוד טכני, והכן מהן צ'קליסט קצר."**

1. **SPLIT** — `agent-action.yml`(`worker_repo=zz-fanout-spike`, `requester_repo=zz-fanout-spike`,
   `task="[MODE:SPLIT]\n<request>"`, `correlation_id=fw-spike-1`). Read
   `zz-fanout-spike/results/fw-spike-1.json` → assert valid JSON, `mode:"fanout"`, `plan[]`
   entries restricted to the allow-list (`zz-fanout-spike`).
2. **FAN-OUT** — for each `plan[]` entry: `agent-action.yml`(`worker_repo=zz-fanout-spike`,
   `requester_repo=zz-fanout-spike`, `task="[MODE:WORKER]\n<subtask>"`,
   `correlation_id=fw-spike-1-<sub_id>`). Read each `results/fw-spike-1-<sub_id>.json` → assert
   valid JSON answer.
3. **UNIFY** — `agent-action.yml`(`task="[MODE:UNIFY]\n<request>\n=== SUB-RESULTS ===\n<a>\n\n<b>"`,
   `correlation_id=fw-spike-1-final`). Read `results/fw-spike-1-final.json` → assert the unified
   answer visibly draws on **both** sub-results.

## GO criteria

See `docs/capability-cards/firstwave-fanout.md`. GO iff: SPLIT emits a valid allow-list-restricted
plan; both sub-tasks return valid JSON; UNIFY demonstrably synthesizes both; no worker gained any
new privilege (every dispatch was an ordinary `agent-action.yml` call).
