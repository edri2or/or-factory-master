// TLS certificate inspection helper for tls_cert_inspect tool. Uses Node's
// stdlib `tls.connect()` to fetch the peer certificate during the handshake,
// then closes the socket without sending any application data. Allowlist
// gate from probe.ts closes the SSRF-via-LLM-input vector.

import tls from 'node:tls';
import { isAllowedHost, ALLOWLIST_SUFFIXES_PUBLIC } from './probe.js';

const TIMEOUT_MS = 5_000;

export class TlsAllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TlsAllowlistError';
  }
}

export interface TlsCertInfo {
  host: string;
  port: number;
  authorized: boolean;
  authorizationError: string | null;
  subject: tls.PeerCertificate['subject'] | null;
  subjectAltName: string | null;
  issuer: tls.PeerCertificate['issuer'] | null;
  validFrom: string | null;
  validTo: string | null;
  serialNumber: string | null;
  fingerprint256: string | null;
}

export async function inspectCert(host: string, port: number): Promise<TlsCertInfo> {
  if (!isAllowedHost(host)) {
    throw new TlsAllowlistError(
      `host not in allowlist: ${host} (allowed suffixes: ${ALLOWLIST_SUFFIXES_PUBLIC.join(', ')})`,
    );
  }
  return new Promise<TlsCertInfo>((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        clearTimeout(timer);
        const cert = socket.getPeerCertificate(true);
        const authorized = socket.authorized;
        const authError = (socket as unknown as { authorizationError?: Error }).authorizationError;
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          resolve({
            host,
            port,
            authorized,
            authorizationError: authError ? String(authError) : null,
            subject: null,
            subjectAltName: null,
            issuer: null,
            validFrom: null,
            validTo: null,
            serialNumber: null,
            fingerprint256: null,
          });
          return;
        }
        resolve({
          host,
          port,
          authorized,
          authorizationError: authError ? String(authError) : null,
          subject: cert.subject ?? null,
          subjectAltName: cert.subjectaltname ?? null,
          issuer: cert.issuer ?? null,
          validFrom: cert.valid_from ?? null,
          validTo: cert.valid_to ?? null,
          serialNumber: cert.serialNumber ?? null,
          fingerprint256: cert.fingerprint256 ?? null,
        });
      },
    );
    const timer = setTimeout(() => {
      socket.destroy(new Error(`TLS connect timeout after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
