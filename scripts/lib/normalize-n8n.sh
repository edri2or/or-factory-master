#!/usr/bin/env bash
# normalize-n8n.sh — canonicalize an n8n workflow JSON so that COSMETIC-only
# diffs (a node repositioned in the editor, a regenerated id, reordered object
# keys) are not mistaken for a REAL content change by the doc-binding gate
# (scripts/check-doc-binding.sh).
#
# Why: an n8n workflow JSON is ~mostly editor metadata. The n8n community figure
# is that the great majority of lines in a workflow diff are position/id noise.
# If the binding gate treated every such diff as "the workflow changed", it would
# demand a doc update for a pure drag-of-a-node — pure false-positive friction.
# Normalizing first means the gate only fires on a SEMANTIC change.
#
# Exposes ONE function, normalize_n8n, that reads an n8n workflow JSON on STDIN
# and writes a canonical form on STDOUT:
#   - drops volatile TOP-LEVEL fields: id, versionId, meta, pinData, tags, staticData
#   - drops per-node COSMETIC fields:  position, id, webhookId
#   - sorts object keys (jq -S) so a pure key-reorder is not a diff
# Everything semantic is kept: each node's name / type / typeVersion / parameters,
# and the connections graph.
#
# This file is SOURCED, not executed (like scripts/lib/event-formatter.sh):
#   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#   . "${SCRIPT_DIR}/lib/normalize-n8n.sh"
# It therefore defines a function only and sets no shell options on the caller.

# normalize_n8n: STDIN n8n workflow JSON  ->  STDOUT canonical JSON.
# Returns jq's exit status, so MALFORMED JSON on STDIN is a loud, non-zero
# failure the caller can detect (the gate treats "couldn't normalize" as a real
# change, never as "no change").
normalize_n8n() {
  jq -S '
    del(.id, .versionId, .meta, .pinData, .tags, .staticData)
    | if has("nodes")
      then .nodes |= map(del(.position, .id, .webhookId))
      else .
      end
  '
}
