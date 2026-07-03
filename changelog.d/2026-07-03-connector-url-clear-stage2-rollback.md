## connector-url-clear Stage 2 — rolled back (redirect_uri_mismatch); issuer restored to the working host

Reverted the Stage 2 pin (PR #572). Pinning `PUBLIC_BASE_URL` to the Region URL flipped the
advertised OAuth `issuer` **and** the `redirect_uri` the gateway sends to Google to the Region
host — but the Google OAuth client (`google-oauth-client-*`) has only the **legacy hash host**
callback registered in its Authorized redirect URIs, so Google rejected every login with
`redirect_uri_mismatch (Error 400)` — a live outage for all OAuth connectors (the Workspace
"Login with Google" flow).

`git revert` of the Stage 2 commit restores `PUBLIC_BASE_URL` to the Cloud Run `status.url`
(hash host), whose callback **is** registered, so Google login works again immediately. The
redeploy (push trigger on the workflow) re-serves the prior known-good issuer.

`devplans/connector-url-clear.md` reopened (`status: active`): Stage 2 now carries a hard
**prerequisite** — register the Region-host redirect URI in the Google OAuth client (console,
`edriorp38@or-infra.com`) **before** re-attempting the pin. Control-plane only; non-behavioral.
