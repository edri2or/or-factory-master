// OIL auto-fix — the "bell". Receives Linear's outbound webhook when an OIL
// issue is created, verifies it is genuinely from Linear (HMAC-SHA256 over the
// raw request body), drops noise with cheap deterministic rules (the OIL-12
// pilot smoke test and OIL-13 info-maintenance cases never proceed), and for a
// real actionable factory failure fires a repository_dispatch(oil-investigate)
// that triggers the read-only investigator workflow. Investigation only — this
// path never writes code, opens a PR, or changes issue state.
//
// Every step is soft-fail: a parse/dispatch error answers 200 (so Linear never
// retry-storms or auto-disables the webhook) and is surfaced via a warning
// observability event. The loop's own events are non-actionable by construction,
// so it can never open a Linear issue about itself and re-trigger.
//
// Detection note: the factory's auto-issues are identified programmatically by
// the OTel JSON embedded in the issue body (otel.event.name), not by the
// `auto-created` label — Linear's webhook payload does not reliably carry label
// NAMES. When names ARE present we additionally honour the label.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { dispatchRepositoryEvent } from './github-client.js';
import { emitEvent, readSecretSoft, linearGql } from './observability-client.js';
import { dispatchSystemRequest } from './system-request.js';

const OWNER = 'edri2or';
const REPO = 'or-factory-master';
const INVESTIGATE_EVENT = 'oil-investigate';
const REPLAY_WINDOW_MS = 60_000;

export interface TriageResult {
  action: 'dispatch' | 'skip';
  reason: string;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

// HMAC-SHA256 over the RAW request bytes, hex, constant-time. Linear signs with
// the webhook signing secret and sends the digest in the `Linear-Signature`
// header (linear.app/developers/webhooks).
export function verifyLinearSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!rawBody || rawBody.length === 0 || !signatureHeader || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Pull the OTel event JSON the observability pipeline embeds in the issue body
// (```json … ```), falling back to parsing the whole description.
export function extractOtel(description: string | null | undefined): Record<string, unknown> | null {
  if (!description) return null;
  const fenced = description.match(/```json\s*([\s\S]*?)```/);
  const candidate = fenced && fenced[1] ? fenced[1] : description;
  try {
    const parsed = JSON.parse(candidate.trim()) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Deterministic triage. Rules apply IN ORDER, so info-maintenance wins over
// action_required (OIL-13 is severity=info AND action_required=true).
export function triage(otel: Record<string, unknown> | null): TriageResult {
  if (!otel || !otel['otel.event.name']) return { action: 'skip', reason: 'not-a-factory-event' };
  const eventName = String(otel['otel.event.name']);
  const severity = String(otel['severity_text'] ?? '');
  const actionRequired = otel['factory.action_required'] === true;
  if (eventName === 'factory.pilot.test') return { action: 'skip', reason: 'test-event' };
  if (severity === 'info') return { action: 'skip', reason: 'info-maintenance' };
  if (!actionRequired) return { action: 'skip', reason: 'not-action-required' };
  return { action: 'dispatch', reason: 'actionable' };
}

type Outcome = 'dispatched' | 'skipped' | 'dispatch_failed';

// Soft-fail observability trail. NON-actionable by construction (actionRequired
// false; info for dispatched/skipped, warning for failures) so the loop never
// opens a Linear issue about itself.
async function emitOil(
  outcome: Outcome,
  issueId: string,
  otel: Record<string, unknown> | null,
  reason: string,
): Promise<void> {
  try {
    await emitEvent({
      name: `factory.oil_autofix.${outcome}`,
      severity: outcome === 'dispatch_failed' ? 'warning' : 'info',
      layer: 'factory',
      system: otel ? String(otel['factory.system_name'] ?? '') || undefined : undefined,
      workflow: 'mcp:linear-webhook',
      runId: new Date().toISOString(),
      actionRequired: false,
      body: { issue: issueId, reason, source_event: otel?.['otel.event.name'] ?? null },
    });
  } catch {
    /* emitEvent is itself soft-fail; guard anyway */
  }
}

// Verify → replay-guard → filter → triage → repository_dispatch. Returns 2xx for
// anything Linear should not retry; 401 only on a bad/absent signature.
export async function handleLinearWebhook(req: Request): Promise<WebhookResult> {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) return { status: 503, body: { error: 'linear_webhook_disabled' } };

  const sigHeader = req.headers['linear-signature'];
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!verifyLinearSignature(rawBody, typeof sigHeader === 'string' ? sigHeader : undefined, secret)) {
    return { status: 401, body: { error: 'bad_signature' } };
  }

  const payload = (req.body ?? {}) as Record<string, unknown>;

  // Replay guard: Linear sends webhookTimestamp (ms epoch).
  const ts = Number(payload['webhookTimestamp'] ?? 0);
  if (ts > 0 && Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
    return { status: 400, body: { error: 'stale_timestamp' } };
  }

  // Only newly-created Issues. (Label-add via "update" is left to the reconciler
  // backstop in a later stage; the factory creates issues WITH their labels.)
  if (payload['type'] !== 'Issue' || payload['action'] !== 'create') {
    return { status: 200, body: { ignored: `type=${String(payload['type'])} action=${String(payload['action'])}` } };
  }

  const data = (payload['data'] ?? {}) as Record<string, unknown>;
  const identifier = String(data['identifier'] ?? '');

  // Honour the auto-created label when names are present; otherwise rely on the
  // OTel-JSON signature below (Linear payloads do not always carry label names).
  const labelNames = Array.isArray(data['labels'])
    ? (data['labels'] as Array<Record<string, unknown>>).map((l) => String(l?.['name'] ?? '')).filter(Boolean)
    : [];
  if (labelNames.length > 0 && !labelNames.includes('auto-created')) {
    return { status: 200, body: { triage: 'skip', reason: 'not-auto-created' } };
  }

  const otel = extractOtel(typeof data['description'] === 'string' ? (data['description'] as string) : null);

  // System resource-request channel: a `system.request.*` ticket is not an OIL
  // failure to investigate — it is a system asking the broker for a resource.
  // Route it to its own bridge (which dispatches the fulfillment register phase),
  // before the OIL triage rules. The system raises it with action_required=true
  // (severity may be info), so it must be caught here ahead of the info-skip rule.
  const eventName = otel ? String(otel['otel.event.name'] ?? '') : '';
  if (eventName.startsWith('system.request.')) {
    return dispatchSystemRequest(otel, identifier);
  }

  const t = triage(otel);

  if (t.action === 'skip' || !identifier) {
    const reason = identifier ? t.reason : 'no-identifier';
    await emitOil('skipped', identifier, otel, reason);
    return { status: 200, body: { triage: 'skip', reason } };
  }

  try {
    await dispatchRepositoryEvent(
      INVESTIGATE_EVENT,
      {
        issue_id: identifier,
        run_id: String(otel?.['factory.run_id'] ?? ''),
        system: String(otel?.['factory.system_name'] ?? ''),
        event: String(otel?.['otel.event.name'] ?? ''),
        layer: String(otel?.['factory.layer'] ?? ''),
      },
      OWNER,
      REPO,
    );
    await emitOil('dispatched', identifier, otel, t.reason);
    return { status: 200, body: { triage: 'dispatch', issue: identifier } };
  } catch (e) {
    await emitOil('dispatch_failed', identifier, otel, String(e).slice(0, 160));
    return { status: 200, body: { triage: 'dispatch_failed', issue: identifier, detail: String(e).slice(0, 200) } };
  }
}

// Idempotent one-time registration of the Linear outbound webhook → this server's
// /linear-webhook, scoped to Issues on the OIL team, carrying the signing secret.
// Admin-gated in index.ts; safe to call repeatedly. Linear's webhookCreate takes
// the signing secret as an input field.
export async function registerLinearWebhook(baseUrl: string): Promise<WebhookResult> {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) return { status: 503, body: { error: 'linear_webhook_disabled' } };

  const [apiKey, teamId] = await Promise.all([
    readSecretSoft('linear-api-key'),
    readSecretSoft('linear-team-id'),
  ]);
  if (!apiKey) return { status: 500, body: { error: 'linear_api_key_unreadable' } };

  const url = `${baseUrl}/linear-webhook`;
  try {
    const existing = await linearGql<{ webhooks: { nodes: Array<{ id: string; url: string; enabled: boolean }> } }>(
      apiKey,
      'query{ webhooks(first:250){ nodes{ id url enabled } } }',
      {},
    );
    const found = existing.webhooks.nodes.find((w) => w.url === url);
    if (found) {
      return { status: 200, body: { webhook: 'exists', id: found.id, url, enabled: found.enabled } };
    }
    const input: Record<string, unknown> = {
      url,
      secret,
      resourceTypes: ['Issue'],
      enabled: true,
      label: 'oil-autofix',
    };
    if (teamId) input['teamId'] = teamId;
    const created = await linearGql<{ webhookCreate: { success: boolean; webhook: { id: string } | null } }>(
      apiKey,
      'mutation($input: WebhookCreateInput!){ webhookCreate(input:$input){ success webhook{ id } } }',
      { input },
    );
    const id = created.webhookCreate.webhook?.id;
    if (!id) return { status: 500, body: { error: 'webhook_create_no_id' } };
    return { status: 200, body: { webhook: 'created', id, url } };
  } catch (e) {
    return { status: 500, body: { error: 'webhook_register_failed', detail: String(e).slice(0, 200) } };
  }
}
