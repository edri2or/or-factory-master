## fix: system resource-request channel — broker token for the project lookup

| Type | Summary |
|---|---|
| fix | Live proof (success path, on `tokile`) caught a real bug: `fulfill-system-request.yml`'s "Resolve target project" step minted a broker App token narrowly scoped to `{"variables":"read"}` on the one system repo, and the `GET /actions/variables/GCP_PROJECT_ID` then failed (curl exit 22 / HTTP 4xx) — the narrow scoping tripped on the variables permission. Fixed by minting the broker's **standard full short-lived installation token** (exactly the call `provision-system.yml` already uses to read/write these same repo variables), kept only in the masked job env, and capturing the HTTP code so any future lookup failure is diagnosable (`HTTP <code>` in the error). This is the OIL-style fast-follow: the live test surfaced what the static gates could not. |
