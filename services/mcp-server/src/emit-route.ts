// Thin, tenant-authed HTTP ingest for the reliability layer: n8n -> observability.
// The express wiring + auth chain live in index.ts (POST /factory/:system/emit),
// reusing the EXACT verifyBearer + systemRouteAllows chain of /factory/:system/mcp.
// This module holds only the PURE, unit-tested pieces: body validation, a per-system
// rate-limiter (a circuit-breaker so an n8n error-storm can't hammer Telegram), and
// the emit-specific kill-switch. Secrets never touch this module — the route hands
// the validated payload to emitEvent() (observability-client.ts), which reads the
// Axiom/Telegram/Linear keys server-side. system + layer are NEVER taken from the
// body: the route injects them from the signed bearer claim (tenant-safe).

import type { Severity } from './observability-client.js';

// Event names must stay in the factory.* namespace (dotted lowercase segments) — keeps
// the Axiom/Linear labeling clean and stops a tenant spoofing a foreign event name.
export const EMIT_NAME_RE = /^factory\.[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const SEVERITIES: ReadonlySet<string> = new Set(['info', 'warning', 'error', 'critical']);
const MAX_NAME_LEN = 120;
const MAX_LABEL_LEN = 200; // workflow / run_id descriptive labels
const MAX_BODY_BYTES = 8 * 1024; // serialized body cap

export interface ValidEmit {
  name: string;
  severity: Severity;
  actionRequired: boolean;
  workflow: string;
  runId: string;
  body: Record<string, unknown>;
}

export type EmitValidation = { ok: true; value: ValidEmit } | { ok: false; error: string };

function clampStr(v: unknown, max: number): string {
  return String(v ?? '').slice(0, max);
}

// Validate + normalize the n8n-supplied body. Returns everything needed to build an
// EmitEventInput EXCEPT system + layer (the route forces those from the bearer claim).
export function validateEmitBody(raw: unknown): EmitValidation {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const o = raw as Record<string, unknown>;

  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name || name.length > MAX_NAME_LEN || !EMIT_NAME_RE.test(name)) {
    return { ok: false, error: 'name must match ^factory.<dotted-lowercase>$' };
  }

  const severity = typeof o.severity === 'string' ? o.severity : '';
  if (!SEVERITIES.has(severity)) {
    return { ok: false, error: 'severity must be one of info|warning|error|critical' };
  }

  if (o.action_required !== undefined && typeof o.action_required !== 'boolean') {
    return { ok: false, error: 'action_required must be a boolean' };
  }
  const actionRequired = o.action_required === true;

  let body: Record<string, unknown> = {};
  if (o.body !== undefined) {
    if (o.body === null || typeof o.body !== 'object' || Array.isArray(o.body)) {
      return { ok: false, error: 'body.body must be a JSON object' };
    }
    body = o.body as Record<string, unknown>;
    if (JSON.stringify(body).length > MAX_BODY_BYTES) {
      return { ok: false, error: `body exceeds ${MAX_BODY_BYTES} bytes` };
    }
  }

  const workflow = o.workflow !== undefined ? clampStr(o.workflow, MAX_LABEL_LEN) : 'n8n';
  const runId = o.run_id !== undefined ? clampStr(o.run_id, MAX_LABEL_LEN) : new Date().toISOString();

  return { ok: true, value: { name, severity: severity as Severity, actionRequired, workflow, runId, body } };
}

// Emit-specific kill-switch, independent of the read-tool allowlist
// (FACTORY_TOOLS_ALLOWED_SYSTEMS). "*" (default) admits any system — the per-system
// bearer is the real boundary; a CSV pins to specific systems; "" closes emit entirely
// without a logic redeploy.
const EMIT_ALLOWED = new Set(
  (process.env.FACTORY_EMIT_ALLOWED_SYSTEMS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const EMIT_ALLOW_ANY = EMIT_ALLOWED.has('*');

export function isEmitAllowedSystem(system: string): boolean {
  return EMIT_ALLOW_ANY || EMIT_ALLOWED.has(system);
}

export interface RateLimiter {
  allow(system: string): boolean;
}

// Fixed-window per-system rate-limiter — a circuit-breaker so a runaway n8n loop can't
// fan thousands of emits at Telegram. In-process (the gateway runs few instances; perfect
// global accuracy isn't needed — this only caps a storm, and emitEvent itself dedups
// Linear over 24h + gates Telegram to warning+).
export function createRateLimiter(limit = 60, windowMs = 60_000, now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(system: string): boolean {
      const t = now();
      const w = windows.get(system);
      if (!w || t - w.start >= windowMs) {
        windows.set(system, { start: t, count: 1 });
        return true;
      }
      if (w.count >= limit) return false;
      w.count += 1;
      return true;
    },
  };
}
