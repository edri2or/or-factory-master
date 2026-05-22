// Manifest helper. Loads a system manifest from edri2or/factory main
// (via the existing GitHub App token) and extracts identifiers needed
// by the verifier tools.

import yaml from 'js-yaml';
import { getRepoFile } from './github-client.js';

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

export async function loadManifest(systemName: string): Promise<SystemManifest> {
  const text = await getRepoFile(`factory/manifests/${systemName}.yml`);
  const doc = yaml.load(text) as SystemManifest;
  if (!doc || typeof doc !== 'object' || !doc.systemName) {
    throw new Error(`Invalid manifest for ${systemName}`);
  }
  return doc;
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
