# Agent isolation testing — proving each brick works *alone*, on real input

> **Why this exists.** A stage is "done" only when the brick is proven to actually
> do its job, on real input, **alone** — not when "the code is written and CI is
> green". CI-green is necessary but not sufficient: it proves the workflow is
> well-formed and wired, not that the VLM read the form right, the poll caught the
> mail, the fill was correct, or the send went out. This guide is the practical
> "how" behind `/dev-stage`'s in-stage functional-proof rule and the per-component
> proof gates in `templates/agent-design-spec.md`.
>
> **The shape:** decompose → prove each part alone (a pinned fixture → an expected
> output) → prove the assembly alone (no orchestrator) → wire the external/live
> endpoint **last**. Never defer all proof to a final "big-bang" stage — when it
> breaks you can't tell which brick failed (the documented *big-bang integration*
> anti-pattern). See `docs/research/agent-role-decomposition-planning.md` §8.

---

## 1. Prove a brick alone inside n8n (the editor primitives)

| Want | How (n8n) | Notes / caveat |
|---|---|---|
| Run the **whole** workflow manually | **Execute workflow** / **Test workflow** button | manual execution |
| Run **one node** in isolation | select node → **Execute step** / **Test step** | runs that node + the predecessors needed to feed it |
| Freeze a node's output as a **fixed input** for everything downstream | **Pin data** (OUTPUT panel → JSON → edit → Save; pin icon appears) | **manual executions only — production ignores pinned data.** This is n8n's official mock primitive ("Data mocking and pinning"). |
| Mock an input without any source node | **Edit Fields (Set)** node — Manual Mapping or raw JSON Output | the standard stub generator |

Sources: n8n docs — *Manual, partial, and production executions*; *Data mocking and
pinning*; *Edit Fields (Set)*.

## 2. Test an Execute-Workflow **sub-workflow** in isolation

The `Execute Sub-workflow Trigger` cannot run on its own. To prove a sub-agent alone:

- **Quick mock:** temporarily attach a **Manual Trigger → Edit Fields (Set)** "Test
  Input" node that builds the mock input, wired into the same shape the parent would
  send. Run it; inspect the output.
- **Declared shape:** on the Execute Sub-workflow Trigger set **Input data mode →
  "Define using JSON example"**, paste a sample input object; n8n infers the schema so
  you can run the sub-workflow standalone against it.
- **Real data:** set the sub-workflow's *Save successful production executions → Save*,
  run the parent once, then **load data from a previous execution** into the trigger and
  **Pin** it — now you iterate against a real captured input, offline.

Source: n8n docs — *Execute Sub-workflow Trigger*; community — *How to test n8n sub-workflows*.

## 3. Test a **polling trigger** (e.g. Gmail) without waiting for a live event

- The manual button is **Fetch Test Event** — but in test mode the Gmail Trigger does
  **not** scan history; it waits for a **new real event**. So: send one real test email,
  click Fetch Test Event to capture it, then **Pin** that output. Every later test reuses
  the pinned sample with zero polling and no live dependency.
- Gotcha: a polling interval under one minute is rejected on activation (`The polling
  interval is too short`). Use the built-in `everyX` mode (e.g. 10 minutes), not a
  sub-minute cron — this is exactly the bug that bit the email-form pilot.

Source: n8n issues #14322 / #14446; n8n docs — *Gmail Trigger / poll-mode options*.

## 4. Test an **LLM / VLM** node on a pinned sample

- Pin the upstream input (the form image/PDF as base64, the email body) → **Test step**
  on the AI/LLM node → inspect the single execution's OUTPUT. Double-click an AI Agent
  node in an execution to see the exact prompt, tool calls, and final answer.
- For systematic scoring, n8n has a built-in **Evaluations** feature (Evaluation node +
  a dataset in Data tables / Google Sheets + metrics) — dev-time "light evaluations" are
  hand-picked test cases, exactly the golden-fixture idea below.
- **Binary caveat — pinning a *string* is not proof for *binary*.** Pinning the form image/PDF
  **as a base64 string** (above) exercises the prompt path, but proves only that the string
  reached the node — not decode/stream/multipart. For a real **binary property** (a Webhook file
  upload, a downloaded attachment) n8n can report node **success while silently dropping the
  binary** — pinning included (n8n GitHub #28843, observed on 2.15.0; docs: *"You can't pin data
  if the output data includes binary data"*). Prove a binary path **end-to-end through a real
  trigger** (e.g. POST a test file to a fixed-path Webhook — §5), never by pinning. Full method:
  `docs/capability-first.md`.

Source: n8n docs — *Basic LLM Chain*; *Evaluations overview*; *Data pinning* (binary limitation);
blog — *Debug AI agent behavior*.

---

## 5. Read the result **without the (flaky) MCP** — the n8n Public API

The n8n MCP sidecar loses its session (`Session not found`) often; never let it gate a
proof. Every check below is plain HTTPS with `X-N8N-API-KEY` — scriptable with `curl`/`jq`.

- **Base + auth:** `https://<host>/api/v1`, header `X-N8N-API-KEY: <key>` (the system's key
  lives in its own Secret Manager; read it server-side, never in the session).
- **Read an execution's output (the verification core):**
  `GET /api/v1/executions?workflowId=<id>&status=success&limit=1` → take its `id` →
  `GET /api/v1/executions/<id>?includeData=true` → assert on `status` and on the node
  output inside `data`. (On n8n ≤ ~1.86 the list omits `status`; fetch the single
  execution to read it.)
- **Activate / deactivate:** `POST /api/v1/workflows/<id>/activate` and `/deactivate` —
  this is the proven pattern the system's `set-workflow-active.yml` already uses (an
  MCP-independent on/off switch over the Public API).
- **No generic "run" endpoint exists.** Drive a test deterministically by `POST`ing to a
  **Webhook** node with a **fixed `path`** (production URL `https://<host>/webhook/<path>`;
  the workflow must be **active** first — see activate above).

Source: n8n docs — *API authentication / API reference*; OpenAPI spec; *Webhook node*.

### The dedicated **verification workflow** pattern (recommended)
Build a tiny n8n workflow that *is* the assertion, then read its verdict over the API:

- **Pattern A — synchronous webhook verdict (simplest):** Webhook (fixed `path`, Respond =
  "Using Respond to Webhook node") → assertion logic → **Respond to Webhook** returning
  `{"pass": true|false, ...}` with HTTP 200/4xx. CI does one `POST /webhook/<path>` and
  asserts on the **response body + status** — no polling, no MCP.
- **Pattern B — execution-status verdict (for async/sub-workflows):** trigger it, then
  poll `GET /executions?...&limit=1` and read `data`. Put a **Stop and Error** node on the
  failed-assertion path so a failure yields `status: error` and a pass yields
  `status: success` — a binary signal from the execution record alone.

---

## 6. Golden fixtures — pin a real input + an expected output

A "golden fixture" makes "I proved it works" concrete and repeatable:

1. Commit the **real input** (the actual form image/PDF, the actual email body) as a
   fixture, version-controlled next to the workflow/prompt.
2. Commit the **hand-verified expected output** next to it.
3. Grade **deterministic-first**: JSON-parses → critical fields exact-match
   (email, amounts) → field-level diff accuracy (`1 − wrong_fields / total_fields`) for
   the rest → LLM-as-judge only for genuinely open-ended text.
4. Start tiny — even **one** real fixture with its expected output is a valid binary gate;
   grow the set from real production traces, turning every new failure into a permanent case.

Sources: Hamel Husain — *Your AI Product Needs Evals*; OpenAI — *Evaluation best practices*;
Anthropic — *Develop tests* / *Demystifying evals*; getomni.ai — *OCR benchmark* (field-diff
accuracy); Braintrust — *Golden dataset*.

---

## 7. Worked example — proving "read a form" (`form-reader`) alone

The capability that, in the pilot, was only ever proven at the very end. Here it is proven
**alone, in its own stage**:

1. **Fixture:** `tests/fixtures/form-reader/sample-form.pdf` (a real one-page form) +
   `tests/fixtures/form-reader/expected.json`:
   ```json
   { "form_title": "Membership form",
     "fields": [ {"label":"Full name","type":"text","known":true},
                 {"label":"Email","type":"email","known":true},
                 {"label":"Signature","type":"signature","is_signature":true} ],
     "missing": ["Date of birth"] }
   ```
2. **Run it alone (no Gmail, no orchestrator):** in the editor, Pin the base64 of
   `sample-form.pdf` on the input node → **Test step** on the `form-reader` sub-workflow.
   For CI, drive it via a fixed-path Webhook (Pattern A) or trigger + read the execution.
   (Pinning here pins a base64 *string* — fine to exercise the VLM prompt path, but it does
   **not** prove real binary handling; for a binary path prove it through the Webhook, per §4's
   binary caveat.)
3. **Assert (MCP-independent):**
   ```bash
   curl -s -H "X-N8N-API-KEY: $KEY" \
     "$HOST/api/v1/executions/$EXEC_ID?includeData=true" \
   | jq '.data.resultData.runData["form-reader"][0].data.main[0][0].json' \
   | jq -e '.form_title=="Membership form"
            and (.fields|length)==3
            and (.missing|index("Date of birth"))!=null'
   ```
   `jq -e` exits non-zero on mismatch → a binary pass/fail your stage can gate on, with no
   MCP and no live email. **Only after this passes** does the form-reader stage close — and
   only then do later stages stack the intake poll, the conversation, and (last) the send.
