## feat: file catalog for free-form file resolution (Stage 1)

| Type | Summary |
|---|---|
| feat | New `file-catalog-refresh` workflow keeps an hourly snapshot of this repo's file paths (one recursive Git Trees call as the system's GitHub App) in a new Postgres `file_catalog` table. This is the catalog the Telegram bot's resolver fuzzy-matches against, so an imprecise file name ("cnfig", a name with a missing letter) can be mapped to the real path — the bot never has to give up or guess. Read-only; soft-fail (a failed refresh never wipes the existing catalog); no new secret. |
