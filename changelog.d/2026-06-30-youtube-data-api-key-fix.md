## provision-youtube-data-api-key fix — pin the API Keys quota project

The first live run (28417/28418140768) failed at `gcloud services api-keys create`
with `SERVICE_DISABLED: API Keys API has not been used in project 140345952904`
(= `or-factory-master-control`, the broker's home project) — even though the
workflow had enabled `apikeys.googleapis.com` on the **target** project
`factory-test-8`.

Root cause: `gcloud services api-keys.*` bills the API call to the credentials'
quota project (the broker's own project), not `--project`. The SERVICE_DISABLED
check is against that quota project, so the 6 retries never helped.

Fix: pass `--billing-project="$GCP_PROJECT"` on every `api-keys.*` call
(`list` / `create` / `get-key-string` / `describe`), so the quota/consumer project
is `factory-test-8` (where the API is enabled and where the key belongs). The
control project is never touched.
