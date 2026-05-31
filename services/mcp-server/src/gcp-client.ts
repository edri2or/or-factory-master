// GCP API client for the verifier tools. Uses Application Default
// Credentials (ADC) — on Cloud Run, that is the attached runtime SA
// (`factory-actions-mcp-runtime-sa@factory-control-9piybr`). Per ADR 139,
// this is ambient — no key files, no impersonation, no refresh code.
// `google-auth-library` handles token caching + refresh transparently.

import { GoogleAuth } from 'google-auth-library';
import { NotFoundError } from './manifest-helper.js';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getToken(): Promise<string> {
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error('ADC returned no access token');
  return t.token;
}

async function gcpFetch(url: string): Promise<unknown> {
  const token = await getToken();
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 404) throw new NotFoundError(`GCP ${url}: 404`);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GCP ${url} → ${resp.status}: ${body.slice(0, 500)}`);
  }
  return resp.json();
}

// POST variant for endpoints like `cloudresourcemanager.projects.getIamPolicy`
// that require POST with an empty (or specified) JSON body.
export async function gcpFetchPost(url: string, body: unknown = {}): Promise<unknown> {
  const token = await getToken();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (resp.status === 404) throw new NotFoundError(`GCP ${url}: 404`);
  if (!resp.ok) {
    const respBody = await resp.text();
    throw new Error(`GCP ${url} → ${resp.status}: ${respBody.slice(0, 500)}`);
  }
  return resp.json();
}

// Exported for new clients that need direct GCP access (e.g. gcp-logging-client).
export { getToken as getGcpAccessToken };

// Read a secret's plaintext VALUE (latest enabled version) via the Secret
// Manager access endpoint. Used by service-API clients (e.g. the n8n Public API
// key in n8n-client). Auth: ADC + the runtime SA's secretAccessor on the
// system's secret (granted per-system by provision-system.yml). Throws
// NotFoundError when the secret/version is absent so callers can surface a
// clear "run deploy first" message rather than leaking a 404.
export async function getSecretValue(projectId: string, name: string): Promise<string> {
  const url = `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets/${encodeURIComponent(name)}/versions/latest:access`;
  const resp = (await gcpFetch(url)) as { payload?: { data?: string } };
  const b64 = resp?.payload?.data;
  if (!b64) throw new Error(`secret ${name} in ${projectId}: empty payload`);
  return Buffer.from(b64, 'base64').toString('utf8');
}

export interface GcpProject {
  projectId: string;
  name?: string;
  lifecycleState?: string;
  parent?: { type: string; id: string };
}

export async function getProject(projectId: string): Promise<GcpProject> {
  return gcpFetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`,
  ) as Promise<GcpProject>;
}

export async function listEnabledServices(projectId: string): Promise<string[]> {
  const data = (await gcpFetch(
    `https://serviceusage.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/services?filter=state:ENABLED&pageSize=200`,
  )) as { services?: Array<{ config?: { name?: string } }> };
  return (data.services ?? [])
    .map((s) => s.config?.name)
    .filter((n): n is string => typeof n === 'string');
}

export interface GcpServiceAccount {
  name: string;
  email: string;
  disabled?: boolean;
}

export async function getServiceAccount(
  projectId: string,
  saEmail: string,
): Promise<GcpServiceAccount | null> {
  try {
    return (await gcpFetch(
      `https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/serviceAccounts/${encodeURIComponent(saEmail)}`,
    )) as GcpServiceAccount;
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

export async function listSAKeys(
  projectId: string,
  saEmail: string,
): Promise<Array<{ name: string; keyType?: string }>> {
  const data = (await gcpFetch(
    `https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/serviceAccounts/${encodeURIComponent(saEmail)}/keys?keyTypes=USER_MANAGED`,
  )) as { keys?: Array<{ name: string; keyType?: string }> };
  return data.keys ?? [];
}

export async function listSecrets(projectId: string): Promise<string[]> {
  const data = (await gcpFetch(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets?pageSize=100`,
  )) as { secrets?: Array<{ name: string }> };
  return (data.secrets ?? []).map((s) => s.name.split('/').pop() ?? '');
}

export async function getEnabledSecretVersionCount(
  projectId: string,
  secretName: string,
): Promise<number> {
  const data = (await gcpFetch(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets/${encodeURIComponent(secretName)}/versions?filter=state:ENABLED`,
  )) as { versions?: Array<unknown> };
  return (data.versions ?? []).length;
}

export interface SecretMetadata {
  name: string;
  createTime: string | null;
  enabledVersionCount: number;
  labels: Record<string, string>;
}

export async function listSecretsWithMetadata(projectId: string): Promise<SecretMetadata[]> {
  const data = (await gcpFetch(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets?pageSize=200`,
  )) as { secrets?: Array<{ name: string; createTime?: string; labels?: Record<string, string> }> };
  const secrets = data.secrets ?? [];
  return Promise.all(
    secrets.map(async (s) => {
      const shortName = s.name.split('/').pop() ?? '';
      let enabledVersionCount = 0;
      try {
        enabledVersionCount = await getEnabledSecretVersionCount(projectId, shortName);
      } catch {
        // best-effort: leave at 0 on failure rather than failing the whole listing
      }
      return {
        name: shortName,
        createTime: s.createTime ?? null,
        enabledVersionCount,
        labels: s.labels ?? {},
      };
    }),
  );
}

export interface SecretExtendedMetadata extends SecretMetadata {
  expireTime: string | null;
  etag: string | null;
  rotation: {
    nextRotationTime: string | null;
    rotationPeriod: string | null;
  } | null;
  ttl: string | null;
  topicCount: number;
}

// Extended secret listing that returns rotation / expireTime / etag / topic
// metadata beyond what `listSecretsWithMetadata` surfaces. All fields are
// returned by the same `secrets.list` API call; no extra scope is needed
// over the existing `roles/secretmanager.secretAccessor` grants. Read-only.
export async function listSecretsExtendedMetadata(projectId: string): Promise<SecretExtendedMetadata[]> {
  const data = (await gcpFetch(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets?pageSize=200`,
  )) as {
    secrets?: Array<{
      name: string;
      createTime?: string;
      labels?: Record<string, string>;
      expireTime?: string;
      etag?: string;
      rotation?: { nextRotationTime?: string; rotationPeriod?: string };
      ttl?: string;
      topics?: Array<{ name: string }>;
    }>;
  };
  const secrets = data.secrets ?? [];
  return Promise.all(
    secrets.map(async (s) => {
      const shortName = s.name.split('/').pop() ?? '';
      let enabledVersionCount = 0;
      try {
        enabledVersionCount = await getEnabledSecretVersionCount(projectId, shortName);
      } catch {
        // best-effort
      }
      return {
        name: shortName,
        createTime: s.createTime ?? null,
        enabledVersionCount,
        labels: s.labels ?? {},
        expireTime: s.expireTime ?? null,
        etag: s.etag ?? null,
        rotation: s.rotation
          ? {
              nextRotationTime: s.rotation.nextRotationTime ?? null,
              rotationPeriod: s.rotation.rotationPeriod ?? null,
            }
          : null,
        ttl: s.ttl ?? null,
        topicCount: (s.topics ?? []).length,
      };
    }),
  );
}

export interface WifPool {
  name: string;
  state: string;
  disabled?: boolean;
}

export async function getWifPool(
  projectNumber: string,
  poolId: string,
): Promise<WifPool> {
  return gcpFetch(
    `https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectNumber)}/locations/global/workloadIdentityPools/${encodeURIComponent(poolId)}`,
  ) as Promise<WifPool>;
}

export async function getWifProvider(
  projectNumber: string,
  poolId: string,
  providerId: string,
): Promise<WifPool> {
  return gcpFetch(
    `https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectNumber)}/locations/global/workloadIdentityPools/${encodeURIComponent(poolId)}/providers/${encodeURIComponent(providerId)}`,
  ) as Promise<WifPool>;
}

export interface WifProviderDetails {
  name: string;
  displayName?: string;
  state: string;
  disabled?: boolean;
  attributeCondition?: string;
  attributeMapping?: Record<string, string>;
  oidc?: { issuerUri?: string; allowedAudiences?: string[] };
}

// Same endpoint as getWifProvider but typed to expose attributeCondition + mapping.
// Requires roles/iam.workloadIdentityPoolViewer on the project (ADR 161) — pre-existing
// systems created before ADR 161 return 403 PERMISSION_DENIED. Callers should treat
// that as the documented expected behavior for backfill-pending systems, not a defect.
export async function getWifProviderDetails(
  projectNumber: string,
  poolId: string,
  providerId: string,
): Promise<WifProviderDetails> {
  return gcpFetch(
    `https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectNumber)}/locations/global/workloadIdentityPools/${encodeURIComponent(poolId)}/providers/${encodeURIComponent(providerId)}`,
  ) as Promise<WifProviderDetails>;
}

export interface CloudRunService {
  name: string;
  uid?: string;
  latestReadyRevision?: string;
  latestCreatedRevision?: string;
  uri?: string;
  template?: {
    revision?: string;
    containers?: Array<{
      name?: string;
      image?: string;
      env?: Array<{ name: string; value?: string; valueSource?: unknown }>;
    }>;
    serviceAccount?: string;
  };
  traffic?: Array<{ type?: string; revision?: string; percent?: number }>;
  conditions?: Array<{ type: string; state: string; reason?: string }>;
}

// Cloud Run /v2 API exposes latest-ready-revision + image SHA + env-var names.
// /v1 was the legacy Knative shape; /v2 is the GA Cloud Run native API.
// Requires roles/run.viewer on the project (ADR 161 grants this to the runtime
// SA on factory-control-9piybr for self-introspection; per-system projects
// already have roles/viewer which includes run.services.get).
export async function getCloudRunService(
  projectId: string,
  region: string,
  serviceName: string,
): Promise<CloudRunService> {
  return gcpFetch(
    `https://run.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(region)}/services/${encodeURIComponent(serviceName)}`,
  ) as Promise<CloudRunService>;
}

export async function getProjectNumber(projectId: string): Promise<string> {
  const data = (await gcpFetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`,
  )) as { projectNumber?: string };
  if (!data.projectNumber) throw new Error(`No projectNumber for ${projectId}`);
  return data.projectNumber;
}

// === Phase 2 read-only helpers (ADR 170) ===

export interface ProjectSummary {
  projectId: string;
  name: string;
  projectNumber: string;
  lifecycleState: string;
  parent: { type?: string; id?: string } | null;
  createTime: string | null;
}

// Lists ACTIVE projects the runtime SA has resourcemanager.projects.get on.
// Returns projects across all systems the SA was granted roles/viewer on
// (factory-bootstrap step 7b grants this per system). Result depth depends
// on the SA's IAM bindings — without org-level projectViewer it returns
// only the projects the SA already touches.
export async function listAllProjects(): Promise<ProjectSummary[]> {
  const data = (await gcpFetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=200&filter=lifecycleState:ACTIVE`,
  )) as {
    projects?: Array<{
      projectId: string;
      name?: string;
      projectNumber?: string;
      lifecycleState?: string;
      parent?: { type?: string; id?: string };
      createTime?: string;
    }>;
  };
  return (data.projects ?? []).map((p) => ({
    projectId: p.projectId,
    name: p.name ?? '',
    projectNumber: p.projectNumber ?? '',
    lifecycleState: p.lifecycleState ?? 'UNKNOWN',
    parent: p.parent ?? null,
    createTime: p.createTime ?? null,
  }));
}

// === GCP project-quota status (mcp-project-quota dev) ===
//
// The org counts ACTIVE + soft-deleted (DELETE_REQUESTED) projects toward its
// project-creation quota. GCP keeps a deleted project for ~30 days before it is
// permanently purged and its quota slot frees up. This constant drives the
// estimated free-up date.
const PROJECT_DELETE_RETENTION_DAYS = 30;

export interface SoftDeletedProject {
  projectId: string;
  displayName: string;
  projectNumber: string;
  deleteTime: string | null; // when deletion was requested (v3 deleteTime)
  freeUpDate: string | null; // deleteTime + ~30d — estimated quota free-up
  daysRemaining: number | null; // whole days from now until freeUpDate (>= 0)
}

export interface ProjectQuotaStatus {
  activeCount: number;
  softDeletedCount: number;
  softDeletedProjects: SoftDeletedProject[];
  retentionDays: number;
  note: string;
}

// Pure helper (no network — exported for unit testing): given a v3 `deleteTime`
// (ISO 8601), compute the estimated quota free-up date (deleteTime + retention)
// and whole days remaining from `now`. Returns nulls for a missing/unparseable
// deleteTime; clamps a past free-up to 0 days remaining.
export function computeFreeUpDate(
  deleteTime: string | null | undefined,
  now: Date = new Date(),
): { freeUpDate: string | null; daysRemaining: number | null } {
  if (!deleteTime) return { freeUpDate: null, daysRemaining: null };
  const deleted = new Date(deleteTime);
  if (Number.isNaN(deleted.getTime())) return { freeUpDate: null, daysRemaining: null };
  const dayMs = 24 * 60 * 60 * 1000;
  const freeUp = new Date(deleted.getTime() + PROJECT_DELETE_RETENTION_DAYS * dayMs);
  const daysRemaining = Math.max(0, Math.ceil((freeUp.getTime() - now.getTime()) / dayMs));
  return { freeUpDate: freeUp.toISOString(), daysRemaining };
}

// Lists soft-deleted (DELETE_REQUESTED) projects via Cloud Resource Manager v3,
// whose `projects:search` exposes the `deleteTime` field that the v1 list lacks.
// Result depth depends on the SA's IAM (same caveat as listAllProjects).
// Paginates via nextPageToken.
export async function listSoftDeletedProjects(now: Date = new Date()): Promise<SoftDeletedProject[]> {
  const out: SoftDeletedProject[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ query: 'state:DELETE_REQUESTED', pageSize: '200' });
    if (pageToken) qs.set('pageToken', pageToken);
    const data = (await gcpFetch(
      `https://cloudresourcemanager.googleapis.com/v3/projects:search?${qs.toString()}`,
    )) as {
      projects?: Array<{
        projectId?: string;
        name?: string; // "projects/<number>"
        displayName?: string;
        deleteTime?: string;
      }>;
      nextPageToken?: string;
    };
    for (const p of data.projects ?? []) {
      const { freeUpDate, daysRemaining } = computeFreeUpDate(p.deleteTime ?? null, now);
      out.push({
        projectId: p.projectId ?? '',
        displayName: p.displayName ?? '',
        projectNumber: (p.name ?? '').replace(/^projects\//, ''),
        deleteTime: p.deleteTime ?? null,
        freeUpDate,
        daysRemaining,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// Aggregates project-quota status: ACTIVE count (v1) + soft-deleted (v3, with
// each project's estimated free-up). No new IAM — runs as the broker SA that
// list-recoverable-projects.yml already uses. The org's absolute
// project-creation cap is not exposed via API, so this reports usage + the
// free-up schedule, not the absolute ceiling.
export async function getProjectQuotaStatus(now: Date = new Date()): Promise<ProjectQuotaStatus> {
  const [active, softDeleted] = await Promise.all([listAllProjects(), listSoftDeletedProjects(now)]);
  softDeleted.sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));
  return {
    activeCount: active.length,
    softDeletedCount: softDeleted.length,
    softDeletedProjects: softDeleted,
    retentionDays: PROJECT_DELETE_RETENTION_DAYS,
    note:
      'Counts reflect only projects the broker SA can enumerate. freeUpDate is an ' +
      'estimate (deleteTime + ~30d GCP retention). The org-wide absolute ' +
      'project-creation cap is not exposed via API.',
  };
}

export interface IamBinding {
  role: string;
  members: string[];
  condition?: { title?: string; description?: string; expression?: string };
}

// Reads the IAM policy of a GCP project. Requires
// resourcemanager.projects.getIamPolicy (included in roles/viewer).
export async function getProjectIamPolicy(projectId: string): Promise<IamBinding[]> {
  const data = (await gcpFetchPost(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}:getIamPolicy`,
    {},
  )) as { bindings?: IamBinding[] };
  return data.bindings ?? [];
}

export interface WifPoolSummary {
  name: string;
  poolId: string;
  state: string;
  disabled: boolean;
  displayName: string;
}

// Lists all WIF pools in a project. Requires iam.workloadIdentityPools.list
// — included in roles/iam.workloadIdentityPoolViewer (ADR 161, per-system).
// Legacy systems created pre-ADR-161 return 403 PERMISSION_DENIED (expected).
export async function listWifPools(projectNumber: string): Promise<WifPoolSummary[]> {
  const data = (await gcpFetch(
    `https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectNumber)}/locations/global/workloadIdentityPools?pageSize=100`,
  )) as {
    workloadIdentityPools?: Array<{
      name: string;
      state?: string;
      disabled?: boolean;
      displayName?: string;
    }>;
  };
  return (data.workloadIdentityPools ?? []).map((p) => ({
    name: p.name,
    poolId: p.name.split('/').pop() ?? '',
    state: p.state ?? 'UNKNOWN',
    disabled: p.disabled ?? false,
    displayName: p.displayName ?? '',
  }));
}

export interface WifProviderSummary {
  name: string;
  providerId: string;
  state: string;
  disabled: boolean;
  displayName: string;
  oidcIssuerUri: string | null;
}

export async function listWifProviders(
  projectNumber: string,
  poolId: string,
): Promise<WifProviderSummary[]> {
  const data = (await gcpFetch(
    `https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectNumber)}/locations/global/workloadIdentityPools/${encodeURIComponent(poolId)}/providers?pageSize=100`,
  )) as {
    workloadIdentityPoolProviders?: Array<{
      name: string;
      state?: string;
      disabled?: boolean;
      displayName?: string;
      oidc?: { issuerUri?: string };
    }>;
  };
  return (data.workloadIdentityPoolProviders ?? []).map((p) => ({
    name: p.name,
    providerId: p.name.split('/').pop() ?? '',
    state: p.state ?? 'UNKNOWN',
    disabled: p.disabled ?? false,
    displayName: p.displayName ?? '',
    oidcIssuerUri: p.oidc?.issuerUri ?? null,
  }));
}

export interface ArtifactRegistryRepo {
  name: string;
  format: string;
  mode: string;
  createTime: string | null;
  updateTime: string | null;
  sizeBytes: string | null;
}

export async function listArtifactRegistryRepos(
  project: string,
  region: string,
): Promise<ArtifactRegistryRepo[]> {
  const data = (await gcpFetch(
    `https://artifactregistry.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}/repositories?pageSize=100`,
  )) as {
    repositories?: Array<{
      name: string;
      format?: string;
      mode?: string;
      createTime?: string;
      updateTime?: string;
      sizeBytes?: string;
    }>;
  };
  return (data.repositories ?? []).map((r) => ({
    name: r.name,
    format: r.format ?? 'UNKNOWN',
    mode: r.mode ?? 'STANDARD_REPOSITORY',
    createTime: r.createTime ?? null,
    updateTime: r.updateTime ?? null,
    sizeBytes: r.sizeBytes ?? null,
  }));
}

export interface ArtifactRegistryDockerImage {
  name: string;
  imageSizeBytes: string;
  uploadTime: string | null;
  mediaType: string | null;
  tags: string[];
  buildTime: string | null;
}

export async function listArtifactRegistryDockerImages(
  project: string,
  region: string,
  repoName: string,
  pageSize = 50,
): Promise<ArtifactRegistryDockerImage[]> {
  const data = (await gcpFetch(
    `https://artifactregistry.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}/repositories/${encodeURIComponent(repoName)}/dockerImages?pageSize=${pageSize}`,
  )) as {
    dockerImages?: Array<{
      name: string;
      imageSizeBytes?: string;
      uploadTime?: string;
      mediaType?: string;
      tags?: string[];
      buildTime?: string;
    }>;
  };
  return (data.dockerImages ?? []).map((i) => ({
    name: i.name,
    imageSizeBytes: i.imageSizeBytes ?? '0',
    uploadTime: i.uploadTime ?? null,
    mediaType: i.mediaType ?? null,
    tags: i.tags ?? [],
    buildTime: i.buildTime ?? null,
  }));
}

export interface CloudBuildSummary {
  id: string;
  status: string;
  createTime: string | null;
  startTime: string | null;
  finishTime: string | null;
  logUrl: string | null;
  sourceRepoUrl: string | null;
  tags: string[];
}

export async function listCloudBuilds(
  project: string,
  pageSize = 20,
): Promise<CloudBuildSummary[]> {
  const data = (await gcpFetch(
    `https://cloudbuild.googleapis.com/v1/projects/${encodeURIComponent(project)}/builds?pageSize=${pageSize}`,
  )) as {
    builds?: Array<{
      id: string;
      status?: string;
      createTime?: string;
      startTime?: string;
      finishTime?: string;
      logUrl?: string;
      source?: { repoSource?: { repoName?: string } };
      tags?: string[];
    }>;
  };
  return (data.builds ?? []).map((b) => ({
    id: b.id,
    status: b.status ?? 'UNKNOWN',
    createTime: b.createTime ?? null,
    startTime: b.startTime ?? null,
    finishTime: b.finishTime ?? null,
    logUrl: b.logUrl ?? null,
    sourceRepoUrl: b.source?.repoSource?.repoName ?? null,
    tags: b.tags ?? [],
  }));
}
