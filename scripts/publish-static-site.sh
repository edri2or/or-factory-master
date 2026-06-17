#!/usr/bin/env bash
# publish-static-site.sh — publish a static site folder to Cloudflare Pages
# (Direct Upload, headless) and attach <slug>.or-infra.com.
#
# This is the factory's "idea -> designed site -> live URL" publish engine.
# It is factory-native: it reuses the existing scoped-token mint/revoke pattern
# (services/mcp-server/src/cloudflare-client.ts + the system deploy workflow's
# Configure-Cloudflare-DNS step) and runs as the broker SA via WIF.
#
# Least-privilege: it mints TWO short-lived (1h) scoped tokens from the
# token-MANAGEMENT token (cloudflare-token-creator) and revokes BOTH on exit:
#   - a Pages token  (account-scoped: com.cloudflare.api.account.<acct>) for
#     the project create + Direct Upload + custom-domain attach, and
#   - a DNS token    (zone-scoped:    com.cloudflare.api.account.zone.<zone>)
#     for the CNAME upsert.
# It never prints a secret value (tokens are ::add-mask::'d the moment minted).
#
# Stage 1 (capability-first proof): SITE_DIR is optional — if unset, a tiny
# inline index.html is generated so the RAW capability (Pages token mint +
# wrangler Direct Upload + domain attach + revoke) is proven on its own.
# Stage 2 hardens this (source-repo checkout, emit events, SSL retry budget).
#
# Required env:
#   SLUG               Cloudflare Pages project name == subdomain label (<slug>.or-infra.com)
#   CF_ACCOUNT_ID      from secret cloudflare-account-id
#   CF_TOKEN_CREATOR   from secret cloudflare-token-creator  (User:API Tokens:Edit)
#   CF_ZONE_ID         from secret cloudflare-zone-id-or-infra
# Optional env:
#   SITE_DIR           directory of static files to publish (default: generated minimal page)
#   ZONE_NAME          apex zone (default: or-infra.com)
#   WRANGLER_VERSION   npm version spec for wrangler (default: 3)
#   PAGES_PROXIED      proxy the custom-domain CNAME through Cloudflare (default: true)
#   PROBE_TRIES        live-probe / activation-wait attempts (default: 40)
#   PROBE_SLEEP        seconds between probe attempts (default: 20)

set -euo pipefail

CF_API="https://api.cloudflare.com/client/v4"
ZONE_NAME="${ZONE_NAME:-or-infra.com}"
WRANGLER_VERSION="${WRANGLER_VERSION:-3}"
PAGES_PROXIED="${PAGES_PROXIED:-true}"
PROBE_TRIES="${PROBE_TRIES:-40}"   # first-time Pages activation can take >5 min
PROBE_SLEEP="${PROBE_SLEEP:-20}"   # 40 x 20s ≈ 13 min activation budget
DNS_GROUP_ID="4755a26eedb94da69e1066d98aa820be"  # Zone:DNS:Edit (same id the deploy workflow uses)

# ---- validate inputs -------------------------------------------------------
: "${SLUG:?SLUG is required}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID is required}"
: "${CF_TOKEN_CREATOR:?CF_TOKEN_CREATOR is required}"
: "${CF_ZONE_ID:?CF_ZONE_ID is required}"

if ! printf '%s' "$SLUG" | grep -Eq '^[a-z0-9][a-z0-9-]{1,56}[a-z0-9]$'; then
  echo "FAIL: SLUG '$SLUG' must be lowercase alphanumeric/hyphen (Cloudflare Pages project-name rules)." >&2
  exit 1
fi

FQDN="${SLUG}.${ZONE_NAME}"
echo "publish-static-site: slug=${SLUG} fqdn=${FQDN} zone=${ZONE_NAME}"

# ---- helpers ---------------------------------------------------------------
# cf_get/cf_post with a given bearer; echo the raw response body.
cf() {  # cf <method> <url> <bearer> [data]
  local method="$1" url="$2" bearer="$3" data="${4:-}"
  if [ -n "$data" ]; then
    curl -sS -X "$method" "$url" \
      -H "Authorization: Bearer ${bearer}" \
      -H "Content-Type: application/json" \
      --data "$data"
  else
    curl -sS -X "$method" "$url" -H "Authorization: Bearer ${bearer}"
  fi
}

mint_token() {  # mint_token <name> <resources-json> <group-id> ; sets MINTED_VALUE/MINTED_ID
  local name="$1" resources="$2" group="$3" expires resp
  expires=$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)
  resp=$(cf POST "${CF_API}/user/tokens" "$CF_TOKEN_CREATOR" \
    "$(jq -cn --arg name "$name" --argjson res "$resources" --arg grp "$group" --arg exp "$expires" \
      '{name:$name,policies:[{effect:"allow",resources:$res,permission_groups:[{id:$grp}]}],expires_on:$exp}')")
  MINTED_VALUE=$(printf '%s' "$resp" | jq -r '.result.value // empty')
  MINTED_ID=$(printf '%s' "$resp" | jq -r '.result.id // empty')
  if [ -z "$MINTED_VALUE" ] || [ "$MINTED_VALUE" = "null" ]; then
    echo "FAIL: could not mint token '$name'" >&2
    printf '%s' "$resp" | jq '{success,errors,messages}' >&2 || true
    exit 1
  fi
  echo "::add-mask::${MINTED_VALUE}"
}

# ---- 1. discover the Cloudflare Pages edit permission group id -------------
# The id isn't published, so resolve it at runtime. CAREFUL: Cloudflare Access
# (Zero Trust) ships a similarly-named "Access: Custom Pages Write" group — a
# DIFFERENT product. A token scoped to it yields a 10000 "Authentication error"
# against the Pages API. So EXCLUDE any access/custom group and require the real
# Cloudflare Pages edit group (name has "pages" + "write"/"edit", no access/custom).
echo "Discovering the Cloudflare Pages edit permission group..."
PG_RESP=$(cf GET "${CF_API}/user/tokens/permission_groups" "$CF_TOKEN_CREATOR")
[ "$(printf '%s' "$PG_RESP" | jq -r '.success')" = "true" ] \
  || { echo "FAIL: could not list permission groups: $(printf '%s' "$PG_RESP" | jq -c '{success,errors}')" >&2; exit 1; }
echo "Candidate 'pages' permission groups (name [id]):"
printf '%s' "$PG_RESP" | jq -r '.result[] | select(.name | test("pages";"i")) | "  - \(.name) [\(.id)]"'
PAGES_GROUP_ID=$(printf '%s' "$PG_RESP" | jq -r '
  [ .result[]
    | select((.name | test("pages"; "i"))
             and (.name | test("write|edit"; "i"))
             and ((.name | test("access|custom"; "i")) | not))
  ]
  | (map(select(.name | test("^(cloudflare )?pages[: ]+(write|edit)$"; "i"))) + .)
  | .[0].id // empty')
PAGES_GROUP_NAME=$(printf '%s' "$PG_RESP" | jq -r --arg id "$PAGES_GROUP_ID" '.result[] | select(.id==$id) | .name')
[ -n "$PAGES_GROUP_ID" ] || { echo "FAIL: no real Cloudflare Pages edit permission group found (excluding Access/Custom)." >&2; exit 1; }
echo "PASS: Pages permission group = '${PAGES_GROUP_NAME}' (id=${PAGES_GROUP_ID})"

# ---- 2. mint the two scoped tokens + arm the revoke trap -------------------
mint_token "publish-pages-${SLUG}" "$(jq -cn --arg a "$CF_ACCOUNT_ID" '{("com.cloudflare.api.account."+$a):"*"}')" "$PAGES_GROUP_ID"
PAGES_TOKEN="$MINTED_VALUE"; PAGES_TOKEN_ID="$MINTED_ID"
echo "PASS: Pages token minted (id=${PAGES_TOKEN_ID})"

revoke_tokens() {
  for tid in "${PAGES_TOKEN_ID:-}" "${DNS_TOKEN_ID:-}"; do
    [ -n "$tid" ] || continue
    curl -sS -X DELETE "${CF_API}/user/tokens/${tid}" -H "Authorization: Bearer ${CF_TOKEN_CREATOR}" >/dev/null 2>&1 \
      && echo "Scoped token revoked (id=${tid})." \
      || echo "::warning::could not revoke token ${tid} (auto-expires in 1h)"
  done
}
trap revoke_tokens EXIT

mint_token "publish-dns-${SLUG}" "$(jq -cn --arg z "$CF_ZONE_ID" '{("com.cloudflare.api.account.zone."+$z):"*"}')" "$DNS_GROUP_ID"
DNS_TOKEN="$MINTED_VALUE"; DNS_TOKEN_ID="$MINTED_ID"
echo "PASS: DNS token minted (id=${DNS_TOKEN_ID})"

# ---- 3. resolve the site directory (Stage 1: inline minimal page) ----------
if [ -z "${SITE_DIR:-}" ]; then
  SITE_DIR="$(mktemp -d)"
  cat > "${SITE_DIR}/index.html" <<HTML
<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>publish-static-site proof</title></head>
<body style="font-family:system-ui;text-align:center;padding:4rem">
<h1>✅ Cloudflare Pages Direct Upload — proof OK</h1>
<p>slug: ${SLUG}</p></body></html>
HTML
  echo "INFO: no SITE_DIR given — generated a minimal proof page at ${SITE_DIR}"
fi
[ -f "${SITE_DIR}/index.html" ] || { echo "FAIL: ${SITE_DIR}/index.html not found." >&2; exit 1; }

# ---- 4. create the Pages project (idempotent: GET then POST) ---------------
echo "Ensuring Pages project '${SLUG}' exists..."
GET_PROJ=$(cf GET "${CF_API}/accounts/${CF_ACCOUNT_ID}/pages/projects/${SLUG}" "$PAGES_TOKEN")
if [ "$(printf '%s' "$GET_PROJ" | jq -r '.success')" = "true" ]; then
  echo "INFO: Pages project '${SLUG}' already exists."
else
  CREATE_PROJ=$(cf POST "${CF_API}/accounts/${CF_ACCOUNT_ID}/pages/projects" "$PAGES_TOKEN" \
    "$(jq -cn --arg n "$SLUG" '{name:$n,production_branch:"main"}')")
  if [ "$(printf '%s' "$CREATE_PROJ" | jq -r '.success')" = "true" ]; then
    echo "PASS: Pages project '${SLUG}' created."
  else
    echo "FAIL: could not create Pages project '${SLUG}': $(printf '%s' "$CREATE_PROJ" | jq -c '{success,errors}')" >&2
    exit 1
  fi
fi

# ---- 5. Direct Upload via wrangler -----------------------------------------
echo "Deploying '${SITE_DIR}' to Pages project '${SLUG}' via wrangler Direct Upload..."
CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID" CLOUDFLARE_API_TOKEN="$PAGES_TOKEN" \
  npx --yes "wrangler@${WRANGLER_VERSION}" pages deploy "$SITE_DIR" \
    --project-name="$SLUG" --branch=main --commit-dirty=true
echo "PASS: wrangler Direct Upload completed."

# ---- 6. attach the custom domain (idempotent) ------------------------------
echo "Attaching custom domain ${FQDN}..."
DOM_RESP=$(cf POST "${CF_API}/accounts/${CF_ACCOUNT_ID}/pages/projects/${SLUG}/domains" "$PAGES_TOKEN" \
  "$(jq -cn --arg n "$FQDN" '{name:$n}')")
if [ "$(printf '%s' "$DOM_RESP" | jq -r '.success')" = "true" ]; then
  echo "PASS: custom domain ${FQDN} attached."
else
  # Tolerate "already added" — confirm by listing.
  LIST_DOM=$(cf GET "${CF_API}/accounts/${CF_ACCOUNT_ID}/pages/projects/${SLUG}/domains" "$PAGES_TOKEN")
  if printf '%s' "$LIST_DOM" | jq -e --arg n "$FQDN" '.result[]? | select(.name==$n)' >/dev/null 2>&1; then
    echo "INFO: custom domain ${FQDN} already attached."
  else
    echo "FAIL: could not attach ${FQDN}: $(printf '%s' "$DOM_RESP" | jq -c '{success,errors}')" >&2
    exit 1
  fi
fi

# ---- 7. upsert the CNAME (<slug> -> <slug>.pages.dev) ----------------------
CNAME_TARGET="${SLUG}.pages.dev"
echo "Upserting CNAME ${FQDN} -> ${CNAME_TARGET} (proxied=${PAGES_PROXIED})..."
LIST=$(cf GET "${CF_API}/zones/${CF_ZONE_ID}/dns_records?type=CNAME&name=${FQDN}" "$DNS_TOKEN")
[ "$(printf '%s' "$LIST" | jq -r '.success')" = "true" ] || { echo "FAIL: CF list ${FQDN}: $LIST" >&2; exit 1; }
REC_ID=$(printf '%s' "$LIST" | jq -r '.result[0].id // ""')
BODY=$(jq -cn --arg name "$FQDN" --arg content "$CNAME_TARGET" --argjson proxied "$PAGES_PROXIED" \
  '{type:"CNAME",name:$name,content:$content,ttl:1,proxied:$proxied,comment:"managed-by=or-factory-master publish-static-site"}')
if [ -z "$REC_ID" ]; then
  RESP=$(cf POST "${CF_API}/zones/${CF_ZONE_ID}/dns_records" "$DNS_TOKEN" "$BODY")
  [ "$(printf '%s' "$RESP" | jq -r '.success')" = "true" ] || { echo "FAIL: CF create CNAME ${FQDN}: $RESP" >&2; exit 1; }
  echo "PASS: CNAME created: ${FQDN} -> ${CNAME_TARGET}"
else
  RESP=$(cf PUT "${CF_API}/zones/${CF_ZONE_ID}/dns_records/${REC_ID}" "$DNS_TOKEN" "$BODY")
  [ "$(printf '%s' "$RESP" | jq -r '.success')" = "true" ] || { echo "FAIL: CF update CNAME ${FQDN}: $RESP" >&2; exit 1; }
  echo "PASS: CNAME updated: ${FQDN} -> ${CNAME_TARGET}"
fi

# ---- 8. wait for activation, then confirm the live URL serves 200 ----------
# First-time Pages custom-domain activation (proxied CNAME -> *.pages.dev)
# returns HTTP 403 at the edge until Cloudflare finishes verifying the domain
# and provisioning its cert — empirically this can take well over 5 minutes.
# So poll BOTH the authoritative Pages domain status AND the live URL on a
# generous budget, treating 403/000/52x as "still activating" (not a failure);
# succeed the instant the URL returns 200. (A re-run of an already-active
# domain returns 200 on the first attempt.)
DOMAIN_URL="${CF_API}/accounts/${CF_ACCOUNT_ID}/pages/projects/${SLUG}/domains/${FQDN}"
echo "Waiting for ${FQDN} to activate + serve 200 (up to ${PROBE_TRIES} x ${PROBE_SLEEP}s)..."
LIVE=0
for i in $(seq 1 "$PROBE_TRIES"); do
  STATUS=$(cf GET "$DOMAIN_URL" "$PAGES_TOKEN" | jq -r '.result.status // "unknown"' 2>/dev/null || echo "unknown")
  CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://${FQDN}" || echo "000")
  echo "  attempt ${i}: domain status=${STATUS}, HTTP ${CODE}"
  if [ "$CODE" = "200" ]; then LIVE=1; break; fi
  sleep "$PROBE_SLEEP"
done
if [ "$LIVE" = "1" ]; then
  echo "PASS: https://${FQDN} is live (HTTP 200)."
else
  echo "FAIL: https://${FQDN} did not return 200 within the ${PROBE_TRIES}x${PROBE_SLEEP}s budget (last domain status logged above)." >&2
  exit 1
fi

echo "DONE: published ${SLUG} -> https://${FQDN}"
