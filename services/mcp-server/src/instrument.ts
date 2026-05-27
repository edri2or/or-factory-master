// Sentry initialization — MUST run before the rest of the app loads. Loaded via
// `node --import ./dist/instrument.js` in the Dockerfile, and imported first by
// index.ts so local `npm start` is covered too (the module is cached, so init
// runs exactly once). No-ops when no real DSN is configured, so the service runs
// fine until SENTRY_DSN (mounted from the sentry-api-key secret) is set.
// Errors-only (no performance tracing). Scrubs the secrets this server handles
// before any event leaves the process.
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN ?? '';

if (dsn.startsWith('https://')) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0, // errors only — no perf tracing
    sendDefaultPii: false,
    beforeSend(event) {
      // This server handles bearer tokens (Authorization), the admin secret
      // (X-Admin-Secret), and request bodies that carry tokens/secrets
      // (/token, /oauth/token). Strip all of it before sending to Sentry.
      const request = event.request;
      if (request) {
        const headers = request.headers as Record<string, unknown> | undefined;
        if (headers) {
          for (const key of Object.keys(headers)) {
            const lower = key.toLowerCase();
            if (lower === 'authorization' || lower === 'cookie' || lower === 'x-admin-secret') {
              delete headers[key];
            }
          }
        }
        const req = request as Record<string, unknown>;
        delete req['data'];
        delete req['cookies'];
      }
      return event;
    },
  });
  process.stdout.write('[sentry] initialized (errors-only)\n');
} else {
  process.stdout.write('[sentry] disabled — no SENTRY_DSN configured\n');
}
