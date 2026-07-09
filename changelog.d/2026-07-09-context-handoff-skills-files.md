## conversation-continuity + conversation-handoff — context now lives in a real file on disk (factory + system template)

Upgraded both conversation skills so the context is a **real file on disk** — `sessions/context/<slug>.md` —
that Claude creates, reads, and updates with the file tools, instead of a text block dumped into the chat
window (the old `conversation-continuity` even declared "not a file on disk"). On "update", Claude reads the
last file from disk, anchors on its `📍 מצב נוכחי` to find what changed since, and appends the development
from there. `conversation-handoff` now sources from that on-disk context-file and delivers the handoff **both**
as a saved file (`sessions/context/<slug>.handoff.md`) and as a ready-to-copy block.

The four copies (factory source ×2 + `templates/system` mirror ×2) were unified to one upgraded version
(the richer or-aios variant — verbatim-anchoring, supersede-not-delete, truth discipline — adopted as the
base). System golden refreshed via `scripts/check-system-golden.sh --update`; `check-system-golden.sh` and
`check-golden-sync.sh` both PASS. Docs/skill-only, no code path, no new capability (capability-first N/A).

A `.gitignore` entry for `sessions/context/` was deliberately left out of the system template in v1 — the
template ships no `.gitignore` and `provision-system.yml` copies none, so adding one would mean changing
provision's copy logic (out of scope for a skill-text change). The files are session working files the
session does not commit; the live or-aios repo added the ignore to its own `.gitignore`.
