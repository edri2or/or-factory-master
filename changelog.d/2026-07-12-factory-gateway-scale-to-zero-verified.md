- **chore(mcp): verified the gateway scale-to-zero saving; close the development.**
  Follow-up to the `factory-master-actions-mcp` scale-to-zero change (PR #589, `87efd78`).
  Post-deploy verification: the new revision `...-00114-rhd` serves 100% traffic, `/health`
  returns 200 (wakes from zero), and `get_billing_costs(groupBy=service)` on 2026-07-12
  confirms the Cloud Run daily cost dropped from a steady **~15 ₪/day** baseline (07/08–07/11,
  matching the always-on ~450 ₪/mo the change set out to cut) to **~1.4 ₪** for the first
  post-change day — a ~90% reduction (heading toward ~40 ₪/mo). The final monthly figure
  settles over the next day (billing-export lag), but the drop is verified and irreversible.
  `devplans/factory-gateway-scale-to-zero.md` set to `status: completed`. Docs/record only.
