#!/usr/bin/env bats
# notify-card-failure.bats — unit tests for scripts/notify-card-failure.sh (Fix 2).
#
# Stubs curl on PATH (records its args to a log) to assert the composed Telegram
# request WITHOUT a live send — the same mock-on-PATH pattern as clean-project-secrets.bats.

load test_helper/common

SCRIPT=""

setup() {
  _COMMON_TMP_PATHS=()
  SCRIPT="$REPO_ROOT/scripts/notify-card-failure.sh"

  MOCK_DIR="$(make_tmpdir)"
  CALLS_LOG="$MOCK_DIR/curl.log"
  cat > "$MOCK_DIR/curl" << MOCK_EOF
#!/usr/bin/env bash
echo "\$*" >> "${CALLS_LOG}"
MOCK_EOF
  chmod +x "$MOCK_DIR/curl"

  export PATH="$MOCK_DIR:$PATH"
  export CALLS_LOG
}

teardown() {
  common_teardown
}

@test "413 too-large: clear Hebrew message names the corr + 'too large' guidance, and curl is called" {
  run env TELEGRAM_BOT_TOKEN=botsecret TELEGRAM_CHAT_ID=999 \
    bash "$SCRIPT" builder-blueprint-v3 413 task_too_large_for_card
  assert_success
  assert_output --partial "builder-blueprint-v3"
  assert_output --partial "ארוכה מדי"
  assert_output --partial "לא נכנסה לתור"
  # The Telegram sendMessage request was issued with the bot URL + chat_id + text.
  run cat "$CALLS_LOG"
  assert_output --partial "https://api.telegram.org/botbotsecret/sendMessage"
  assert_output --partial "chat_id=999"
  assert_output --partial "text="
}

@test "no telegram creds: message is logged, curl is NOT called, exit 0 (soft)" {
  run bash "$SCRIPT" some-corr 500 "boom"
  assert_success
  assert_output --partial "some-corr"
  assert_output --partial "printed to log only"
  [ ! -s "$CALLS_LOG" ]   # curl never invoked → no recorded calls
}

@test "generic reason: the reason text is included" {
  run env TELEGRAM_BOT_TOKEN=b TELEGRAM_CHAT_ID=c bash "$SCRIPT" cc 502 "bad gateway"
  assert_success
  assert_output --partial "סיבה: bad gateway"
}
