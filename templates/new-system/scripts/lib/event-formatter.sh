#!/usr/bin/env bash
# Sourceable library: format a factory event as a single-line, compact
# OpenTelemetry-SemConv-shaped JSON document. Exposes one function,
# format_otel_event, which writes the JSON to stdout and does no other I/O.
#
# format_otel_event NAME SEVERITY LAYER WORKFLOW RUN_ID SYSTEM ACTION_REQUIRED BODY_JSON
#
# Returns non-zero (emitting nothing) if SEVERITY is not one of
# info|warning|error|critical, or LAYER is not one of factory|system, or if
# BODY_JSON is non-empty but not valid JSON.

format_otel_event() {
  local name="$1" severity="$2" layer="$3" workflow="$4" run_id="$5"
  local system="$6" action_required="$7" body_json="$8"

  case "$severity" in
    info|warning|error|critical) ;;
    *) return 1 ;;
  esac
  case "$layer" in
    factory|system) ;;
    *) return 1 ;;
  esac

  local now sha ver ar
  now=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
  sha="${GITHUB_SHA:-unknown}"
  ver="${sha:0:7}"
  if [ "$action_required" = "true" ]; then ar="true"; else ar="false"; fi
  [ -n "$body_json" ] || body_json="{}"

  # Field order matches the schema table in docs/observability.md. The keys
  # carry literal dots (service.name, otel.event.name, ...) — they are flat
  # attribute names, not nested objects. factory.system_name is omitted when
  # empty. action_required is a real JSON boolean (--argjson, not --arg).
  jq -cn \
    --arg time "$now" \
    --arg sver "$ver" \
    --arg name "$name" \
    --arg sev "$severity" \
    --arg sys "$system" \
    --arg wf "$workflow" \
    --arg run "$run_id" \
    --arg layer "$layer" \
    --argjson ar "$ar" \
    --argjson body "$body_json" \
    '{
       "_time": $time,
       "service.name": "factory",
       "service.version": $sver,
       "otel.event.name": $name,
       "severity_text": $sev
     }
     + (if $sys == "" then {} else { "factory.system_name": $sys } end)
     + {
       "factory.workflow": $wf,
       "factory.run_id": $run,
       "factory.layer": $layer,
       "factory.action_required": $ar,
       "event.body": $body
     }'
}
