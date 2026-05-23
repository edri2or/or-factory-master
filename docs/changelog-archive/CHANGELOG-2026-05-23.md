# Changelog archive — through 2026-05-23

Older `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).

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
