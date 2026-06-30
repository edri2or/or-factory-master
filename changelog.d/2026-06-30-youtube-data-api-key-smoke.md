## provision-youtube-data-api-key — add a live key smoke-test (prove GO)

The or-aios `youtube-search-capability-probe.yml` on `main` reads the OLD
`google-api-key` secret (the updated probe that reads `youtube-data-api-key`
lives only on the unmerged `youtube-search-api` branch), so it can't prove the
newly-provisioned key — it kept failing on the old invalid key.

To prove the new key end-to-end without depending on that other development,
`provision-youtube-data-api-key.yml` now has a final **smoke-test** step (only
when `target_service==youtube.googleapis.com`): it reads `youtube-data-api-key`
(masked immediately), calls the cheapest YouTube Data API v3 endpoint
(`i18nLanguages`, 1 unit) with the key in the `X-goog-api-key` header (never the
URL, never logged), and asserts HTTP 200 — retrying the brand-new-key
propagation window. Green = the key is valid, the API is enabled, and the
restriction lets the call through. Idempotent (reuses the existing key).
