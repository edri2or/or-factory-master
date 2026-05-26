#!/usr/bin/env bash
# Sourceable library: create or update a Linear issue for a factory event.
# Exposes one function, create_or_update_linear_issue. It is strictly
# soft-fail: any network/API/parse error prints a single
# [linear] action='failed' ... line to stdout and returns 0. It never
# causes a non-zero exit, so a dead Linear never fails the caller.
#
# create_or_update_linear_issue EVENT_JSON LINEAR_TOKEN LINEAR_TEAM_ID
#
# Dedup: sha256("<otel.event.name>::<factory.system_name|_global>")[:12].
# An open issue (state backlog|unstarted|started) carrying that key in its
# description, updated <24h ago, gets a comment instead of a new issue.

LINEAR_API_URL="https://api.linear.app/graphql"

# Map a managed label name to its Linear colour. source-* and anything
# unmapped fall back to a neutral grey.
_linear_label_color() {
  case "$1" in
    factory)           echo "#5E6AD2" ;;
    auto-created)      echo "#95A2B3" ;;
    severity-info)     echo "#4EA7FC" ;;
    severity-warning)  echo "#F2994A" ;;
    severity-error)    echo "#EB5757" ;;
    severity-critical) echo "#9F1239" ;;
    *)                 echo "#6B7280" ;;
  esac
}

_linear_fail() {
  echo "[linear] action='failed' error='${1}'"
  return 0
}

# Run one GraphQL operation. Args: QUERY VARIABLES_JSON. Echoes the raw
# response on success; returns non-zero on transport error or GraphQL errors.
# Reads LINEAR_TOKEN from the caller's scope (bash dynamic scoping).
_linear_gql() {
  local q="$1" vars="$2" payload resp
  payload=$(jq -cn --arg q "$q" --argjson v "$vars" '{query:$q, variables:$v}') || return 1
  resp=$(curl -sS -m 15 -X POST "$LINEAR_API_URL" \
    -H "Authorization: ${LINEAR_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$payload") || return 1
  [ -n "$resp" ] || return 1
  if [ "$(jq -r 'has("errors")' <<<"$resp" 2>/dev/null)" = "true" ]; then
    return 1
  fi
  printf '%s' "$resp"
}

# Resolve a label name to its id, creating it (with its mapped colour) if it
# does not exist. Reads LABELS_JSON + LINEAR_TEAM_ID from the caller's scope.
_linear_ensure_label() {
  local name="$1" id color resp
  id=$(jq -r --arg n "$name" '.[] | select(.name == $n) | .id' <<<"$LABELS_JSON" | head -n1)
  if [ -n "$id" ]; then printf '%s' "$id"; return 0; fi
  color=$(_linear_label_color "$name")
  resp=$(_linear_gql \
    'mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success issueLabel{ id } } }' \
    "$(jq -cn --arg name "$name" --arg color "$color" --arg team "$LINEAR_TEAM_ID" \
        '{input:{name:$name, color:$color, teamId:$team}}')") || return 1
  id=$(jq -r '.data.issueLabelCreate.issueLabel.id // empty' <<<"$resp")
  [ -n "$id" ] || return 1
  printf '%s' "$id"
}

create_or_update_linear_issue() {
  local EVENT_JSON="$1" LINEAR_TOKEN="$2" LINEAR_TEAM_ID="$3"

  command -v jq >/dev/null 2>&1 || { _linear_fail "jq not available"; return 0; }
  command -v curl >/dev/null 2>&1 || { _linear_fail "curl not available"; return 0; }
  [ -n "$LINEAR_TOKEN" ] || { _linear_fail "missing linear token"; return 0; }
  [ -n "$LINEAR_TEAM_ID" ] || { _linear_fail "missing linear team id"; return 0; }

  local event_name system_name severity workflow
  event_name=$(jq -r '."otel.event.name" // empty' <<<"$EVENT_JSON" 2>/dev/null)
  system_name=$(jq -r '."factory.system_name" // empty' <<<"$EVENT_JSON" 2>/dev/null)
  severity=$(jq -r '.severity_text // empty' <<<"$EVENT_JSON" 2>/dev/null)
  workflow=$(jq -r '."factory.workflow" // empty' <<<"$EVENT_JSON" 2>/dev/null)
  [ -n "$event_name" ] || { _linear_fail "event has no otel.event.name"; return 0; }

  local dedup_src dedup_key
  dedup_src="${event_name}::${system_name:-_global}"
  dedup_key=$(printf '%s' "$dedup_src" | sha256sum | cut -c1-12)

  local source
  case "$workflow" in
    provision-system.yml) source="source-provision" ;;
    *deploy*)             source="source-deploy" ;;
    audit-*)              source="source-audit" ;;
    system-runtime-*)     source="source-runtime" ;;
    *)                    source="source-other" ;;
  esac

  # --- Look for an existing open issue carrying this dedup key ---
  local search_resp match
  search_resp=$(_linear_gql \
    'query($teamId: ID!){ issues(first:25, filter:{ team:{ id:{ eq:$teamId } }, state:{ type:{ in:["backlog","unstarted","started"] } } }){ nodes{ id identifier description updatedAt url } } }' \
    "$(jq -cn --arg t "$LINEAR_TEAM_ID" '{teamId:$t}')") \
    || { _linear_fail "issue search failed"; return 0; }

  match=$(jq -c --arg dk "dedup:${dedup_key}" \
    '[.data.issues.nodes[] | select(.description != null and (.description | contains($dk)))] | first // empty' \
    <<<"$search_resp" 2>/dev/null)

  if [ -n "$match" ] && [ "$match" != "null" ]; then
    local existing_id existing_updated updated_epoch now_epoch age
    existing_id=$(jq -r '.id' <<<"$match")
    existing_updated=$(jq -r '.updatedAt' <<<"$match")
    updated_epoch=$(date -d "$existing_updated" +%s 2>/dev/null || echo 0)
    now_epoch=$(date -u +%s)
    age=$(( now_epoch - updated_epoch ))
    if [ "$updated_epoch" -gt 0 ] && [ "$age" -lt 86400 ]; then
      local cbody comment_resp
      cbody='```json'$'\n'"${EVENT_JSON}"$'\n''```'
      comment_resp=$(_linear_gql \
        'mutation($issueId: String!, $body: String!){ commentCreate(input:{ issueId:$issueId, body:$body }){ success } }' \
        "$(jq -cn --arg i "$existing_id" --arg b "$cbody" '{issueId:$i, body:$b}')") \
        || { _linear_fail "commentCreate failed"; return 0; }
      echo "[linear] action='updated' issue_id='${existing_id}' dedup_key='${dedup_key}'"
      return 0
    fi
    # Found but stale (>24h) — fall through and open a fresh issue.
  fi

  # --- Resolve label ids (creating managed labels as needed) ---
  local labels_resp
  labels_resp=$(_linear_gql 'query{ issueLabels(first:250){ nodes{ id name } } }' '{}') \
    || { _linear_fail "issueLabels query failed"; return 0; }
  local LABELS_JSON
  LABELS_JSON=$(jq -c '.data.issueLabels.nodes' <<<"$labels_resp")

  local label_names=(factory auto-created "severity-${severity}" "$source")
  case "$severity" in error|critical) label_names+=(Bug) ;; esac

  local label_ids=() ln lid bid
  for ln in "${label_names[@]}"; do
    if [ "$ln" = "Bug" ]; then
      # Bug is a pre-existing standard label — use it if present, never create it.
      bid=$(jq -r --arg n "Bug" '.[] | select(.name == $n) | .id' <<<"$LABELS_JSON" | head -n1)
      [ -n "$bid" ] && label_ids+=("$bid")
      continue
    fi
    lid=$(_linear_ensure_label "$ln") || { _linear_fail "label '${ln}' could not be ensured"; return 0; }
    label_ids+=("$lid")
  done
  local labels_json
  labels_json=$(printf '%s\n' "${label_ids[@]}" | jq -R . | jq -sc .)

  # --- Priority + title + description, then create ---
  local prio
  case "$severity" in
    critical) prio=1 ;;
    error)    prio=2 ;;
    warning)  prio=3 ;;
    info)     prio=4 ;;
    *)        prio=0 ;;
  esac

  local title description
  title="[${severity}] ${event_name} — ${system_name:-global}"
  description='<!-- dedup:'"${dedup_key}"' -->'$'\n\n''```json'$'\n'"${EVENT_JSON}"$'\n''```'

  local input create_resp new_id
  input=$(jq -cn \
    --arg team "$LINEAR_TEAM_ID" \
    --arg title "$title" \
    --arg desc "$description" \
    --argjson labels "$labels_json" \
    --argjson prio "$prio" \
    '{teamId:$team, title:$title, description:$desc, labelIds:$labels, priority:$prio}')
  create_resp=$(_linear_gql \
    'mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue{ id identifier url } } }' \
    "$(jq -cn --argjson i "$input" '{input:$i}')") \
    || { _linear_fail "issueCreate failed"; return 0; }
  new_id=$(jq -r '.data.issueCreate.issue.id // empty' <<<"$create_resp")
  [ -n "$new_id" ] || { _linear_fail "issueCreate returned no id"; return 0; }
  echo "[linear] action='created' issue_id='${new_id}' dedup_key='${dedup_key}'"
  return 0
}
