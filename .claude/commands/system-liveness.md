---
audience: factory-only
description: Truthful per-automation liveness report of a system's live n8n — which automations ACTUALLY ran, which never ran, which last failed — using only read-only MCP tools (list_n8n_workflows + inspect_n8n_execution). Use when asked "מה באמת עובד?" / "what actually works?", for a liveness/truth audit of a system's automations, to detect drift between what's claimed-working and what's actually-working, or after changes to confirm nothing regressed. Catches "never ran" (e.g. a scheduled workflow that was registered but never fired) and "last run failed" — the exact gaps a one-line system-level health probe misses.
---

# System Liveness — "What Actually Works?" (per-automation truth report)

## Role
You are giving Or — non-technical, Hebrew-speaking, ADHD, needs control and zero
cognitive load — the **honest** picture of which of a system's automations are
actually working, proven by real execution history. Or asked for this BECAUSE the
gap between "the docs say it works" and "it really ran" is what makes him anxious.
Your job here is to find that gap, not to reassure. Report in plain Hebrew.

## When to use
- "מה באמת עובד?" / "what actually works?" / "תבדוק שהכל עובד" / liveness / truth audit.
- After a change, to confirm no automation regressed.
- Whenever you'd otherwise be tempted to *assume* an automation works — don't; run this.

## Inputs
- `system` — the system to audit (default: `or-edri-4`, the standing proving system).
- optional `failed-only` — show only the problems.

## Procedure (read-only — never changes anything)
1. **List the automations.** Call `list_n8n_workflows(systemName=<system>)` → every
   workflow with its `active` flag and `triggerTypes`.
2. **Prove each one with real execution history.** For EACH workflow call
   `inspect_n8n_execution(systemName=<system>, workflowId=<id>)` → latest execution
   `status` + `startedAt` + `failingNode`. To catch a failure masked by a later
   success, also spot-check `inspect_n8n_execution(..., status="error")`.
3. **Classify each (evidence-based — never guess):**
   - ✅ **proven** — has a recent **successful** execution (cite the execution id + time).
   - 🔴 **never-ran** — an **active** workflow with **zero** executions (this is exactly
     how DB Vacuum hid: registered + active, but never fired). Surface FIRST.
   - 🔴 **last-failed** — latest execution is `error`/`crashed` (name the failing node).
   - 🟡 **stale** — last success is older than the workflow's expected cadence (read the
     schedule cron from the trigger; e.g. a daily cron with no run in 2 days).
   - ⬛ **inactive-by-design** — a sub-workflow (Execute-Workflow-Trigger only) is
     correctly inactive; it runs only when invoked, so "no own executions" is NOT a
     failure. A disabled/demo workflow is inactive too — label it, don't red-flag it.
4. **Claim-vs-reality cross-check.** Skim the system's `AGENTS.md` ("What was
   provisioned" + capabilities) and flag anything *claimed* that has **no execution
   evidence** (e.g. a capability wired but never exercised). This is the drift hunt.
5. **Report to Or in Hebrew** — a short table: `אוטומציה | תפקיד | סטטוס | רצה לאחרונה`.
   Lead with the 🔴/🟡 rows; greens summarized. Then offer the fix: any 🔴 can be
   run-and-proven on demand with `trigger-system-workflow.yml`
   (`system_name`, `gcp_project`, `workflow_id`) — the same way DB Vacuum was proven.

## Honesty rules (the whole point)
- **Never** mark ✅ without an execution id as evidence. "Active" ≠ "works".
- **never-ran** and **last-failed** are RED and go first — do not soften them.
- A successful execution proves it **ran without crashing**, NOT that it produced a
  **correct/good answer**. Say so. For answer-quality (e.g. an agent's reply), the
  only proof is sending a real test input and judging the output — note this for
  LLM/agent workflows.
- Don't dump raw logs on Or — translate to plain Hebrew.

## Output
A plain-Hebrew truth report (table + 1-line bottom line), and concrete next actions
for every red. No file is opened by Or; you do the technical part.
