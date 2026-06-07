# Changelog fragment — repo-delete-gate verify helper (2026-06-07)

> Per-development changelog fragment. Folded into `CHANGELOG.md` by `scripts/compile-changelog.sh`.

## chore: repo-delete-gate — throwaway-repo creator for end-to-end verification

| Type | Summary |
|---|---|
| chore | New `.github/workflows/create-throwaway-repo.yml` — creates a `zz-`-prefixed throwaway PRIVATE repo via the broker App (name hard-guarded to `^zz-`), so the Telegram-gated repo-delete capability can be proven end-to-end on a real repo (also confirms the broker can CREATE). One-shot, exempt in `monitoring/registry-exempt.txt`. yamllint clean. |
