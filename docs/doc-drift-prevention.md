# Documentation drift prevention — מנגנון מניעת סחיפת-תיעוד

> **ל-Or, במשפט:** הפקטורי כבר בודק שהתיעוד *קיים* ומסונכרן *מבנית*, אבל לא שהוא *אומר אמת*.
> זה המנגנון שרץ אוטומטית בכל PR ותופס מצב שבו הקוד אומר דבר אחד והתיעוד אומר אחר — בדיוק
> כמו האירוע של "8 שאילתות בקוד מול 4 בתיעוד". זה שומר, לא ניקוי חד-פעמי.

## The problem it solves

The factory already enforces two kinds of documentation hygiene:

- **Presence / structural sync** — a new operable n8n workflow needs a paired skill
  (`scripts/check-workflow-skill-pair.sh`) and a capability card
  (`scripts/check-capability-card.sh`); code changes need a CHANGELOG fragment
  (`scripts/check-changelog-updated.sh`) and a devplan touch
  (`scripts/check-devplan-updated.sh`).
- It does **not** enforce **content accuracy.** A document can keep existing — passing
  every presence gate — while it describes a reality that already changed underneath it.

The recorded proof is the **"8 vs 4" event** (`docs/master-integrity-matrix.md`):
`templates/system/workflows/n8n/postgres-named-queries.json` defined **8** named queries
while `AGENTS.md` documented only **4**, and no gate caught it. This mechanism is the
running, automatic guard against that class of drift as the factory keeps evolving.

## The model — a layered native gate

Built natively in `bash` over the existing helpers (`scripts/lib.sh`,
`scripts/emit-event.sh`) — **no external action and no third-party dependency**
(deliberately not `tj-actions/changed-files`, which carried CVE-2025-30066; deliberately
not a vendored doc-linter in v1).

| Layer | What it does | Blocking? | Status |
|---|---|---|---|
| **1 — binding** (`check-doc-binding.sh`) | If a *bound artifact* really changed, its *bound doc* must be touched in the same diff. Catches "you changed the thing but forgot the doc." | **Yes** | live |
| **2 — facts** (`check-doc-facts.sh`) | Extract a fact (a count / a name-set) from the code and assert it equals what the doc declares. Catches "the doc states a number that the code contradicts" — the 8-vs-4 case. **The pillar.** | **Yes** | live |
| **3 — advisory judge** (`doc-drift-advisory.yml`) | An LLM reads the PR diff + the doc and gives a non-binding opinion on semantic drift, as a PR comment. | **Never** | **deferred** (separate, cost-consented development) |

Both blocking layers run in the **"Changelog gates"** job of
`.github/workflows/changelog-check.yml`, alongside the other `check-*.sh` gates. They read
`git diff --name-only HEAD~1 HEAD` (the depth-2 checkout the job already uses).

## The native files

| File | Role |
|---|---|
| `monitoring/doc-bindings.json` | The manifest: each **binding** maps a high-value doc → the artifact(s) it describes. Read by `check-doc-binding.sh`. |
| `monitoring/doc-binding-exempt.txt` | Artifacts intentionally **not** bound to any doc (basename match, `#` comments) — the conscious-decision list, a twin of `monitoring/capability-card-exempt.txt`. |
| `monitoring/doc-fact-checks.json` | The fact registry: each **check** names a `type` + a code-side and doc-side extractor, and the values are compared. Read by `check-doc-facts.sh`. |
| `scripts/lib/normalize-n8n.sh` | Sourced helper: canonicalizes an n8n workflow JSON (drops `position`/`id`/`webhookId`/top-level metadata, sorts keys) so a cosmetic editor diff is not seen as a real change. Used by the binding gate. |

> **Why JSON, not YAML, for the two manifests:** they are parsed with **`jq`**, the
> factory's guaranteed tool and the dominant machine-read-config pattern already
> (`monitoring/watchdog-registry.json`, `e2e-surfaces.json`). The runner's `yq` build is
> environment-dependent (Go/mikefarah vs Python/kislyuk have incompatible dialects), so
> depending on it would be a portability hazard — JSON + `jq` sidesteps it entirely and
> keeps the "native, no external dependency" rule.

## Layer 2 — fact checks (`doc-fact-checks.json`)

Declarative and extensible. Each entry names a `type` whose code-side and doc-side
extractors are bash functions dispatched by a `case` in `check-doc-facts.sh`:

```json
{
  "version": 1,
  "checks": [
    {
      "id": "named-queries-set",
      "type": "name_set",
      "name_he": "ערכת השאילתות הבטוחות (postgres_named_query)",
      "code": { "file": "templates/system/workflows/n8n/postgres-named-queries.json",
                "extractor": "jq_const_array", "arg": "Normalize Input::valid" },
      "doc":  { "file": "templates/system/AGENTS.md.template",
                "extractor": "md_backtick_list_on_line", "arg": "read-only SELECTs" },
      "enforce": true
    }
  ]
}
```

- `type: name_set` compares the two extracted **sets** and fails naming exactly which member
  is code-only / doc-only — that is what makes a drift *actionable*. Set-equality subsumes a
  count check.
- The extractors **fail closed**: if the code array or the doc line can't be located (a node
  was renamed, the anchor line was edited away), the check **fails loudly** ("could not locate
  …") rather than silently passing on an empty comparison.

**Adding a fact check:** add a `checks[]` entry. If its shape matches an existing `type`,
that's all. A genuinely new shape = one new entry + one new extractor function pair (and a
bats case). Start a noisy candidate with `"enforce": false` to report-only before it blocks.

## Layer 1 — bindings (`doc-bindings.json`)

```json
{
  "version": 1,
  "bindings": [
    {
      "id": "postgres-named-queries",
      "name_he": "תיעוד השאילתות הבטוחות",
      "artifacts": ["templates/system/workflows/n8n/postgres-named-queries.json"],
      "docs": ["templates/system/AGENTS.md.template"],
      "enforce": true
    }
  ]
}
```

For each binding, the gate looks at the bound **artifacts** present in the diff and decides
whether each **really changed**: an n8n workflow JSON is compared `HEAD~1` vs `HEAD` *after*
`normalize_n8n` (so a pure reposition is not a change); other files are compared as raw blobs;
a newly-added file always counts as changed. If a bound artifact really changed and **none**
of its bound docs were touched, the gate fails.

**Adding a binding:** add a `bindings[]` entry mapping the doc to the artifact(s) it
describes. If an artifact should never be bound, list it in `doc-binding-exempt.txt` instead.

### Waiver — the escape hatch

A legitimate artifact change that genuinely needs no doc edit is waived with a line in a
`changelog.d/` fragment **in the same PR**:

```
doc-waiver: <artifact-path> — <reason>
```

When the binding gate finds a matching waiver it **passes** for that artifact and emits an
audit event (`scripts/emit-event.sh --name=factory.doc_drift.waived --severity=warning`),
so Or has a trail of every waiver. The waiver is scanned **only in fragments changed in this
diff** — a stale waiver in an old fragment can never silently disable the gate.

## Scope (v1)

Factory-side only: the gates run on the factory's own PRs and *read* `templates/system/**`
as data. They add no provisioned capability and change no provisioned output, so they do not
touch any live system and trigger no golden refresh. Shipping these gates *into* provisioned
systems is a later, separate step.

## Deferred — Layer 3 (the advisory LLM judge)

`doc-drift-advisory.yml` + `docs/doc-drift-rubric.md` (a PR-triggered, never-blocking
semantic judge that runs Claude over the diff) is **not** part of v1. It is the only piece
that carries a recurring per-PR inference cost, so it is its own Or-consented `/dev-stage`
development and must be registered in `monitoring/watchdog-registry.json` when built.
