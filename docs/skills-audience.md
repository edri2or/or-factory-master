# Skills audience: factory-only vs shared

Every slash command in `.claude/commands/*.md` declares **who it is for** with an
`audience:` key in its first YAML frontmatter block. This is the single decision that
controls whether the command is shipped into the systems the factory provisions.

```markdown
---
audience: shared        # or: factory-only
description: ...
---
```

| Value | Meaning |
|---|---|
| `shared` | Used by the factory **and** shipped to every provisioned system. |
| `factory-only` | Used by the factory only. **Never** copied into a created system. |

## Why this exists

`provision-system.yml` copies `templates/system/.claude/` into every new system repo, so
`templates/system/.claude/commands/` **is** the exact set of slash commands a created system
receives. Historically that mirror was forced byte-identical to `.claude/commands/`, which
meant *every* factory command — including ones only useful for running the factory itself —
was pushed onto every system. The `audience:` tag turns the system package into a **derived
subset**: a factory-only command stays in the factory and never reaches a system.

## The two directories

- **Source of truth:** `.claude/commands/*.md` — the factory's own slash commands (all of them).
  The tag only controls *propagation to systems*; the factory can always use a command
  regardless of its tag.
- **Derived mirror:** `templates/system/.claude/commands/*.md` — exactly the `audience: shared`
  files, byte-identical. No `factory-only` file ever appears here.

## Adding or changing a command

1. Create / edit the command under `.claude/commands/<name>.md` and **set `audience:`** —
   `shared` if any provisioned system could use it, `factory-only` if it's about operating the
   factory (provisioning, decommission, factory health, etc.).
2. Regenerate the mirror:
   ```bash
   bash scripts/sync-skills-mirror.sh
   ```
   This copies only the `shared` commands into `templates/system/.claude/commands/` and drops
   any `factory-only` / stale file. It refuses to run while any tag is missing or invalid.
3. Commit both the command and the regenerated mirror.

## Enforcement (CI)

`scripts/check-skills-mirror.sh` runs in the "Changelog gates" job (`changelog-check.yml`) and
fails the build when:

- a `.claude/commands/*.md` has a **missing or invalid** `audience:` key — so a new skill can
  never merge without an explicit shared/factory-only decision; or
- the mirror is not exactly the `shared` set, byte-identical (a `factory-only` leak, a missing
  shared command, or content drift).

The fix is always `bash scripts/sync-skills-mirror.sh` (for mirror drift) or adding the tag
(for a missing decision). Tests covering all of these live in
`scripts/tests/check-skills-mirror.bats`.

> Note: `scripts/check-skills-mirror.sh` and `scripts/sync-skills-mirror.sh` are factory-only
> tooling and are intentionally **not** shipped into provisioned systems — a system doesn't
> provision sub-systems, so it has no mirror to guard.
