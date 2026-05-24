// System resolution helper for the verifier tools. This factory never writes
// manifest files (factory/manifests/*.yml), so a system's identifiers are
// derived at call time from its GitHub repo name and its GCP_PROJECT_ID repo
// variable (see resolveSystem). Also holds the shared Check / Condition /
// VerifyResult types every verify_* tool returns.

import { getRepoVariable } from './github-client.js';

// Typed error for 404 responses. Lets callers detect "not found" via
// `instanceof` rather than substring-matching on error messages.
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface SystemManifest {
  systemName: string;
  githubRepo?: string;
  gcpProjectId?: string;
  externalResources?: {
    railway?: {
      projectId?: string;
      environmentId?: string;
      services?: { postgres?: string; n8n?: string };
      volumeId?: string;
    };
    cloudflare?: {
      zoneId?: string;
      records?: Array<{ name: string; recordId?: string; type: string }>;
    };
    mcp?: {
      endpointUrl?: string;
      railwayServiceId?: string;
    };
  };
  manifestSchemaVersion?: string;
}

// Resolve a system to the identifiers the verifier tools need, without reading
// a manifest file. githubRepo is always edri2or/<name>; gcpProjectId comes from
// the system repo's GCP_PROJECT_ID variable (= the shared backend project in
// reuse/test mode, = <name> in normal mode), set by provision-system.yml.
// Falls back to <name> if the variable is absent (normal-mode convention).
export async function resolveSystem(systemName: string): Promise<SystemManifest> {
  const githubRepo = `edri2or/${systemName}`;
  const gcpProjectId = (await getRepoVariable('edri2or', systemName, 'GCP_PROJECT_ID')) ?? systemName;
  return { systemName, githubRepo, gcpProjectId };
}

export interface Condition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  reason?: string;
  message?: string;
  lastTransitionTime: string;
}

export interface Check {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  evidence?: string;
}

export type VerifyResult = {
  system: string;
  timestamp: string;
  manifestSchemaVersion?: string;
  checks: Check[];
  conditions: Condition[];
  summary: 'all-pass' | 'degraded' | 'fail';
};

export function summarize(checks: Check[]): VerifyResult['summary'] {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'skip')) return 'degraded';
  return 'all-pass';
}

export function condition(
  type: string,
  checks: Check[],
  planeName: string,
): Condition {
  const failed = checks.filter((c) => c.status === 'fail');
  const skipped = checks.filter((c) => c.status === 'skip');
  const lastTransitionTime = new Date().toISOString();
  if (failed.length > 0) {
    return {
      type,
      status: 'False',
      reason: 'CheckFailed',
      message: `${planeName}: ${failed.length}/${checks.length} checks failed (first: ${failed[0].name} — ${failed[0].evidence ?? 'no evidence'})`,
      lastTransitionTime,
    };
  }
  if (skipped.length === checks.length) {
    return {
      type,
      status: 'Unknown',
      reason: 'AllSkipped',
      message: `${planeName}: all ${checks.length} checks skipped`,
      lastTransitionTime,
    };
  }
  return {
    type,
    status: 'True',
    reason: 'AllChecksPass',
    message: `${planeName}: ${checks.length - skipped.length}/${checks.length} checks passed${skipped.length > 0 ? ` (${skipped.length} skipped)` : ''}`,
    lastTransitionTime,
  };
}
