## פירוק מכונת-המפעל — אצווה 6 (מכונת-התבנית)

אצווה 6 של `factory-dismantle` — מחיקת מכונת-ייצור-המערכות עצמה מהקוד:

- **תבניות-מוצר:** `templates/system/` (193 קבצים), `templates/agent-repo/`, `templates/agent-repo-builder/`, `templates/agent-design-spec.md`. (נשמר `templates/devplan/`.)
- **provisioners:** `provision-system.yml`, `fulfill-promote-request.yml`, `refresh-system-agents.yml`.
- **מכונת golden:** `render-system-golden`/`check-system-golden`/`check-golden-sync`/`render-agent-repo-golden`/`check-agent-repo-golden`(+`-sync`) + `tests/golden/`.
- **סקריפטי-בדיקה תלויי-תבנית/agent:** doc-facts, doc-binding, workflow-skill-pair, capability-card, executeworkflow-published, agent-single-voice, agent-folder, agent-readme, skills-mirror, gen-workflow-skill, sync-skills-mirror, build-agent-workflow, check-n8n-sql-literals, validate-templates + ה-bats/validators שלהם.
- **סקריפטי-הקמה:** copy-generic-secrets, clean-project-secrets, agent-classify, test-agent-classify.
- **מניפסטים:** `monitoring/{doc-fact-checks,doc-bindings}.json`, `{doc-binding-exempt,capability-card-exempt,workflow-skill-exempt}.txt`.
- **גיזום שלבי-CI תלויי-תבנית:** מ-`changelog-check.yml` ("Changelog gates"), `playground-tests.yml` ("Playground tests"), ו-`pipeline-tests.yml` (yamllint על תיקיות-תבנית).

נשמר: ה-gateway (`services/**`), מסלול Google, ה-backbone (broker/WIF/SA), שערי-ה-CI הגנריים,
`templates/devplan/`, `render-mcp-service-yaml.sh`, `ensure-protect-main-ruleset.sh`.
נדחה ל-אצווה 7 (תיעוד): כתיבה-מחדש של `CLAUDE.md` + גיזום docs-המפעל.
