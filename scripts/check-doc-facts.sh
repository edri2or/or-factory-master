#!/usr/bin/env bash
# check-doc-facts.sh — documentation drift prevention, Layer 2 (the pillar).
#
# Asserts that a FACT extracted from the code equals the fact a doc DECLARES.
# This is what catches the recorded "8 vs 4" event: the code defined 8 named
# Postgres queries while AGENTS.md documented 4, and no presence/structure gate
# noticed. A presence gate asks "does the doc exist?"; this asks "does the doc
# tell the truth?".
#
# Declarative + extensible: every check in monitoring/doc-fact-checks.json names
# a `type` plus a code-side and doc-side `extractor`. Each extractor is a bash
# function dispatched by a `case`; adding a check of an existing shape is pure
# data, a new shape is one function + one bats case.
#
# Runs in the "Changelog gates" job. Read-only; needs no secrets. It scans the
# committed registry every run (not the diff) — a fact must hold on every commit.
#
# Env: FACT_CHECKS_FILE (default monitoring/doc-fact-checks.json) — overridable
# so the bats acceptance test can point it at a fixture.
#
# Exit 0 = every enforced fact holds; 1 = a mismatch, an unextractable fact
# (fail-closed), or a malformed registry.
set -euo pipefail

FACT_CHECKS_FILE="${FACT_CHECKS_FILE:-monitoring/doc-fact-checks.json}"

if [ ! -f "$FACT_CHECKS_FILE" ]; then
  echo "ERROR: פנקס בדיקות-העובדות לא נמצא: $FACT_CHECKS_FILE" >&2
  echo "ERROR: doc fact-checks registry not found: $FACT_CHECKS_FILE" >&2
  exit 1
fi
if ! jq empty "$FACT_CHECKS_FILE" 2>/dev/null; then
  echo "ERROR: פנקס בדיקות-העובדות אינו JSON תקין: $FACT_CHECKS_FILE" >&2
  echo "ERROR: doc fact-checks registry is not valid JSON: $FACT_CHECKS_FILE" >&2
  exit 1
fi

# --- code-side extractors ------------------------------------------------------

# jq_const_array: pull a JS `const <var> = [ '...', '...' ]` array out of an n8n
# code node's jsCode and emit its single-quoted members as a sorted set.
# arg = "<node name>::<const var name>".
_extract_jq_const_array() {
  local file="$1" arg="$2" node var code
  node="${arg%%::*}"
  var="${arg##*::}"
  code=$(jq -r --arg n "$node" '.nodes[]? | select(.name==$n) | .parameters.jsCode // empty' "$file" 2>/dev/null || true)
  [ -n "$code" ] || return 1
  printf '%s' "$code" \
    | grep -oE "const ${var} = \[[^]]*\]" \
    | grep -oE "'[a-z0-9_]+'" \
    | tr -d "'" \
    | LC_ALL=C sort -u
}

# --- doc-side extractors -------------------------------------------------------

# md_backtick_list_on_line: on the first line containing the anchor substring,
# take everything after the first ": " (so a pre-colon backticked token like
# `postgres_named_query` is excluded) and emit the backticked snake_case tokens
# as a sorted set. arg = the anchor substring.
_extract_md_backtick_list() {
  local file="$1" anchor="$2" line rest
  line=$(grep -F "$anchor" "$file" 2>/dev/null | head -1 || true)
  [ -n "$line" ] || return 1
  rest="${line#*: }"
  printf '%s' "$rest" \
    | grep -oE '`[a-z0-9_]+`' \
    | tr -d '`' \
    | LC_ALL=C sort -u
}

# --- dispatch ------------------------------------------------------------------

extract_code() { # extractor file arg
  case "$1" in
    jq_const_array) _extract_jq_const_array "$2" "$3" ;;
    *) echo "ERROR: unknown code extractor '$1'." >&2; return 2 ;;
  esac
}

extract_doc() { # extractor file arg
  case "$1" in
    md_backtick_list_on_line) _extract_md_backtick_list "$2" "$3" ;;
    *) echo "ERROR: unknown doc extractor '$1'." >&2; return 2 ;;
  esac
}

# --- run -----------------------------------------------------------------------

fail=0
count=0
while IFS=$'\t' read -r id type cfile cextr carg dfile dextr darg; do
  [ -n "${id:-}" ] || continue
  count=$((count + 1))

  code_set=$(extract_code "$cextr" "$cfile" "$carg" || true)
  doc_set=$(extract_doc "$dextr" "$dfile" "$darg" || true)

  # Fail closed: an empty extraction means the code structure or the doc anchor
  # moved — a structural drift, NOT a silent pass on an empty comparison.
  if [ -z "$code_set" ]; then
    echo "ERROR: [$id] לא ניתן לחלץ את העובדה מהקוד ($cfile · $cextr '$carg') — ייתכן שמבנה הקוד השתנה." >&2
    echo "ERROR: [$id] could not extract the fact from code ($cfile via $cextr '$carg') — the code structure may have changed." >&2
    fail=1; continue
  fi
  if [ -z "$doc_set" ]; then
    echo "ERROR: [$id] לא ניתן לחלץ את המוצהר מהתיעוד ($dfile · anchor '$darg')." >&2
    echo "ERROR: [$id] could not extract the declared fact from the doc ($dfile, anchor '$darg')." >&2
    fail=1; continue
  fi

  case "$type" in
    name_set)
      if [ "$code_set" != "$doc_set" ]; then
        only_code=$(comm -23 <(printf '%s\n' "$code_set") <(printf '%s\n' "$doc_set") | tr '\n' ' ')
        only_doc=$(comm -13 <(printf '%s\n' "$code_set") <(printf '%s\n' "$doc_set") | tr '\n' ' ')
        echo "ERROR: [$id] אי-התאמה בין הקוד לתיעוד (סחיפת-תוכן)." >&2
        echo "ERROR: [$id] code/doc mismatch — documentation content drift." >&2
        [ -n "${only_code// /}" ] && echo "  בקוד אך לא בתיעוד / in code, missing from the doc: ${only_code% }" >&2
        [ -n "${only_doc// /}" ]  && echo "  בתיעוד אך לא בקוד / in the doc, missing from code: ${only_doc% }" >&2
        echo "  תקן: עדכן את $dfile שיתאר בדיוק את $cfile — או הוסף doc-waiver אם זו החלטה מודעת (docs/doc-drift-prevention.md)." >&2
        fail=1
      fi
      ;;
    *)
      echo "ERROR: [$id] סוג בדיקה לא ידוע '$type'." >&2
      echo "ERROR: [$id] unknown check type '$type'." >&2
      fail=1
      ;;
  esac
done < <(jq -r '.checks[]? | select(.enforce == true) | [.id, .type, .code.file, .code.extractor, .code.arg, .doc.file, .doc.extractor, .doc.arg] | @tsv' "$FACT_CHECKS_FILE")

if [ "$fail" -ne 0 ]; then
  echo "doc fact-check FAILED — a documented fact no longer matches the code (see $FACT_CHECKS_FILE, docs/doc-drift-prevention.md)." >&2
  exit 1
fi

echo "PASS: doc fact-check — $count enforced fact(s) match the code."
