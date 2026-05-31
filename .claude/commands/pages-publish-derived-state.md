---
audience: shared
description: Publishes a derived JSON file (state, manifest, metrics) from a private GitHub repo via anonymous GitHub Pages, with auto-deploy on file changes. Use when runtime systems (N8N, lambdas, webhooks) need credentialless read access to a no-secret derived file.
---

# Pages Publish Derived State

## Role
You are an Anonymous-Read Architect. You expose a derived JSON file from a private repository via GitHub Pages so that runtime systems can read it without credentials — but only after proving the file contains no secrets and writing an ADR that formally acknowledges the public exposure as a written gate against future drift.

## Context — Read First
- The project's secrets policy (typically a Hard Rule like "Never print/log/commit secret values; reference by env-var name only")
- Existing `.github/workflows/enable-github-pages.yml` (or absence)
- The derived file's content and schema — to verify no secret fields
- `docs/adr/README.md` — to find the next ADR number

## Prerequisites
| Prerequisite | How to verify |
|---|---|
| Repo has GitHub Pages enabled OR will enable in this work | `gh api /repos/{owner}/{repo}/pages` returns 200 OR no Pages block in this repo means we'll add it |
| Derived file is checked into the repo at a known path | `ls <path>` returns the file |
| File contains no secret values | Schema review + grep for known secret patterns + cross-check against project's secrets policy |
| Consumer system can fetch HTTPS URLs anonymously | Most can; verify if behind a proxy |

## Instructions

### Phase 1 — Verify "no-secret" property (mandatory gate)
1. Read the derived file in full.
2. Read the project's secrets policy (Hard Rule on secret handling).
3. Confirm explicitly: every field in the file is metadata derivable from already-public sources (ADR titles, schema versions, status enums, IDs that don't authenticate anything). If ANY field could be sensitive — STOP. Do not proceed; recommend an alternative (envelope encryption, App-token mint flow, private API).
4. Print the verification: "File `<path>` verified no-secret per `<policy>`: <enumerated rationale>."

### Phase 2 — Modify `enable-github-pages.yml`
If the workflow doesn't exist, create it. If it exists, edit in place.

Required surface:
```yaml
on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - '<derived-file-path>'
      # any other directories you also publish

permissions:
  pages: write
  id-token: write
  contents: read

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true
```

`cancel-in-progress: true` is **deliberate** for derived-state deploys: rapid commit bursts should converge to one final deploy, not queue intermediate snapshots that no consumer reads. (GitHub's documented Pages template uses `false` to avoid half-deploys; that risk doesn't apply because Pages deploys are atomic on GitHub's side.)

If publishing more than one path, add a staging step (single-path constraint of `actions/upload-pages-artifact@v3`):
```yaml
- name: Stage Pages artifact
  run: |
    mkdir -p _pages
    cp <derived-file-path> _pages/<derived-file-path>
    cp -r <other-dir> _pages/<other-dir>
- uses: actions/configure-pages@v5
- uses: actions/upload-pages-artifact@v3
  with:
    path: _pages/
- uses: actions/deploy-pages@v4
  id: deployment
```

### Phase 3 — Update consumer URLs
For every runtime system that previously fetched the file (or was about to): set the URL to `https://<owner>.github.io/<repo>/<derived-file-path>`. Anonymous fetch — drop any auth headers, credentials blocks, Accept overrides, and bearer tokens. Keep timeout + graceful-degrade logic.

### Phase 4 — Write the public-exposure ADR
Number sequentially per `docs/adr/README.md`. Include:
- **Decision 1**: file is published to Pages anonymously; cite the no-secret verification.
- **Decision 2**: push trigger on the file path + `cancel-in-progress: true`; cite GitHub Pages docs convention vs. derived-state semantics.
- **Decision 3**: formal acknowledgment of public exposure as a written gate. Future contributors who try to add sensitive fields to the file violate this decision + the project's secrets policy simultaneously.

### Phase 5 — Deploy + verify
1. PR with the YAML + consumer-URL changes + ADR. Get green CI.
2. Squash-merge.
3. `workflow_dispatch` on `enable-github-pages.yml` once for the bootstrap deploy. Wait ~30–60 s build + ~5 min CDN propagation.
4. `curl https://<owner>.github.io/<repo>/<derived-file-path>` — expect HTTP 200 + valid JSON.
5. Verify auto-trigger by making a tiny change to the derived file (e.g., bump a timestamp) and merging. Observe the Pages workflow auto-fire with `event: push`. **This is the load-bearing proof.**

## Known Failures
| Failure | Symptom | Root Cause | Fix | ADR |
|---------|---------|-----------|-----|-----|
| Anonymous raw on private repo | `raw.githubusercontent.com/.../<file>` returns HTTP 404 to anonymous clients | GitHub serves private repos' raw URLs as 404 to all unauthenticated requests, regardless of file path | Use Pages instead (this skill) or authenticated Contents API | 0039 |
| PAT scope insufficient | CI deploy passes but consumer fetch returns 404 | The PAT used by the consumer lacks `Contents:read` scope | Either add scope (if PAT is allowed) OR pivot to Pages | 0041 (superseded) |
| Org-wide GitHub App is CI-only | Cannot use App token at runtime | `actions/create-github-app-token@v1` only works in GitHub Actions; runtime mint requires holding App private key in the runtime trust boundary | Use Pages for read-only no-secret data | 0042 |
| `cancel-in-progress: false` queues deploys | Rapid commits → multi-minute lag to fresh state | GitHub's documented Pages template default | Switch to `true`; intermediate snapshots have no consumer | 0042 D2 |
| `upload-pages-artifact` takes one path | Cannot upload multiple top-level dirs | Action constraint | Stage all sources into a `_pages/` dir, upload that | 0042 D1 |
| CDN staleness | Consumer fetches old version for ~5 min after deploy | Fastly TTL on `<owner>.github.io` | Acceptable for hand-typed probes; for sub-minute freshness use authenticated Contents API or webhook cache invalidation | 0042 trade-offs |
| Push trigger doesn't fire on ref-only PR merge | After merge, no auto-redeploy | The merge commit didn't actually change the watched paths | Bootstrap with `workflow_dispatch` once | 0042 verification |

## E2E Gate
Two-part:
1. `curl -o /dev/null -w "%{http_code}\n" https://<owner>.github.io/<repo>/<derived-file-path>` returns `200`.
2. After a follow-up commit that touches the file, `gh run list --workflow=enable-github-pages.yml` shows a run with `event: push` (not `workflow_dispatch`).

## Safety Rules
1. **NEVER publish files that contain secret values.** Phase 1's no-secret verification is mandatory and not skippable. If even one field in the file could be sensitive, stop — propose an authenticated path (App token, Contents API).
2. **NEVER make the whole repo public** as a shortcut. Pages serves files; visibility flip is a separate, larger, irreversible decision.
3. **NEVER skip the auto-trigger E2E** in Phase 5 step 5. The push-trigger contract is load-bearing; if it doesn't fire, the system silently goes stale.
4. **NEVER accept stale ADR cross-references.** When this pattern's path supersedes a prior decision (e.g., "we used the Contents API"), edit only the Status header of the prior ADR (immutability rule), not the body.
5. **NEVER skip the auto-templatizer step** if your project ships portable skills — the project-specific original belongs in `.claude/plugins/.../skills/`; the globalized version belongs in `exported-skills/`.

## Examples
**User:** `/pages-publish-derived-state state.json`

**Agent behaviour:** Reads `state.json` (8 fields: schema_version, updated_at, build_stages, last_session, open_prs, next_actions, journey_retention). Reads CLAUDE.md Hard Rule #6 ("Never print/log/commit secret values; reference by env-var name only"). Verifies: every field is a name, status enum, ISO date, ADR number, or human-readable action description — no tokens, no IDs that authenticate. Prints rationale. Modifies `enable-github-pages.yml` (current artifact: `tools/`) to also stage `state.json` into `_pages/`, adds push trigger on `state.json`, adds `cancel-in-progress: true`. Updates the two N8N JSONs that previously hit `raw.githubusercontent.com` (now 404 — repo is private) to fetch `https://<owner>.github.io/<repo>/state.json` anonymously. Writes an ADR. Opens PR. After merge: dispatches `enable-github-pages.yml` once, curls the URL (HTTP 200), bumps `state.json.updated_at` in a follow-up tiny PR, observes the auto-trigger fire with `event: push` — the load-bearing proof.

**User:** `/pages-publish-derived-state secrets-config.json`

**Agent behaviour:** Reads `secrets-config.json`. Detects fields named `api_key`, `bearer_token`, `client_secret`. STOPS. Prints: "Phase 1 gate failed — `secrets-config.json` contains secret-shaped fields. Pages is not the right mechanism. Recommended alternatives: (a) keep it private, expose a redacted view via authenticated Contents API; (b) GitHub App-issued installation token from CI, write a public derivative; (c) refuse to expose at all." No file modifications.
