// Durable mirror of the n8n-mcp proxy's per-client session memory.
//
// The proxy (n8n-mcp-proxy.ts) keeps each client's `initialize` payload in an
// instance-RAM Map so it can transparently re-initialize a reaped upstream
// session. That Map is correct within one warm instance but is LOST whenever the
// Cloud Run instance is replaced (DEPLOY_NONCE revision roll, maintenance, OOM)
// — after which recovery used to fail and the client saw the raw
// "Session not found" error (Layer B of the two root causes; Layer A is the
// sidecar idle-reap window, handled in render-mcp-service-yaml.sh).
//
// This module adds a durable tier (Firestore, via the REST API + the ambient
// runtime-SA ADC token — the same bare-fetch pattern as gcp-client.ts, ZERO new
// deps) so the record survives instance replacement and the proxy can rehydrate
// and recover. It is an availability UPGRADE, never a new hard dependency:
// every method is FAIL-OPEN (a store outage resolves to a miss / a swallowed
// write), so a down store degrades to exactly today's RAM-only behavior, never
// worse.
//
// Security: the stored record holds NO secrets. `initBody` is the client's
// initialize JSON-RPC bytes; the per-tenant `x-n8n-url`/`x-n8n-key` are injected
// per-request in the proxy's fetchUpstream, never serialized here. `system` is
// the tenant binding (see resolveStoredSession) so a record minted under tenant
// A can never be replayed against tenant B's n8n.

import { getGcpAccessToken } from './gcp-client.js';

const COLLECTION = 'n8n-mcp-sessions';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h — generously longer than the
// sidecar idle-reap window; a record older than this is a stale client we let
// lapse to a normal re-initialize.
const STORE_TIMEOUT_MS = 4_000; // bounded so a hung Firestore can't stall the
// proxy's request budget (60s); on timeout we abort and treat it as a miss.

export interface StoredSession {
  initBody: string; // exact initialize bytes for replay (no secrets)
  upstreamSid: string; // last-known upstream sid (advisory — reinit re-mints)
  system: string; // tenant binding
}

// The minimal durable backend the proxy depends on. The real impl is Firestore
// REST; tests inject a fake (or a throwing fake to prove the fail-open path).
// Every method FAILS OPEN: get → null on any error, put/del → swallow.
export interface SessionBackend {
  get(clientSid: string): Promise<StoredSession | null>;
  put(clientSid: string, rec: StoredSession): Promise<void>;
  del(clientSid: string): Promise<void>;
}

// Firestore typed-value document shape (only the fields we use).
interface FirestoreDoc {
  fields?: {
    initBody?: { stringValue?: string };
    upstreamSid?: { stringValue?: string };
    system?: { stringValue?: string };
    expireAt?: { timestampValue?: string };
  };
}

// ── Pure helpers (no network — exported for unit testing, mirroring
//    gcp-client.ts's buildAddSecretVersionRequest / computeFreeUpDate) ─────────

// REST resource path for one session document. `clientSid` is encoded so an id
// containing a '/' can never be interpreted as a Firestore subcollection.
export function buildSessionDocPath(project: string, clientSid: string): string {
  return `projects/${encodeURIComponent(project)}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(clientSid)}`;
}

// Serialize a record to a Firestore document, stamping `expireAt = now + ttl`
// (server-side TTL policy reaps it; the read side also enforces it).
export function encodeSessionDoc(rec: StoredSession, now: number, ttlMs: number = DEFAULT_TTL_MS): FirestoreDoc {
  return {
    fields: {
      initBody: { stringValue: rec.initBody },
      upstreamSid: { stringValue: rec.upstreamSid },
      system: { stringValue: rec.system },
      expireAt: { timestampValue: new Date(now + ttlMs).toISOString() },
    },
  };
}

// Parse a Firestore document back to a record. Returns null for a malformed doc
// OR an expired one (app-side TTL — Firestore's server-side TTL deletion is
// best-effort within ~24h, so we never trust a past `expireAt`).
export function decodeSessionDoc(doc: unknown, now: number): StoredSession | null {
  const f = (doc as FirestoreDoc | undefined)?.fields;
  if (!f) return null;
  const initBody = f.initBody?.stringValue;
  const upstreamSid = f.upstreamSid?.stringValue;
  const system = f.system?.stringValue;
  if (typeof initBody !== 'string' || typeof upstreamSid !== 'string' || typeof system !== 'string') {
    return null;
  }
  const expireAt = f.expireAt?.timestampValue;
  if (typeof expireAt === 'string' && Number.isFinite(Date.parse(expireAt)) && Date.parse(expireAt) <= now) {
    return null;
  }
  return { initBody, upstreamSid, system };
}

// Resolve a stored session for recovery, enforcing the tenant guard. Returns the
// record only when it exists AND was minted under the same `system` — so a
// recovered record can never be replayed against the wrong tenant. Fail-open:
// a null backend or any store error yields null (→ the proxy falls back to
// today's "couldn't recover, surface the original error" path). Exported as the
// network-free seam the proxy calls and the unit tests drive with fakes.
export async function resolveStoredSession(
  clientSid: string,
  system: string,
  backend: SessionBackend | null,
): Promise<StoredSession | null> {
  if (!backend) return null;
  const stored = await backend.get(clientSid).catch(() => null);
  if (!stored) return null;
  if (stored.system !== system) return null; // tenant guard (defense-in-depth)
  return stored;
}

// ── Firestore backend (the only impure edge) ─────────────────────────────────

let lastWarnAt = 0;
function warnThrottled(msg: string): void {
  const now = Date.now();
  if (now - lastWarnAt > 60_000) {
    lastWarnAt = now;
    // Single throttled line; a store hiccup is degraded handling, not an error.
    console.warn(`[session-store] ${msg}`);
  }
}

async function firestoreFetch(
  method: string,
  path: string,
  body: unknown,
  getToken: () => Promise<string>,
): Promise<globalThis.Response> {
  const token = await getToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STORE_TIMEOUT_MS);
  try {
    return await fetch(`https://firestore.googleapis.com/v1/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function makeFirestoreBackend(deps?: {
  getToken?: () => Promise<string>;
  project?: string;
  ttlMs?: number;
  now?: () => number;
}): SessionBackend {
  const getToken = deps?.getToken ?? getGcpAccessToken;
  const project = deps?.project ?? process.env.SESSION_STORE_PROJECT ?? 'or-factory-master-control';
  const ttlMs = deps?.ttlMs ?? DEFAULT_TTL_MS;
  const now = deps?.now ?? (() => Date.now());
  return {
    async get(clientSid: string): Promise<StoredSession | null> {
      try {
        const resp = await firestoreFetch('GET', buildSessionDocPath(project, clientSid), undefined, getToken);
        if (resp.status === 404) return null; // normal miss
        if (!resp.ok) {
          warnThrottled(`get ${resp.status} — treating as miss`);
          return null;
        }
        return decodeSessionDoc(await resp.json(), now());
      } catch (e) {
        warnThrottled(`get failed (${String((e as Error).message).slice(0, 120)}) — treating as miss`);
        return null;
      }
    },
    // PATCH with the full record = upsert (we always write all fields, so the
    // missing-updateMask "replace" semantics are exactly what we want).
    async put(clientSid: string, rec: StoredSession): Promise<void> {
      try {
        const resp = await firestoreFetch(
          'PATCH',
          buildSessionDocPath(project, clientSid),
          encodeSessionDoc(rec, now(), ttlMs),
          getToken,
        );
        if (!resp.ok) warnThrottled(`put ${resp.status} — RAM tier still authoritative`);
      } catch (e) {
        warnThrottled(`put failed (${String((e as Error).message).slice(0, 120)}) — RAM tier still authoritative`);
      }
    },
    async del(clientSid: string): Promise<void> {
      try {
        await firestoreFetch('DELETE', buildSessionDocPath(project, clientSid), undefined, getToken);
      } catch {
        /* hygiene-only delete — a failure just leaves a doc to lapse via TTL */
      }
    },
  };
}

// The default backend, or null when the durable tier is disabled
// (SESSION_STORE_ENABLED!="1" — the instant RAM-only rollback, no code change).
export function defaultBackend(): SessionBackend | null {
  if (process.env.SESSION_STORE_ENABLED !== '1') return null;
  return makeFirestoreBackend();
}
