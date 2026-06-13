#!/usr/bin/env bash
# runtime-audit-targets.sh — the set of systems system-runtime-audit.yml probes.
#
# Every system with its OWN GCP project under the Systems folder (listed by
# gcloud), PLUS the always-probe standing proving system(s) — e.g. or-edri-4,
# which lives on a test project (factory-test-21, adopt) OUTSIDE the Systems
# folder and so is never returned by `gcloud projects list`. Without this, the
# factory's standing proving ground would have no heartbeat — the exact silent
# decay that retired the old reference system (see docs/live-test-loop.md).
#
# Output: one project/system id per line, de-duplicated, blanks removed.
#   FOLDER         Systems folder id (default 123180924297)
#   ALWAYS_PROBE   space-separated standing systems to always include (default or-edri-4)
# Tests inject the folder listing via RUNTIME_AUDIT_FOLDER_LIST (skips gcloud).
set -uo pipefail

FOLDER="${FOLDER:-123180924297}"
ALWAYS_PROBE="${ALWAYS_PROBE:-or-edri-4}"

if [ -n "${RUNTIME_AUDIT_FOLDER_LIST+x}" ]; then
  folder_list="$RUNTIME_AUDIT_FOLDER_LIST"
else
  folder_list=$(gcloud projects list --filter="parent.id=${FOLDER}" --format='value(projectId)' 2>/dev/null || true)
fi

# Word-split both sources on whitespace, drop blanks, de-duplicate (a standing
# system that later gets its own folder project is still probed exactly once).
# shellcheck disable=SC2086
{ printf '%s\n' $folder_list; printf '%s\n' $ALWAYS_PROBE; } | sed '/^[[:space:]]*$/d' | LC_ALL=C sort -u
