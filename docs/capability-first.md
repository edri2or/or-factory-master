# Capability-first — prove the raw capability *outside n8n*, then build the agent

> **Why this exists.** Building a sub-agent already has a disciplined flow
> (`/build-agent`, `templates/agent-design-spec.md`, `docs/agent-isolation-testing.md`):
> decompose → prove each brick alone → three ordered gates → wire the orchestrator last.
> But all of it starts *inside* n8n and **assumes the underlying capability is feasible**.
> The feasibility checkbox in the design-spec is empty by default. This guide fills that gap:
> a **Phase 1** that runs *before* any n8n work — prove the *raw capability* (read a Hebrew
> form, fill a PDF, send a threaded email) works **outside n8n** with a real fixture, then a
> **go/no-go** — so you never decompose and build an automation around a capability that was
> never going to work.

This is the *spike* / *tracer-bullet* discipline applied to an agent's hardest external
dependency: for a third-party API you touch for the first time, **write code that makes a
single call** and see it work, before wiring anything around it. The two phases compose —
Phase 1 (this doc) de-risks feasibility; Phase 2 (the existing `/build-agent` flow) builds
incrementally on a capability already proven.

---

## Phase 1 — the capability probe (a spike, outside n8n)

For each capability the agent depends on (the *verb*: "read", "fill", "send", "extract"):

1. **Name the capability + its real input.** Not "handle forms" — "extract the labelled
   fields from *this* real one-page Hebrew membership PDF". Vague capability → vague proof.
2. **Get a real fixture.** A real file / email / payload — not a toy. Commit it under
   `tests/fixtures/<capability>/` so the probe is repeatable (this is the same fixture the
   `/build-agent` Step-0 row and the Gate-1 isolation test will reuse — `agent-isolation-testing.md`).
3. **Make one raw call, outside n8n.** A `curl` to the API, or a ~20-line script
   (`node`/`python`) calling the SDK directly. No workflow, no nodes, no orchestrator —
   just the capability and the real input.
4. **Compare to a hand-verified expected output.** Deterministic-first (JSON parses →
   critical fields exact-match), exactly as in `agent-isolation-testing.md §6`.
5. **Record the result in the Capability Card** (`templates/agent-design-spec.md`, the
   section above §1): capability · external proof (tool + command) · fixture · expected ·
   **verdict (go/no-go)** · risks & assumptions.

### The feasibility gate (go / no-go)
- **Go** — the raw call produced the expected output on the real fixture. *Now* enter Phase 2
  and build the agent around a proven capability.
- **No-go / partial** — the capability is weaker than assumed (e.g. non-Latin accuracy, a
  missing UI, a wrong scope). **Stop and re-scope before building**: pick a different tool, add
  a pre/post step (basic OCR + an external LLM), or tell Or it's not feasible as asked. A
  half-working capability discovered in Phase 1 costs minutes; discovered after the whole
  automation is built, it costs the build.

---

## Phase 2 — build the agent (the existing flow)

Once the capability is **go**, the rest is unchanged: `/build-agent` Step 0 (decompose +
define each part's prove-alone fixture) → bottom-up build → the three ordered gates
(part-alone → assembly-alone → routing last). See `templates/agent-design-spec.md` and
`docs/agent-isolation-testing.md`. Phase 1 feeds Phase 2: the Capability Card's fixture and
expected output become the §3 component row and the Gate-1 isolation test.

---

## The binary caveat — a green checkmark is not proof for binary

A pinned **base64 string** in JSON is pinnable and proves the *string* reached the node — but
**only** string-passing, not decode / stream / multipart. For a real **binary property** (a
Webhook file upload, a downloaded attachment), **n8n may report node success while silently
dropping the binary** — pinning included. This is documented: a node "executes successfully
but silently drops the binary property" with a green checkmark (n8n GitHub #28843, observed on
n8n **2.15.0** — a 2.x phenomenon, not only 1.x); Set / Edit-Fields nodes also drop binary by
default; and the n8n docs state plainly: *"You can't pin data if the output data includes
binary data"* (docs.n8n.io/data/data-pinning).

**Therefore:** prove any binary path **end-to-end through a real trigger** — e.g. `POST` a
test file to a fixed-path **Webhook** node and assert on the result over the n8n Public API
(`agent-isolation-testing.md §5`) — **never** by pinning and a green Test-Step. (Pinning a
base64 string to exercise an LLM/VLM prompt path is fine — it just doesn't prove binary
handling.)

---

## Three worked capability probes

### (a) Read a form — Document AI on **Hebrew** *(partial — prove it first)*
Google Document AI OCR covers 200+ languages, but structured key-value-pair (form-field)
extraction is the risk for Hebrew: the international KVP path is in Preview and the docs hedge
that *"KVP parsing might be higher for Latin languages than others"* — so **Hebrew field
extraction is at risk and must be proven on a real Hebrew fixture before you rely on it**.
*(`[משוער]` — assumptions to verify, not facts: the exact language code `iw` vs `he`; and
"the generative Form Parser is English-only + 4 regions". Treat as hypotheses to confirm
against the live API, not as settled.)*
- **Probe:** `curl` the Document AI `process` endpoint with a real Hebrew form image; inspect
  the returned entities/fields.
- **If partial:** fall back to basic OCR + an **external LLM** to structure the fields, and
  prove *that* path on the same fixture.

### (b) Fill a PDF — programmatic, no built-in UI *(verified)*
`pdf-lib` (AcroForm / `PDFForm`) and **PDFtk** fill form fields **programmatically, with no
UI** — confirmed in their docs. There is **no built-in UI for filling/e-signing**; for an
operator-facing fill/sign step use a **separate** tool — **Documenso** (open-source,
self-hostable; alternatives OpenSign / LibreSign / DocuSeal). Caveat: PDFtk is weak on
signature/image fields and XFA forms.
- **Probe:** a ~15-line `pdf-lib` script that loads a real PDF, sets the known fields, saves,
  and reopens to assert the values stuck.

### (c) Send a threaded email — Gmail API *(verified)*
`gmail.send` is a **sensitive** scope (not *restricted*) — feasible without the heavier
restricted-scope review. **Threading is the catch:** correct threading needs a full **MIME**
message per **RFC 2822** with `In-Reply-To` + `References` headers, a matching `Subject`, and
the `threadId`; the `raw` field is **base64url**. Setting `threadId` *alone* groups the
message only in the *sender's* UI, not the recipient's.
- **Probe:** build the raw MIME with the reply headers, `users.messages.send` with `threadId`,
  and confirm it threads in a real recipient inbox — not just the sender's.

---

## Credentials — the OSS-correct pattern (read once)
Do **not** plan to read secrets from n8n's `$secrets` / **External Secrets** — that is
**Enterprise-only**. And n8n **2.0** broke env-var access in **Code** nodes and disabled
**ExecuteCommand**, so don't stash secrets in env/Code either. The factory's pattern is
correct: read the secret from GCP Secret Manager at deploy and create the n8n credential over
the REST/Public API (`gcloud → REST`). Per-system credential ids are resolved at install time
from `@@CRED_*@@` placeholders by `configure-agent-router.yml` — see
`templates/n8n/subagent.contract.md` (its "Placeholders" + "Registration" sections).

---

Sources: n8n docs — *Data pinning* (binary limitation); n8n GitHub #28843 (silent binary drop,
2.15.0) · *Pragmatic Programmer* (spike) / Cockburn, GOOS (tracer-bullet / walking-skeleton);
Built In — *tracer bullets* ("a single call to the API" first) · Google Cloud — *Document AI
form parser* / release notes (KVP Preview, non-Latin caveat) · pdf-lib `PDFForm` docs / PDFtk;
Documenso (OSS e-sign) · Google — *Gmail API scopes* (`gmail.send` sensitive) / *Sending* /
*users.messages* (RFC 2822, `raw` base64url, threading) · n8n docs — *External Secrets*
(Enterprise) / *2.0 breaking changes*.
