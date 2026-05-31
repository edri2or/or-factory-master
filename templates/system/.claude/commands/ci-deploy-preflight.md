---
audience: shared
description: Adds a CI step BEFORE deploy that proves the deployed system's runtime contracts (credential scopes, external resources). On contract violation: exit 1 with ::error:: that names exact remediation (which scope, which env-var). Use to convert silent runtime degrade into loud CI fail.
synthesis-required: false
adapted-by: skill-adapter
adapted-on: 2026-05-24
---

# CI Deploy Pre-Flight

## Role
You are a Contract Validator. You insert a deploy-time check that curls the actual resource the deployed system will hit at runtime, and fails the CI run loudly with a remediation message that names the exact scope/permission/env-var the operator needs to fix. You convert silent runtime degrade — invisible until an operator probes the system hours later — into a loud CI fail that nobody can miss.

## Context — Read First
- The deploy workflow YAML you're modifying
- The runtime system's actual fetch URL + headers (so the pre-flight curls the same endpoint the deployed system will)
- The credential or resource the contract depends on (PAT scope, GitHub App permission, IAM role, schema version)
- Existing graceful-degrade logic in the deployed system (the pre-flight is *layered* on top of it, not a replacement)

## Prerequisites
| Prerequisite | How to verify |
|---|---|
| The deploy YAML has a step that creates/updates the credential or resource the system depends on | `grep -E "Upsert|Create|Update.*[Cc]redential" .github/workflows/<deploy>.yml` |
| The credential value is available as an env-var in the same workflow | The deploy step uses `${{ steps.secrets.outputs.<NAME> }}` or `${{ secrets.<NAME> }}` |
| The runtime resource is reachable from GitHub Actions runners | Most public APIs are; flag if behind a VPN/proxy |
| You can curl the runtime resource and get a 2xx with a valid credential | One-time manual verification before adding the pre-flight |

## Instructions

### Phase 1 — Identify the runtime contract
Pin down four things on paper before touching YAML:
1. **The endpoint** the deployed system will fetch (exact URL, including query string and any path parameters).
2. **The auth shape** (Bearer token? httpHeaderAuth? OAuth? None?).
3. **The expected status** (typically 200; sometimes 204 or 304).
4. **The minimum scope/permission** required (e.g., `Contents:read`, `Actions:write`, `repo`).

If any of these is unclear — STOP. The pre-flight will be wrong if the contract is wrong.

### Phase 2 — Insert the pre-flight step BEFORE the deploy
Place the new step:
- AFTER the secret-fetch step (so the env-var is available)
- BEFORE the credential-create / workflow-upsert step that depends on the contract

Add a one-line YAML comment above the pre-flight that names what it protects against. This stops a future contributor from "simplifying the workflow" by deleting it:
```yaml
# Load-bearing pre-flight: <CRED_NAME> must have <SCOPE> at deploy time
# or the deployed <SYSTEM> will silently degrade in production.
```

Template:
```yaml
- name: Verify <CONTRACT> (deploy pre-flight)
  env:
    <CRED_VAR>: ${{ steps.secrets.outputs.<CRED_NAME> }}
  run: |
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $<CRED_VAR>" \
      <ANY_OTHER_HEADERS> \
      "<EXACT_ENDPOINT>")
    if [ "$HTTP" != "<EXPECTED_STATUS>" ]; then
      echo "::error::<CRED_NAME> cannot <ACTION> <RESOURCE> (HTTP $HTTP). Re-issue with <EXACT_SCOPE> scope (or <ALTERNATIVE>)."
      exit 1
    fi
    echo "Contract OK — <RESOURCE> returns <EXPECTED_STATUS>."
```

The `::error::` message MUST contain:
- The credential name (so the operator knows which secret to fix)
- The actual HTTP code returned (so they know whether it's auth, missing resource, or rate limit)
- The exact remediation (scope name, permission name, alternative auth path)

### Phase 3 — Optional: post-flight invariant check
If the deploy involves placeholder substitution (`sed -e "s|@@FOO@@|...|g"`), add a post-flight grep that catches any unsubstituted token:
```bash
unmatched=$(grep -oE '@@[A-Z0-9_]+@@' "$processed" | sort -u | tr '\n' ' ' || true)
if [ -n "$unmatched" ]; then
  echo "::error::Unsubstituted placeholder(s) remain: $unmatched"
  exit 1
fi
```
Pair the post-flight with the substitution, immediately after `jq empty` (or the format-validation step).

> **`|| true` use note:** the trailing `|| true` here is safe because grep returning 1 on no-match is success for us (no unsubstituted placeholders is the green path). Reserve this construct for cases where empty output equals success. NEVER apply it to the pre-flight curl status check (Safety Rule 1) — there, a non-zero exit IS the failure signal you're asking the CI to surface.

### Phase 4 — Test the pre-flight by inducing the failure once
Before relying on the pre-flight in production, prove it actually fires:
1. Temporarily change the URL to a `404` endpoint (e.g., add `/nonexistent`).
2. Re-run the workflow via `workflow_dispatch`.
3. Confirm the run fails at the pre-flight step with the expected `::error::` message.
4. Revert the URL change. Re-run, confirm pass.

This step is the load-bearing test of the load-bearing check. Never skip it.

## Known Failures
| Failure | Symptom | Root Cause | Fix | ADR |
|---------|---------|-----------|-----|-----|
| Pre-flight placed AFTER deploy step | Deploy succeeds; pre-flight runs but its failure is too late | Step ordering wrong | Move pre-flight BEFORE the credential-create / workflow-upsert step | 0041 D2 |
| Generic "deploy failed" error message | Operator sees `exit 1` with no actionable info | The `::error::` was a placeholder copy | Message MUST name the credential, the actual HTTP status, and the exact remediation | 0041 D2 |
| Pre-flight curl missing the same headers the runtime uses | Pre-flight returns 200 but runtime returns 401 | The runtime sends `Accept: application/vnd.github.raw` (or similar), pre-flight sent default `Accept` — different code paths at GitHub | Match every header the runtime will send | 0041 |
| Pre-flight relies on a different credential than runtime | Pre-flight uses a session token with broader scope; runtime uses a stored cred with narrower scope | Two credentials confused | Always pre-flight using the SAME credential the runtime will use | 0041 D2 |
| Pre-flight masks `set -e` failure with `|| true` | Pre-flight passes when it shouldn't | Defensive `|| true` accidentally swallows the contract violation | Reserve `|| true` ONLY for the post-flight grep (where empty output is success); never on the pre-flight curl status check | 0042 D2 (concurrency analogy) |
| Pattern removed when underlying mechanism changes | Future bug surfaces silently again | Engineer assumed pre-flight was tied to the old mechanism | Even when the mechanism pivots (e.g., PAT → Pages), keep the pre-flight pattern in place; just retarget the contract | 0042 (the original pre-flight WAS removed in PR #170 — that was correct because Pages requires no auth — but document the pivot) |
| `cancel-in-progress: true` on the deploy workflow + pre-flight | Pre-flight starts on commit N, gets cancelled by commit N+1; commit N+1's deploy starts without re-running pre-flight | Concurrency setting cancels mid-flight | Use `cancel-in-progress: false` on workflows where pre-flight outcomes matter | 0042 D2 |

## E2E Gate
Three-part:
1. The pre-flight step exists in the YAML AND is positioned before the dependent deploy step (`grep -A2 -B2 "<pre-flight name>" .github/workflows/<deploy>.yml`).
2. Inducing a deliberate contract violation (Phase 4) causes the workflow to fail at the pre-flight, not later.
3. The `::error::` message in the failed run names the credential, the HTTP status, and the remediation — verifiable from the workflow run logs.

## Safety Rules
1. **NEVER swallow the pre-flight curl's exit status with `|| true` or `|| echo`.** The contract check IS the failure signal.
2. **NEVER write a generic error message.** "Deploy failed" tells the operator nothing. The message MUST name what to fix.
3. **NEVER place the pre-flight AFTER the deploy step.** A check that fires too late is silent in the same way as no check at all.
4. **NEVER pre-flight using a different credential than the runtime will use.** The whole point is to validate the actual contract, not a similar one.
5. **NEVER skip Phase 4 (induce-the-failure test).** A pre-flight that has never fired is a pre-flight you can't trust.

## Examples
**User:** `/ci-deploy-preflight configure-subagents.yml — verify GITHUB_PAT_ACTIONS_WRITE has Contents:read on state.json`

**Agent behaviour:** Reads `configure-subagents.yml`. Identifies the credential-create step (the "Upsert GitHub PAT credential" section). Inserts a pre-flight immediately above it. The curl hits `https://api.github.com/repos/${{ github.repository }}/contents/state.json?ref=main` with `Authorization: Bearer $GH_PAT` + `Accept: application/vnd.github.raw` — exact same headers the deployed N8N node will send. `::error::` message: "GITHUB_PAT_ACTIONS_WRITE cannot read state.json via Contents API (HTTP $HTTP). Re-issue with Contents:read scope (or repo scope on a classic PAT)." Adds a one-line "Load-bearing pre-flight" comment above. Tests by temporarily pointing the URL at `/state-nonexistent.json`, runs, confirms fail with the expected error. Reverts.

**User:** `/ci-deploy-preflight my-deploy.yml — but I'm not sure what scope is needed`

**Agent behaviour:** STOPS. Phase 1 gate fails — the contract isn't pinned down. Prints: "Phase 1 of /ci-deploy-preflight requires four pinned facts: endpoint, auth shape, expected status, minimum scope. Cannot insert a pre-flight from incomplete contract. Recommend: (a) Read the runtime system's docs to find the exact scope; (b) test manually with `gh api` to find which scope returns 200; (c) re-run this skill once the contract is documented."
