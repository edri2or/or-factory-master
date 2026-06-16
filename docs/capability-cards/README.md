# Capability Cards — the Phase-1 proof, per shipped capability workflow

This directory holds one **Capability Card** per operable n8n workflow that adds a
**new external capability** to what the factory ships into systems
(`templates/system/workflows/n8n/<name>.json`). A card is the recorded evidence that
**capability-first** (`docs/capability-first.md`) was actually done **before** the
workflow was built: the raw capability (the *verb* — read / fill / extract / send /
parse) was proven **outside n8n** on a real fixture, with a **go/no-go** verdict.

The CI gate `scripts/check-capability-card.sh` (factory-only, in the **Playground
tests** job) enforces the pairing: every mould workflow either has a card here, or is
listed in `monitoring/capability-card-exempt.txt` (it adds no new external capability).
This is the *teeth* behind the routing rule in `CLAUDE.md` and the Step-0 gate in
`/dev-stage` / `/dev-stage-factory`. It is the gate the `email-form-intake` monolith
would have hit: building a "read a PDF form" workflow with no proven, recorded read.

## What the gate requires (minimum)

For `templates/system/workflows/n8n/<name>.json`, the file `docs/capability-cards/<name>.md`
must exist and contain a **machine-readable verdict line**:

```
verdict: go        # one of: go | partial   (no-go means: do NOT ship it as-is)
```

- `go` — the raw capability produced the expected output on the real fixture. Build it.
- `partial` — feasible only after a re-scope (a different tool, an added OCR/LLM step).
  Allowed, but the card must say what was re-scoped.
- `no-go` — proven NOT feasible as asked. A workflow shipping with a `no-go` card is a
  contradiction; the gate **fails** it. Re-scope to `partial`/`go` or don't ship it.

A missing file, a missing/garbled `verdict:` line, or `verdict: no-go` all fail the gate.

## The full card format (author this — `verdict:` is the only machine-checked part)

Reuse the **§0 Capability Card** table from `templates/agent-design-spec.md` for the
human-rich part, then add the explicit `verdict:` line the gate reads:

```markdown
# Capability Card — <name>

| יכולת (capability) | הוכחה גולמית (tool + command, מחוץ ל-n8n) | fixture אמיתי | פלט מצופה | הכרעה | סיכונים / הנחות |
|---|---|---|---|---|---|
| <the verb + its real input> | <curl / ~20-line node|python to the API> | tests/fixtures/<cap>/… | <hand-verified output> | go / partial / no-go | <what is `משוער`/unverified> |

verdict: go
```

The fixture should be the **same** real file/payload the `/build-agent` Step-0 row and
the Gate-1 isolation test reuse (`docs/agent-isolation-testing.md`). One source of truth.

## Scope (and a deliberate deferral)

This gate runs **factory-only**, over the mould (`templates/system/workflows/n8n/`).
The proven failure mode — building a capability into the template without proof — is a
*factory* development, which this catches exactly. Shipping the gate **into** provisioned
systems (so a system enforces it on its own local workflow development) is a deliberate
future option, **not** done here: systems already receive `docs/capability-first.md`,
`/prove-capability`, and `/build-agent`, and adding new raw external capabilities inside
a system is rare. Keeping the MVP minimal is itself the capability-first lesson.
