// GCP Cloud Logging client for the tail_cloud_run_logs tool.
// Uses the same ADC token chain as gcp-client.ts. Read-only: only ever
// calls entries:list, never writes log entries.
//
// Required IAM: roles/logging.viewer on the target project (or roles/viewer
// which includes logging.logEntries.list). Per-system projects already have
// roles/viewer via broker.sh Step 7b; factory-control gets logging.viewer
// via the best-effort grant in bootstrap-mcp-runtime-sa.sh.

import { getGcpAccessToken } from './gcp-client.js';
import { NotFoundError } from './manifest-helper.js';

export interface LogEntry {
  timestamp: string;
  severity: string;
  textPayload: string | null;
  jsonPayload: unknown;
  resource: { type?: string; labels?: Record<string, string> } | null;
  insertId: string | null;
  logName: string | null;
}

// Tails the latest `lines` log entries for a Cloud Run service in a project.
// Filters on resource.type=cloud_run_revision + service_name label.
// Orders by timestamp desc (most recent first), then reverses for chronological
// display in the response.
export async function tailCloudRunLogs(
  project: string,
  serviceName: string,
  lines: number,
): Promise<LogEntry[]> {
  const token = await getGcpAccessToken();
  const filter = [
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name="${serviceName.replace(/"/g, '')}"`,
  ].join(' AND ');
  const resp = await fetch(
    'https://logging.googleapis.com/v2/entries:list',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resourceNames: [`projects/${project}`],
        filter,
        orderBy: 'timestamp desc',
        pageSize: lines,
      }),
    },
  );
  if (resp.status === 404) throw new NotFoundError(`Cloud Logging 404 for ${project}/${serviceName}`);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Cloud Logging ${resp.status}: ${body.slice(0, 500)}`);
  }
  const data = (await resp.json()) as {
    entries?: Array<{
      timestamp?: string;
      severity?: string;
      textPayload?: string;
      jsonPayload?: unknown;
      resource?: { type?: string; labels?: Record<string, string> };
      insertId?: string;
      logName?: string;
    }>;
  };
  const entries = (data.entries ?? []).map((e) => ({
    timestamp: e.timestamp ?? '',
    severity: e.severity ?? 'DEFAULT',
    textPayload: e.textPayload ?? null,
    jsonPayload: e.jsonPayload ?? null,
    resource: e.resource ?? null,
    insertId: e.insertId ?? null,
    logName: e.logName ?? null,
  }));
  // Reverse so output is chronological (oldest first) — matches what
  // tail_railway_deployment_logs and most log readers expect.
  return entries.reverse();
}
