## fix: Stage 83 — system-repo clone in the OIL loop (auth method + diagnosability)

| Type | Summary |
|---|---|
| fix | The Stage-83 system-clone steps in `oil-autofix-investigate.yml` ("Prepare the target working tree") and `oil-autofix-verify.yml` cloned the target system with `git -c http.extraheader="AUTHORIZATION: basic …"`, which GitHub can silently drop on the redirect to the pack server when the credential is an App installation token → a 403 the step then **swallowed** (`>/dev/null 2>&1`), leaving `./target` absent so the investigator saw no system code and (correctly) escalated. Switched both to the URL-embed auth the rest of the repo already uses for App tokens (the openpr push form), which survives the redirect; added a 3× retry for fresh-repo/token propagation; surfaced the git error (token scrubbed) instead of suppressing it; and scrub the token from the clone's persisted remote URL afterwards. Caught by the first live system-targeted run on `factory-test-83`. |
