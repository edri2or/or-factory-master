# Capability Card — publish-static-site

> Capability-first Phase-1 proof for the factory's static-site **publish** engine
> (`.github/workflows/publish-static-site.yml` + `scripts/publish-static-site.sh`).
> NOTE: this is a factory **GitHub Actions** capability, not an n8n mould workflow, so
> `scripts/check-capability-card.sh` (which scans `templates/system/workflows/n8n/`) does
> **not** gate it. This card is the recorded go/no-go evidence per the capability-first
> *process* rule in `CLAUDE.md`, not a CI artifact.

| יכולת (capability) | הוכחה גולמית (tool + command, מחוץ לאבסטרקציה) | fixture אמיתי | פלט מצופה | הכרעה | סיכונים / הנחות |
|---|---|---|---|---|---|
| Publish a static site directory to **Cloudflare Pages (Direct Upload, headless)** and attach a live `<slug>.or-infra.com` HTTPS URL, then revoke all credentials | `wrangler pages deploy <dir> --project-name=<slug>` (account-scoped Pages token minted at runtime) + Cloudflare REST for project-create / domain-attach / CNAME; driven live on `main` (run [27678930371](https://github.com/edri2or/or-factory-master/actions/runs/27678930371)) | Stage-1: an inline minimal `index.html`; Stage-3 reuses the real `edri2or/or-edri-4/site` RTL demo | `https://pages-proof.or-infra.com` → **HTTP 200** with the page body; both scoped tokens revoked | **go** | (1) The Pages edit permission group is **`Pages Write`** id `8d28297797f24fb8a0c332fe0866ec89` (discovered at runtime; must EXCLUDE the look-alike Cloudflare **Access** group `Access: Custom Pages Write`). (2) The custom-domain CNAME must be **DNS-only** (`proxied=false`) — a proxied record is 403'd for datacenter IPs by the zone's Bot Fight Mode, breaking CI/monitor verification; Pages still serves its own cert DNS-only. |

verdict: go

## Evidence

- **First live green:** run `27678930371` (2026-06-17) — `wrangler` Direct Upload → `✨ Deployment complete` → custom-domain attach → DNS-only CNAME → probe **HTTP 200** → both tokens revoked → job conclusion `success`.
- **Independent confirmation:** `probe_endpoint https://pages-proof.or-infra.com` → 200, body matched.
- **Least-privilege held:** on the two earlier failed runs the EXIT trap revoked both short-lived tokens; no credential leaked.

## What was re-scoped along the way (both fixed in `main`)

1. Runtime permission-group selector matched Cloudflare **Access** "Custom Pages Write" → 10000 Authentication error. Fixed: exclude `access/custom`, require the real Cloudflare Pages edit group, log all candidates.
2. Proxied CNAME → zone Bot Fight Mode 403 to the CI probe (site was live for browsers). Fixed: default the CNAME to DNS-only; probe sends a browser UA and follows redirects.
