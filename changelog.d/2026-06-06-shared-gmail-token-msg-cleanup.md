## fix: Gmail bootstrap shows no consent link on the auto-connected path

Tightens `templates/system/.github/workflows/bootstrap-gmail-oauth.yml`: when the
shared token validates and the credential is auto-connected, the Telegram message
and job summary now say "connected ✅" with **no** consent link. The per-system
consent URL only belongs to the genuine fallback path — on the auto path it would
just 400 with `redirect_uri_mismatch` (each system's `n8n-<system>.or-infra.com`
callback isn't registered on the shared Google client), which misleads the
operator into clicking a link that can't work. Regenerated `tests/golden/system/`.
Part of `shared-gmail-token`.
