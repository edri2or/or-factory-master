#!/usr/bin/env bats
# agent-repo-extractor.bats — deterministic before/after proof for the agent-repo worker's
# JSON extractor (templates/agent-repo/.github/workflows/agent-main.yml, the "Extract the
# answer" step).
#
# The OLD extractor grabbed the FIRST fenced ```json block and matched the fence token as a
# SUBSTRING anywhere on a line. Two real failures (both observed live in the first-wave
# fan-out): (1) an EXAMPLE ```json block before the real one was captured instead of the
# result; (2) when a JSON content line itself contains the literal text ```json (because the
# answer describes this very bug), the line was mis-read as a new opening fence and skipped, so
# the block came out empty — exactly what wrapped Nachshon's own split-plan as
# status:"unstructured". The NEW extractor captures the LAST block with FULL-LINE-ANCHORED
# fence patterns, then validates with jq (design by natan-research, verified live).
#
# These tests pin fail-before / pass-after so the regression cannot silently return.

load test_helper/common

# --- the OLD (buggy) extractor + the shared fallback -------------------------------------
old_extract() {
  local result diag
  result="$(cat)"
  diag="$(printf '%s\n' "$result" | awk '/```json/{f=1;next} /```/{f=0} f')"
  if ! printf '%s' "$diag" | jq -e . >/dev/null 2>&1; then
    diag="$(jq -cn --arg a "$result" '{answer:$a, status:"unstructured"}')"
  fi
  printf '%s' "$diag"
}

# --- the NEW extractor — MUST mirror templates/agent-repo/.github/workflows/agent-main.yml --
new_extract() {
  local result diag
  result="$(cat)"
  diag="$(printf '%s\n' "$result" | awk '
    /^[[:space:]]*```json[[:space:]]*$/    { cap=1; buf=""; next }
    cap && /^[[:space:]]*```[[:space:]]*$/ { cap=0; last=buf; next }
    cap                                    { buf = buf $0 "\n" }
    END                                    { printf "%s", last }
  ')"
  if ! printf '%s' "$diag" | jq -e . >/dev/null 2>&1; then
    diag="$(jq -cn --arg a "$result" '{answer:$a, status:"unstructured"}')"
  fi
  printf '%s' "$diag"
}

status_of() { printf '%s' "$1" | jq -r '.status'; }
answer_of() { printf '%s' "$1" | jq -r '.answer'; }

# --- Fixture A: an EXAMPLE block (invalid placeholder) before the real sentinel block ------
fixture_example_then_real() {
  cat <<'EOF'
Here is my analysis.

For example, the worker should end with a block shaped like this:

```json
{"answer": "...", "status": "ok"}   // <- placeholder, fill in
```

After weighing the options, here is my actual structured answer:

```json
{"answer": "real result", "status": "ok"}
```
EOF
}

# --- Fixture B: the real bug — a JSON content line embeds the literal ```json token ---------
# (mirrors Nachshon's live split-plan, which came back status:"unstructured").
fixture_fence_in_content() {
  cat <<'EOF'
The task is to route this.

```json
{"status":"ok","mode":"fanout","plan":[{"subtask":"the worker grabs the FIRST fenced ```json block it sees","sub_id":"a"}]}
```
EOF
}

# --- Fixture C: a single clean block (happy path — must keep working) ----------------------
fixture_single_clean() {
  cat <<'EOF'
Short answer.

```json
{"answer": "all good", "status": "ok"}
```
EOF
}

@test "Fixture A — OLD captures the example (not 'ok'); NEW captures the real sentinel" {
  fixture="$(fixture_example_then_real)"
  old="$(printf '%s' "$fixture" | old_extract)"
  new="$(printf '%s' "$fixture" | new_extract)"
  # OLD: the placeholder example block is invalid JSON -> fallback unstructured (it did NOT
  # return the real result).
  [ "$(status_of "$old")" != "ok" ]
  # NEW: the real final block.
  [ "$(status_of "$new")" = "ok" ]
  [ "$(answer_of "$new")" = "real result" ]
}

@test "Fixture B — OLD loses the block (unstructured); NEW recovers it (the live Nachshon bug)" {
  fixture="$(fixture_fence_in_content)"
  old="$(printf '%s' "$fixture" | old_extract)"
  new="$(printf '%s' "$fixture" | new_extract)"
  # OLD: the content line containing ```json mis-opens a fence -> empty -> unstructured.
  [ "$(status_of "$old")" = "unstructured" ]
  # NEW: full-line anchoring ignores the in-content token -> the fanout plan is recovered.
  [ "$(status_of "$new")" = "ok" ]
  run bash -c "printf '%s' '$new' | jq -r '.mode'"
  assert_output "fanout"
}

@test "Fixture C — happy path: a single clean block still extracts under NEW" {
  fixture="$(fixture_single_clean)"
  new="$(printf '%s' "$fixture" | new_extract)"
  [ "$(status_of "$new")" = "ok" ]
  [ "$(answer_of "$new")" = "all good" ]
}

@test "template ships the anchored extractor and not the naive substring one" {
  wf="$REPO_ROOT/templates/agent-repo/.github/workflows/agent-main.yml"
  [ -f "$wf" ]
  # The hardened, full-line-anchored opening fence must be present...
  grep -qF '/^[[:space:]]*```json[[:space:]]*$/' "$wf"
  # ...and the naive substring extractor must be gone.
  ! grep -qF "awk '/\`\`\`json/{f=1;next} /\`\`\`/{f=0} f'" "$wf"
}
