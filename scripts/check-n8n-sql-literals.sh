#!/usr/bin/env bash
# check-n8n-sql-literals.sh — guard the JSON.stringify-in-SQL antipattern in n8n
# postgres queries.
#
# THE BUG (bit 3 workers live; one was silently masked by onError):
#   A value interpolated into a postgres `query` via an n8n `{{ ... }}` expression
#   must become a SQL *string literal* (single-quoted). `JSON.stringify(...)` emits
#   DOUBLE quotes — and Postgres reads "..." as an IDENTIFIER (a column name). So
#     ... WHERE session_id = 'tg:' || {{ JSON.stringify('@@CHAT_ID@@') }}   -> "5786..."  -> `column "5786..." does not exist`
#     ... VALUES (..., {{ JSON.stringify(JSON.stringify($json.profile)) }}::jsonb, ...)    -> `Syntax error near "language_primary"`
#   Both ran on every schedule and never once succeeded.
#
# THE RULE: inside a postgres `query`, any `{{ ... }}` block that calls
# `JSON.stringify` MUST be emitted as a single-quoted SQL literal — either
#   (A) the SQL wraps the block:        '{{ ... }}'
#   (B) the expression builds the quotes: {{ "'" + JSON.stringify(x)... + "'" }}
# Anything else is flagged. This is precise: `JSON.stringify` is legitimate in
# httpRequest jsonBody / jwt claimsJson / chainLlm text / code jsCode — this check
# ONLY inspects postgres query strings, so those are never touched.
#
# Usage: check-n8n-sql-literals.sh [root]   (root default: templates/system/workflows/n8n)
# Exit 0 = clean, 1 = a violation (or a malformed JSON file).
set -euo pipefail

ROOT="${1:-templates/system/workflows/n8n}"

python3 - "$ROOT" <<'PY'
import sys, os, json, glob, re

root = sys.argv[1]
block_re = re.compile(r'\{\{.*?\}\}', re.DOTALL)
SQ = '"' + "'" + '"'   # the 3-char token "'" — the expression-side single-quote wrap (condition B)

violations = []
files = sorted(glob.glob(os.path.join(root, "*.json")))

for f in files:
    try:
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as e:  # noqa: BLE001 — a malformed template is itself a failure
        violations.append((f, "(file)", f"invalid JSON: {e}"))
        continue
    for node in (data.get("nodes") or []):
        if node.get("type") != "n8n-nodes-base.postgres":
            continue
        query = ((node.get("parameters") or {}).get("query")) or ""
        if "JSON.stringify" not in query:
            continue
        for m in block_re.finditer(query):
            block = m.group(0)
            if "JSON.stringify" not in block:
                continue
            # (B) the expression builds its own SQL single-quotes.
            if SQ in block:
                continue
            # (A) the SQL wraps the block in single-quotes immediately around it.
            before = query[m.start() - 1] if m.start() > 0 else ""
            after = query[m.end()] if m.end() < len(query) else ""
            if before == "'" and after == "'":
                continue
            violations.append((f, node.get("name", "?"), block.strip()))

if violations:
    sys.stderr.write(
        "ERROR: JSON.stringify inside an n8n postgres query without SQL single-quoting.\n"
        "JSON.stringify emits DOUBLE quotes; Postgres reads \"...\" as an identifier "
        "(column name) -> `column \"...\" does not exist` / `Syntax error`.\n"
        "Fix: emit a SQL string literal — '{{ ... }}' or {{ \"'\" + expr + \"'\" }} "
        "(single-quote it; escape inner quotes with .split(\"'\").join(\"''\")).\n"
    )
    for f, node, block in violations:
        b = block if len(block) <= 140 else block[:137] + "..."
        sys.stderr.write(f"  - {f} :: node '{node}' :: {b}\n")
    sys.exit(1)

print(f"PASS: no JSON.stringify-without-SQL-quoting in any n8n postgres query ({len(files)} files scanned).")
PY
