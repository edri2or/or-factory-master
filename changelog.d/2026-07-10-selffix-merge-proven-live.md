## docs: system-request `merge` type proven live (author≠approver)

| Type | Summary |
|---|---|
| docs | Record the live end-to-end proof of the card-free `merge` request type (`system-self-sufficiency-channels` stage C). After PR #584 merged and the MCP redeployed, or-aios's self-fix loop opened draft PR #466 as `or-aios-app[bot]`; on Or's ✅ (or-aios's own bot) `oil-selfmerge` emitted `system.request.merge`, the factory verified it via `isMergeableSelffixPr`, and the **factory approver merged** it — `merged_by=oil-autofix-approver[bot]`, distinct from the PR author `or-aios-app[bot]`. author≠approver proven live. `oil-selffix-verify` re-ran the reproducer on merged main → verified. Stage C → completed; stage B (`promote`) live proof remains the plan's open item. |
