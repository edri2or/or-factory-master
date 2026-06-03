import jwt from 'jsonwebtoken';

const SIGNING_KEY = process.env.BEARER_SIGNING_KEY;
if (!SIGNING_KEY) throw new Error('BEARER_SIGNING_KEY env var is required');

export type BearerKind = 'oauth' | 'oidc' | 'admin' | 'n8n-dev';

export interface BearerPayload {
  exp: number;
  iat: number;
  kind: BearerKind;
  // Present only on system-scoped tokens (kind 'n8n-dev'): the single system
  // this bearer may drive live n8n writes against. The /n8n/<system>/mcp
  // handler asserts payload.system === <system-from-path> and 403s on mismatch,
  // so a token minted for one system can never reach another's n8n.
  system?: string;
}

// `extra` carries optional claims — currently only `system`, bound into
// 'n8n-dev' bearers so cross-tenant access is a hard 403, not a convention.
export function signBearer(
  ttlMs: number,
  kind: BearerKind,
  extra?: { system?: string },
): string {
  const claims: Record<string, unknown> = { kind };
  if (extra?.system) claims.system = extra.system;
  return jwt.sign(claims, SIGNING_KEY!, {
    algorithm: 'HS256',
    expiresIn: Math.floor(ttlMs / 1000),
  });
}

// In-memory revocation set — best-effort, wiped on restart. Acceptable:
// factory-verify-system.yml calls /logout within seconds of issuance, so
// persistence is not needed; long-lived oauth bearers (30d) fall back to TTL.
const revoked = new Set<string>();

setInterval(() => {
  const nowSec = Date.now() / 1000;
  for (const tok of revoked) {
    const decoded = jwt.decode(tok) as { exp?: number } | null;
    if (!decoded?.exp || nowSec > decoded.exp) revoked.delete(tok);
  }
}, 60_000).unref();

export function verifyBearer(token: string): BearerPayload | null {
  if (revoked.has(token)) return null;
  try {
    return jwt.verify(token, SIGNING_KEY!, { algorithms: ['HS256'] }) as BearerPayload;
  } catch {
    return null;
  }
}

export function revokeBearer(token: string): void {
  revoked.add(token);
}
