## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 1a: הדלת + הוכחת-מפתח

Or בחר את מודל-המפתח לריפו-סוכן: **דלת-WIF משותפת** (אופציה B) — ריפו בלי GCP משלו מקבל את
`anthropic-api-key` בזמן ריצה דרך GitHub OIDC קצר-מועד → WIF → SA זמן-ריצה מינימלי, בלי שום
סוד קבוע בריפו (D6/D9 של המחקר). שלב 1 פוצל ל-1a (הדלת + הוכחת-המפתח, capability-first
bottom-up) ו-1b (הלולאה המלאה). שלב זה בונה את 1a; ההרצה החיה + ההכרעה אחרי מיזוג ל-main.

- **`scripts/bootstrap-agent-repo-identity.sh` (חדש)** — תאום-רוח של `bootstrap-sandbox-tester.sh`.
  בונה אידמפוטנטית `agent-repo-pool` / `github-agent-repo-provider` / `agent-repo-runtime-sa`
  ב-`factory-test-25` (CEL: org `edri2or` + `ref==main`), binding `workloadIdentityUser`
  per-agent-repo, ו-`secretAccessor` חוצה-פרויקט על **סוד יחיד** — `anthropic-api-key` ב-control.
  **מיקום ב-factory-test-25 (לא control) הוא אילוץ הרשאות:** ל-broker יש `secretmanager.admin`
  ב-control אך לא `workloadIdentityPoolAdmin`/`serviceAccountAdmin`, אז הוא לא יכול ליצור שם
  pool/SA; הוא כן יכול ליצור WIF ב-factory-test-25 וגם לתת IAM על סוד יחיד ב-control. Hard-guards:
  WIF רק ב-factory-test-25, סוד רק ב-control. לא קורא/מדפיס ערכי-סוד.
- **`.github/workflows/bootstrap-agent-repo-identity.yml` (חדש)** — מריץ את הסקריפט כ-broker
  (WIF, main-locked), קלט `bind_repos` (ברירת-מחדל `zz-agentskel-worker`). לא ב-dispatch_workflow
  allowlist (הקמה חד-פעמית).
- **`spikes/agent-skeleton/cred-probe.yml` (חדש, throwaway)** — נזרע לתוך ריפו-`zz-`: auth דרך
  הדלת → קורא `anthropic-api-key` → מדפיס **רק אורך** (הערך מוסתר, לעולם לא מודפס). זו הוכחת
  הלבנה הקשה: ריפו בלי GCP שולף את המפתח דרך OIDC קצר-מועד.
- **`.github/workflows/agent-skeleton-seed.yml` (חדש, throwaway)** — יוצר ריפו-`zz-` (broker App,
  name-guard `zz-`) ומזריע אליו את `spikes/agent-skeleton/*.yml` דרך token מתוחם
  (`contents+workflows:write` לריפו בודד); אופציונלית פותח issue-משימה ב-requester (לשלב 1b).
  יוחלף ב-`provision-agent-repo.yml` בשלב 3.
- **`monitoring/registry-exempt.txt`** — נוספו שני ה-workflows החדשים (one-time/throwaway,
  dispatch-only, אין cadence לאמת).
- **`devplans/agent-repo-product.md`** — עודכן: החלטת מודל-המפתח (B), פיצול שלב 1 ל-1a/1b, יומן.

אין נגיעה ב-`templates/system/**` (שער הזהב לא נדרס) ולא בקבצי-התנהגות-בוט (שער ה-E2E no-op).
