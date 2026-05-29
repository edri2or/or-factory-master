## fix: provision systems with allow_auto_merge enabled (OIL approver)

| Type | Summary |
|---|---|
| fix | `provision-system.yml` now creates each system repo with `allow_auto_merge: true` (added to the "Create GitHub repo with auto_init" body, alongside `delete_branch_on_merge`). The OIL auto-fix approver merges by arming GitHub **native auto-merge**, which errors `Auto merge is not allowed for this repository` unless the repo has the setting enabled — the factory has it, fresh systems didn't, so the first system auto-fix ✅ failed until the setting was flipped by hand. Enabling it at create time makes the Stage-83 system-fix loop merge with no manual step, matching the factory. Surfaced by the live end-to-end test on `factory-test-83` (OIL-26), which then merged + auto-closed once the setting was on. Existing systems are unaffected until re-provisioned. |
