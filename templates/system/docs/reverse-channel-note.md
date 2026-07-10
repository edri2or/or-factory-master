# Reverse channel (system → factory template)

A provisioned system can propose promoting a doc it developed **up** into the factory
template (`templates/system/**`), so every future system is born with it. The system only
**asks** — the broker performs the promote (the system's GitHub App is locked to its own
repo), and Or double-gates it: a Telegram ✅ on the request, then a review + merge of the
draft PR the broker opens on `or-factory-master`.

This note is the seed artifact used to prove that channel end to end (docs-only MVP).
