# Changelog fragment — consolidate-to-master (2026-06-06)

> Per-development changelog fragment. Folded into the numbered `CHANGELOG.md` by
> `scripts/compile-changelog.sh`.

## fix: consolidate-to-master — gcp-action classifies on a flag-stripped command (Stage 3 follow-up)

| Type | Summary |
|---|---|
| fix | The Stage-3 `gcp-action.yml` classified the raw command, but the classifier matches operation SHAPE with exact token counts — so a real flagged read like `secrets list --project=or-factory-master-control` (3 tokens) missed green `secrets list` (2 tokens) and fell through to RED, needlessly demanding approval for benign reads. Ports gcp-hands' normalization: strip `-*` flag tokens before classifying, while the FULL command is preserved for execution. Now green/yellow flagged commands classify correctly; only genuinely red operations route to the Telegram approval card. yamllint clean. |
