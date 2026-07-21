// Drive non-native content edit — the one capability the bundled workspace-mcp
// `update_drive_file` tool refuses.
//
// The package's `update_drive_file` rewrites file CONTENT only for Google-native
// MIME types (Docs / Sheets / Slides); a `.md` / `.txt` / binary file is rejected
// with a ValueError. The raw Drive API `files.update` with a media upload has no
// such limit (proven live — capability probe drive-content-edit, 2026-06-16:
// `.md` + binary read-back matched). Rather than fork the Python package, the
// gateway exposes ONE synthetic MCP tool, `edit_drive_file_content`, as a facade
// over the existing `/workspace/<system>/mcp` route: tools/list gains the tool,
// and a tools/call to it is handled here — everything else still passes through
// to the sidecar untouched.
//
// Identity + safety: the edit runs as the SHARED Google account (the same
// gmail-oauth-* token the sidecar uses), minted here from the refresh token read
// server-side from Secret Manager — never from the client, never logged. The
// route's existing gate is unchanged (operator `oauth` bearer = Or via
// OAUTH_ALLOWED_EMAILS, or a system-scoped workspace-runtime bearer + HITL inside
// a system). This adds a new write VERB under that same gate, no new surface.
// A MIME guard refuses Google-native files so a Doc/Sheet/Slide can never be
// clobbered through this path (those keep going through update_drive_file).

import { getSecretValue } from './gcp-client.js';

const CONTROL_PROJECT = process.env.CONTROL_PROJECT ?? 'or-factory-master-control';
const REFRESH_TOKEN_SECRET = 'gmail-oauth-refresh-token';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

// The synthetic MCP tool definition injected into the workspace tools/list and
// handled by this module. Shape matches the MCP `tools/list` contract (name +
// description + JSON-Schema inputSchema), so any MCP client renders it natively.
export const DRIVE_EDIT_TOOL_NAME = 'edit_drive_file_content';

export const DRIVE_EDIT_TOOL = {
  name: DRIVE_EDIT_TOOL_NAME,
  description:
    "Replace the CONTENT (body bytes) of a NON-native Google Drive file (.md / .txt / any " +
    'binary) via the Drive API files.update media path — the one thing update_drive_file ' +
    "cannot do. For Google-native Docs / Sheets / Slides use update_drive_file or the Docs/Sheets " +
    'tools instead (this tool refuses native files so they are never clobbered). Provide file_id ' +
    'and EXACTLY ONE of content (UTF-8 text) or content_base64 (binary). Optional mime_type sets ' +
    "the file's MIME type (e.g. text/markdown, image/png). Writes to the shared Google account; " +
    'operator/HITL-gated like every workspace write.',
  inputSchema: {
    type: 'object',
    properties: {
      file_id: { type: 'string', description: 'The Drive file id to overwrite.' },
      content: { type: 'string', description: 'New content as UTF-8 text (use for .md / .txt).' },
      content_base64: { type: 'string', description: 'New content as a base64 string (use for binary files).' },
      mime_type: {
        type: 'string',
        description: 'Optional MIME type to set on the file (e.g. text/markdown, image/png). Defaults to the file\'s current type.',
      },
      user_google_email: {
        type: 'string',
        description: 'Optional and ignored — the shared account is fixed server-side (parity with the other Drive tools).',
      },
    },
    required: ['file_id'],
  },
} as const;

// ── Pure helpers (no network — unit-tested) ──────────────────────────────────

// A Google-native file (Doc/Sheet/Slide/etc.) carries an application/vnd.google-apps.*
// MIME type; its bytes are not a plain blob, so a media overwrite would corrupt it.
// This is the guard that keeps native files on the update_drive_file path.
export function isGoogleNativeMime(mimeType: unknown): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('application/vnd.google-apps');
}

export interface DriveEditArgs {
  fileId: string;
  body: Buffer;
  mimeType?: string;
}

// Validates + normalises the tool arguments into the bytes to upload. Enforces
// file_id present and EXACTLY ONE of content / content_base64. Returns the parsed
// args, or an Error with a caller-facing message (never throws on bad input).
export function parseDriveEditArgs(args: Record<string, unknown>): DriveEditArgs | Error {
  const fileId = typeof args.file_id === 'string' ? args.file_id.trim() : '';
  if (!fileId) return new Error('file_id is required');

  const hasText = typeof args.content === 'string';
  const hasB64 = typeof args.content_base64 === 'string';
  if (hasText === hasB64) {
    return new Error('provide exactly one of content (UTF-8 text) or content_base64 (binary)');
  }

  let body: Buffer;
  if (hasText) {
    body = Buffer.from(args.content as string, 'utf8');
  } else {
    const raw = (args.content_base64 as string).trim();
    // Validate the base64 round-trips, so a malformed blob fails here, not at Drive.
    body = Buffer.from(raw, 'base64');
    if (body.toString('base64').replace(/=+$/, '') !== raw.replace(/\s+/g, '').replace(/=+$/, '')) {
      return new Error('content_base64 is not valid base64');
    }
  }

  const mimeType = typeof args.mime_type === 'string' && args.mime_type.trim() ? args.mime_type.trim() : undefined;
  return { fileId, body, mimeType };
}

type JsonRpc = { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown; result?: unknown };

// Returns the {id, args} of a SINGLE tools/call request for our synthetic tool,
// or null for anything else (batches, other tools, other methods) — those pass
// through to the sidecar untouched.
export function parseDriveEditCall(body: unknown): { id: unknown; args: Record<string, unknown> } | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const m = body as JsonRpc;
  if (m.method !== 'tools/call') return null;
  const params = (m.params ?? {}) as Record<string, unknown>;
  if (params.name !== DRIVE_EDIT_TOOL_NAME) return null;
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  return { id: m.id ?? null, args };
}

// True when the body is a SINGLE tools/list request (the one we augment).
export function isToolsListRequest(body: unknown): boolean {
  return Boolean(body) && typeof body === 'object' && !Array.isArray(body) && (body as JsonRpc).method === 'tools/list';
}

// Force the shared single-user label onto any Workspace tools/call so a caller
// that omits or guesses the wrong user_google_email can never derail the shared
// identity. In the sidecar's single-user mode the one credential is filed under
// "<label>.json" and looked up by the caller-supplied user_google_email; a wrong
// value misses and drops workspace-mcp into its interactive OAuth fallback (the
// dead localhost:3002 consent link). Forcing the label here — the same server-side
// injection the gateway already does for auth — makes that class of error
// impossible. Mutates `body` in place; returns true iff it was a real (non-synthetic)
// tools/call we normalized. Batches (arrays), non-tools/call methods, and the
// gateway's synthetic edit_drive_file_content tool (handled elsewhere, email
// ignored) are left untouched.
export function forceWorkspaceUserEmail(body: unknown, label: string): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const m = body as JsonRpc;
  if (m.method !== 'tools/call') return false;
  const params = (m.params ?? {}) as Record<string, unknown>;
  if (params.name === DRIVE_EDIT_TOOL_NAME) return false;
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  args.user_google_email = label;
  params.arguments = args;
  m.params = params;
  return true;
}

// Extracts the JSON-RPC message object from an upstream MCP response, whether the
// sidecar framed it as application/json or as a text/event-stream (SSE) `data:`
// payload. Returns null when nothing parseable is found (caller then falls back to
// a clean passthrough instead of corrupting the stream).
export function extractJsonRpcMessage(contentType: string, text: string): JsonRpc | null {
  const tryParse = (s: string): JsonRpc | null => {
    try {
      const o = JSON.parse(s);
      return o && typeof o === 'object' ? (o as JsonRpc) : null;
    } catch {
      return null;
    }
  };
  if (contentType.includes('text/event-stream')) {
    // Collect data: lines; an SSE message may split data across multiple lines.
    const dataLines = text
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    // Join consecutive data lines per spec, then try whole-then-each.
    const joined = dataLines.join('\n');
    return tryParse(joined) ?? dataLines.map(tryParse).find((o): o is JsonRpc => o !== null) ?? null;
  }
  return tryParse(text.trim());
}

// Appends our synthetic tool to a tools/list result (de-duped by name). Mutates
// and returns the message; a non-tools/list shape is returned unchanged.
export function injectToolIntoToolsList(msg: JsonRpc): JsonRpc {
  const result = msg.result as { tools?: Array<{ name?: string }> } | undefined;
  if (result && Array.isArray(result.tools)) {
    if (!result.tools.some((t) => t?.name === DRIVE_EDIT_TOOL_NAME)) {
      result.tools.push(DRIVE_EDIT_TOOL as unknown as { name: string });
    }
  }
  return msg;
}

// Builds an MCP tool-call JSON-RPC result envelope (single text content block).
export function buildToolResult(id: unknown, payload: unknown, isError = false): JsonRpc {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      isError,
    },
  };
}

// ── Network: token minting + Drive calls ─────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

// Mint a short-lived Google access token for the SHARED account via the
// refresh_token grant on the WORKSPACE OAuth client (the same client the sidecar
// refreshes with). The refresh token is read server-side from Secret Manager and
// never logged. Cached until shortly before expiry to avoid a mint per call.
export async function mintSharedAccessToken(now: number = Date.now()): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;

  const clientId = process.env.WORKSPACE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.WORKSPACE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret || clientId === '__NOT_CONFIGURED__' || clientSecret === '__NOT_CONFIGURED__') {
    throw new Error('workspace OAuth client is not configured');
  }
  const refreshToken = await getSecretValue(CONTROL_PROJECT, REFRESH_TOKEN_SECRET);

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const json = (await resp.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!resp.ok || !json.access_token) {
    throw new Error(`could not mint a Google access token (status ${resp.status})`);
  }
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
}

async function getFileMeta(token: string, fileId: string): Promise<DriveFileMeta> {
  const resp = await fetch(
    `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (resp.status === 404) throw new Error(`file ${fileId} not found`);
  if (!resp.ok) throw new Error(`Drive files.get failed (status ${resp.status})`);
  return (await resp.json()) as DriveFileMeta;
}

async function updateFileMedia(token: string, fileId: string, mimeType: string, body: Buffer): Promise<void> {
  // fetch's BodyInit accepts an ArrayBuffer (not a Node Buffer) — hand it the
  // exact byte range this Buffer views, so binary content round-trips intact.
  const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  const resp = await fetch(
    `${DRIVE_UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true&fields=id`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': mimeType },
      body: ab,
    },
  );
  if (!resp.ok) {
    const detail = (await resp.text().catch(() => '')).slice(0, 200);
    throw new Error(`Drive files.update failed (status ${resp.status})${detail ? `: ${detail}` : ''}`);
  }
}

export interface DriveEditResult {
  ok: true;
  file_id: string;
  name: string;
  mime_type: string;
  bytes_written: number;
}

// Orchestrates the capability: validate args → mint token → read the file's MIME
// (guard: refuse Google-native) → files.update media. Throws an Error with a
// caller-facing message on any failure; the route wraps it into a tool result.
export async function executeDriveContentEdit(args: Record<string, unknown>): Promise<DriveEditResult> {
  const parsed = parseDriveEditArgs(args);
  if (parsed instanceof Error) throw parsed;

  const token = await mintSharedAccessToken();
  const meta = await getFileMeta(token, parsed.fileId);

  if (isGoogleNativeMime(meta.mimeType)) {
    throw new Error(
      `"${meta.name}" is a Google-native file (${meta.mimeType}) — its content cannot be media-overwritten. ` +
        'Use update_drive_file or the Docs/Sheets/Slides tools for native files.',
    );
  }
  if (isGoogleNativeMime(parsed.mimeType)) {
    throw new Error('mime_type must not be a Google-native (application/vnd.google-apps.*) type');
  }

  const mimeType = parsed.mimeType ?? meta.mimeType ?? 'application/octet-stream';
  await updateFileMedia(token, parsed.fileId, mimeType, parsed.body);

  return {
    ok: true,
    file_id: parsed.fileId,
    name: meta.name,
    mime_type: mimeType,
    bytes_written: parsed.body.length,
  };
}
