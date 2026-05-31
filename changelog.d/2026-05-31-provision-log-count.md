# Changelog fragment — provision-log-count (2026-05-31)

## chore: make the provision scaffold PASS summary report the real n8n workflow count

| Type | Summary |
|---|---|
| chore | `.github/workflows/provision-system.yml`: the "scaffold pushed" PASS log hardcoded "3 n8n workflows", which drifted as workflows were added (the actual ship is a `cp -r` of the whole `workflows/n8n` tree, so new JSONs already ride along). Compute `N8N_COUNT` from the copied files and report it, so the summary stays honest. Cosmetic log only — no change to what is provisioned. |
