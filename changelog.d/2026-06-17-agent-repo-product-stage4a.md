## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 4a: ה-classifier של שער-הסיכון

שלב 4 (שער-סיכון + אישור-טלגרם) פוצל לשניים. **4a** = ה-classifier הדטרמיניסטי, נבדק לבד
(capability-first), חינם וללא תלות ב-MCP. **4b** (הבא) = חיווט ל-broker + גשר-אישור-הטלגרם
ב-MCP + redeploy.

- **`policy/agent-risk-tiers.yml` (חדש)** — מקור-האמת ל-classifier. בניגוד ל-`gcp-risk-tiers.yml`
  (שמתאים פקודת-gcloud מובנית token-wise), משימת-סוכן היא טקסט חופשי — אז זהו סורק keywords
  case-insensitive: RED קודם (בקשה מסוכנת/חוצת-גבול מנצחת), אז YELLOW (כתיבה-עצמית), אחרת GREEN.
  ברירת-המחדל GREEN כי ה-worker הנוכחי read-only (בטוח ממילא); לתעד מחדש כשיהיו workers עם כתיבה.
- **`scripts/agent-classify.sh` (חדש)** — תאום-רוח של `gcp-classify.sh`. קורא את ה-policy, מסווג
  משימה ל-`{"tier":"green|yellow|red","matched_pattern":...}`. הוכח על דגימות:
  "summarise…"/"research…plan"→green, "open a pull request"/"refactor"→yellow,
  "delete…"/"edit AGENTS.md and deploy"/"read the secret key"→red. shellcheck נקי (severity=error).

הניתוב בפועל (green=הרצה מיידית, yellow=הרצה+audit, red=אישור-טלגרם) יחווט ל-`agent-action.yml`
+ גשר ה-MCP ב-4b. אין נגיעה ב-`templates/system/**` ולא בקבצי-התנהגות-בוט.
