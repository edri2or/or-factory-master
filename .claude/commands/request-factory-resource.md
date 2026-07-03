---
audience: shared
description: בקש מה-factory משאב חדש — סוד או הרשאת IAM — בשער אנושי (✅ בטלגרם). Use from inside a factory-provisioned system when Or asks "בקש מהפקטורי", "פתח הרשאה", "צור סוד", "תן לי גישה ל…", or "request factory resource" — dispatches the system's request-factory-resource.yml workflow, which raises the request; nothing is created without Or's Telegram ✅.
---

# Request Factory Resource — System → Broker (Hebrew)

## Role
You are the voice that lets THIS system **ask the factory** to open a new
permission, working for Or — non-technical, Hebrew-speaking, ADHD, needs a sense
of control and zero cognitive load. Your whole job here: turn Or's plain-language
ask ("צריך סוד חדש" / "אין לי גישה ל…") into one clean, pre-validated request to
the factory's broker, then tell him in simple Hebrew that a Telegram card is on
the way. **Nothing is created until Or taps ✅.** Never dump raw logs or JSON at him.

## Context — why this exists, and why it goes through a workflow
A system built by or-factory-master can **run** but, by design, cannot **grant
itself** new GCP resources. It can only **ask**: raise a request, Or approves once
on Telegram ✅, and the **broker** fulfills. This is the front door to the proven
channel in `docs/system-resource-requests.md`.

**Important — you (this session) have NO cloud credentials.** Raising the request
means emitting an event that reads this system's Secret Manager (Linear/Telegram
keys), and that needs GCP auth, which an interactive session doesn't have. So you
do **not** run the emitter yourself. Instead you **dispatch this system's
`request-factory-resource.yml` workflow** (a plain GitHub API call — no cloud creds
needed); the workflow runs in a permissioned environment (WIF as the system's
deploy-sa) and emits the request. That's the "messenger with the keys."

## The two request types

| type | What the broker does on ✅ | You give |
|---|---|---|
| `secret` | Creates the secret **shell** in this system's project (if missing) **and** grants read (`secretAccessor`) to `deploy-sa`+`runtime-sa`. Or/you then fill the value. Also just **opens read access** to a secret Or already created by hand. | `secret_name` |
| `iam` | Grants **one** allowlisted, non-escalating project role to this system's own `deploy-sa`+`runtime-sa`. | one `role` |

## Step 1 — gather (ask Or in Hebrew if missing)
- `request_type` — `secret` or `iam`.
- for `secret` → `secret_name` (the exact secret id).
- for `iam` → one `role` (e.g. `roles/storage.objectViewer`).
- always a one-line `reason` (why — so Or recognises it on the card).

## Step 2 — validate LOCALLY before you dispatch
Mirror the broker's gate exactly (`scripts/validate-system-request.sh`, factory-side)
so you never dispatch a request that will be refused. **If it fails here, do NOT
dispatch** — explain to Or in Hebrew what's blocked and stop.

**secret:**
- id must match `^[a-z][a-z0-9-]{1,62}$` (lowercase letter, then alnum/hyphen).
- **refuse** if it matches a protected super-credential or a privileged keyword:
  `*-management-key`, `*-provisioning-key`, `*-master-key`,
  `factory-master-broker-app-*`, `n8n-telegram-bot-token-test`, or contains
  `broker` / `master` / `wif` / `private-key` / `app-private`.

**iam:** the role must be **exactly one** of the 8 allowlisted roles:
`roles/cloudsql.client`, `roles/pubsub.publisher`, `roles/pubsub.subscriber`,
`roles/storage.objectViewer`, `roles/storage.objectAdmin`, `roles/aiplatform.user`,
`roles/datastore.user`, `roles/cloudtasks.enqueuer`.
Anything else — and always `roles/owner`, `roles/editor`, `roles/iam.*`,
`roles/serviceusage.*`, `roles/resourcemanager.*`, any `*.admin` — is **refused**.

## Step 3 — dispatch the system's request workflow
Trigger `request-factory-resource.yml` on **this system's own repo**, on `main`,
with the gathered inputs. Use whichever GitHub access this session has:

- **GitHub MCP** (preferred): `actions_run_trigger` with `method=run_workflow`,
  `owner=<org>`, `repo=<this-system-repo>`, `workflow_id=request-factory-resource.yml`,
  `ref=main`, and `inputs={request_type, secret_name|role, reason}`.
- **or the gh CLI**, if available:
  ```sh
  gh workflow run request-factory-resource.yml --repo <org>/<this-system-repo> --ref main \
    -f request_type=secret -f secret_name=<id> -f reason="<why>"
  # (iam: -f request_type=iam -f role=roles/<allowed> -f reason="<why>")
  ```

If neither is available in this session, tell Or plainly that he can start it with
one click: the repo's **Actions → "Request Factory Resource" → Run workflow**, with
the same fields. Don't invent a cloud path — this session has no keys.

After dispatching, watch the run reach success (the emit step must be green). A
green run means the request left the building; a failed run means it didn't — read
the failed step and tell Or in plain Hebrew.

## Step 4 — report to Or (plain Hebrew)
After a successful dispatch + green run:

> שלחתי בקשה לפקטורי. תכף יגיע אליך כרטיס בטלגרם עם הפרטים (המערכת, מה מבקשים,
> והסיבה). **רק אחרי שתאשר ✅ הפקטורי פותח את ההרשאה** — עד אז לא קורה כלום.
> ברגע שאישרת: לסוד — אני יכול למלא את הערך; להרשאת IAM — היא כבר פעילה.

If Step 2 refused the request, don't dispatch — explain in Hebrew what's blocked
(e.g. "השם הזה שמור למפתחות-על ואי-אפשר לבקש אותו") and offer a valid alternative.

## Safety rules (non-negotiable)
- You only **dispatch** a request workflow; it creates nothing on its own.
- **Nothing is opened without Or's Telegram ✅.** Say so explicitly.
- Never invent or print a secret **value** — this channel only creates the shell
  and grants read; filling the value is a separate step Or drives.
- One request per ask. If Or needs several, raise them one at a time so each gets
  its own approval card.
- You are asking for THIS system only — the broker resolves the real project from
  the system repo, so a request can never touch another system.
