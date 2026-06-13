## or-edri-4-standing-proving-system — Stage 1: doctrine (or-edri-4 = standing proving system)

Formalize `or-edri-4` (GCP `factory-test-21`, adopt) as the factory's **permanent standing
proving system**: every provisioning-process change is **first applied and proven live on
`or-edri-4`, and only then locked into the factory template** (merge to `main`). Reframes — does
not merely delete — the retired "reference system" reasoning: `or-edri-4` avoids the old decay
because using it is mandatory + CI-enforced, the proof is fresh per change, and it is
heartbeat-audited; it costs nothing new (already Or's running system). The throwaway reuse-mode
system is retained only for the **Day-0 birth check** (a Day-2 system cannot prove a fresh birth).

- `CLAUDE.md` — rewrote the "Validating provisioning-process changes" paragraph + added a
  **Standing proving system** row to Fixed values; updated the `docs/live-test-loop.md` Key-files
  description.
- `docs/live-test-loop.md` — replaced "Why not a standing reference system" with "`or-edri-4` as
  the standing proving system — and how it avoids the old decay"; reframed the loop to
  or-edri-4-first; added a Day-0-birth-check subsection and a prove→merge reconciliation note
  (the merge-blocking proof must come from `or-edri-4`).
- `.claude/commands/dev-stage-factory.md` — flipped the method to or-edri-4-first, made teardown
  apply only to a throwaway Day-0 system (`or-edri-4` is never torn down), and updated Step 3
  (a.2), Step 5, Safety rules 4–5, the examples, and the frontmatter description.
