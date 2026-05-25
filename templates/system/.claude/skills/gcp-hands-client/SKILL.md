---
name: gcp-hands-client
description: >-
  Run any Google Cloud / gcloud operation by dispatching it to the edri2or/gcp-hands broker
  instead of running gcloud locally. Use whenever a task needs a GCP action — listing/describing
  Secret Manager secrets, projects, IAM policies, or Cloud Run services; enabling APIs; deploying
  Cloud Run; adding secret versions; creating/deleting resources or changing IAM. Triggers on any
  mention of gcloud, Google Cloud, GCP, Secret Manager, Cloud Run, IAM, or a GCP project id.
allowed-tools: Bash(gh api:*) Bash(gh issue:*) Bash(gh repo:*) Bash(date:*) Bash(jq:*)
---

# gcp-hands client

This repo does not hold Google Cloud credentials and does not run `gcloud`. Every GCP operation
is delegated to the **`edri2or/gcp-hands`** broker, which classifies the request by risk tier and
runs it under Workload Identity Federation. You send a request; the result comes back as a comment
on a GitHub issue.

## CRITICAL: never run gcloud yourself

- **NEVER** run `gcloud` (or `gsutil`, `bq`, the GCP SDK) locally. You have no GCP credentials and
  neither does the user's shell.
- **NEVER** ask the user to run `gcloud` or to open the Cloud Console.
- **EVERY** Google Cloud operation — read or write — goes through `edri2or/gcp-hands` via a GitHub
  `repository_dispatch` event.
- If you catch yourself about to type `gcloud`, stop and dispatch instead.

## How it works

1. You send a `repository_dispatch` event (type `gcp-action`) to `edri2or/gcp-hands`.
2. The broker classifies your command into a risk tier and acts on it.
3. The result is posted as a comment on the issue you name in `requesting_issue`. You poll that
   issue for the comment matching your `correlation_id`.

| Tier | Examples | Broker behavior | Expect a result within |
|---|---|---|---|
| 🟢 green | `secrets list`, `secrets describe X`, `projects describe X`, `projects get-iam-policy X`, `run services describe X` | runs immediately | ~5 min |
| 🟡 yellow | `secrets versions add X`, `run deploy X`, `services enable X` | runs + opens an auto-merged audit PR | ~5 min |
| 🔴 red | creates, deletes, IAM-binding changes, **anything not listed above** | waits for a human Telegram approval (~30 min window, default REJECT on timeout) | up to ~35 min |

When you are unsure which tier a command falls into, assume **red** and warn the user that a human
approval may be required before it runs.

## Request payload schema

The dispatch target is **always** `edri2or/gcp-hands`; `event_type` is **always** `gcp-action`.

```json
{
  "event_type": "gcp-action",
  "client_payload": {
    "command": "secrets list --project=gcp-hands-control",
    "requesting_issue": "edri2or/<this-repo>#<issue-number>",
    "correlation_id": "<unique-string>"
  }
}
```

- **`command`** — the gcloud invocation **without** the leading word `gcloud`. Always pass an
  explicit `--project=<id>`; the broker has no default project for your repo. Flags are safe to
  include: the broker strips flag tokens (`--project=…`, `--format=…`) before classifying, so they
  never change the tier.
- **`requesting_issue`** — `owner/repo#number` of the issue where the result comment should land
  (see Step 1).
- **`correlation_id`** — an opaque unique string you use to find your result comment (see Step 1).

## Step 1 — gather the three fields

- **command:** build it exactly as you would type after `gcloud`. Example:
  `secrets list --project=gcp-hands-control`.
- **requesting_issue:** the issue the result lands on. Determine it in this order:
  1. If you were invoked on a specific issue/PR, use that `owner/repo#number`.
  2. Otherwise derive `owner/repo` from the git remote with
     `gh repo view --json nameWithOwner -q .nameWithOwner`, and use the issue number from your task
     context.
  3. If there is no issue to land on, **open one first** (`gh issue create`) so the result has a
     home, then use its number. Polling needs a real, open issue you can read.
- **correlation_id:** a unique string restricted to `[A-Za-z0-9._-]` (this charset keeps the yellow
  audit branch/file names clean). Generate one with:
  ```bash
  CORR="$(date +%Y%m%d-%H%M%S)-$RANDOM"        # or: python3 -c "import uuid;print(uuid.uuid4())"
  ```

## Step 2 — dispatch the request

The dispatch is `POST /repos/edri2or/gcp-hands/dispatches` with header
`Accept: application/vnd.github+json` and a JSON body of `{event_type, client_payload}`. A success
returns **HTTP 204 No Content** — that confirms the broker *accepted* the request, **not** that it
finished. Do not report success off the 204; wait for the comment (Step 3).

**Preferred — `gh` CLI.** `client_payload` is a nested object, so send the whole body as raw JSON
via `--input -`. Do **not** use `gh api -f 'client_payload[command]=…'` — the `-f`/`-F` form sends
flat string fields and is brittle for nested/dynamic content.

```bash
gh api repos/edri2or/gcp-hands/dispatches \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "event_type": "gcp-action",
  "client_payload": {
    "command": "secrets list --project=gcp-hands-control",
    "requesting_issue": "edri2or/gcp-hands#REPLACE-NUM",
    "correlation_id": "REPLACE-CORRELATION"
  }
}
JSON
```

When the command contains spaces or quotes, build the JSON with `jq` so values are escaped safely:

```bash
jq -n --arg cmd "$COMMAND" --arg iss "$REQ_ISSUE" --arg cid "$CORR" \
  '{event_type:"gcp-action", client_payload:{command:$cmd, requesting_issue:$iss, correlation_id:$cid}}' \
| gh api repos/edri2or/gcp-hands/dispatches --method POST -H "Accept: application/vnd.github+json" --input -
```

**Alternative — GitHub MCP server.** If your MCP server exposes a repository-dispatch tool, call it
with `owner=edri2or`, `repo=gcp-hands`, `event_type=gcp-action`, and `client_payload` as an object
with the three keys. Most GitHub MCP servers do **not** expose a dispatch tool, so `gh api` is the
reliable path.

**If neither `gh` nor an MCP dispatch tool is available:** tell the user this repo is not set up to
reach gcp-hands and stop. Do **not** fall back to running gcloud locally.

## Step 3 — wait for and parse the result

Poll the `requesting_issue` for a new comment whose first line contains your `correlation_id`:

```bash
gh issue view <number> --repo edri2or/gcp-hands --json comments -q '.comments[].body'
```

(or the MCP `list_issue_comments` tool), filtering for your `correlation_id`. The comment format is:

```
gcp-hands result (correlation: <correlation_id>)
Tier: <green|yellow|red>
Status: <success|failed|denied>
Output:
```<gcloud output, first 50 lines>```
```

**Polling:** every ~15–30 s. Stop after **5 minutes** for green/yellow and **35 minutes** for red
(the 30-min Telegram window plus a 5-min buffer). Do not busy-loop.

**Interpreting `Status`:**

- `success` → report the Output block to the user.
- `failed` → the command ran but gcloud returned an error; the Output holds the error text. Show it
  and propose a fix.
- `denied` → a human rejected the red-tier request **or** the 30-min approval window elapsed (the
  broker emits `denied` for both; there is no separate `timed-out` status). Do not retry
  automatically — tell the user it was not approved and ask how to proceed.
- **No comment before the timeout** → the run may still be pending human approval (red) or may have
  failed before commenting. Tell the user and link them to the gcp-hands Actions tab. **Never
  re-dispatch on a timeout** — a re-dispatch re-runs the operation, which is unsafe for yellow/red.

## Examples

**Green — list secrets**
```
command:          secrets list --project=gcp-hands-control
expected tier:    green
expected status:  success (Output = secret names), back within ~1 min
```

**Yellow — enable an API**
```
command:          services enable run.googleapis.com --project=gcp-hands-control
expected tier:    yellow
expected status:  success; gcp-hands auto-opens & merges an audit PR (you do not act on it)
```

**Red — create a secret** (warn the user up front that this needs human approval)
```
command:          secrets create my-new-secret --project=gcp-hands-control
expected tier:    red
expected status:  success on approve; denied on reject or 30-min timeout; up to ~35 min
```

## Cross-repo results

Result comments come back to the **`requesting_issue` you name — in your own repo**. The broker
mints a per-request `gcp-hands-broker-app` token scoped to just that repo (issues:write only) and
posts the result there, so set `requesting_issue` to an issue in your repo and poll it in place
(Step 3). There is no need to route results through `edri2or/gcp-hands`.
