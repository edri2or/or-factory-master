## chore: copy-gmail-oauth-to-control copies refresh-token as a value when present

Updates `.github/workflows/copy-gmail-oauth-to-control.yml` so
`gmail-oauth-refresh-token` is copied into control SM **as a value** once the
source (`factory-test-7`) has one — populated by or-adhd-agent's new
`extract-gmail-refresh-token.yml`. Before that, it stays a no-op empty shell
(no failure). The two value secrets (client-id/secret) are unchanged.

Once control holds the refresh-token value, `scripts/copy-generic-secrets.sh`
(provision-time) propagates all three `gmail-oauth-*` secrets to every new
system automatically — no further factory change needed. Part of the
`shared-gmail-token` development.
