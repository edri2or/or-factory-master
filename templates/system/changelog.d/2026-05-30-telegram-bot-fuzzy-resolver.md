## feat: file catalog for free-form file resolution (Stage 1)

| Type | Summary |
|---|---|
| feat | New `file-catalog-refresh` workflow keeps an hourly snapshot of this repo's file paths (one recursive Git Trees call as the system's GitHub App) in a new Postgres `file_catalog` table. This is the catalog the Telegram bot's resolver fuzzy-matches against, so an imprecise file name ("cnfig", a name with a missing letter) can be mapped to the real path — the bot never has to give up or guess. Read-only; soft-fail (a failed refresh never wipes the existing catalog); no new secret. |

## feat: resolve imprecise file names to real paths (Stage 3)

| Type | Summary |
|---|---|
| feat | The Telegram bot now maps an imprecise or misspelled file reference to a real file in this repo. The router extracts the file name you mentioned, fuzzy-matches it (Jaro-Winkler) against the cached file catalog, and: if it's a confident match it reads that exact file; if it's a near match it asks "did you mean X?" (or shows a short numbered list); if nothing fits it offers to list a folder. It never replies "I can't access files" and never invents a path. If the catalog/Postgres is unavailable it simply falls back to normal conversation. |

## fix: correct file-read example + advertise folder listing (Stage 2)

| Type | Summary |
|---|---|
| fix | The agents' file-read example `read_file:AGENT.md` (a non-existent file) is corrected to `read_file:AGENTS.md` in both `ops-agent` and `unknown-agent`. Each agent is now told to use a verified path verbatim when one is provided, to pass a folder path to `github_readonly` for a directory listing on broad "what files exist" questions, and to **never invent a path**. The `github_readonly` tool now documents the folder-listing capability, and a "Not Found" lookup returns a helpful hint (try a folder listing / the catalog) instead of a raw error. |
