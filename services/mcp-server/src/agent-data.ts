// Pure helpers for the `append_agent_data` MCP tool — path allowlisting +
// append composition. NO network here (unit-tested directly in
// test/agent-data-path.test.mjs); the GitHub calls live in github-client.ts and
// the wiring in tools.ts. Keeping the security-critical validation pure means it
// is exhaustively testable without stubbing the network.

// A system/agent folder name: lowercase alphanumeric + internal hyphens, 1–40
// chars, no leading/trailing hyphen. Matches the system-name shape used
// elsewhere in the gateway; agents live under agents/<agent>/.
const AGENT_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

// A single filename segment: starts alphanumeric, then alphanumeric/dot/
// underscore/hyphen. No slashes, so a second path segment is impossible.
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Compose the repo path SERVER-SIDE from (agent, file) so a caller can never
// inject "../", an absolute path, or a second path segment — the slash is only
// ever inserted here, between validated tokens. Returns the path or an Error.
export function buildAgentDataPath(agent: string, file: string): string | Error {
  if (typeof agent !== 'string' || !AGENT_RE.test(agent)) {
    return new Error('invalid agent name');
  }
  if (typeof file !== 'string' || file === '.' || file === '..' || !FILE_RE.test(file)) {
    return new Error('invalid file name (single segment, no slashes)');
  }
  return `agents/${agent}/data/${file}`;
}

// Append `row` to `base` as a trailing line: exactly one newline between the
// existing content and the new row, and a single trailing newline. Idempotent
// about the row's own trailing newlines (they are normalised away first).
export function composeAppendedContent(base: string, row: string): string {
  const cleanRow = row.replace(/\n+$/, '');
  if (base === '') return `${cleanRow}\n`;
  const sep = base.endsWith('\n') ? '' : '\n';
  return `${base}${sep}${cleanRow}\n`;
}
