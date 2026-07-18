import { test } from 'node:test';
import assert from 'node:assert/strict';

import { namesEqualCI } from '../dist/name-match.js';

test('matches the Railway Postgres service across casing (the fixed bug)', () => {
  // Railway names the database service "Postgres"; the verifier looks for "postgres".
  assert.equal(namesEqualCI('Postgres', 'postgres'), true);
});

test('is case-insensitive both directions and for other services', () => {
  assert.equal(namesEqualCI('N8N', 'n8n'), true);
  assert.equal(namesEqualCI('n8n', 'N8N'), true);
  assert.equal(namesEqualCI('Production', 'production'), true);
  assert.equal(namesEqualCI('Protect-Main', 'protect-main'), true);
});

test('still distinguishes genuinely different names', () => {
  assert.equal(namesEqualCI('n8n', 'postgres'), false);
  assert.equal(namesEqualCI('caddy', 'postgres'), false);
});

test('is null/undefined safe (no throw, no false positive)', () => {
  assert.equal(namesEqualCI(undefined, 'postgres'), false);
  assert.equal(namesEqualCI('postgres', undefined), false);
  assert.equal(namesEqualCI(null, null), false);
  assert.equal(namesEqualCI(undefined, undefined), false);
  assert.equal(namesEqualCI('', ''), true);
});
