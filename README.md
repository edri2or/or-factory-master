# or-factory-master

A bootstrap factory that provisions new systems on GCP + GitHub. Successor to `edri2or/factory`, redesigned around the principle: **build manually, see every step, continue only after verifying**.

## Start here

1. [`CLAUDE.md`](CLAUDE.md) — operating rules for any agent working in this repo
2. [`docs/bootstrap-record.md`](docs/bootstrap-record.md) — how this factory itself was built
3. [`docs/external-state.md`](docs/external-state.md) — IAM grants and App permissions outside the workflow (for disaster recovery)
4. [`docs/roadmap.md`](docs/roadmap.md) — what's done, what's next, what's deliberately not planned
5. [`CHANGELOG.md`](CHANGELOG.md) — history of merged PRs

## Provisioning a new system

Manual dispatch only. From the Actions tab:

1. Pick `Provision System (step 1 — GCP + GitHub + secrets)`.
2. Run on `main` (the workflow's WIF binding pins to it).
3. Enter `system_name` — lowercase, 6-30 chars, `[a-z][a-z0-9-]*[a-z0-9]`.
4. Watch the run. ~3 minutes if nothing fails.

What you get: a fresh GCP project, two SAs with WIF, a private GitHub repo with protected `main`, 16 generic secrets, and 4 repo variables. The system can authenticate to its own GCP project from any workflow inside it.

## Repository layout

```
CLAUDE.md                                # agent operating rules
README.md                                # this file
CHANGELOG.md                             # PR history
docs/
  bootstrap-record.md                    # how the factory was built
  external-state.md                      # IAM/App state outside the workflow
  roadmap.md                             # what's next
skills/
  build-system/                          # provision a new system
  decommission-system/                   # tear one down (workflow TBD)
  health-check/                          # read-only status report
.github/workflows/
  register-broker-app.yml                # one-shot; created the broker App
  provision-system.yml                   # the one provisioning workflow
scripts/
  copy-generic-secrets.sh                # called by provision-system.yml
  generate-app-token.sh                  # mints App installation tokens
src/bootstrap-receiver/                  # reference; ran once in stage 4
```
