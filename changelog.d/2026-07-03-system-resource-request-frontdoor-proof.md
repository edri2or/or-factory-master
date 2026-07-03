## system resource-request front door — live-proven + backfilled (closeout)

Closes the `system-resource-request-frontdoor` development. The
`/request-factory-resource` front door (command + per-system
`request-factory-resource.yml` workflow, PRs #565/#566) was **proven live
end-to-end** on the standing proving system `or-edri-4`: from an interactive
session Or raised a `secret` request → the workflow emitted → a Linear ticket →
`fulfill-system-request.yml` register → a real **Telegram card** → Or's ✅ → the
fulfill phase (run 28631352035) created the `dummy-test-key` shell and granted
`secretAccessor` to `deploy-sa`+`runtime-sa` on `factory-test-21` (verified via the
run's Resolve-project / Validate-gate / Fulfill / Audit+notify steps, all green).

Both artifacts were back-filled into the live systems in place via
`refresh-system-agents.yml` (no re-provision): `or-edri-4` (run 28631087213) and
`or-aios`. Newly-provisioned systems get both at provision. The `dummy-test-key`
test shell was intentionally left in place (empty, no value, harmless). Further
systems will be back-filled once named / once the factory connector is authorized
to pull the live inventory.
