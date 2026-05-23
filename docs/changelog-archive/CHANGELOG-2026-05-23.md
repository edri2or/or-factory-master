# Changelog archive — through 2026-05-23

Older `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).

## Stage 14 — deploy-plane: retry-with-recreate on TLS cert wait

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Replace `Wait for Railway TLS cert` in `templates/system/.github/workflows/deploy-railway-cloudflare.yml:736-762` with a 2-attempt retry-with-recreate loop. Each attempt polls the TLS handshake for 5 min via the existing `openssl s_client` + cert-CN-match pipeline (unchanged); between attempts, force `customDomainDelete` + `customDomainCreate` (helpers lifted from the existing `Configure Cloudflare DNS:687-731` block) and re-publish the resulting CNAME target to Cloudflare via a freshly-minted 1h-expiry scoped DNS:Edit token (revoked immediately after use). On 2-attempt timeout: `::error::` + `exit 1` with a pointer to CLAUDE.md's `Railway scheduler throttle` row. Surfaced today on two consecutive systems (factory-test-20, factory-test-21) where Railway lost the first verification attempt — the prior 1-recreate + 5-min wait passed silently, the next step (`Set up n8n owner account`) curl'd into the missing cert, and the Stage 9 fail-fast (now archived) triggered on a non-200 HTTP that looked like an n8n bug rather than a Railway timing issue. Critical observation: between factory-test-21's failed Deploy #1 and successful Deploy #2, the customDomain sat in `verified=false` for 9 idle minutes with no change (verified directly via two `inspect_railway_service_direct` MCP calls) — direct evidence that wall-clock time alone does not unstick Railway's verification, but a fresh `customDomainDelete` + `customDomainCreate` does. Together with the Stage 9 fail-fast, this forms a single-dispatch single-success contract when Railway is healthy, and a fast-fail with an operator-actionable error when Railway is throttled. |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). factory-test-{20,21} already work end-to-end via manual re-dispatch; not backfilling their frozen scaffolds.

## Stage 13 — Telegram push for App-registration HITL gate

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Add `notify-telegram` step to `.github/workflows/register-system-app.yml` (inserted between `Operator instructions` and `Poll for App credentials`). When App registration is needed, the step pulls `telegram-bot-token` + `telegram-chat-id` from `or-factory-master-control` SM via the broker SA (already authenticated through the existing WIF + setup-gcloud chain; no new IAM) and POSTs an HTML-formatted message to the chat with the live receiver URL, a 10-minute deadline, the system name, and the 2-click install instructions. Closes the "operator must watch the Actions tab to catch the URL" gap during App registration — the operator can complete the 2 clicks from a phone notification. Properties: `parse_mode=HTML` so Cloud Run URLs survive without escape; `disable_web_page_preview=true` so Telegram's link-unfurler does not GET the receiver before the operator clicks (closes a documented data-exfiltration vector); `::add-mask::` on both secrets; `{ ... } 2>&1 \| tee /tmp/notify-telegram.log` + `exit "${PIPESTATUS[0]}"` so step output reaches the failed-run diagnosis surface via `read_github_actions_run_logs` and the step's exit code is preserved through the pipe. Install instruction reads `"Only select repositories", tick edri2or/<system_name>"` to match the narrow-scope contract enforced by the existing `Verify install scope is narrow` step. |

Nothing propagates from this stage — `register-system-app.yml` is a factory-level workflow, not a template. Effective on next dispatch.

## Stage 12 — deploy-plane N8N_HOST correctness

| PR | Type | Summary |
|---|---|---|
| TBD | fix | Set `N8N_HOST` to the system FQDN (`$DOMAIN`) instead of `0.0.0.0` in `templates/system/.github/workflows/deploy-railway-cloudflare.yml:432-442`, and correct the surrounding comment. The original comment claimed `N8N_HOST is the BIND address (Express listen interface), not the public hostname` — wrong in n8n 1.x: `N8N_HOST` carries the public hostname used by URL generation and the `Editor is now accessible via …` startup log line; the bind interface is controlled by `N8N_LISTEN_ADDRESS` (default `::`, which already covers IPv4+IPv6 and is what every existing system actually binds on — visible in the deployment log as `n8n ready on ::, port 5678`). The bug surfaced during factory-test-20 diagnosis with the new MCP's `inspect_railway_service_direct`: `customDomain` was verified, cert was `COMPLETE`, but the operator-facing log read `Editor is now accessible via: https://0.0.0.0`, which falsely suggested the host config was broken when in fact `WEBHOOK_URL=https://${DOMAIN}` and Railway's edge routing made the system fully functional. Cosmetic-only for existing systems (factory-test-18/19/20 keep `0.0.0.0` in their frozen workflow copies — `WEBHOOK_URL` overrides actual URL generation), but new systems will now ship with the right value from first deploy and the comment will no longer mislead the next reader. |

Template edits propagate only to newly-provisioned systems (per CLAUDE.md). Existing systems keep their pre-fix workflows.

Out of scope: backfilling `N8N_HOST` on factory-test-18/19 (factory-test-20 was already corrected manually in the previous session); deferred until those systems are otherwise redeployed.

## Stage 11 — MCP visibility + cosmetic followups

| PR | Type | Summary |
|---|---|---|
| TBD | feature | Add `.github/workflows/tail-mcp-logs.yml` — manual-dispatch workflow that reads recent Cloud Logging entries for the `factory-master-actions-mcp` Cloud Run service and writes them to the job summary. Lets the agent diagnose OAuth / RPC issues against the new MCP without operator dashboard access (the operator now hits this via `gh` dispatch instead of running `gcloud logging read` in Cloud Shell). Logs only contain method/path/status/ms (per `services/mcp-server/src/index.ts:80-88`), so step-summary publication doesn't leak secrets. Accepts `lines` (1-500, default 40) and `severity` (DEFAULT/INFO/WARNING/ERROR) inputs. |
| TBD | fix | Cosmetic: the OAuth authorize HTML page in `services/mcp-server/src/index.ts:174` was carried over verbatim from `edri2or/factory` and still labelled the consent prompt "Authorize Claude to access GitHub Actions for **edri2or/factory**". Update to `edri2or/or-factory-master`. Operator hits this page during the 1-time OAuth setup of the MCP in Claude Code. |

Stages 6-10 archived to `docs/changelog-archive/CHANGELOG-2026-05-22.md` to keep this file under the 20 KB scan-friendly cap.
