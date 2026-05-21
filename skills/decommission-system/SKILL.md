# Skill: decommission-system

Tear down a system safely. **Destructive — requires explicit written approval.**

## Status

The decommission workflow (`.github/workflows/decommission-system.yml`) is not implemented yet. This skill describes the intended flow; when the workflow exists, follow it. Until then, decommission steps are performed manually via gcloud + GitHub API by the user, with the agent observing.

## Pre-flight

1. Get `system_name` from the user.
2. Confirm the system exists:
   - GCP project: `list_gcp_projects` shows `<system_name>`.
   - Repo: `mcp__github__get_file_contents` on `edri2or/<system_name>` returns 200.
3. Show the user a destructive-action prompt:
   ```
   I'm about to archive repo edri2or/<name> and schedule GCP project <name>
   for deletion (30-day grace period). Railway + Cloudflare resources will need
   separate cleanup.
   
   This is reversible during the grace period but expensive to undo.
   
   To proceed, please type the system name exactly: <name>
   ```
4. Only continue if the user types the name back exactly. Anything else aborts.

## Execute

When the workflow exists, dispatch it manually with `system_name` and `confirmed_destructive=true`. Until then, walk the user through these steps:

1. Archive the repo (not delete):
   ```
   PATCH /repos/edri2or/<system_name>  {"archived": true}
   ```
   via the broker App token.
2. Schedule GCP project deletion:
   ```
   gcloud projects delete <system_name>
   ```
   GCP defaults to a 30-day soft delete; the project is recoverable via `gcloud projects undelete` during that window.
3. Note: Railway + Cloudflare resources are NOT touched by this skill. The user should manually delete the Railway project and Cloudflare DNS records, or invoke a separate workflow when available.

## What this skill does NOT do

- Does not delete the GitHub repo (archive only).
- Does not force-delete the GCP project (uses default soft-delete window).
- Does not touch Railway or Cloudflare resources.
- Does not pre-warn or notify anyone other than the user in this session.

## Abort conditions

- System does not exist.
- User types the name incorrectly or refuses.
- Target is the factory itself (`or-factory-master`, `or-factory-master-control`). Hard-refuse.
