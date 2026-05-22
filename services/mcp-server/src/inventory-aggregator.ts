// Cross-cloud inventory aggregator for the list_all_systems_inventory tool.
// Pulls GCP projects + Railway projects + Cloudflare zones in parallel,
// scans factory/manifests/*.yml for the factory-known systems, then
// joins everything into a single inventory table.
//
// Each cloud resource is tagged inFactory: true if a manifest exists for
// the corresponding system, false if the resource is reachable but not
// registered with the factory.

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

import { listAllProjects, type ProjectSummary } from './gcp-client.js';
import { listProjects as railwayListProjects, type RailwayProjectSummary } from './railway-client.js';
import { listZones, CfZonesTokenError, type CfZone } from './cloudflare-client.js';

const MANIFESTS_DIR = 'factory/manifests';

interface ManifestSummary {
  systemName: string;
  gcpProjectId: string | null;
  railwayProjectId: string | null;
  cloudflareZoneId: string | null;
}

async function loadManifestsSummary(): Promise<ManifestSummary[]> {
  const out: ManifestSummary[] = [];
  let files: string[];
  try {
    files = await fs.readdir(MANIFESTS_DIR);
  } catch {
    return out;
  }
  for (const f of files) {
    if (!f.endsWith('.yml') && !f.endsWith('.yaml')) continue;
    try {
      const raw = await fs.readFile(path.join(MANIFESTS_DIR, f), 'utf8');
      const m = yaml.load(raw) as {
        systemName?: string;
        gcpProjectId?: string;
        externalResources?: {
          railway?: { projectId?: string };
          cloudflare?: { zoneId?: string };
        };
      };
      out.push({
        systemName: m.systemName ?? f.replace(/\.(yml|yaml)$/, ''),
        gcpProjectId: m.gcpProjectId ?? null,
        railwayProjectId: m.externalResources?.railway?.projectId ?? null,
        cloudflareZoneId: m.externalResources?.cloudflare?.zoneId ?? null,
      });
    } catch {
      // skip malformed manifests rather than fail the whole inventory
    }
  }
  return out;
}

export interface InventoryRow<T> {
  resource: T;
  inFactory: boolean;
  systemName: string | null;
}

export interface Inventory {
  timestamp: string;
  gcp: {
    projectCount: number;
    projects: Array<InventoryRow<ProjectSummary>>;
  };
  railway: {
    projectCount: number;
    projects: Array<InventoryRow<RailwayProjectSummary>>;
  };
  cloudflare: {
    zoneCount: number;
    zones: Array<InventoryRow<CfZone>>;
    error: string | null;
  };
  manifests: {
    count: number;
    orphaned: ManifestSummary[];
  };
}

// Returns null-safe cloudflare error when the zones-read token is not
// configured yet; aggregator should not crash because of that.
async function safeListZones(): Promise<{ zones: CfZone[]; error: string | null }> {
  try {
    const zones = await listZones();
    return { zones, error: null };
  } catch (e) {
    if (e instanceof CfZonesTokenError) {
      return { zones: [], error: e.message };
    }
    return { zones: [], error: String(e).slice(0, 300) };
  }
}

export async function buildInventory(): Promise<Inventory> {
  const [gcpProjects, railwayProjects, cfResult, manifests] = await Promise.all([
    listAllProjects().catch((e) => {
      throw new Error(`list_all_projects failed: ${String(e).slice(0, 200)}`);
    }),
    railwayListProjects().catch(() => [] as RailwayProjectSummary[]),
    safeListZones(),
    loadManifestsSummary(),
  ]);

  const gcpToSystem = new Map<string, string>();
  const railwayToSystem = new Map<string, string>();
  const cfZoneToSystem = new Map<string, string>();
  for (const m of manifests) {
    if (m.gcpProjectId) gcpToSystem.set(m.gcpProjectId, m.systemName);
    if (m.railwayProjectId) railwayToSystem.set(m.railwayProjectId, m.systemName);
    if (m.cloudflareZoneId) cfZoneToSystem.set(m.cloudflareZoneId, m.systemName);
  }

  const seenGcp = new Set<string>();
  const gcpRows: Array<InventoryRow<ProjectSummary>> = gcpProjects.map((p) => {
    const sys = gcpToSystem.get(p.projectId) ?? null;
    if (sys) seenGcp.add(p.projectId);
    return { resource: p, inFactory: sys !== null, systemName: sys };
  });

  const seenRailway = new Set<string>();
  const railwayRows: Array<InventoryRow<RailwayProjectSummary>> = railwayProjects.map((p) => {
    const sys = railwayToSystem.get(p.id) ?? null;
    if (sys) seenRailway.add(p.id);
    return { resource: p, inFactory: sys !== null, systemName: sys };
  });

  const seenCf = new Set<string>();
  const cfRows: Array<InventoryRow<CfZone>> = cfResult.zones.map((z) => {
    const sys = cfZoneToSystem.get(z.id) ?? null;
    if (sys) seenCf.add(z.id);
    return { resource: z, inFactory: sys !== null, systemName: sys };
  });

  // Manifests that reference a cloud resource the SA cannot see — likely
  // decommissioned externally, or grant gap. Reported to help reconcile.
  const orphaned: ManifestSummary[] = manifests.filter((m) => {
    const gcpOrphan = m.gcpProjectId !== null && !seenGcp.has(m.gcpProjectId);
    const railwayOrphan = m.railwayProjectId !== null && !seenRailway.has(m.railwayProjectId);
    const cfOrphan = m.cloudflareZoneId !== null && !seenCf.has(m.cloudflareZoneId);
    return gcpOrphan || railwayOrphan || cfOrphan;
  });

  return {
    timestamp: new Date().toISOString(),
    gcp: { projectCount: gcpProjects.length, projects: gcpRows },
    railway: { projectCount: railwayProjects.length, projects: railwayRows },
    cloudflare: { zoneCount: cfResult.zones.length, zones: cfRows, error: cfResult.error },
    manifests: { count: manifests.length, orphaned },
  };
}
