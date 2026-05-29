## Stage 82 fix — make the OIL `npm test` verification path actually work

Follow-up to Stage 82 (#209). The `npm --prefix <dir> test` path was accepted by
the whitelist but never ran end-to-end — driving the gate directly produced
`VERDICT: failed — declared test file does not exist on main: --prefix`.

**Fixes:**
- `scripts/oil-autofix-validate.sh` / `scripts/oil-verify.sh`: for `npm` commands,
  derive the reproducer from `test_paths` (validate) / the `--prefix` dir (verify)
  instead of `awk '{print $2}'`, which yielded the literal `--prefix`. The bash /
  bats path is unchanged.
- Both gates now build with `npm run build` (the repo's pinned local `tsc`) instead
  of bare `tsc --build --force`, which is not guaranteed to resolve to the pinned
  binary and errors under a newer global tsc on this non-composite `tsconfig`.
- `services/mcp-server/package.json`: `test` script no longer relies on node's
  `--test "test/**/*.test.mjs"` glob expansion (added only in node 21+). The gates
  run the test under a scrubbed `PATH` that resolves the system `node` (older than
  the setup-node version, on CI runners too), so the script now uses the
  version-robust no-arg `node --test` auto-discovery — works on node 18/20/22.

**Boundaries unchanged:** forbidden paths, `MAX_FILES=2`, `MAX_LINES=100`, and the
proven bash verification path are untouched. No workflow files modified.
