# Changelog archive — through 2026-05-25

Older `CHANGELOG.md` entries moved here to keep the main file under the 20 KB scan-friendly cap (enforced by `scripts/check-changelog-size.sh`). Ordering preserved (newest archived stage first).

## Stage 27 — workflows: move actions off Node.js 20 (checkout v5, auth v3)

| PR | Type | Summary |
|---|---|---|
| TBD | chore | Bump pinned actions to versions that declare `runs.using: node24`, ahead of GitHub's Node 20 deprecation (forced to Node 24 on 2026-06-02, removed from runners 2026-09-16). `actions/checkout` `v4.2.2` → **`v5.0.1`** (`93cb6efe…`) across all 10 `.github/workflows/` files; `google-github-actions/auth` `v2.1.13` → **`v3.0.0`** (`7c6bc770…`) across 7 `.github/workflows/` files **and** the scaffold `templates/system/.github/workflows/deploy-railway-cloudflare.yml`. `google-github-actions/setup-gcloud` was already `v3.0.1`/node24 — left unchanged (the deprecation warning named only checkout + auth). SHA-pin posture preserved; auth v3's "removed old parameters" do not touch the WIF inputs we use (`workload_identity_provider` / `service_account`, confirmed still present in v3.0.0's `action.yml`), so GCP auth is unaffected. Pure pin bumps — no workflow logic changed. The template edit reaches newly-provisioned systems only (per CLAUDE.md); existing system repos keep their pin until re-provisioned. |

## Stage 26 — provision seeds n8n-telegram-chat-id; deploy notifier test send non-fatal

| PR | Type | Summary |
|---|---|---|
| TBD | feature | `.github/workflows/provision-system.yml`'s `Pre-create runtime secret shells` step now **seeds `n8n-telegram-chat-id` from `telegram-chat-id`** (placed in the project moments earlier by `scripts/copy-generic-secrets.sh`). The per-system n8n bot is a different bot — `n8n-telegram-bot-token` is still filled manually — but it messages the **same** operator chat, and a Telegram `chat_id` is global across bots, so the factory-admin chat-id is the right default. Seeds only when the secret has no version (same seed-if-empty pattern as `copy-generic-secrets.sh`) so reuse re-runs and any manual override aren't clobbered; the value is `::add-mask::`-ed and never echoed. Removes the redundant manual step of re-typing a chat-id already sitting in the same SM. Runs in both normal and reuse mode, no IAM change (broker SA is owner), applies to all future provisions immediately. |
| TBD | fix | `templates/system/.github/workflows/deploy-railway-cloudflare.yml`: the `Create "n8n is ready" Telegram notifier workflow` step's final test send (the webhook fire) is now **non-fatal** — a non-200 from api.telegram.org writes a `$GITHUB_STEP_SUMMARY` warning and continues instead of `exit 1`; credential / workflow-create / activate stay fatal. With the chat-id now seeded, the notifier attempts a real send as soon as the bot token is filled; if that per-system bot was never `/start`-ed by (or added to) the seeded chat the send is rejected — operator-side bot setup, not a deploy failure, so it must not fail an otherwise-successful deploy. The warning is retry-accurate: the workflow is created + active but the step's name-based idempotency skips it on redeploy, so it tells the operator to `/start` the bot and re-run the notifier workflow manually from n8n. Template edit → newly-provisioned systems only. |

Provision change is repo-level (all future provisions); the deploy-template change reaches systems provisioned after the edit only (per CLAUDE.md).
