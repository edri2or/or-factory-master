# Skill: health-check

Report the current state of the factory and all systems it manages. **Read-only.**

## Steps

1. **Factory health** — verify the control plane:
   - GCP control project: `or-factory-master-control` (project number 140345952904) exists and is healthy.
   - Broker SA: `factory-master-broker@or-factory-master-control.iam.gserviceaccount.com` exists, has the expected folder + project bindings.
   - WIF pool/provider: `github-pool` / `github-provider` in the control project, CEL pinned to repo `edri2or/or-factory-master` + `refs/heads/main`.
   - All 19 secrets present in control SM (16 generic + 3 broker-app).
   - GitHub App `factory-master-broker` installed on the org.
   
   Use `mcp__5b6e937f-c064-4cfd-88c4-ef93df38fa87__verify_gcp_system` against `or-factory-master-control` to check the GCP side.

2. **System inventory** — `list_all_systems_inventory` returns every system the factory manages. For each one, run:
   - `verify_gcp_system <system>` — project, SAs, WIF, secrets
   - `verify_github_system <system>` — repo, branch protection, variables
   - `verify_railway_system <system>` — if a Railway project ID is recorded
   - `verify_cloudflare_system <system>` — DNS records if any
   - `verify_mcp_server <system>` — only if the system runs an MCP server

   For deep Railway diagnostics (custom-domain verification, certificate state, env vars, volumes, deployment history), the typed tools below cover the common cases without leaving the agent:

   - `inspect_railway_service_direct` — latest deployment + serviceDomains + customDomains (incl. `verified`, `verificationDnsHost`, `verificationToken`, `certificateStatusDetailed`, `certificateErrorMessage`, `dnsRecords`). Use this whenever you suspect a 403 "Host not in allowlist" — `customDomains[*].status.verified` and `certificateStatusDetailed` tell you whether Railway has finished DNS validation + cert issuance.
   - `list_railway_service_variables` — env-var names (values redacted by default; pass `reveal=true` only when actively debugging).
   - `list_railway_service_volumes` — volume id/name/mountPath/sizeMB.
   - `list_railway_deployments` — recent N deployments per service.
   - `railway_graphql_read` — read-only passthrough; use only when no typed tool covers the field. Mutations are server-side rejected.

   Never ask the user to look in the Railway dashboard.

3. **Report format** — produce a markdown table:

   ```
   ## Factory status — <date>
   
   ### Control plane
   - GCP control project: ✓ | ✗
   - Broker SA: ✓ | ✗
   - WIF: ✓ | ✗
   - Secrets (count vs expected 19): N
   - GitHub App: ✓ | ✗
   
   ### Systems (<count> total)
   
   | Name | GCP | GitHub | Railway | Cloudflare | MCP | Notes |
   |---|---|---|---|---|---|---|
   | or-test-1 | ✓ | ✓ | ✓ | ✓ | n/a | |
   | ... | | | | | | |
   
   ### Issues found
   - (one bullet per problem, with proposed action)
   ```

## What this skill does NOT do

- Does not write any state. **Read-only.**
- Does not attempt to fix anything. Issues are reported; the user decides next steps.
- Does not call any factory workflow.

## Failure handling

If any individual `verify_*` call fails, mark that cell ✗ in the table and include the error text under "Issues found". Continue with the rest of the report.
