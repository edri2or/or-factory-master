import jwksClient from 'jwks-rsa';
import jwt, { type GetPublicKeyOrSecret } from 'jsonwebtoken';

const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const AUDIENCE = process.env.OIDC_AUDIENCE ?? 'mcp.factory.edri2or';

const ALLOWED_REPOS = new Set(['edri2or/factory']);
const ALLOWED_WORKFLOW_REFS = new Set([
  'edri2or/factory/.github/workflows/factory-verify-system.yml@refs/heads/main',
  'edri2or/factory/.github/workflows/factory-autoremediate.yml@refs/heads/main',
  'edri2or/factory/.github/workflows/fetch-org-reader-mcp-logs.yml@refs/heads/main',
  'edri2or/factory/.github/workflows/fetch-mcp-logs.yml@refs/heads/main',
]);

const client = jwksClient({
  jwksUri: `${GITHUB_OIDC_ISSUER}/.well-known/jwks`,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000,
  rateLimit: true,
});

const getKey: GetPublicKeyOrSecret = (header, cb) => {
  if (!header.kid) { cb(new Error('missing kid')); return; }
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) { cb(err ?? new Error('no signing key')); return; }
    cb(null, key.getPublicKey());
  });
};

export interface OidcClaims {
  repository: string;
  workflow_ref: string;
  ref: string;
  event_name: string;
  actor: string;
  run_id: string;
}

export async function verifyGitHubOidc(token: string): Promise<OidcClaims> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      issuer: GITHUB_OIDC_ISSUER,
      audience: AUDIENCE,
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err || typeof decoded !== 'object' || decoded === null) {
        reject(new Error(`oidc_verify_failed: ${err?.message ?? 'invalid'}`));
        return;
      }
      const claims = decoded as Record<string, unknown>;
      const repo = String(claims['repository'] ?? '');
      const wfRef = String(claims['job_workflow_ref'] ?? claims['workflow_ref'] ?? '');
      if (!ALLOWED_REPOS.has(repo)) { reject(new Error(`repo_not_allowed: ${repo}`)); return; }
      if (!ALLOWED_WORKFLOW_REFS.has(wfRef)) { reject(new Error(`workflow_not_allowed: ${wfRef}`)); return; }
      resolve({
        repository: repo,
        workflow_ref: wfRef,
        ref: String(claims['ref'] ?? ''),
        event_name: String(claims['event_name'] ?? ''),
        actor: String(claims['actor'] ?? ''),
        run_id: String(claims['run_id'] ?? ''),
      });
    });
  });
}
