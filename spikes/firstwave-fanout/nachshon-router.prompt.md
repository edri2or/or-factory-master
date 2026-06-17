# spike: Nachshon router worker prompt (throwaway)

> Throwaway Phase-1 spike artifact for `agent-repo-first-wave` (capability card
> `docs/capability-cards/firstwave-fanout.md`). This is the **router worker prompt** applied to
> the single throwaway test repo `zz-fanout-spike` via `refresh-agent-repo.yml --source_ref=spike/firstwave-fanout`
> (never merged to the product template — `templates/agent-repo/**` on `main` stays the generic
> worker). It proves the **new** brick: a read-only worker emits a fan-out **declaration**, the
> orchestrator fans the sub-tasks through the existing broker, and a final pass **unifies** them.
> Deleted on stage close.

The spike worker is **tri-mode**, keyed on a trusted control tag on the task's first line
(`[MODE:SPLIT]` / `[MODE:WORKER]` / `[MODE:UNIFY]`). Everything after line 1 is untrusted DATA
(the prompt-injection mitigation is preserved). One repo plays all three roles for the spike;
in the real build (Stage 3) Nachshon gets SPLIT+UNIFY and Natan/Sapi get WORKER.

- **SPLIT** — decompose the request into a fan-out plan over the sibling allow-list
  (`zz-fanout-spike` only, for the spike). Output `{"status":"ok","mode":"fanout","plan":[…],"unify_hint":…}`,
  or `{"answer":…,"status":"ok","mode":"single"}` if single-domain.
- **WORKER** — answer one sub-task. Output `{"answer":…,"status":"ok","mode":"worker"}`.
- **UNIFY** — synthesize the original request + a `=== SUB-RESULTS ===` block into one answer
  drawing on **both** sub-results. Output `{"answer":…,"status":"ok","mode":"unify"}`.

The full prompt text lives in the spike branch's
`templates/agent-repo/.github/workflows/agent-main.yml` (`spike/firstwave-fanout`). The existing
worker's "Extract the answer" step already passes through any valid fenced-json block verbatim
(adding only `correlation_id`), so the declaration rides the **unchanged** result/artifact channel.
