# Changelog fragment — consolidate-to-master (2026-06-06)

> Per-development changelog fragment. Folded into the numbered `CHANGELOG.md` by
> `scripts/compile-changelog.sh`.

## fix: consolidate-to-master — gcp-approval bridge strips the display "gcloud" prefix (Stage 3 follow-up)

| Type | Summary |
|---|---|
| fix | The GCP RED approval card embeds the command for DISPLAY as `gcloud <cmd>` (sentinel-wrapped), but `recoverCommandFromText` returned the whole slice including `gcloud`, and the `gcp-action.yml` execute step prepends `gcloud` itself — so an approved command ran as `gcloud gcloud projects delete …` → `Invalid choice: 'gcloud'`. Surfaced live while deleting the old control projects. Fix: `recoverCommandFromText` now strips a leading `gcloud ` after extraction (the execute step is the single owner of the `gcloud` prefix). New `test/gcp-approval.test.mjs` locks the decoders + the strip (7 cases incl. the double-prefix regression and shell-metachar rejection). `tsc` + `node --test` green. Requires an MCP redeploy to take effect on the live Telegram-tap path. |
