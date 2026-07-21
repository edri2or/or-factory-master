import { test } from 'node:test';
import assert from 'node:assert/strict';

// Pure helpers behind the append_agent_data tool — the security-critical path
// allowlist + append composition. Imported from the compiled output (npm test =
// "tsc && node --test"), mirroring test/workspace-drive-edit.test.mjs.
import { buildAgentDataPath, composeAppendedContent } from '../dist/agent-data.js';

test('buildAgentDataPath composes a valid path from (agent, file)', () => {
  assert.equal(buildAgentDataPath('gmail', 'log.md'), 'agents/gmail/data/log.md');
  assert.equal(buildAgentDataPath('foo-bar', 'log.csv'), 'agents/foo-bar/data/log.csv');
  assert.equal(buildAgentDataPath('a1', 'x_y-1.2.json'), 'agents/a1/data/x_y-1.2.json');
});

test('buildAgentDataPath rejects traversal / slashes / absolute / dotfiles in file', () => {
  for (const bad of ['../etc/passwd', 'a/b', '/abs', 'x/../y', '..', '.', '', '.hidden', 'a b']) {
    assert.ok(
      buildAgentDataPath('gmail', bad) instanceof Error,
      `file "${bad}" must be rejected`,
    );
  }
});

test('buildAgentDataPath rejects a bad agent name', () => {
  for (const bad of ['..', 'a/b', 'UPPER', '-lead', 'trail-', '', 'a b', 'x'.repeat(41)]) {
    assert.ok(
      buildAgentDataPath(bad, 'log.md') instanceof Error,
      `agent "${bad}" must be rejected`,
    );
  }
});

test('composeAppendedContent ensures single-newline separation + trailing newline', () => {
  assert.equal(composeAppendedContent('', 'row1'), 'row1\n');
  assert.equal(composeAppendedContent('a\n', 'b'), 'a\nb\n');
  assert.equal(composeAppendedContent('a', 'b'), 'a\nb\n'); // base missing trailing newline
  assert.equal(composeAppendedContent('a\n', 'b\n'), 'a\nb\n'); // row already newline-terminated
  assert.equal(composeAppendedContent('a\n', 'b\n\n'), 'a\nb\n'); // strips extra trailing newlines on row
  assert.equal(composeAppendedContent('h1\nh2\n', 'r'), 'h1\nh2\nr\n'); // multi-line base
});
