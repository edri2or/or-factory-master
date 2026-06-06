## fix: let refresh-system-agents sync workflow files (workflows:write)

`refresh-system-agents.yml` minted its broker App token with
`contents`+`pull_requests`+`actions` only, so a push that created or updated
a file under `.github/workflows/` was rejected by GitHub
("refusing to allow a GitHub App to create or update workflow ... without
`workflows` permission"). The `paths` input advertised syncing any
`templates/system/` subpath, but workflow files were silently unsupported.

**Changes:**
- `.github/workflows/refresh-system-agents.yml`: add `"workflows":"write"` to
  the minted token's permission set, so the cheap iterate-on-one-live-system
  loop can also sync workflow templates (e.g. `deploy-railway-cloudflare.yml`),
  not just n8n JSONs / Caddyfile.

Surfaced while live-verifying the auto-n8n-connector change on a throwaway
test system: applying the updated deploy workflow to the live system needs
this permission.
