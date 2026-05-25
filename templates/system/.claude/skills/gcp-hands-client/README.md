# gcp-hands-client skill

The source-of-truth client skill for talking to the **`edri2or/gcp-hands`** GCP operations broker.
Copy it into any `edri2or` repo so that repo's Claude Code agent dispatches GCP operations to
gcp-hands instead of running `gcloud` locally. Risk classification, approval, and GCP auth all live
in gcp-hands; the client repo holds no credentials.

## Install

Copy the skill into the client repo at the standard Claude Code project-skill path:

```
.claude/skills/gcp-hands-client/SKILL.md
```

```bash
mkdir -p .claude/skills/gcp-hands-client
cp <path-to>/gcp-hands/templates/gcp-hands-client/SKILL.md .claude/skills/gcp-hands-client/SKILL.md
git add .claude/skills/gcp-hands-client/SKILL.md && git commit -m "add gcp-hands-client skill"
```

Claude auto-discovers `.claude/skills/` from the repo root (and parent dirs); the directory name is
the skill name. **Do not** drop `SKILL.md` at the repo root — repo root is not a skill-discovery
path for Claude Code, so it would not be picked up.

## Prerequisites

- The repo is in the **`edri2or`** org (the broker only serves `edri2or`).
- The agent's environment has **either** the `gh` CLI (authenticated) **or** a GitHub MCP server
  with a repository-dispatch tool.
- **Dispatch permission:** sending a `repository_dispatch` to `edri2or/gcp-hands` needs a token with
  **Contents: write** on that repo (fine-grained PAT or GitHub App token), or classic `repo` scope.
  A *different* repo's default Actions `GITHUB_TOKEN` is scoped to its own repo and **cannot**
  dispatch to gcp-hands — an interactive agent typically uses the operator's `gh` auth; an automated
  agent needs a token explicitly granted on gcp-hands. Keep it least-privilege; no service-account
  keys.
- **No GCP credentials** are needed in the client repo — that is the whole point. GCP auth lives
  only in gcp-hands via Workload Identity Federation.

## Quickstart

1. Install the skill (above) and commit it.
2. Open an issue in your repo, e.g. *"List the Secret Manager secrets in gcp-hands-control."*
3. In Claude Code, ask it to do that. The skill auto-triggers, dispatches a green operation, and
   polls for the result comment.
4. The result comes back as a comment on that same issue in your own repo; the skill polls it for
   the comment matching your `correlation_id`.
5. You can also watch the run under gcp-hands → **Actions** → `gcp-action`.

## Risk tiers (what the broker will do)

- 🟢 **Green** — read-only inspection (list/describe/get-iam-policy); runs immediately.
- 🟡 **Yellow** — reversible changes to existing resources (add a secret version, redeploy a
  service, enable an API); runs and opens an auto-merged audit PR.
- 🔴 **Red** — creation, deletion, IAM-binding changes, or anything unrecognized; blocked until a
  human approves over Telegram (~30 min window, default REJECT on timeout).

## Cross-repo results

Results are posted directly to the `requesting_issue` in your own repo: the broker mints a
per-request `gcp-hands-broker-app` token scoped to that repo (issues:write only) and comments there.
Point `requesting_issue` at an issue in your repo and poll it in place — no need to route results
through `edri2or/gcp-hands`.

## Updating the skill

This template is the single source of truth in `edri2or/gcp-hands` under
`templates/gcp-hands-client/`. When it changes, re-copy it into client repos. (An automated sync is
a Phase 4 follow-up per the PLAN.md risks table.) For how the factory should bundle this skill into
every new system at scaffold time, see [`../../docs/factory-integration.md`](../../docs/factory-integration.md).
