// Unit tests for the pure Drive content-edit helpers (no network). The module
// reads CONTROL_PROJECT + the WORKSPACE client from env at import, and pulls in
// gcp-client (ADC, no network at import), so just import the compiled module.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The module pulls in gcp-client → manifest-helper → github-client, which throws
// at import without these env vars. No network is touched; the values are dummies.
process.env.GITHUB_APP_ID ||= 'test';
process.env.GITHUB_APP_INSTALLATION_ID ||= 'test';
process.env.GITHUB_APP_PRIVATE_KEY ||= 'test';

const {
  DRIVE_EDIT_TOOL_NAME,
  DRIVE_EDIT_TOOL,
  isGoogleNativeMime,
  parseDriveEditArgs,
  parseDriveEditCall,
  isToolsListRequest,
  extractJsonRpcMessage,
  injectToolIntoToolsList,
  buildToolResult,
} = await import('../dist/workspace-drive-edit.js');

test('DRIVE_EDIT_TOOL: well-formed MCP tool definition', () => {
  assert.equal(DRIVE_EDIT_TOOL.name, DRIVE_EDIT_TOOL_NAME);
  assert.equal(DRIVE_EDIT_TOOL.inputSchema.type, 'object');
  assert.deepEqual(DRIVE_EDIT_TOOL.inputSchema.required, ['file_id']);
  for (const p of ['file_id', 'content', 'content_base64', 'mime_type']) {
    assert.ok(DRIVE_EDIT_TOOL.inputSchema.properties[p], `schema has ${p}`);
  }
});

test('isGoogleNativeMime: only application/vnd.google-apps.* is native', () => {
  assert.equal(isGoogleNativeMime('application/vnd.google-apps.document'), true);
  assert.equal(isGoogleNativeMime('application/vnd.google-apps.spreadsheet'), true);
  assert.equal(isGoogleNativeMime('text/markdown'), false);
  assert.equal(isGoogleNativeMime('text/plain'), false);
  assert.equal(isGoogleNativeMime('image/png'), false);
  assert.equal(isGoogleNativeMime(undefined), false);
});

test('parseDriveEditArgs: requires file_id', () => {
  const r = parseDriveEditArgs({ content: 'hi' });
  assert.ok(r instanceof Error);
  assert.match(r.message, /file_id is required/);
});

test('parseDriveEditArgs: requires exactly one of content / content_base64', () => {
  assert.ok(parseDriveEditArgs({ file_id: 'x' }) instanceof Error, 'neither');
  assert.ok(
    parseDriveEditArgs({ file_id: 'x', content: 'a', content_base64: 'YQ==' }) instanceof Error,
    'both',
  );
});

test('parseDriveEditArgs: text content → UTF-8 buffer', () => {
  const r = parseDriveEditArgs({ file_id: 'abc', content: 'héllo' });
  assert.ok(!(r instanceof Error));
  assert.equal(r.fileId, 'abc');
  assert.equal(r.body.toString('utf8'), 'héllo');
  assert.equal(r.mimeType, undefined);
});

test('parseDriveEditArgs: valid base64 → decoded buffer; mime_type passes through', () => {
  const b64 = Buffer.from([0, 1, 2, 255]).toString('base64');
  const r = parseDriveEditArgs({ file_id: 'abc', content_base64: b64, mime_type: 'image/png' });
  assert.ok(!(r instanceof Error));
  assert.deepEqual([...r.body], [0, 1, 2, 255]);
  assert.equal(r.mimeType, 'image/png');
});

test('parseDriveEditArgs: malformed base64 is rejected', () => {
  const r = parseDriveEditArgs({ file_id: 'abc', content_base64: 'not valid base64 @@@' });
  assert.ok(r instanceof Error);
  assert.match(r.message, /not valid base64/);
});

test('parseDriveEditCall: matches a single tools/call for our tool', () => {
  const body = {
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: DRIVE_EDIT_TOOL_NAME, arguments: { file_id: 'z', content: 'q' } },
  };
  const call = parseDriveEditCall(body);
  assert.ok(call);
  assert.equal(call.id, 7);
  assert.equal(call.args.file_id, 'z');
});

test('parseDriveEditCall: ignores other tools, methods, and batches', () => {
  assert.equal(parseDriveEditCall({ method: 'tools/call', params: { name: 'update_drive_file' } }), null);
  assert.equal(parseDriveEditCall({ method: 'tools/list' }), null);
  assert.equal(parseDriveEditCall([{ method: 'tools/call', params: { name: DRIVE_EDIT_TOOL_NAME } }]), null);
  assert.equal(parseDriveEditCall(null), null);
});

test('isToolsListRequest: only a single tools/list', () => {
  assert.equal(isToolsListRequest({ method: 'tools/list' }), true);
  assert.equal(isToolsListRequest({ method: 'tools/call' }), false);
  assert.equal(isToolsListRequest([{ method: 'tools/list' }]), false);
});

test('extractJsonRpcMessage: plain application/json', () => {
  const msg = extractJsonRpcMessage('application/json', '{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}');
  assert.equal(msg.id, 1);
  assert.deepEqual(msg.result.tools, []);
});

test('extractJsonRpcMessage: SSE dataframing', () => {
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"a"}]}}\n\n';
  const msg = extractJsonRpcMessage('text/event-stream', sse);
  assert.equal(msg.id, 2);
  assert.equal(msg.result.tools[0].name, 'a');
});

test('extractJsonRpcMessage: unparseable → null', () => {
  assert.equal(extractJsonRpcMessage('application/json', 'not json'), null);
});

test('injectToolIntoToolsList: appends once, de-dupes by name', () => {
  const msg = { jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'search_drive_files' }] } };
  injectToolIntoToolsList(msg);
  const names = msg.result.tools.map((t) => t.name);
  assert.ok(names.includes(DRIVE_EDIT_TOOL_NAME));
  assert.equal(msg.result.tools.length, 2);
  // idempotent
  injectToolIntoToolsList(msg);
  assert.equal(msg.result.tools.length, 2);
});

test('injectToolIntoToolsList: leaves a non-list message unchanged', () => {
  const msg = { jsonrpc: '2.0', id: 1, result: { somethingElse: true } };
  const out = injectToolIntoToolsList(msg);
  assert.deepEqual(out.result, { somethingElse: true });
});

test('buildToolResult: MCP tool-result envelope with one text block', () => {
  const r = buildToolResult(9, { ok: true, file_id: 'x' });
  assert.equal(r.jsonrpc, '2.0');
  assert.equal(r.id, 9);
  assert.equal(r.result.isError, false);
  assert.equal(r.result.content[0].type, 'text');
  assert.match(r.result.content[0].text, /file_id/);
});
