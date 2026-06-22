#!/usr/bin/env bash
# check-agent-folder.sh — fail-closed CI gate for the canonical agent-folders
# (templates/system/agents/<name>/, the source of truth defined in
# agents/_spec/agent-folder.spec.md). Twin of check-golden-sync.sh.
#
# Two invariants, both fail-closed:
#   1. SCHEMA   — every agents/<name>/ folder has the 3 required files, and its
#                 agent.yaml / tools.yaml validate against agents/_spec/*.schema.json
#                 (required keys, types, enums, patterns, additionalProperties:false).
#   2. IN-SYNC  — for every foldered agent that ALSO has a committed
#                 workflows/n8n/<name>-agent.json, the deterministic compiler
#                 (scripts/compile-agent.sh) must reproduce that JSON SEMANTICALLY
#                 (normalized diff = empty). This locks the folder and the JSON
#                 together during the transition, before Change 5 flips the
#                 source-of-truth. Skipped for tool-carrying agents until the
#                 compiler grows tool-node injection (compiler v1 = no-tools).
#
# No-op (clean PASS) when there is no agents/ dir — so it is safe to run anywhere,
# including a provisioned system that has not yet received agent-folders.
#
# Deps: jq + python3/pyyaml (the same YAML→JSON bridge compile-agent.sh uses; the
# repo deliberately avoids `yq`). Messages are Hebrew-then-English; exit 0/1.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENTS_DIR="${AGENTS_DIR:-$REPO_ROOT/templates/system/agents}"
WF_DIR="${WF_DIR:-$REPO_ROOT/templates/system/workflows/n8n}"
SPEC_DIR="$AGENTS_DIR/_spec"
COMPILER="${COMPILER:-$REPO_ROOT/templates/system/scripts/compile-agent.sh}"
# shellcheck source=lib/normalize-n8n.sh
. "$REPO_ROOT/scripts/lib/normalize-n8n.sh"

if [ ! -d "$AGENTS_DIR" ]; then
  echo "PASS: אין תיקיית agents/ — אין מה לבדוק (no agents/ dir — nothing to check)."
  exit 0
fi

# norm — STDIN n8n JSON -> canonical form, EVERY id stripped at any depth (the
# round-trip normalizer; matches scripts/tests/compile-agent.bats).
norm() { normalize_n8n | jq -S 'walk(if type=="object" and has("id") then del(.id) else . end)'; }

# validate_schema DOC_YAML SCHEMA_JSON -> 0/1, prints errors. Generic draft-07
# subset: required, additionalProperties:false, type, enum, pattern, min/max,
# array items.enum + uniqueItems. Pure python3+pyyaml (no jsonschema dep).
validate_schema() {
  python3 - "$1" "$2" <<'PY'
import sys, json, re
import yaml
doc_p, sch_p = sys.argv[1], sys.argv[2]
try:
    doc = yaml.safe_load(open(doc_p)) or {}
except Exception as e:
    print(f"ERROR: {doc_p} — YAML לא תקין (invalid YAML): {e}"); sys.exit(1)
sch = json.load(open(sch_p))
errs = []
if not isinstance(doc, dict):
    print(f"ERROR: {doc_p} — חייב להיות מיפוי (must be a mapping)"); sys.exit(1)
props = sch.get("properties", {})
if sch.get("additionalProperties") is False:
    for k in doc:
        if k not in props:
            errs.append(f"מפתח לא מוכר (unexpected key): {k}")
for r in sch.get("required", []):
    if r not in doc:
        errs.append(f"חסר שדה חובה (missing required): {r}")
def chk(name, val, spec):
    t = spec.get("type")
    if t == "string" and not isinstance(val, str): errs.append(f"{name} אינו string")
    if t == "number" and (isinstance(val, bool) or not isinstance(val, (int, float))): errs.append(f"{name} אינו number")
    if t == "boolean" and not isinstance(val, bool): errs.append(f"{name} אינו boolean")
    if t == "array" and not isinstance(val, list): errs.append(f"{name} אינו array")
    if "enum" in spec and val not in spec["enum"]: errs.append(f"{name}={val!r} לא ברשימת enum")
    if "pattern" in spec and isinstance(val, str) and not re.search(spec["pattern"], val): errs.append(f"{name}={val!r} לא תואם pattern {spec['pattern']}")
    if "minimum" in spec and isinstance(val, (int, float)) and not isinstance(val, bool) and val < spec["minimum"]: errs.append(f"{name} < minimum {spec['minimum']}")
    if "maximum" in spec and isinstance(val, (int, float)) and not isinstance(val, bool) and val > spec["maximum"]: errs.append(f"{name} > maximum {spec['maximum']}")
    if t == "array" and isinstance(val, list):
        items = spec.get("items", {})
        if spec.get("uniqueItems") and len(val) != len(set(map(json.dumps, val))): errs.append(f"{name} פריטים כפולים (duplicate items)")
        if "enum" in items:
            for it in val:
                if it not in items["enum"]: errs.append(f"{name}: {it!r} לא ברשימת enum")
for k, v in doc.items():
    if k in props:
        chk(k, v, props[k])
if errs:
    for e in errs: print(f"ERROR: {doc_p} — {e}")
    sys.exit(1)
sys.exit(0)
PY
}

rc=0
found=0
for dir in "$AGENTS_DIR"/*/; do
  name="$(basename "$dir")"
  case "$name" in _*) continue ;; esac   # _spec and any _-prefixed helper dir
  found=1

  # 1. required files
  missing=0
  for f in agent.yaml instructions.md tools.yaml; do
    if [ ! -f "$dir$f" ]; then
      echo "ERROR: agents/$name — קובץ חובה חסר (required file missing): $f" >&2
      rc=1; missing=1
    fi
  done
  [ "$missing" = "1" ] && continue

  # 2. schema validation
  if ! validate_schema "$dir/agent.yaml" "$SPEC_DIR/agent.schema.json" >&2; then rc=1; fi
  if ! validate_schema "$dir/tools.yaml" "$SPEC_DIR/tools.schema.json" >&2; then rc=1; fi

  # 3. generated-in-sync (no-tools agents only — matches compiler v1)
  tool_count="$(python3 -c 'import yaml,sys; d=yaml.safe_load(open(sys.argv[1])) or {}; print(len(d.get("tools") or []))' "$dir/tools.yaml" 2>/dev/null || echo "?")"
  json="$WF_DIR/${name}-agent.json"
  if [ -f "$json" ] && [ "$tool_count" = "0" ]; then
    if ! diff <(bash "$COMPILER" "$name" --agents-dir "$AGENTS_DIR" 2>/dev/null | norm) <(norm < "$json") >/dev/null 2>&1; then
      echo "ERROR: agents/$name סטה מ-$WF_DIR/${name}-agent.json — התיקייה והקובץ הנגזר לא תואמים." >&2
      echo "ERROR: agents/$name drifted from its committed JSON. Recompile and reconcile: bash scripts/compile-agent.sh $name" >&2
      rc=1
    fi
  fi
done

if [ "$found" = "0" ]; then
  echo "PASS: אין תיקיות-סוכן ב-agents/ (only _spec present — nothing to validate)."
  exit 0
fi

if [ "$rc" = "0" ]; then
  echo "PASS: agent-folder check — all folders valid + in sync with their generated JSON."
fi
exit "$rc"
