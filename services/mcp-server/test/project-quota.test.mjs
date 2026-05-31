import { test } from 'node:test';
import assert from 'node:assert/strict';

// Satisfy the module-load env checks pulled in transitively (github-client),
// mirroring test/oil-approval.test.mjs. computeFreeUpDate itself is a pure
// helper — no network, no credentials needed.
process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const { computeFreeUpDate } = await import('../dist/gcp-client.js');

test('computeFreeUpDate: freeUpDate = deleteTime + 30 days', () => {
  const { freeUpDate } = computeFreeUpDate(
    '2026-05-01T00:00:00Z',
    new Date('2026-05-10T00:00:00Z'),
  );
  assert.equal(freeUpDate, '2026-05-31T00:00:00.000Z');
});

test('computeFreeUpDate: daysRemaining counts whole days from now', () => {
  // deleteTime + 30d = 2026-05-31; now = 2026-05-21 → 10 days remaining
  const { daysRemaining } = computeFreeUpDate(
    '2026-05-01T00:00:00Z',
    new Date('2026-05-21T00:00:00Z'),
  );
  assert.equal(daysRemaining, 10);
});

test('computeFreeUpDate: past free-up clamps to 0', () => {
  const { daysRemaining } = computeFreeUpDate(
    '2026-01-01T00:00:00Z',
    new Date('2026-05-21T00:00:00Z'),
  );
  assert.equal(daysRemaining, 0);
});

test('computeFreeUpDate: null/blank deleteTime → nulls', () => {
  assert.deepEqual(computeFreeUpDate(null), { freeUpDate: null, daysRemaining: null });
  assert.deepEqual(computeFreeUpDate(''), { freeUpDate: null, daysRemaining: null });
});

test('computeFreeUpDate: unparseable deleteTime → nulls', () => {
  assert.deepEqual(computeFreeUpDate('not-a-date'), { freeUpDate: null, daysRemaining: null });
});
