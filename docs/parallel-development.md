# Parallel development in the factory

How **two developments run at once** in `or-factory-master` without overwriting each other —
on the shared proving system `or-edri-4` or on `main`. The factory deliberately solves this
with **short-lived branches + a per-system run queue**, not with a merge queue or strict
required-status-checks.

> Short version: each development lives on its **own short-lived branch** with its **own
> `devplans/<slug>.md` + `changelog.d/` fragment** (no plan/changelog collisions); every
> factory workflow that touches a live system shares a **`live-system-<system>` FIFO queue**
> (`queue: max`) so operations on `or-edri-4` serialize instead of colliding; and `main` stays
> **non-strict** (PR + green checks, no rebase tax, no merge queue) because at the factory's PR
> volume that is the right trade.

## The three friction points (and how each is closed)

Per-ref CI isolation is already solved — every workflow run is keyed to its own ref. The real
friction of running two developments in parallel is three points.

### A — merging to `main`

`main` is protected by the `protect-main` ruleset (`scripts/ensure-protect-main-ruleset.sh`):
PR-required (0 approvals), no force-push, no deletion, the factory's required CI contexts, and
**`strict_required_status_checks_policy: false`** — *non-strict*: a branch does **not** have to
be up-to-date with `main` before it merges. That non-strictness is the deliberate choice that
makes parallel merges cheap: two independently-green PRs can both merge without a serialized
rebase dance. See "Why not strict, and not a merge queue" below.

> A leftover **classic** branch protection (`strict: true`, applied by a 2026-05 one-shot and
> never removed) used to coexist with the ruleset and silently force strict — it blocked a
> "behind" PR during this very development. `scripts/ensure-protect-main-ruleset.sh` now
> deletes any such classic protection once the ruleset is confirmed active, so live `main`
> matches this non-strict intent. See `docs/bootstrap-record.md` › "Classic-protection
> reconciliation".

### B — the shared live proving system `or-edri-4`

Four factory workflows act on a live system — `prove-on-test-system.yml`,
`refresh-system-agents.yml`, `e2e-verify.yml`, `deploy-verify.yml`. Two parallel developments
could drive `or-edri-4` at the same time and overwrite each other's live state mid-proof. All
four now share one workflow-level concurrency group:

```yaml
concurrency:
  # `inputs.system_name` in prove/refresh; `github.event.inputs.system_name` in e2e/deploy-verify
  group: live-system-${{ inputs.system_name }}
  cancel-in-progress: false
  queue: max
```

`queue: max` (GitHub Actions, GA 2026-05-07) queues up to 100 runs **FIFO** instead of
cancelling; it **requires** `cancel-in-progress: false` (the combination with `true` is a
workflow validation error). Grouping by **system** (not by branch / `target_ref`) is what
serializes *all* factory work on `or-edri-4` — matching the proof-system lock, which pins
proofs to `or-edri-4` (`e2e-surfaces.json`). Concurrency groups are **per-repo**, so the
factory's `live-system-or-edri-4` queue and a system repo's own concurrency never interfere
(no cross-repo deadlock: `refresh`/`prove` dispatch into the *system* repo and wait on the
*system's* checks, a separate namespace).

> The `templates/system/.github/workflows/{e2e-verify,deploy-verify}.yml` **twins** still use
> the older `*-verify-<target_ref>` grouping. Backfilling the per-system queue into the template
> is future work (it needs a golden refresh + a live proof), so the divergence is intentional,
> not drift.

### C — the devplan gate under parallel plans

`scripts/check-devplan-updated.sh` blocks merging dev-code while any `devplans/*.md` is
`status: active` unless the same diff **touches a devplan file**. It is a path-membership twin
of the CHANGELOG gate: a touch of *any* devplan file — whether the plan ends the change
`active` or flips to `completed` — satisfies it. So **closing one plan in a code PR while
another stays active is safe** (this was historically a trap that failed the gate, because the
gate credited only *still-active* plans; fixed 2026-06-15). Each development keeping its own
plan file means two plans never collide on one file.

## Why not strict, and not a merge queue

Both were considered and deliberately declined:

- **Merge queue** — declined. It is **likely unavailable on the org's GitHub plan** (merge
  queue needs a public org or GitHub Enterprise Cloud — confirm before ever adopting), it is
  **not supported alongside the wildcard / ruleset branch protection** the factory uses, and it
  is **low-value at low PR volume** — its payoff is keeping a high-throughput always-green `main`
  under many concurrent merges, which the factory does not have. The `protect-main` script says
  as much in-code (`scripts/ensure-protect-main-ruleset.sh`: *"merge queue is the right tool at
  higher throughput, not strict rebasing at current factory PR volume"*).
- **Strict required-status-checks** (`strict_required_status_checks_policy: true` — "branch must
  be up to date before merging") — declined as the default. It forces every PR to rebase onto
  the latest `main` and re-run all checks before each merge: a serialization tax that hurts
  exactly the parallel flow this policy enables, for little benefit at current volume.

**Fallback (documented, not active):** if PR volume ever rises to where parallel merges
regularly land individually-green-but-jointly-broken combinations, flip `protect-main` to
strict (`strict_required_status_checks_policy: true`) — and only then reconsider a merge queue,
if the plan supports it. The `live-system-<system>` queue (B) is the standing safeguard against
the costlier failure (clobbering the live proving system) regardless.

## See also

- `.claude/commands/dev-stage-factory.md` / `dev-stage.md` — the staged-development flow and the
  per-plan (`devplans/<slug>.md`) + per-fragment (`changelog.d/`) machinery that keeps parallel
  developments from colliding.
