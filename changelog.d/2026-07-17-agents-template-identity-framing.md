## System template: frame n8n URL/health as the tool's, not the system's identity

Cross-repo follow-up from or-aios ADR-0025 Part D. `templates/system/AGENTS.md.template` — the
orientation doc every provisioned system is born with — listed **Public URL** / **Health check** with
no framing. Added a one-line clarification in the Identity section: those are **n8n's** endpoint and
liveness (the tool / the hands), **not** the system's identity — the system is the repo + the
coordinating role; the health mechanisms monitor n8n-as-a-tool (which must stay up for the Telegram
HITL channel), not "the system". Refreshed the system golden accordingly
(`tests/golden/system/rendered/AGENTS.md`).

Provision-only: reaches systems built **after** this change; existing systems are not back-filled (a
separate `refresh-system-agents.yml` run would do that, if wanted). Doc-only — no code / behavior /
deploy.
