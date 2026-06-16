// Capability probe (Phase 1 of docs/capability-first.md) — PROVE, outside n8n and
// outside the gateway/sidecar, that the raw Google Drive capability we want exists:
// editing the *content* of a NON-NATIVE Drive file (.md / .txt / binary) via
// Drive API files.update with a media upload. This is the exact path the
// workspace-mcp sidecar's update_drive_file refuses (ValueError on non-native MIME),
// so the spike calls the Drive REST API directly with the shared Google token.
//
// No SDK, no deps — Node 20+ built-in fetch only. Reads no secrets itself: the
// runner step (drive-content-edit-probe.yml) reads them from Secret Manager via WIF
// and passes them masked as env. This script never logs a secret.
//
// Inputs (env): GMAIL_OAUTH_REFRESH_TOKEN, GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET
// Verdict: prints "VERDICT: go" + exit 0 on success; "VERDICT: no-go" + exit 1 on any failure.

const REFRESH_TOKEN = required('GMAIL_OAUTH_REFRESH_TOKEN');
const CLIENT_ID = required('GMAIL_OAUTH_CLIENT_ID');
const CLIENT_SECRET = required('GMAIL_OAUTH_CLIENT_SECRET');

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`FATAL: env ${name} is absent`);
    process.exit(1);
  }
  return v.trim();
}

// A real fixture, committed under tests/fixtures/drive-content-edit/ for repeatability.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_MD = readFileSync(join(HERE, '..', 'tests', 'fixtures', 'drive-content-edit', 'sample.md'), 'utf8');

// A 1x1 transparent PNG (binary fixture, generated inline to avoid committing a blob).
const PNG_A = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);
// A different 1x1 PNG (red pixel) — the "updated" binary content.
const PNG_B = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function mintAccessToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error(`token mint failed: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  }
  return j.access_token;
}

// Create a file with arbitrary content via multipart upload; returns its id.
async function createFile(token, name, mimeType, content) {
  const boundary = 'probe-' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, mimeType });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const r = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const j = await r.json();
  if (!r.ok || !j.id) throw new Error(`create failed: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.id;
}

// THE CAPABILITY UNDER TEST: replace a file's content via files.update + media upload.
async function updateContent(token, fileId, mimeType, content) {
  const r = await fetch(`${UPLOAD}/files/${fileId}?uploadType=media&fields=id`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': mimeType },
    body: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
  });
  const j = await r.json();
  if (!r.ok || !j.id) throw new Error(`update failed: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
}

async function readContent(token, fileId) {
  const r = await fetch(`${DRIVE}/files/${fileId}?alt=media`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`read failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function trash(token, fileId) {
  await fetch(`${DRIVE}/files/${fileId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

async function proveCase(token, label, mimeType, original, updated, equals) {
  let fileId;
  try {
    fileId = await createFile(token, `drive-content-edit-probe-${Date.now()}-${label}`, mimeType, original);
    await updateContent(token, fileId, mimeType, updated);
    const got = await readContent(token, fileId);
    const ok = equals(got);
    console.log(`  [${label}] mimeType=${mimeType} fileId=${fileId} content changed: ${ok ? 'YES ✅' : 'NO ❌'}`);
    if (!ok) throw new Error(`${label}: read-back did not match the updated content`);
  } finally {
    if (fileId) await trash(token, fileId).catch(() => {});
  }
}

async function main() {
  console.log('=== Drive non-native content-edit capability probe ===');
  const token = await mintAccessToken();
  console.log('minted a short-lived access token from the shared refresh token ✅');

  const updatedMd = FIXTURE_MD + `\n\nUPDATED-BY-PROBE @ ${new Date().toISOString()}\n`;
  await proveCase(
    token, 'markdown', 'text/markdown', FIXTURE_MD, updatedMd,
    (got) => got.toString('utf8') === updatedMd,
  );

  await proveCase(
    token, 'binary-png', 'image/png', PNG_A, PNG_B,
    (got) => Buffer.compare(got, PNG_B) === 0,
  );

  console.log('VERDICT: go — files.update(media) edits non-native content (text + binary) with the shared token.');
}

main().catch((e) => {
  console.error(`VERDICT: no-go — ${String(e.message || e)}`);
  process.exit(1);
});
