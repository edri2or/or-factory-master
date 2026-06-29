// Unit tests for the durable session store (Layer B of the n8n-mcp session
// durability fix). Pure + DI-seam only — no real Firestore, no network. Mirrors
// the tsc-gated, zero-dep convention: build first, then `npm test`. The store's
// only impure edge (Firestore REST) is exercised via an injected getToken whose
// failure proves the fail-open contract; the pure (de)serialization + the
// tenant-guarded resolver are tested directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// session-store → gcp-client → (transitively) github-client, which asserts these
// env vars at load. The store never touches GitHub; dummy values satisfy the
// presence check so the import succeeds (same shim as n8n-mcp-proxy.test.mjs).
process.env.GITHUB_APP_ID ??= 'test-app-id';
process.env.GITHUB_APP_INSTALLATION_ID ??= 'test-install-id';
process.env.GITHUB_APP_PRIVATE_KEY ??= 'test-key';

const {
  buildSessionDocPath,
  encodeSessionDoc,
  decodeSessionDoc,
  resolveStoredSession,
  makeFirestoreBackend,
} = await import('../dist/session-store.js');

const rec = { initBody: '{"jsonrpc":"2.0","method":"initialize","id":1}', upstreamSid: 'up-123', system: 'or-edri-4' };

// ── pure (de)serialization ───────────────────────────────────────────────────

test('encode/decode round-trips the record', () => {
  const now = 1_000_000;
  const doc = encodeSessionDoc(rec, now, 60_000);
  const back = decodeSessionDoc(doc, now);
  assert.deepEqual(back, rec);
});

test('encodeSessionDoc stamps expireAt = now + ttl', () => {
  const now = 1_700_000_000_000;
  const ttl = 3_600_000;
  const doc = encodeSessionDoc(rec, now, ttl);
  assert.equal(doc.fields.expireAt.timestampValue, new Date(now + ttl).toISOString());
});

test('secret-safety: the serialized record carries no n8n credential material', () => {
  const serialized = JSON.stringify(encodeSessionDoc(rec, 0, 60_000));
  for (const needle of ['x-n8n-key', 'x-n8n-url', 'apiKey', 'Bearer']) {
    assert.ok(!serialized.includes(needle), `serialized record must not contain "${needle}"`);
  }
});

test('decodeSessionDoc returns null for an expired doc (app-side TTL)', () => {
  const stampedAt = 1_000_000;
  const doc = encodeSessionDoc(rec, stampedAt, 60_000); // expires at stampedAt+60s
  assert.equal(decodeSessionDoc(doc, stampedAt + 60_001), null);
});

test('decodeSessionDoc returns null for a malformed / empty doc', () => {
  assert.equal(decodeSessionDoc(undefined, 0), null);
  assert.equal(decodeSessionDoc({}, 0), null);
  assert.equal(decodeSessionDoc({ fields: { initBody: { stringValue: 'x' } } }, 0), null); // missing system/upstreamSid
});

test('buildSessionDocPath encodes the clientSid path segment', () => {
  const path = buildSessionDocPath('or-factory-master-control', 'a/b weird');
  assert.ok(path.includes('/documents/n8n-mcp-sessions/a%2Fb%20weird'));
  assert.ok(path.startsWith('projects/or-factory-master-control/databases/(default)/documents/'));
});

// ── tenant-guarded resolver (the proxy's recovery seam) ──────────────────────

function fakeBackend(map) {
  return {
    async get(sid) {
      return map.get(sid) ?? null;
    },
    async put(sid, r) {
      map.set(sid, r);
    },
    async del(sid) {
      map.delete(sid);
    },
  };
}

test('resolveStoredSession rehydrates a same-tenant record (cross-instance replacement)', async () => {
  const be = fakeBackend(new Map([['sid-1', rec]]));
  const got = await resolveStoredSession('sid-1', 'or-edri-4', be);
  assert.deepEqual(got, rec);
});

test('resolveStoredSession refuses a foreign-tenant record (tenant guard)', async () => {
  const be = fakeBackend(new Map([['sid-1', rec]])); // rec.system === or-edri-4
  assert.equal(await resolveStoredSession('sid-1', 'some-other-system', be), null);
});

test('resolveStoredSession returns null for an unknown sid and a null backend', async () => {
  const be = fakeBackend(new Map());
  assert.equal(await resolveStoredSession('missing', 'or-edri-4', be), null);
  assert.equal(await resolveStoredSession('sid-1', 'or-edri-4', null), null);
});

test('resolveStoredSession fails open when the backend throws', async () => {
  const throwing = {
    async get() {
      throw new Error('firestore down');
    },
    async put() {
      throw new Error('firestore down');
    },
    async del() {
      throw new Error('firestore down');
    },
  };
  assert.equal(await resolveStoredSession('sid-1', 'or-edri-4', throwing), null);
});

// ── Firestore backend fail-open (no network: the injected getToken fails) ─────

test('makeFirestoreBackend.get returns null (not throws) when auth/network fails', async () => {
  const be = makeFirestoreBackend({
    getToken: async () => {
      throw new Error('no ADC token');
    },
    project: 'or-factory-master-control',
  });
  assert.equal(await be.get('sid-1'), null);
});

test('makeFirestoreBackend.put swallows errors (RAM tier stays authoritative)', async () => {
  const be = makeFirestoreBackend({
    getToken: async () => {
      throw new Error('no ADC token');
    },
    project: 'or-factory-master-control',
  });
  await assert.doesNotReject(be.put('sid-1', rec));
  await assert.doesNotReject(be.del('sid-1'));
});
