# Capability Card — publish-static-site

The raw capability behind the factory's "idea → designed site → live URL" publish engine:
take a folder of static files and put it on a **live, public, HTTPS `<slug>.or-infra.com`**
via **Cloudflare Pages Direct Upload** (headless `wrangler`), least-privilege and free.
Proven **outside any abstraction**, directly by the `publish-static-site.yml` workflow run on
`main`, before the engine is wired into the MCP allowlist or wrapped in skills.

| יכולת (capability) | הוכחה גולמית (tool + command) | fixture אמיתי | פלט מצופה | הכרעה | סיכונים / הנחות |
|---|---|---|---|---|---|
| Publish a static folder to a live public URL: runtime-discover the Pages-Write group → mint an account-scoped Pages token + a zone-scoped DNS token (both 1 h, revoked on exit) → `wrangler pages deploy` (Direct Upload) → attach `<slug>.or-infra.com` + proxied CNAME → serve 200 | `publish-static-site.yml` run **27674750310** on `main` (`scripts/publish-static-site.sh`): `wrangler@3 pages deploy` of a minimal `index.html`, `POST …/pages/projects/pages-proof/domains`, CNAME upsert, then `GET https://pages-proof.or-infra.com` | the Stage-1 generated `index.html` (`<h1>✅ Cloudflare Pages Direct Upload — proof OK</h1>`) | `https://pages-proof.or-infra.com` returns **HTTP 200** with that HTML | **go** | First-time custom-domain **activation lag**: a freshly-attached proxied domain returns **403** at the edge for several minutes until Cloudflare activates it (longer than the original 5-min probe) — handled by the activation-aware probe (polls Pages domain status + tolerates 403/000/52x, ~13-min budget). The Pages-Write group id is **not** published → discovered at runtime (Access "Custom Pages" groups are a *different* product and are excluded). |

## Evidence (hand-verified)

- **Discovered permission group:** `Pages Write` = `8d28297797f24fb8a0c332fe0866ec89` (the runtime selector correctly excluded the Cloudflare **Access** look-alikes `Access: Custom Pages Write` etc. that caused the first run's `10000 Authentication error`).
- **Live flow (run 27674750310):** Pages token minted + DNS token minted → project `pages-proof` created → `wrangler` Direct Upload `✨ Deployment complete` (`https://08db4ced.pages-proof.pages.dev`) → custom domain `pages-proof.or-infra.com` attached → CNAME `pages-proof.or-infra.com → pages-proof.pages.dev` (proxied) created → **both scoped tokens revoked by the EXIT trap**.
- **Functional proof:** the run's final probe red-flagged only because the 5-min budget expired during first-time activation (403). The domain activated minutes later: `probe_endpoint https://pages-proof.or-infra.com` → **HTTP 200** with the exact proof HTML (verified 2026-06-17). Capability confirmed; the only gap was the probe budget, fixed in the script.
- **Security held:** both failed runs revoked both scoped tokens in the EXIT trap (no surviving `publish-*` token). Auth is the broker SA via WIF; tokens are `::add-mask::`'d the instant they are minted.

verdict: go
