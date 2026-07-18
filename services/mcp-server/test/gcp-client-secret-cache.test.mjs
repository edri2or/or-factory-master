// Unit tests for the in-memory TTL cache wrapping getSecretValue in gcp-client.
// No network: a fake fetchImpl is injected and an explicit clock (now) drives
// TTL expiry deterministically, mirroring the injected-clock convention already
// used by computeFreeUpDate in the same module.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// gcp-client → manifest-helper → github-client throws at import without these.
// No network is touched; the values are dummies.
process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { getSecretValue, __resetSecretCache } = await import('../dist/gcp-client.js');

// A call-counting fake of the private gcpFetch: returns a well-formed Secret
// Manager `:access` response wrapping `value`.
function stubFetch(value) {
  const calls = { count: 0 };
  const fetchImpl = async () => {
    calls.count += 1;
    return { payload: { data: Buffer.from(value, 'utf8').toString('base64') } };
  };
  return { fetchImpl, calls };
}

test('getSecretValue: a successful read is cached within the TTL (one network call)', async () => {
  __resetSecretCache();
  const { fetchImpl, calls } = stubFetch('hunter2');
  const a = await getSecretValue('proj', 'sec', { now: 1_000, fetchImpl });
  const b = await getSecretValue('proj', 'sec', { now: 1_000 + 30_000, fetchImpl }); // < 60s TTL
  assert.equal(a, 'hunter2');
  assert.equal(b, 'hunter2');
  assert.equal(calls.count, 1, 'second read within TTL is served from cache');
});

test('getSecretValue: re-reads once the TTL has expired', async () => {
  __resetSecretCache();
  const { fetchImpl, calls } = stubFetch('v');
  await getSecretValue('proj', 'sec', { now: 1_000, fetchImpl });
  await getSecretValue('proj', 'sec', { now: 1_000 + 61_000, fetchImpl }); // > 60s TTL
  assert.equal(calls.count, 2, 'an expired entry triggers a fresh network read');
});

test('getSecretValue: cache is keyed per (projectId, name), not global', async () => {
  __resetSecretCache();
  const { fetchImpl, calls } = stubFetch('x');
  await getSecretValue('projA', 'sec', { now: 1_000, fetchImpl });
  await getSecretValue('projB', 'sec', { now: 1_000, fetchImpl });
  await getSecretValue('projA', 'other', { now: 1_000, fetchImpl });
  assert.equal(calls.count, 3, 'three distinct keys each fetch exactly once');
});

test('getSecretValue: failures are NOT cached (a retry fetches fresh)', async () => {
  __resetSecretCache();
  let n = 0;
  const fetchImpl = async () => {
    n += 1;
    if (n === 1) throw new Error('boom');
    return { payload: { data: Buffer.from('ok', 'utf8').toString('base64') } };
  };
  await assert.rejects(getSecretValue('proj', 'sec', { now: 1_000, fetchImpl }), /boom/);
  const v = await getSecretValue('proj', 'sec', { now: 1_500, fetchImpl }); // still inside would-be TTL
  assert.equal(v, 'ok', 'the prior failure was not cached; the retry read fresh');
  assert.equal(n, 2);
});

test('getSecretValue: an empty payload throws and is NOT cached', async () => {
  __resetSecretCache();
  let n = 0;
  const fetchImpl = async () => {
    n += 1;
    if (n === 1) return { payload: {} }; // empty → must throw and not cache
    return { payload: { data: Buffer.from('good', 'utf8').toString('base64') } };
  };
  await assert.rejects(getSecretValue('proj', 'sec', { now: 1_000, fetchImpl }), /empty payload/);
  const v = await getSecretValue('proj', 'sec', { now: 1_200, fetchImpl });
  assert.equal(v, 'good');
  assert.equal(n, 2);
});
