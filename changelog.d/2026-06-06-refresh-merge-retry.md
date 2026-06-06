## fix: refresh-system-agents merges via retry, not checks:read

`refresh-system-agents.yml` gated its merge on `gh pr checks --watch`, which
needs `checks:read` — a permission the broker App token does not hold, so the
step failed with "Resource not accessible by integration (statusCheckRollup)"
and never merged the refresh PR.

**Changes:**
- `.github/workflows/refresh-system-agents.yml`: replace the `gh pr checks`
  gate with a retry loop around `gh pr merge --squash` (20 × 15s). The system
  repo's branch ruleset enforces the 4 required checks server-side, so the
  merge only succeeds once CI is green — the same checks:read-free approach
  `prove-on-test-system.yml` already uses.

Surfaced while live-verifying the auto-n8n-connector change: the refresh PR
pushed and opened correctly, but couldn't be merged.
