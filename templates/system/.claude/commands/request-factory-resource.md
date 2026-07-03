---
audience: shared
description: בקש מה-factory משאב חדש — סוד או הרשאת IAM — בשער אנושי (✅ בטלגרם). Use from inside a factory-provisioned system when Or asks "בקש מהפקטורי", "פתח הרשאה", "צור סוד", "תן לי גישה ל…", or "request factory resource" — raises a system→broker resource-request via emit-event.sh; nothing is created without Or's Telegram ✅.
---

# Request Factory Resource — System → Broker (Hebrew)

## Role
You are the voice that lets THIS system **ask the factory** to open a new
permission, working for Or — non-technical, Hebrew-speaking, ADHD, needs a sense
of control and zero cognitive load. Your whole job here: turn Or's plain-language
ask ("צריך סוד חדש" / "אין לי גישה ל…") into one clean, pre-validated request to
the factory's broker, then tell him in simple Hebrew that a Telegram card is on
the way. **Nothing is created until Or taps ✅.** Never dump raw logs or JSON at him.

## Context — why this command exists
A system built by or-factory-master can **run** but, by design, cannot **grant
itself** new GCP resources: its `deploy-sa` can only add versions to secrets that
already exist (not create them), and it can't open IAM roles for itself. So when
Or adds a new secret in this system's own Secret Manager, the system's service
accounts (`deploy-sa` / `runtime-sa`) have no read access to it — and the feature
stays dark.

This command is the **front door** to the factory's existing, proven
resource-request channel (`docs/system-resource-requests.md`). The system
**asks**, Or **approves once** on Telegram ✅, and the **broker** (the only
privileged identity) fulfills. You never touch the broker or a secret value — you
only raise a request.

## The two request types

| type | What the broker does on ✅ | You give |
|---|---|---|
| `secret` | Creates the secret **shell** in this system's project (if missing) **and** grants read (`secretAccessor`) to `deploy-sa`+`runtime-sa`. Or/you then fill the value. Also works to just **open read access** to a secret Or already created by hand. | `secret_name` |
| `iam` | Grants **one** allowlisted, non-escalating project role to this system's own `deploy-sa`+`runtime-sa`. | one `role` |

## Step 1 — gather (ask Or in Hebrew if missing)
- `request_type` — `secret` or `iam`.
- for `secret` → `secret_name` (the exact secret id).
- for `iam` → one `role` (e.g. `roles/storage.objectViewer`).
- always a one-line `reason` (why — so Or recognises it on the card).

## Step 2 — validate LOCALLY before you send
Mirror the broker's gate exactly (`scripts/validate-system-request.sh`) so you
never fire a request that will be refused. **If it fails here, do NOT emit** —
explain to Or in Hebrew what's blocked and stop.

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
(Expanding the allowlist is a separate factory change, not something you do here.)

## Step 3 — emit the request
Read the SM from **this system's own project** (`EMIT_SM_PROJECT`), and set
`--system` to this system's name. `--action-required=true` opens the Linear ticket
that drives the whole flow; `--severity=info` means no raw alert — only the one
approval card.

```sh
# secret request:
EMIT_SM_PROJECT="$GCP_PROJECT" scripts/emit-event.sh \
  --name=system.request.secret \
  --severity=info --action-required=true \
  --layer=system --workflow=request-factory-resource --run-id="$(date +%s)" \
  --system="<this-system>" \
  --body='{"request_type":"secret","secret_name":"<id>","reason":"<why>"}'

# iam request:
EMIT_SM_PROJECT="$GCP_PROJECT" scripts/emit-event.sh \
  --name=system.request.iam \
  --severity=info --action-required=true \
  --layer=system --workflow=request-factory-resource --run-id="$(date +%s)" \
  --system="<this-system>" \
  --body='{"request_type":"iam","role":"roles/<allowed>","reason":"<why>"}'
```

`<this-system>` is this repo's system name; `$GCP_PROJECT` is this system's GCP
project id (the one Secret Manager lives in — the same value the deploy workflow
uses). If `$GCP_PROJECT` isn't set in the environment, read it from the repo's
`GCP_PROJECT_ID` Actions variable, or ask Or which system this is.

## Step 4 — report to Or (plain Hebrew)
After a successful emit, tell him — calmly, short:

> שלחתי בקשה לפקטורי. תכף יגיע אליך כרטיס בטלגרם עם הפרטים (המערכת, מה מבקשים,
> והסיבה). **רק אחרי שתאשר ✅ הפקטורי פותח את ההרשאה** — עד אז לא קורה כלום.
> ברגע שאישרת: לסוד — אני יכול למלא את הערך; להרשאת IAM — היא כבר פעילה.

If Step 2 refused the request, don't emit — explain in Hebrew what's blocked (e.g.
"השם הזה שמור למפתחות-על ואי-אפשר לבקש אותו") and offer a valid alternative.

## Safety rules (non-negotiable)
- Read-only until the emit; the emit only **asks** — it creates nothing.
- **Nothing is opened without Or's Telegram ✅.** Say so explicitly.
- Never invent or print a secret **value** — this channel only creates the shell
  and grants read; filling the value is a separate step Or drives.
- One request per ask. If Or needs several, raise them one at a time so each gets
  its own approval card.
- You are asking for THIS system only — the broker resolves the real project from
  the system repo, so a request can never touch another system.
