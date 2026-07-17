## Deletion pre-flight: a required impact scan + "never assert safe before the check" rule

Structural safeguard after an incident where the agent called a 20-repo deletion "safe / aligns with
the records" **before** running any check — `or-adhd-agent` in fact had an open `docs/roadmap.md` #6
"blocks any teardown" note. No damage (the shared Google identity lives in GCP SM + the gateway, not
the repo, and was re-proven healthy live), but the assertion preceded the verification. The fix is
structural, not a promise:

- **`.claude/commands/delete-repos.md`** — new **required Step 2, "Impact scan"**: before proposing any
  deletion, `search_code` the org + grep `docs/`/`docs/roadmap.md`/`devplans/` for each target repo,
  flag any constraint signal (`blocks`/`teardown`/`pending`/`still carries`/`keep` or a live dependency
  like a secret home), and present the **actual findings** to Or. A documented constraint → STOP. The
  Invariant now also forbids calling a deletion "safe" from assumption.
- **`CLAUDE.md`** (Never list) — the general principle: never assert an action is safe/done/verified
  before the check that proves it; before an irreversible action a pre-flight impact scan is a
  **required** step; state what the scan found, not a reassurance.

Doc-only (no code / behavior / deploy). `delete-repos.md` is `audience: factory-only`, so the system
mirror is unaffected.
