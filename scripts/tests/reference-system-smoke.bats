#!/usr/bin/env bats
# reference-system-smoke.bats — tests for scripts/reference-system-smoke.sh.
# A path-routing mock HTTP server stands in for the live system: 200 for
# /healthz and /, 401 for /webhook/* (mimicking Caddy's edge HMAC guard). The
# smoke passes when the mock is up, skips when the system is unprovisioned with
# no overrides, and fails when nothing is listening.

load test_helper/common

SMOKE="$REPO_ROOT/scripts/reference-system-smoke.sh"

setup() {
  _COMMON_TMP_PATHS=()
  WORK="$(make_tmpdir)"
  cat > "$WORK/mock.py" <<'PY'
import http.server, sys
port = int(sys.argv[1])
class H(http.server.BaseHTTPRequestHandler):
    def _h(self):
        if self.path.startswith('/webhook/'):
            self.send_response(401)
        elif self.path == '/healthz' or self.path == '/':
            self.send_response(200)
        else:
            self.send_response(404)
        self.end_headers()
    def do_GET(self):  self._h()
    def do_POST(self): self._h()
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', port), H).serve_forever()
PY
  PORT="$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')"
}

teardown() {
  [ -n "${MOCK_PID:-}" ] && kill "$MOCK_PID" 2>/dev/null || true
  unset REF_HEALTH_URL REF_PUBLIC_URL MOCK_PID REF_CONFIG_FILE
  common_teardown
}

start_mock() {
  python3 "$WORK/mock.py" "$PORT" &
  MOCK_PID=$!
  local _
  for _ in $(seq 1 50); do
    if curl -sS -o /dev/null "http://127.0.0.1:${PORT}/healthz" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
  done
  return 1
}

@test "SKIP: unprovisioned with no overrides is a clean skip" {
  # Isolate from the real reference-system/config.yml (whose provisioned flag
  # flips to true once the standing system is built) — this test only asserts
  # the unprovisioned-no-overrides path.
  cat > "$WORK/config.yml" <<'YML'
system_name: smoke-test
repo: edri2or/smoke-test
gcp_project_id: smoke-test
region: me-west1
public_url: https://n8n-smoke-test.or-infra.com
health_url: https://n8n-smoke-test.or-infra.com/healthz
provisioned: false
YML
  export REF_CONFIG_FILE="$WORK/config.yml"
  run bash "$SMOKE"
  assert_success
  assert_output --partial "SKIP"
}

@test "PASS: all checks green against a healthy mock" {
  start_mock
  export REF_HEALTH_URL="http://127.0.0.1:${PORT}/healthz"
  export REF_PUBLIC_URL="http://127.0.0.1:${PORT}"
  run bash "$SMOKE"
  assert_success
  assert_output --partial "PASS"
}

@test "FAIL: checks fail when the system is unreachable" {
  export REF_HEALTH_URL="http://127.0.0.1:${PORT}/healthz"
  export REF_PUBLIC_URL="http://127.0.0.1:${PORT}"
  run bash "$SMOKE"
  assert_failure
  assert_output --partial "FAIL"
}
