// Railway GraphQL client for verifier tools. Bearer from RAILWAY_API_TOKEN
// (mounted as a Cloud Run secret from GCP SM `railway-api-token`).
// Read-only: never mutates.

import { NotFoundError } from './manifest-helper.js';

const RAILWAY_GQL = 'https://backboard.railway.com/graphql/v2';
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;

async function gql(query: string, variables: Record<string, unknown>): Promise<unknown> {
  if (!RAILWAY_TOKEN) throw new Error('RAILWAY_API_TOKEN not set');
  const resp = await fetch(RAILWAY_GQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RAILWAY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Railway GraphQL ${resp.status}: ${body.slice(0, 500)}`);
  }
  const data = (await resp.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (data.errors && data.errors.length > 0) {
    const msg = data.errors.map((e) => e.message).join('; ');
    if (/not found|does not exist/i.test(msg)) throw new NotFoundError(`Railway: ${msg}`);
    throw new Error(`Railway GraphQL errors: ${msg}`);
  }
  return data.data;
}

export interface RailwayProject {
  id: string;
  name: string;
  environments: { edges: Array<{ node: { id: string; name: string } }> };
  services: { edges: Array<{ node: { id: string; name: string } }> };
}

export interface RailwayProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  workspaceName: string;
}

// Lists every Railway project the API token can reach across all workspaces
// (personal + team) the token is a member of. Railway projects are owned by a
// workspace, not by `me` directly — `me { projects }` returns only personal
// projects, which on a team-token account is empty. The right path is
// `me.workspaces[].projects.edges`. Same shape used by deploy-org-reader-mcp.yml
// (line 91). Read-only.
export async function listProjects(): Promise<RailwayProjectSummary[]> {
  const d = (await gql(
    `query{
      me{
        workspaces{
          id
          name
          projects{
            edges{node{id name createdAt updatedAt}}
          }
        }
      }
    }`,
    {},
  )) as {
    me: {
      workspaces: Array<{
        id: string;
        name: string;
        projects?: { edges: Array<{ node: { id: string; name: string; createdAt: string; updatedAt: string } }> };
      }>;
    };
  } | null;
  const workspaces = d?.me?.workspaces ?? [];
  const out: RailwayProjectSummary[] = [];
  for (const ws of workspaces) {
    for (const edge of ws.projects?.edges ?? []) {
      out.push({
        ...edge.node,
        workspaceId: ws.id,
        workspaceName: ws.name,
      });
    }
  }
  return out;
}

export async function getProject(projectId: string): Promise<RailwayProject | null> {
  try {
    const d = (await gql(
      `query($pid:String!){
        project(id:$pid){
          id name
          environments{edges{node{id name}}}
          services{edges{node{id name}}}
        }
      }`,
      { pid: projectId },
    )) as { project: RailwayProject | null };
    return d.project ?? null;
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

export interface RailwayDeployment {
  id: string;
  status: string;
  createdAt: string;
}

export async function getServiceLatestDeployment(
  projectId: string,
  environmentId: string,
  serviceId: string,
): Promise<RailwayDeployment | null> {
  const d = (await gql(
    `query($pid:String!,$eid:String!,$sid:String!){
      deployments(input:{projectId:$pid,environmentId:$eid,serviceId:$sid},first:1){
        edges{node{id status createdAt}}
      }
    }`,
    { pid: projectId, eid: environmentId, sid: serviceId },
  )) as { deployments: { edges: Array<{ node: RailwayDeployment }> } };
  return d.deployments.edges[0]?.node ?? null;
}

export interface RailwayLog {
  timestamp: string;
  severity: string;
  message: string;
}

// Fetch deployment logs (stdout/stderr) from Railway for a given deployment ID.
// Read-only; Railway redacts secret values in log output. Caller should
// resolve the latest deployment via `getServiceLatestDeployment` first.
export async function getDeploymentLogs(
  deploymentId: string,
  limit: number,
): Promise<RailwayLog[]> {
  const d = (await gql(
    `query($id:String!,$limit:Int!){
      deploymentLogs(deploymentId:$id,limit:$limit){
        timestamp
        severity
        message
      }
    }`,
    { id: deploymentId, limit },
  )) as { deploymentLogs: RailwayLog[] | null };
  return d.deploymentLogs ?? [];
}

// Fetch build-phase logs (nixpacks / Dockerfile build output) for a given
// deployment ID. Distinct from getDeploymentLogs (runtime stdout/stderr).
// Read-only; Railway redacts secret values in build output.
export async function getBuildLogs(
  deploymentId: string,
  limit: number,
): Promise<RailwayLog[]> {
  const d = (await gql(
    `query($id:String!,$limit:Int!){
      buildLogs(deploymentId:$id,limit:$limit){
        timestamp
        severity
        message
      }
    }`,
    { id: deploymentId, limit },
  )) as { buildLogs: RailwayLog[] | null };
  return d.buildLogs ?? [];
}

export interface RailwayDnsRecord {
  hostlabel: string;
  recordType: string;
  requiredValue: string;
}

export interface RailwayCustomDomain {
  id: string;
  domain: string;
  status: {
    verified: boolean | null;
    verificationDnsHost: string | null;
    verificationToken: string | null;
    certificateStatusDetailed: string | null;
    certificateErrorMessage: string | null;
    dnsRecords: RailwayDnsRecord[];
  };
}

export interface RailwayServiceInstance {
  serviceId: string;
  latestDeployment: RailwayDeployment | null;
  serviceDomains: Array<{ domain: string }>;
  customDomains: RailwayCustomDomain[];
  // Back-compat: existing callers read `.domains` as the flat Railway-assigned
  // list. Keep that field populated from serviceDomains so inspect_railway_service
  // consumers don't break, while exposing the new richer fields too.
  domains: Array<{ domain: string }>;
}

// Fetch a serviceInstance with: deploy status, service domains
// (Railway-assigned), AND custom domains with full verification + cert state.
// Used by inspect_railway_service / inspect_railway_service_full.
//
// The customDomains selection mirrors the working GraphQL the deploy template
// uses (templates/system/.github/workflows/deploy-railway-cloudflare.yml:469-470)
// — verified, verificationDnsHost, verificationToken, certificateStatusDetailed,
// certificateErrorMessage, dnsRecords{hostlabel,recordType,requiredValue}.
// Returning these is what lets the agent diagnose "Host not in allowlist" 403s
// without an operator dashboard look-up.
export async function getServiceInstance(
  projectId: string,
  environmentId: string,
  serviceId: string,
): Promise<RailwayServiceInstance | null> {
  try {
    // Railway schema-drift log (observed empirically, errors from the wire):
    // 2026-05-19 dropped `projectId` argument from Query.serviceInstance;
    // 2026-05-20 dropped `serviceVariables` field from ServiceInstance
    // (env-var names recoverable via the variables(...) query — see listServiceVariables).
    // `pid` stays in the function signature for caller symmetry.
    const d = (await gql(
      `query($eid:String!,$sid:String!){
        serviceInstance(environmentId:$eid,serviceId:$sid){
          latestDeployment{id status createdAt}
          domains{
            serviceDomains{domain}
            customDomains{
              id domain
              status{
                verified
                verificationDnsHost
                verificationToken
                certificateStatusDetailed
                certificateErrorMessage
                dnsRecords{hostlabel recordType requiredValue}
              }
            }
          }
        }
      }`,
      { eid: environmentId, sid: serviceId },
    )) as {
      serviceInstance: {
        latestDeployment: RailwayDeployment | null;
        domains: {
          serviceDomains: Array<{ domain: string }>;
          customDomains: RailwayCustomDomain[];
        };
      } | null;
    };
    const si = d.serviceInstance;
    if (!si) return null;
    const serviceDomains = si.domains.serviceDomains ?? [];
    const customDomains = si.domains.customDomains ?? [];
    return {
      serviceId,
      latestDeployment: si.latestDeployment,
      serviceDomains,
      customDomains,
      domains: serviceDomains,
    };
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

// ---------- Additions for full read visibility ----------

export interface RailwayVariableSummary {
  name: string;
  // Values are redacted by default to avoid leaking secrets through the MCP.
  // Callers can opt into revealed values via `revealValues=true` (which the
  // tool surface gates behind admin auth).
  value: string;
}

// List env-var names (and optionally values) on a service instance.
// Railway's `variables(...)` query returns a flat map; we project to an array
// of {name, value}. Values are redacted as "***" unless reveal=true.
export async function listServiceVariables(
  projectId: string,
  environmentId: string,
  serviceId: string,
  reveal: boolean = false,
): Promise<RailwayVariableSummary[]> {
  const d = (await gql(
    `query($pid:String!,$eid:String!,$sid:String!){
      variables(projectId:$pid,environmentId:$eid,serviceId:$sid)
    }`,
    { pid: projectId, eid: environmentId, sid: serviceId },
  )) as { variables: Record<string, string> | null };
  const map = d.variables ?? {};
  return Object.keys(map)
    .sort()
    .map((name) => ({ name, value: reveal ? map[name] : '***' }));
}

export interface RailwayVolume {
  id: string;
  name: string;
  // Railway returns volume size in bytes when set; null while unattached.
  // mountPath is on the volumeInstance (per-environment binding).
  mountPath: string | null;
  sizeMB: number | null;
}

// List volumes in a project (project-scoped, not service-scoped — Railway's
// schema puts volumes at the project level with per-service-instance mounts).
export async function listVolumes(projectId: string): Promise<RailwayVolume[]> {
  try {
    const d = (await gql(
      `query($pid:String!){
        project(id:$pid){
          volumes{
            edges{
              node{
                id name
                volumeInstances{
                  edges{node{mountPath sizeMB}}
                }
              }
            }
          }
        }
      }`,
      { pid: projectId },
    )) as {
      project: {
        volumes: {
          edges: Array<{
            node: {
              id: string;
              name: string;
              volumeInstances: {
                edges: Array<{ node: { mountPath: string | null; sizeMB: number | null } }>;
              };
            };
          }>;
        };
      } | null;
    };
    const edges = d.project?.volumes?.edges ?? [];
    return edges.map((e) => {
      const first = e.node.volumeInstances.edges[0]?.node;
      return {
        id: e.node.id,
        name: e.node.name,
        mountPath: first?.mountPath ?? null,
        sizeMB: first?.sizeMB ?? null,
      };
    });
  } catch (e) {
    if (e instanceof NotFoundError) return [];
    throw e;
  }
}

// List recent deployments for a service (history, not just latest).
export async function listDeployments(
  projectId: string,
  environmentId: string,
  serviceId: string,
  limit: number = 10,
): Promise<RailwayDeployment[]> {
  const d = (await gql(
    `query($pid:String!,$eid:String!,$sid:String!,$first:Int!){
      deployments(input:{projectId:$pid,environmentId:$eid,serviceId:$sid},first:$first){
        edges{node{id status createdAt}}
      }
    }`,
    { pid: projectId, eid: environmentId, sid: serviceId, first: limit },
  )) as { deployments: { edges: Array<{ node: RailwayDeployment }> } };
  return d.deployments.edges.map((e) => e.node);
}

// Raw read-only GraphQL passthrough. Forward-compatible escape hatch — any
// future Railway schema addition is reachable without an MCP redeploy.
// Server-side guard: reject any payload containing a `mutation` operation.
// The regex is conservative (strips comments + string-literal punctuation
// noise before matching) — see rejection contract in the tool's description.
export async function rawGraphqlRead(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<unknown> {
  const stripped = query
    // strip line comments
    .replace(/#[^\n]*/g, '')
    // strip block strings + regular strings so the word `mutation` inside a
    // string literal doesn't trip the guard
    .replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"/g, '""')
    .trim();
  // Match any operation that opens with `mutation` (anonymous or named) at
  // the start of the document or after whitespace/braces.
  if (/(^|[^A-Za-z0-9_])mutation([^A-Za-z0-9_]|$)/.test(stripped)) {
    throw new Error('railway_graphql_read: mutations are not allowed (read-only tool)');
  }
  return await gql(query, variables);
}
