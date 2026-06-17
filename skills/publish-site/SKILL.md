# Skill: publish-site

Publish a static site folder to a **live public URL** — `<slug>.or-infra.com` — via
Cloudflare Pages Direct Upload. This is the "idea → designed site → live URL" engine:
one dispatchable workflow, fully autonomous, free, least-privilege. Pairs with the
`build-site` skill (which prepares the bytes) and the `publish-static-site.yml` workflow.

## What it does (so you can explain it to Or in plain Hebrew)

A single workflow takes a folder of static files from a source repo and puts it online
at a real address, with HTTPS, in ~1–2 minutes — no dashboards, no zip dragging. It mints
short-lived credentials, uploads, wires the domain, checks it's alive, and revokes the
credentials. Repeatable for any site.

## Pre-flight

1. **The bytes must live in a repo the broker App can read** at `<source_dir>/` (a folder
   of static files with an `index.html` at its root). Default source is
   `edri2or/or-edri-4`@`main`:`site`. Any `edri2or/*` repo works (org-wide broker install).
   Use `build-site` first if the site isn't in a repo yet.
2. **Pick the slug** — lowercase alphanumeric/hyphen, `^[a-z0-9][a-z0-9-]{1,56}[a-z0-9]$`.
   It becomes BOTH the Cloudflare Pages project name AND the subdomain `<slug>.or-infra.com`.
   Re-using a slug **updates** that site (idempotent).
3. **Confirm cost/scope with Or** — it's free (CF Pages Free; Direct Upload doesn't consume
   build minutes) and reversible, but it's a live outward action. Get his OK before the first
   publish of a new site, per "The one rule".

## Dispatch

Trigger `publish-static-site.yml` on `or-factory-master`@`main` (it auths as the broker, so
it only runs on `main`):

- **MCP tool:** `dispatch_workflow` with `workflow_id=publish-static-site.yml`,
  `inputs={ "slug": "<slug>" }` (+ optional `source_repo` / `source_ref` / `source_dir`).
- **Web session (the `dispatch_workflow` connector gate):** use `mcp__github__actions_run_trigger`
  with `method=run_workflow`, `owner=edri2or`, `repo=or-factory-master`, `ref=main`,
  `workflow_id=publish-static-site.yml`, `inputs={...}`. The GitHub-MCP path does not consult
  the allowlist, so it always works. (See CLAUDE.md › "Web-session connector gate".)

## Watch + verify

1. Poll the run with `get_workflow_run` until terminal (success/failure). On failure read
   `get_run_jobs` logs.
2. **Verify live** with `probe_endpoint https://<slug>.or-infra.com` → expect HTTP **200**
   with the site's HTML. (`probe_endpoint` is host-allowlisted to `*.or-infra.com`, so this
   site qualifies.) First requests after a brand-new domain can lag on SSL issuance — the
   workflow's own probe loop already waits; if you probe externally, retry for ~1–2 min.
3. The run emits `factory.publish.{started,completed,failed}` to the observability pipeline.

## Key facts (don't relearn these the hard way)

- **Two short-lived scoped Cloudflare tokens**, both revoked on exit (an EXIT trap, even on
  failure): a **Pages** account-scoped token (permission group **`Pages Write`**, discovered
  at runtime — the look-alike Cloudflare **Access** "Custom Pages Write" group is the WRONG one
  and yields `10000 Authentication error`) and a **DNS** zone-scoped token for the CNAME.
- The custom-domain CNAME is **DNS-only** (`proxied=false`) on purpose: a proxied record is
  403'd for datacenter IPs by the zone's Bot Fight Mode (breaking CI/monitor verification),
  while Cloudflare Pages serves the custom domain with its own cert either way.
- Capability-first proof + the discovered group id + these findings: `docs/capability-cards/publish-static-site.md`.

## What it does NOT do

- It does not *design* the site (that's `build-site`) and it does not commit bytes into the
  source repo for you. It publishes what already exists at `source_repo`@`source_ref`:`source_dir`.
- It does not touch `templates/system/**` (no provisioning change; no golden refresh).

## Handoff

Report the live URL to Or in plain Hebrew. Stop there — ask what's next; don't chain.
