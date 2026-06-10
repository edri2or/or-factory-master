## לידה מחוברת (mcp-birth-bundle) — Stage 4 PR-A: the Drive+Docs consent path

First half of expanding the shared Google identity to Drive + Docs. No gateway
behavior changes yet (that's PR-B) — this PR lands the one-click consent
machinery and the template's future-facing scope.

The exact scope strings were verified against the pinned `workspace-mcp==1.21.1`
wheel (`auth/scopes.py`): its `SCOPE_HIERARCHY` lets `auth/drive` cover
`drive.readonly`+`drive.file` and `auth/documents` cover `documents.readonly`,
so the minimal correct grant is **exactly 6 scopes** — the existing 4
(gmail.modify, calendar.events, gmail.settings.basic, gmail.settings.sharing)
plus `auth/drive` + `auth/documents`.

**Changes:**
- `.github/workflows/request-workspace-scopes-consent.yml` (new, one-shot,
  confirm-gated): logs into or-adhd-agent's n8n (the shared client's ONLY
  registered redirect URI), PATCHes the "Google OAuth2 API" credential's scope
  to the 6-scope set WITHOUT `oauthTokenData` (forcing a fresh consent), and
  sends Or the one-click consent link via the factory bot. Documented side
  effect: or-adhd-agent's own Gmail tools are unauthorized until the click.
  Registry-exempted (one-shot).
- `.github/workflows/copy-gmail-oauth-to-control.yml`: new `rotate` input —
  adds a NEW `gmail-oauth-refresh-token` version on top of an existing one
  (the previous version stays in SM history as the rollback); no-op when the
  source value equals control's current.
- `templates/system/.github/workflows/bootstrap-gmail-oauth.yml`: SCOPE
  expanded to the same 6 (future systems' n8n credential matches the rotated
  shared token exactly — a mismatch breaks the preloaded-token path with
  "Scope has changed"). Golden refreshed.
- Folded in: closing `devplans/shared-gmail-token.md` (its stage-3 message
  cleanup merged on 2026-06-06 — fragment `shared-gmail-token-msg-cleanup` —
  and the plan was simply never closed; live proof rode google-mcp-systems).

**Next (Or-gated):** dispatch the consent workflow → Or's single click →
extract-gmail-refresh-token (or-adhd-agent) → copy with rotate=true → PR-B
(gateway: WORKSPACE_MCP_SCOPES env + tools="calendar gmail drive docs" +
extended smoke).

**Fix (same stage, found live):** the consent link first sent was
`/rest/oauth2-credential/auth?id=...` — an endpoint that requires an n8n
SESSION, so Or got `401 Unauthorized` on phone AND desktop. The workflow now
calls that endpoint itself (owner cookie, server-side), extracts the direct
`accounts.google.com` consent URL, validates its shape, and sends THAT — no
n8n login needed on the operator side; n8n's oauth callback is session-exempt
and validated by the embedded state token. (The template bootstrap's fallback
link has the same latent flaw — recorded as a follow-up; its primary path is
the no-click preloaded token.)
