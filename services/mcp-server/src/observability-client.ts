// Observability event emitter — TypeScript port of scripts/emit-event.sh +
// scripts/lib/event-formatter.sh + scripts/lib/linear-issue.sh. The MCP Docker
// image ships only src/ (no scripts/), so the bash fan-out cannot be shelled
// out to; this reimplements it for the `emit_event` MCP tool.
//
// Builds one OTel-SemConv-shaped event and fans it out SOFT-FAIL to:
//   - Axiom    (always)
//   - Telegram (severity warning|error|critical)
//   - Linear   (severity error|critical OR action_required; 24h dedup + labels)
// Each destination fails independently; emitEvent never throws. Secrets are read
// at runtime from the control project via ADC (the runtime broker SA already
// holds secretAccessor on them — same principal that runs emit-event.sh in CI).

import { createHash } from 'node:crypto';
import { getSecretValue } from './gcp-client.js';

const CONTROL_PROJECT = 'or-factory-master-control';
// EU edge deployment + /v1/ingest/<dataset> path — see scripts/emit-event.sh:88.
const AXIOM_INGEST_URL = 'https://eu-central-1.aws.edge.axiom.co/v1/ingest/factory-events';
const LINEAR_API_URL = 'https://api.linear.app/graphql';

export type Severity = 'info' | 'warning' | 'error' | 'critical';
export type Layer = 'factory' | 'system';

export interface EmitEventInput {
  name: string;
  severity: Severity;
  layer: Layer;
  system?: string;
  workflow: string;
  runId: string;
  actionRequired: boolean;
  body?: Record<string, unknown>;
}

interface AxiomResult { status: 'ok' | 'failed' | 'skipped'; http?: number; reason?: string; detail?: string }
interface TelegramResult { status: 'ok' | 'failed' | 'skipped'; http?: number; reason?: string }
interface LinearResult { status: 'created' | 'updated' | 'skipped' | 'failed'; issueId?: string; dedupKey?: string; reason?: string }

export interface EmitEventResult {
  event: Record<string, unknown>;
  axiom: AxiomResult;
  telegram: TelegramResult;
  linear: LinearResult;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Read a control-project secret; empty string on any failure (soft-fail, mirrors
// emit-event.sh's `[event] secret=… read='failed'`). trimEnd matches bash's
// command-substitution stripping of trailing newlines.
export async function readSecretSoft(name: string): Promise<string> {
  try {
    const v = await getSecretValue(CONTROL_PROJECT, name);
    return v.trimEnd();
  } catch {
    return '';
  }
}

// Mirrors scripts/lib/event-formatter.sh: flat dotted-key attributes (not nested),
// factory.system_name omitted when empty, factory.action_required a real boolean.
function formatOtelEvent(input: EmitEventInput): Record<string, unknown> {
  const sha = process.env.GITHUB_SHA ?? '';
  const event: Record<string, unknown> = {
    _time: new Date().toISOString(),
    'service.name': 'factory',
    'service.version': sha ? sha.slice(0, 7) : 'mcp',
    'otel.event.name': input.name,
    severity_text: input.severity,
  };
  if (input.system) event['factory.system_name'] = input.system;
  event['factory.workflow'] = input.workflow;
  event['factory.run_id'] = input.runId;
  event['factory.layer'] = input.layer;
  event['factory.action_required'] = input.actionRequired;
  event['event.body'] = input.body ?? {};
  return event;
}

async function ingestAxiom(eventJson: string, key: string): Promise<AxiomResult> {
  if (!key) return { status: 'skipped', reason: 'no-key' };
  try {
    const resp = await fetchWithTimeout(
      AXIOM_INGEST_URL,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: `[${eventJson}]`,
      },
      10000,
    );
    if (resp.ok) return { status: 'ok', http: resp.status };
    const detail = (await resp.text()).replace(/[\r\n]+/g, ' ').slice(0, 300);
    return { status: 'failed', http: resp.status, detail };
  } catch (e) {
    return { status: 'failed', http: 0, detail: String(e).slice(0, 300) };
  }
}

// Low-level Telegram Bot API send.
async function postTelegram(token: string, chatId: string, text: string): Promise<TelegramResult> {
  if (!token || !chatId) return { status: 'skipped', reason: 'no-secret' };
  try {
    const resp = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ chat_id: chatId, text }).toString(),
      },
      10000,
    );
    return resp.ok ? { status: 'ok', http: resp.status } : { status: 'failed', http: resp.status };
  } catch {
    return { status: 'failed', http: 0 };
  }
}

// Mirrors scripts/emit-event.sh:114-133. Caller gates on severity.
async function sendTelegram(input: EmitEventInput, token: string, chatId: string): Promise<TelegramResult> {
  const emoji = input.severity === 'critical' ? '🔥' : input.severity === 'error' ? '🚨' : '⚠️';
  const text =
    `${emoji} ${input.name}\n` +
    `System: ${input.system || 'control plane'}\n` +
    `Workflow: ${input.workflow} (run ${input.runId})\n` +
    `Severity: ${input.severity}`;
  return postTelegram(token, chatId, text);
}

// Send a free-form Telegram message, reading the bot token + chat id from the
// control project's Secret Manager at runtime (broker SA). Used by the
// /bs-webhook forwarder. Returns 'skipped' if a secret can't be read.
export async function sendTelegramMessage(text: string): Promise<TelegramResult> {
  const [token, chatId] = await Promise.all([
    readSecretSoft('telegram-bot-token'),
    readSecretSoft('telegram-chat-id'),
  ]);
  return postTelegram(token, chatId, text);
}

// ── Telegram inline-keyboard + callback helpers (OIL approval bridge) ────────────
// The approval bridge sends ONE message with ✅/❌ inline buttons whose
// callback_data carries the PR number (so no server-side state is needed), then
// answers the callback + edits the message after the press. All read the control
// bot token/chat id at runtime, same as sendTelegramMessage.

export interface InlineButton {
  text: string;
  callback_data: string;
}

interface SendKeyboardResult extends TelegramResult {
  messageId?: number;
}

// Send a message carrying an inline keyboard (one row of buttons). Returns the
// created message_id so the caller could edit it later if it wishes.
export async function sendTelegramKeyboard(
  text: string,
  buttons: InlineButton[],
): Promise<SendKeyboardResult> {
  const [token, chatId] = await Promise.all([
    readSecretSoft('telegram-bot-token'),
    readSecretSoft('telegram-chat-id'),
  ]);
  if (!token || !chatId) return { status: 'skipped', reason: 'no-secret' };
  try {
    const resp = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: { inline_keyboard: [buttons] },
        }),
      },
      10000,
    );
    if (!resp.ok) return { status: 'failed', http: resp.status };
    const data = (await resp.json().catch(() => ({}))) as { result?: { message_id?: number } };
    return { status: 'ok', http: resp.status, messageId: data.result?.message_id };
  } catch {
    return { status: 'failed', http: 0 };
  }
}

// Acknowledge a callback query (clears the button's loading spinner; optional
// toast text). Best-effort — returns the raw status.
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<TelegramResult> {
  const token = await readSecretSoft('telegram-bot-token');
  if (!token) return { status: 'skipped', reason: 'no-secret' };
  try {
    const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text) body['text'] = text;
    const resp = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/answerCallbackQuery`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      10000,
    );
    return resp.ok ? { status: 'ok', http: resp.status } : { status: 'failed', http: resp.status };
  } catch {
    return { status: 'failed', http: 0 };
  }
}

// Replace a message's text and drop its inline keyboard (called after ✅/❌ so the
// buttons can't be pressed twice). Best-effort.
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
): Promise<TelegramResult> {
  const token = await readSecretSoft('telegram-bot-token');
  if (!token) return { status: 'skipped', reason: 'no-secret' };
  try {
    const resp = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/editMessageText`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: [] } }),
      },
      10000,
    );
    return resp.ok ? { status: 'ok', http: resp.status } : { status: 'failed', http: resp.status };
  } catch {
    return { status: 'failed', http: 0 };
  }
}

// Managed-label colours — scripts/lib/linear-issue.sh:18-28.
const LABEL_COLORS: Record<string, string> = {
  factory: '#5E6AD2',
  'auto-created': '#95A2B3',
  'severity-info': '#4EA7FC',
  'severity-warning': '#F2994A',
  'severity-error': '#EB5757',
  'severity-critical': '#9F1239',
};

export async function linearGql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const resp = await fetchWithTimeout(
    LINEAR_API_URL,
    {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    },
    15000,
  );
  if (!resp.ok) throw new Error(`Linear GraphQL HTTP ${resp.status}`);
  const json = (await resp.json()) as { errors?: unknown[]; data?: T };
  if (json.errors && json.errors.length > 0) throw new Error('Linear GraphQL returned errors');
  if (json.data === undefined) throw new Error('Linear GraphQL returned no data');
  return json.data;
}

// Mirrors scripts/lib/linear-issue.sh: dedup search → comment if <24h else create;
// ensure managed labels; priority map. Strictly soft-fail.
async function createOrUpdateLinearIssue(
  event: Record<string, unknown>,
  token: string,
  teamId: string,
): Promise<LinearResult> {
  if (!token || !teamId) return { status: 'skipped', reason: 'no-secret' };
  try {
    const eventName = String(event['otel.event.name'] ?? '');
    const systemName = String(event['factory.system_name'] ?? '');
    const severity = String(event['severity_text'] ?? '');
    const workflow = String(event['factory.workflow'] ?? '');
    if (!eventName) return { status: 'failed', reason: 'event has no otel.event.name' };

    const dedupKey = createHash('sha256')
      .update(`${eventName}::${systemName || '_global'}`)
      .digest('hex')
      .slice(0, 12);
    const eventJson = JSON.stringify(event);

    let source = 'source-other';
    if (workflow === 'provision-system.yml') source = 'source-provision';
    else if (workflow.includes('deploy')) source = 'source-deploy';
    else if (workflow.startsWith('audit-')) source = 'source-audit';
    else if (workflow.startsWith('system-runtime-')) source = 'source-runtime';

    // Look for an existing open issue carrying this dedup key.
    const search = await linearGql<{
      issues: { nodes: Array<{ id: string; description: string | null; updatedAt: string }> };
    }>(
      token,
      'query($teamId: ID!){ issues(first:25, filter:{ team:{ id:{ eq:$teamId } }, state:{ type:{ in:["backlog","unstarted","started"] } } }){ nodes{ id identifier description updatedAt url } } }',
      { teamId },
    );
    const marker = `dedup:${dedupKey}`;
    const match = search.issues.nodes.find((n) => typeof n.description === 'string' && n.description.includes(marker));
    if (match) {
      const updatedEpoch = Date.parse(match.updatedAt);
      const age = Date.now() - updatedEpoch;
      if (!Number.isNaN(updatedEpoch) && age < 86_400_000) {
        const body = '```json\n' + eventJson + '\n```';
        await linearGql(
          token,
          'mutation($issueId: String!, $body: String!){ commentCreate(input:{ issueId:$issueId, body:$body }){ success } }',
          { issueId: match.id, body },
        );
        return { status: 'updated', issueId: match.id, dedupKey };
      }
      // Found but stale (>24h) — fall through and open a fresh issue.
    }

    // Resolve label ids, creating managed labels as needed. Bug is pre-existing.
    const labelsData = await linearGql<{ issueLabels: { nodes: Array<{ id: string; name: string }> } }>(
      token,
      'query{ issueLabels(first:250){ nodes{ id name } } }',
      {},
    );
    const labels = labelsData.issueLabels.nodes;
    const labelNames = ['factory', 'auto-created', `severity-${severity}`, source];
    if (severity === 'error' || severity === 'critical') labelNames.push('Bug');

    const labelIds: string[] = [];
    for (const name of labelNames) {
      const found = labels.find((l) => l.name === name);
      if (found) {
        labelIds.push(found.id);
        continue;
      }
      if (name === 'Bug') continue; // never create the standard Bug label
      const created = await linearGql<{ issueLabelCreate: { issueLabel: { id: string } | null } }>(
        token,
        'mutation($input: IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success issueLabel{ id } } }',
        { input: { name, color: LABEL_COLORS[name] ?? '#6B7280', teamId } },
      );
      const id = created.issueLabelCreate.issueLabel?.id;
      if (id) {
        labelIds.push(id);
        labels.push({ id, name });
      }
    }

    const priority =
      severity === 'critical' ? 1 : severity === 'error' ? 2 : severity === 'warning' ? 3 : severity === 'info' ? 4 : 0;
    const title = `[${severity}] ${eventName} — ${systemName || 'global'}`;
    const description = `<!-- dedup:${dedupKey} -->\n\n\`\`\`json\n${eventJson}\n\`\`\``;

    const createData = await linearGql<{ issueCreate: { issue: { id: string } | null } }>(
      token,
      'mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue{ id identifier url } } }',
      { input: { teamId, title, description, labelIds, priority } },
    );
    const newId = createData.issueCreate.issue?.id;
    if (!newId) return { status: 'failed', reason: 'issueCreate returned no id' };
    return { status: 'created', issueId: newId, dedupKey };
  } catch (e) {
    return { status: 'failed', reason: String(e).slice(0, 200) };
  }
}

// Orchestrates the full fan-out with the same severity gates as emit-event.sh.
export async function emitEvent(input: EmitEventInput): Promise<EmitEventResult> {
  const event = formatOtelEvent(input);
  const eventJson = JSON.stringify(event);

  const [axiomKey, tgToken, tgChat, linearKey, linearTeam] = await Promise.all([
    readSecretSoft('axiom-api-key'),
    readSecretSoft('telegram-bot-token'),
    readSecretSoft('telegram-chat-id'),
    readSecretSoft('linear-api-key'),
    readSecretSoft('linear-team-id'),
  ]);

  const axiom = await ingestAxiom(eventJson, axiomKey);

  let telegram: TelegramResult = { status: 'skipped', reason: 'severity' };
  if (input.severity === 'warning' || input.severity === 'error' || input.severity === 'critical') {
    telegram = await sendTelegram(input, tgToken, tgChat);
  }

  let linear: LinearResult = { status: 'skipped', reason: 'severity' };
  if (input.severity === 'error' || input.severity === 'critical' || input.actionRequired) {
    linear = await createOrUpdateLinearIssue(event, linearKey, linearTeam);
  }

  return { event, axiom, telegram, linear };
}
