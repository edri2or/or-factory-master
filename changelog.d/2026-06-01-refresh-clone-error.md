## refresh-clone-error

Surface the real git error when `refresh-system-agents.yml` fails to clone the
target system repo. Previously `2>/dev/null` swallowed the actual cause (auth,
network, missing branch) and the workflow printed only a generic "does it exist
/ is it provisioned?" message. Now stderr is captured and the token sed-stripped
out of the URL before printing — same pattern the push step in the same job
already uses.
