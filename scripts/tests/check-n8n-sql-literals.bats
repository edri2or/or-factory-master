#!/usr/bin/env bats
# check-n8n-sql-literals.bats — unit tests for scripts/check-n8n-sql-literals.sh.
#
# The check flags `JSON.stringify` inside an n8n postgres `query` unless the value
# is emitted as a single-quoted SQL literal (it emits DOUBLE quotes otherwise, which
# Postgres reads as an identifier). Fixtures cover the two real historical bugs (must
# be flagged), the two correct quoting forms (must pass), and the precision boundary
# (JSON.stringify outside a postgres query must be ignored).

load test_helper/common

CHECK="$REPO_ROOT/scripts/check-n8n-sql-literals.sh"

setup() { _COMMON_TMP_PATHS=(); }
teardown() { common_teardown; }

# Write a one-node workflow JSON whose postgres query is the given file's content.
# Using jq --rawfile keeps the query (with its quotes) byte-exact and valid JSON.
_pg_fixture() {  # $1=dir $2=path-to-query-file
  jq -n --rawfile q "$2" \
    '{nodes:[{type:"n8n-nodes-base.postgres",name:"Q",parameters:{query:$q}}]}' \
    > "$1/wf.json"
}

# --- the two real historical bugs MUST be flagged ---

@test "flags the tg-proactive bug: JSON.stringify(chat_id) unwrapped" {
  dir="$(make_tmpdir)"
  cat > "$dir/q.sql" <<'SQL'
SELECT COUNT(*) FROM n8n_chat_histories WHERE session_id = 'tg:' || {{ JSON.stringify('@@CHAT_ID@@') }};
SQL
  _pg_fixture "$dir" "$dir/q.sql"
  run bash "$CHECK" "$dir"
  assert_failure
  assert_output --partial "without SQL single-quoting"
}

@test "flags the jsonb bug: JSON.stringify(JSON.stringify(x))::jsonb" {
  dir="$(make_tmpdir)"
  cat > "$dir/q.sql" <<'SQL'
INSERT INTO style_profile (chat_id, profile) VALUES ({{ '@@CHAT_ID@@' }}, {{ JSON.stringify(JSON.stringify($json.profile)) }}::jsonb);
SQL
  _pg_fixture "$dir" "$dir/q.sql"
  run bash "$CHECK" "$dir"
  assert_failure
}

# --- the two correct quoting forms MUST pass ---

@test "passes the expression-side wrap: {{ \"'\" + JSON.stringify(x)... + \"'\" }}" {
  dir="$(make_tmpdir)"
  cat > "$dir/q.sql" <<'SQL'
INSERT INTO style_profile (chat_id, profile) VALUES ({{ '@@CHAT_ID@@' }}, {{ "'" + JSON.stringify($json.profile || {}).split("'").join("''") + "'" }}::jsonb);
SQL
  _pg_fixture "$dir" "$dir/q.sql"
  run bash "$CHECK" "$dir"
  assert_success
}

@test "passes the SQL-side wrap: '{{ JSON.stringify(x) }}'" {
  dir="$(make_tmpdir)"
  cat > "$dir/q.sql" <<'SQL'
INSERT INTO t (profile) VALUES ('{{ JSON.stringify($json.profile) }}'::jsonb);
SQL
  _pg_fixture "$dir" "$dir/q.sql"
  run bash "$CHECK" "$dir"
  assert_success
}

# --- precision boundary ---

@test "passes a postgres query with no JSON.stringify" {
  dir="$(make_tmpdir)"
  cat > "$dir/q.sql" <<'SQL'
SELECT profile FROM style_profile WHERE chat_id = {{ '@@CHAT_ID@@' }} LIMIT 1;
SQL
  _pg_fixture "$dir" "$dir/q.sql"
  run bash "$CHECK" "$dir"
  assert_success
}

@test "ignores JSON.stringify outside a postgres query (httpRequest jsonBody)" {
  dir="$(make_tmpdir)"
  jq -n '{nodes:[{type:"n8n-nodes-base.httpRequest",name:"H",parameters:{jsonBody:"={{ JSON.stringify({a:1}) }}"}}]}' \
    > "$dir/wf.json"
  run bash "$CHECK" "$dir"
  assert_success
}

# --- regression anchor: the real shipped templates are clean ---

@test "the committed n8n templates pass (no antipattern on main)" {
  run bash "$CHECK" "$REPO_ROOT/templates/system/workflows/n8n"
  assert_success
}
