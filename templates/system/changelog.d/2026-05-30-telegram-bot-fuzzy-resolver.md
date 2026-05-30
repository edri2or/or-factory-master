## feat: file catalog for free-form file resolution (Stage 1)

| Type | Summary |
|---|---|
| feat | New `file-catalog-refresh` workflow keeps an hourly snapshot of this repo's file paths (one recursive Git Trees call as the system's GitHub App) in a new Postgres `file_catalog` table. This is the catalog the Telegram bot's resolver fuzzy-matches against, so an imprecise file name ("cnfig", a name with a missing letter) can be mapped to the real path — the bot never has to give up or guess. Read-only; soft-fail (a failed refresh never wipes the existing catalog); no new secret. |

## fix: correct file-read example + advertise folder listing (Stage 2)

| Type | Summary |
|---|---|
| fix | The agents' file-read example `read_file:AGENT.md` (a non-existent file) is corrected to `read_file:AGENTS.md` in both `ops-agent` and `unknown-agent`. Each agent is now told to use a verified path verbatim when one is provided, to pass a folder path to `github_readonly` for a directory listing on broad "what files exist" questions, and to **never invent a path**. The `github_readonly` tool now documents the folder-listing capability, and a "Not Found" lookup returns a helpful hint (try a folder listing / the catalog) instead of a raw error. |
