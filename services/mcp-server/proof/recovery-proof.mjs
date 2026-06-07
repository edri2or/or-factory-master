// PROOF (manual, not in CI): drives the REAL proxyToN8nMcp against a scripted
// fake n8n-mcp sidecar to demonstrate transparent session recovery end-to-end.
// Run with:
//   npm run build && node --experimental-test-module-mocks --test test/recovery-proof.mjs
// (kept out of `npm test` because it needs the module-mock flag.)
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';

// Module load reads these once — set before importing the proxy.
process.env.N8N_MCP_URL = 'http://fake-sidecar.local/mcp';
process.env.N8N_MCP_AUTH_TOKEN = 'x'.repeat(40);
process.env.N8N_DEV_ALLOWED_SYSTEMS = '*';
process.env.GITHUB_APP_ID ??= 'test-app-id';
process.env.GITHUB_APP_INSTALLATION_ID ??= 'test-install-id';
process.env.GITHUB_APP_PRIVATE_KEY ??= 'test-key';

// Stub the only non-fetch dependency: the cross-project tenant resolver (GCP SM).
mock.module('../dist/n8n-client.js', {
  namedExports: {
    resolveN8nTarget: async () => ({ baseUrl: 'https://n8n-or-tok.or-infra.com', apiKey: 'tenant-key' }),
    N8nKeyMissingError: class N8nKeyMissingError extends Error {},
  },
});

const { proxyToN8nMcp } = await import('../dist/n8n-mcp-proxy.js');

// ── Scripted fake n8n-mcp sidecar (the "stateful translator") ──
// Mints sess-1 first; reaps it (returns the real "Session not found or expired"
// 400 on the next tools/call); mints sess-2 on the gateway's transparent re-init.
const calls = [];
let initCount = 0;
function jsonResp(status, obj, sid) {
  const headers = { 'content-type': 'application/json' };
  if (sid) headers['mcp-session-id'] = sid;
  return new Response(JSON.stringify(obj), { status, headers });
}
globalThis.fetch = async (_url, opts) => {
  const sid = opts.headers['mcp-session-id'];
  const body = opts.body ? JSON.parse(opts.body) : {};
  const method = Array.isArray(body) ? body[0]?.method : body.method;
  calls.push({ method, sid });
  if (method === 'initialize') {
    initCount += 1;
    return jsonResp(200, { jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26' } }, initCount === 1 ? 'sess-1' : 'sess-2');
  }
  if (method === 'notifications/initialized') return new Response('', { status: 202 });
  // tools/call: sess-1 was reaped → expired error; sess-2 is live → success.
  if (sid === 'sess-1') {
    return jsonResp(400, { jsonrpc: '2.0', id: body.id, error: { code: -32001, message: 'Session not found or expired' } });
  }
  if (sid === 'sess-2') {
    return jsonResp(200, { jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'n8n_list_workflows' }] } });
  }
  return new Response('unexpected', { status: 500 });
};

class FakeRes extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
    this._ended = false;
  }
  status(c) { this.statusCode = c; return this; }
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
  getHeader(k) { return this.headers[k.toLowerCase()]; }
  json(o) { this.end(JSON.stringify(o)); return this; }
  _write(chunk, _enc, cb) { this.chunks.push(Buffer.from(chunk)); cb(); }
  end(chunk, enc, cb) { this._ended = true; return super.end(chunk, enc, cb); }
  get body() { return Buffer.concat(this.chunks).toString('utf8'); }
  get headersSent() { return this._ended; }
}

function makeReq(method, body, sid) {
  return { method, headers: sid ? { 'mcp-session-id': sid } : {}, body, rawBody: Buffer.from(JSON.stringify(body)) };
}
async function drive(req) {
  const res = new FakeRes();
  const finished = new Promise((r) => res.on('finish', r));
  await proxyToN8nMcp(req, res, 'or-tok');
  await Promise.race([finished, new Promise((r) => setTimeout(r, 500))]);
  return res;
}

test('PROOF: gateway transparently recovers an expired session — client gets 200, never the 400', async () => {
  // 1) initialize → gateway mints + remembers the client session (sess-1).
  const init = await drive(makeReq('POST', { jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }));
  assert.equal(init.statusCode, 200, 'initialize should succeed');
  assert.equal(init.getHeader('mcp-session-id'), 'sess-1', 'client receives sess-1');

  // 2) a tools/call AFTER the sidecar reaped sess-1. The gateway must NOT pass the
  //    400 through — it re-initializes (sess-2) under the hood and replays the call.
  const call = await drive(makeReq('POST', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'n8n_list_workflows', arguments: {} } }, 'sess-1'));

  assert.equal(call.statusCode, 200, 'client must see 200 (recovered), NOT 400 (expired)');
  assert.equal(call.getHeader('mcp-session-id'), 'sess-1', 'client keeps its STABLE session id');
  assert.match(call.body, /n8n_list_workflows/, 'client gets the real tool result');

  // And prove the recovery actually happened underneath: a 2nd initialize (re-init)
  // and the replayed tools/call landed on the fresh upstream session sess-2.
  assert.equal(initCount, 2, 'gateway performed a transparent re-initialize');
  assert.ok(calls.some((c) => c.method === 'tools/call' && c.sid === 'sess-2'), 'original call was replayed on the fresh session');
});
