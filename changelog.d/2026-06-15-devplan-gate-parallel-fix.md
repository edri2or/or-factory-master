## fix: devplan gate credits any touched devplan file (multi-development close)

| Type | Summary |
|---|---|
| fix | `scripts/check-devplan-updated.sh` now credits a touch of ANY devplan file (`DEVPLAN.md` / `devplans/*.md`) as the progress signal — whether that plan ended the change `active` or was flipped to `completed` — instead of intersecting only *still-active* plans against the diff. Fixes the multi-development case where closing one plan (→`completed`) in a code PR while another plan stays `active` and untouched wrongly failed the gate. Now a structural twin of `check-changelog-updated.sh`; path-scoping (excludes `templates/devplan/`) and the `oil-autofix/*` exemption are unchanged. New BATS test covers the close-one-while-another-active scenario (8/8 green). |
