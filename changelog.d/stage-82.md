## Stage 82 — OIL Auto-fix: TypeScript test verification

Extends the OIL fail-before/pass-after verification gates to cover
TypeScript/Node.js code in `services/mcp-server/`, in addition to the
existing bash-script coverage.

**Changes:**
- `services/mcp-server/test/oil-autofix.test.mjs` (new): unit tests for
  `verifyLinearSignature`, `extractOtel`, and `triage` from `oil-autofix.ts`.
  Serves as both a regression guard and the canonical reproducer model for
  future OIL TypeScript fixes.
- `scripts/oil-autofix-validate.sh`: whitelist now accepts
  `npm --prefix <dir> test`; scrubbed env passes HOME + npm cache isolation;
  forces `tsc --build --force` before each test run (pass-after and
  fail-before) to prevent stale-artifact false results.
- `scripts/oil-verify.sh`: symmetric changes to the post-merge gate.

**Boundaries unchanged:** forbidden paths (.github/workflows, secrets, WIF,
IAM, *.pem, *.key, .env*) remain blocked. MAX_FILES=2, MAX_LINES=100
unchanged. No workflow files modified.
