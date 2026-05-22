import jwt from 'jsonwebtoken';

const SIGNING_KEY = process.env.BEARER_SIGNING_KEY;
if (!SIGNING_KEY) throw new Error('BEARER_SIGNING_KEY env var is required');

export type BearerKind = 'oauth' | 'oidc' | 'admin';

export interface BearerPayload {
  exp: number;
  iat: number;
  kind: BearerKind;
}

export function signBearer(ttlMs: number, kind: BearerKind): string {
  return jwt.sign({ kind }, SIGNING_KEY!, {
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
