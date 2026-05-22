// DNS resolution helper for dns_resolve tool. Uses Node's stdlib
// `dns/promises` — no external auth needed. Allowlist gate from probe.ts
// closes the SSRF-via-LLM-input vector at the application layer (Cloud Run
// has no network egress allowlist).

import dns from 'node:dns/promises';
import { isAllowedHost, ALLOWLIST_SUFFIXES_PUBLIC } from './probe.js';

export const SUPPORTED_DNS_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SOA'] as const;
export type DnsRecordType = typeof SUPPORTED_DNS_TYPES[number];

export class DnsAllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DnsAllowlistError';
  }
}

export interface DnsResolveResult {
  hostname: string;
  type: DnsRecordType;
  records: unknown;
  resolverMs: number;
}

export async function resolveRecord(
  hostname: string,
  type: DnsRecordType,
): Promise<DnsResolveResult> {
  if (!isAllowedHost(hostname)) {
    throw new DnsAllowlistError(
      `host not in allowlist: ${hostname} (allowed suffixes: ${ALLOWLIST_SUFFIXES_PUBLIC.join(', ')})`,
    );
  }
  if (!SUPPORTED_DNS_TYPES.includes(type)) {
    throw new Error(`unsupported record type: ${type}`);
  }
  const start = Date.now();
  let records: unknown;
  switch (type) {
    case 'A':
      records = await dns.resolve4(hostname);
      break;
    case 'AAAA':
      records = await dns.resolve6(hostname);
      break;
    case 'CNAME':
      records = await dns.resolveCname(hostname);
      break;
    case 'TXT':
      records = await dns.resolveTxt(hostname);
      break;
    case 'MX':
      records = await dns.resolveMx(hostname);
      break;
    case 'NS':
      records = await dns.resolveNs(hostname);
      break;
    case 'SOA':
      records = await dns.resolveSoa(hostname);
      break;
  }
  return { hostname, type, records, resolverMs: Date.now() - start };
}
