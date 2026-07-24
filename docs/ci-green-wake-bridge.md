# CI-green → wake-the-watching-session bridge

`notify-routine-ci-green.yml` closes a gap in how a Claude Code session subscribed
to a PR is notified.

## The gap

A session subscribed to a PR (Auto-fix / PR-activity) is pushed GitHub events for
**CI check failures** and **review comments** — but **not** for **CI success**. So a
PR going fully green never wakes the watching session on its own; the failure side is
covered natively, the success side is silent.

## The fix

CI success is not a push event, but a submitted PR **review** is. When CI completes on
a PR, the workflow posts a short review (`event=COMMENT`, via `gh api` with the default
`GITHUB_TOKEN`). The subscribed session receives that review as a
`github-webhook-activity` event and wakes immediately — no timer, no polling, the same
session. (Proven live in the sibling system `or-agents`, 2026-07-24: a submitted review
pushes into the subscribed session within seconds; a plain issue comment does not.)

## Why it re-checks every check-run

The factory splits CI across five workflows (`Changelog Check`, `Pipeline Tests`,
`Secret Scan`, `Supply Chain Check`, `Playground Tests`). Listening to any one of them
would let the workflow post "✅ CI passed" while another gate is still running or red. So
before posting, the step re-reads **every check-run on the PR's head commit** and posts
only when they are all green (treating `success` / `neutral` / `skipped` as passing).
Because the workflow is `workflow_run`-triggered it does not attach a check-run to the PR
head, so it never gates on itself. The net effect: exactly one honest post per green PR —
only the last-finishing run sees everything green. The check needs no hardcoded gate list,
so the same logic works unchanged in any sibling system regardless of its gate count.

## Properties

- **Non-blocking.** `continue-on-error` throughout; it never reddens CI, and it is **not**
  in any `protect-main` required-contexts set.
- **Triggers.** `workflow_run` on the five CI workflows above, plus `workflow_dispatch` for
  a manual reachability smoke (a manual run has no PR context, so it posts nothing).
- **Shipped to siblings.** The gold template carries a generic copy at
  `templates/new-system/.github/workflows/notify-routine-ci-green.yml`, so every future
  `/new-system` sibling inherits the bridge.
