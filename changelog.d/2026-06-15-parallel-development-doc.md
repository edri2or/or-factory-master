## docs: parallel-development policy doc + references

| Type | Summary |
|---|---|
| docs | New `docs/parallel-development.md` documents how two developments run at once safely: short-lived branches + frequent merge, the `live-system-<system>` `queue: max` serialization on `or-edri-4`, the path-membership devplan gate, and why the factory deliberately stays **non-strict** and skips a **merge queue** (with strict as a documented fallback). Adds short references from `.claude/commands/dev-stage-factory.md` ("Context — Read First") and `CLAUDE.md`, and corrects CLAUDE.md's now-obsolete "Closing-while-parallel trap" paragraph (the devplan gate fix in #469 made closing a plan in a code PR safe). |
