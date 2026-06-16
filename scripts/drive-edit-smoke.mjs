// Live smoke for the gateway-owned edit_drive_file_content tool (drive-content-edit
// Stage 2). Unlike the Phase-1 probe (which hit the Drive API directly), this drives
// the tool THROUGH the live gateway's /workspace/<system>/mcp route end-to-end — the
// real facade path claude.ai and every system use. Proof:
//   1. create a real temp .md in Drive (shared token)         [setup]
//   2. mint a workspace-runtime bearer for <system>           [admin-gated]
//   3. MCP initialize + tools/list -> tool MUST be present
//   4. tools/call edit_drive_file_content -> rewrite content
//   5. read the file back (Drive API) -> MUST equal the new content
//   6. trash the temp file                                    [cleanup]
//
// All creds are read from Secret Manager by the workflow and passed as masked env;
// this script logs no secret. Node 20+ built-ins only.

const GATEWAY_URL = required('GATEWAY_URL').replace(/\/+$/, '');
const ADMIN_SECRET = required('ADMIN_SECRET');
const REFRESH_TOKEN = required('GMAIL_OAUTH_REFRESH_TOKEN');
const CLIENT_ID = required('GMAIL_OAUTH_CLIENT_ID');
const CLIENT_SECRET = required('GMAIL_OAUTH_CLIENT_SECRET');
const SYSTEM = (process.env.SMOKE_SYSTEM || 'or-edri-4').trim();
const TOOL = 'edit_drive_file_content';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

function required(name) {
  const v = process.env[name];
  if (!v) { console.error(`FATAL: env ${name} is absent`); process.exit(1); }
  return v.trim();
}

async function mintSharedToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' }).toString(),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`shared token mint failed: ${r.status}`);
  return j.access_token;
}

async function createMd(token, name, content) {
  const boundary = 'smoke-' + Math.random().toString(36).slice(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: 'text/markdown' })}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n--${boundary}--\r\n`),
  ]);
  const r = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const j = await r.json();
  if (!r.ok || !j.id) throw new Error(`create fixture failed: ${r.status}`);
  return j.id;
}

async function readMd(token, fileId) {
  const r = await fetch(`${DRIVE}/files/${fileId}?alt=media`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`read-back failed: ${r.status}`);
  return r.text();
}

async function trash(token, fileId) {
  await fetch(`${DRIVE}/files/${fileId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  }).catch(() => {});
}

async function mintWorkspaceBearer() {
  const r = await fetch(`${GATEWAY_URL}/workspace/${SYSTEM}/token`, {
    method: 'POST',
    headers: { 'x-admin-secret': ADMIN_SECRET },
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`workspace bearer mint failed: ${r.status}`);
  return j.access_token;
}

// Extract the JSON-RPC message from a gateway MCP response (JSON or SSE framed).
function extractMcp(contentType, text) {
  if (contentType.includes('text/event-stream')) {
    const data = text.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
    try { return JSON.parse(data); } catch { return null; }
  }
  try { return JSON.parse(text.trim()); } catch { return null; }
}

async function mcp(bearer, sessionId, payload) {
  const headers = {
    authorization: `Bearer ${bearer}`,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const r = await fetch(`${GATEWAY_URL}/workspace/${SYSTEM}/mcp`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const sid = r.headers.get('mcp-session-id');
  const text = await r.text();
  return { status: r.status, sid, msg: extractMcp(r.headers.get('content-type') || '', text), raw: text };
}

async function main() {
  console.log(`=== edit_drive_file_content live smoke via /workspace/${SYSTEM}/mcp ===`);
  const shared = await mintSharedToken();
  const original = `# smoke fixture\n\noriginal @ ${new Date().toISOString()}\n`;
  const fileId = await createMd(shared, `drive-edit-smoke-${Date.now()}.md`, original);
  console.log(`created temp .md fileId=${fileId} ✅`);

  try {
    const bearer = await mintWorkspaceBearer();
    console.log('minted workspace-runtime bearer ✅');

    const init = await mcp(bearer, undefined, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'drive-edit-smoke', version: '1' } },
    });
    if (init.status !== 200 || !init.sid) throw new Error(`initialize failed: status=${init.status} sid=${init.sid}`);
    const sid = init.sid;
    console.log('MCP initialize ✅');
    await mcp(bearer, sid, { jsonrpc: '2.0', method: 'notifications/initialized' });

    const list = await mcp(bearer, sid, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const names = (list.msg?.result?.tools || []).map((t) => t.name);
    if (!names.includes(TOOL)) throw new Error(`tools/list does NOT contain ${TOOL} (got ${names.length} tools)`);
    console.log(`tools/list contains ${TOOL} ✅ (${names.length} tools total)`);

    const updated = `# smoke fixture\n\nUPDATED-VIA-GATEWAY @ ${new Date().toISOString()}\n`;
    const call = await mcp(bearer, sid, {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: TOOL, arguments: { file_id: fileId, content: updated } },
    });
    if (call.status !== 200 || !call.msg?.result || call.msg.result.isError) {
      throw new Error(`tools/call failed: status=${call.status} body=${call.raw.slice(0, 300)}`);
    }
    console.log(`tools/call ${TOOL} ✅`);

    const back = await readMd(shared, fileId);
    if (back !== updated) throw new Error(`read-back mismatch — content was NOT updated through the gateway`);
    console.log('Drive read-back equals the gateway-written content ✅');

    console.log('VERDICT: go — edit_drive_file_content edits non-native content live through the gateway.');
  } finally {
    await trash(shared, fileId);
  }
}

main().catch((e) => { console.error(`VERDICT: no-go — ${String(e.message || e)}`); process.exit(1); });
