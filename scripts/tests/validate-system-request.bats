#!/usr/bin/env bats
# validate-system-request.bats — unit tests for scripts/validate-system-request.sh.
#
# The gate is pure (no network, no gcloud), so the tests just set the request
# fields as environment variables and assert on the VERDICT line + exit code.

load test_helper/common

SCRIPT=""

setup() {
  _COMMON_TMP_PATHS=()
  SCRIPT="$REPO_ROOT/scripts/validate-system-request.sh"
}

teardown() {
  common_teardown
}

# ---------------------------------------------------------------------------
# Common guards
# ---------------------------------------------------------------------------

@test "REFUSE: missing request_type" {
  run env -u REQUEST_TYPE SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 bash "$SCRIPT"
  assert_failure
  assert_output --partial "VERDICT: refuse — no request_type"
}

@test "REFUSE: missing system_name" {
  run env REQUEST_TYPE=secret GCP_PROJECT=factory-test-18 bash "$SCRIPT"
  assert_failure
  assert_output --partial "no system_name"
}

@test "REFUSE: missing gcp_project" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile bash "$SCRIPT"
  assert_failure
  assert_output --partial "no gcp_project"
}

@test "REFUSE: control project (or-factory-master-control)" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=or-factory-master-control SECRET_NAME=foo-key bash "$SCRIPT"
  assert_failure
  assert_output --partial "control project"
}

@test "REFUSE: old control project (factory-control-9piybr)" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-control-9piybr SECRET_NAME=foo-key bash "$SCRIPT"
  assert_failure
  assert_output --partial "control project"
}

@test "REFUSE: shared sandbox backend (factory-test-25)" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-25 SECRET_NAME=foo-key bash "$SCRIPT"
  assert_failure
  assert_output --partial "factory-test-25"
}

@test "REFUSE: invalid gcp_project shape" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=BAD_Proj SECRET_NAME=foo-key bash "$SCRIPT"
  assert_failure
  assert_output --partial "not a valid project id"
}

@test "REFUSE: invalid system_name shape" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=ab GCP_PROJECT=factory-test-18 SECRET_NAME=foo-key bash "$SCRIPT"
  assert_failure
  assert_output --partial "not a valid system name"
}

@test "REFUSE: unknown request_type" {
  run env REQUEST_TYPE=railway SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 bash "$SCRIPT"
  assert_failure
  assert_output --partial "unknown request_type 'railway'"
}

# ---------------------------------------------------------------------------
# secret type
# ---------------------------------------------------------------------------

@test "ALLOW: valid secret request" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=supadata-api-key bash "$SCRIPT"
  assert_success
  assert_output --partial "VERDICT: allow (type=secret"
  assert_output --partial "role=secretAccessor"
}

@test "REFUSE: secret type without secret_name" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 bash "$SCRIPT"
  assert_failure
  assert_output --partial "no secret_name"
}

@test "REFUSE: secret name with invalid shape" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME="Bad_Name" bash "$SCRIPT"
  assert_failure
  assert_output --partial "not a safe secret id"
}

@test "REFUSE: super-credential -master-key" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=openrouter-master-key bash "$SCRIPT"
  assert_failure
  assert_output --partial "protected super-credential"
}

@test "REFUSE: super-credential -management-key" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=openrouter-management-key bash "$SCRIPT"
  assert_failure
  assert_output --partial "protected super-credential"
}

@test "REFUSE: broker app private key" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=factory-master-broker-app-id bash "$SCRIPT"
  assert_failure
  assert_output --partial "protected super-credential"
}

@test "REFUSE: privileged keyword in secret name (broker)" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=my-broker-token bash "$SCRIPT"
  assert_failure
  assert_output --partial "privileged keyword"
}

@test "REFUSE: privileged keyword in secret name (wif)" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=some-wif-config bash "$SCRIPT"
  assert_failure
  assert_output --partial "privileged keyword"
}

# ---------------------------------------------------------------------------
# members validation (secret type, but member logic is shared)
# ---------------------------------------------------------------------------

@test "ALLOW: explicit members = the system's own deploy-sa + runtime-sa" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=supadata-api-key \
    MEMBERS="deploy-sa@factory-test-18.iam.gserviceaccount.com,runtime-sa@factory-test-18.iam.gserviceaccount.com" \
    bash "$SCRIPT"
  assert_success
  assert_output --partial "VERDICT: allow"
}

@test "REFUSE: external member" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=supadata-api-key \
    MEMBERS="attacker@evil.iam.gserviceaccount.com" bash "$SCRIPT"
  assert_failure
  assert_output --partial "is not the system's own deploy-sa/runtime-sa"
}

@test "REFUSE: cross-project SA member" {
  run env REQUEST_TYPE=secret SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 SECRET_NAME=supadata-api-key \
    MEMBERS="deploy-sa@other-project.iam.gserviceaccount.com" bash "$SCRIPT"
  assert_failure
  assert_output --partial "is not the system's own deploy-sa/runtime-sa"
}

# ---------------------------------------------------------------------------
# iam type
# ---------------------------------------------------------------------------

@test "ALLOW: allowlisted iam role" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/cloudsql.client bash "$SCRIPT"
  assert_success
  assert_output --partial "VERDICT: allow (type=iam"
  assert_output --partial "roles/cloudsql.client"
}

@test "ALLOW: allowlisted iam role (storage.objectAdmin not caught by *.admin)" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/storage.objectAdmin bash "$SCRIPT"
  assert_success
  assert_output --partial "VERDICT: allow (type=iam"
}

@test "REFUSE: iam type without role" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 bash "$SCRIPT"
  assert_failure
  assert_output --partial "no role"
}

@test "REFUSE: escalating role owner" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/owner bash "$SCRIPT"
  assert_failure
  assert_output --partial "privilege-escalating"
}

@test "REFUSE: escalating role editor" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/editor bash "$SCRIPT"
  assert_failure
  assert_output --partial "privilege-escalating"
}

@test "REFUSE: escalating role iam.securityAdmin" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/iam.securityAdmin bash "$SCRIPT"
  assert_failure
  assert_output --partial "privilege-escalating"
}

@test "REFUSE: escalating role secretmanager.admin" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/secretmanager.admin bash "$SCRIPT"
  assert_failure
  assert_output --partial "privilege-escalating"
}

@test "REFUSE: escalating role serviceusage.serviceUsageAdmin" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/serviceusage.serviceUsageAdmin bash "$SCRIPT"
  assert_failure
  assert_output --partial "privilege-escalating"
}

@test "REFUSE: valid but non-allowlisted role" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE=roles/bigquery.dataViewer bash "$SCRIPT"
  assert_failure
  assert_output --partial "not on the IAM allowlist"
}

@test "REFUSE: malformed role id" {
  run env REQUEST_TYPE=iam SYSTEM_NAME=tokile GCP_PROJECT=factory-test-18 ROLE="not-a-role" bash "$SCRIPT"
  assert_failure
  assert_output --partial "not a valid role id"
}
