- **perf(mcp): scale the `factory-master-actions-mcp` gateway to zero when idle (cost).**
  The gateway was pinned always-warm (`minScale "1"` + `cpu-throttling "false"`), holding
  ~3 vCPU + 2Gi allocated 24/7 — the dominant monthly cost of the service (~429 ₪/mo).
  With `or-aios` now runtime-independent of the gateway and no live system depending on it
  at runtime, that standing cost isn't justified. `render-mcp-service-yaml.sh` now sets
  `minScale "0"` + `cpu-throttling "true"`, so an idle gateway costs ~nothing and each
  inbound request (Telegram webhook, an approval callback, a connector call) cold-starts one
  instance for a few seconds. `maxScale "1"` + `sessionAffinity` are kept (single-instance
  stickiness while warm). Safe for the stateful `n8nmcp` sidecar because
  `SESSION_STORE_ENABLED "1"` already persists each client's session to Firestore
  (`services/mcp-server/src/session-store.ts`), so a fresh instance after scale-to-zero
  transparently re-inits the upstream session instead of erroring "Session not found"; the
  only residual cost is first-request cold-start latency (Telegram/approvals/Workspace are
  indifferent to it). Config-only; no proxy-logic change. Reversible in one line
  (`minScale "1"` + `cpu-throttling "false"` → redeploy). Deploys via the existing
  `deploy-mcp-server.yml` push-trigger on merge.
