## youtube-data-api-key — GO verified live

`provision-youtube-data-api-key.yml` run 28420141323 completed success with the
new smoke-test step passing: a live YouTube Data API v3 call (`i18nLanguages`)
authenticated with the provisioned `youtube-data-api-key` returned HTTP 200. The
key is valid, the API is enabled, and the api-target restriction allows the call.
End-to-end proof complete; the youtube-data-api-key development is closed.

Note: the earlier or-aios `youtube-search-capability-probe.yml` "API key not valid"
failures were a red herring — that probe (on or-aios main) reads the OLD
`google-api-key` secret, not the new key.
