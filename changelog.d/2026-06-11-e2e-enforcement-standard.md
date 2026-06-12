## סטנדרט אכיפת E2E כללי (e2e-enforcement-standard) — שלב 1: מסמך הסטנדרט

הבלם שנבנה היום ספציפי לבוט הטלגרם; הפקטורי בונה עוד ~11 משטחי-ריצה שדורשים E2E ולרובם
אין אכיפה. השלב הזה מתעד את **הסטנדרט המקצועי הכללי** לאכיפת E2E מבוססת-סיכון: risk-based
testing, "right test at the right layer", מודל ה-can-i-deploy של Pact כשער-אימות גנרי,
אנטי-דפוס של שער-יחיד, ו-DORA 2024 (עם מקורות מתוארכים). כולל **רוּבריקת-החלטה** ("האם
פיתוח דורש שער E2E אכיף?"), מפת הפערים בפקטורי, ועיצוב רשם-המשטחים (`e2e-surfaces.json`)
שמכליל את ה-5-חלקים מהבלם הקיים.

**Changes:**
- `docs/e2e-enforcement-standard.md` — מסמך הסטנדרט (חדש).
- `devplans/e2e-enforcement-standard.md` — תוכנית הפיתוח (5 שלבים).

## שלב 2 — תשתית הרשם (בוט=ערך #1, אפס שינוי התנהגות)

הפיכת הבלם מ-bot-only ל**מבוסס-רשם**: `e2e-surfaces.json` מתאר כל משטח (trigger_paths /
proof_producer / proof_glob / hash_inputs / freshness / scope / enforce); הבוט הוא ערך #1
עם ערכים זהים להיום. `scripts/lib.sh` קיבל helpers שקוראים מהרשם
(`e2e_enforced_surface_ids`/`e2e_surface_hash`/`e2e_changed_surface_files`/`e2e_surface_get`),
עם **fallback מובנה לבוט** אם הרשם חסר — והפונקציות הישנות (`e2e_behavior_hash` וכו') נשמרו
כ-wrappers כך שמפיקי-ההוכחה (`e2e-verify.yml`) לא משתנים. `scripts/check-e2e-proof.sh` הפך
**surface-aware** (לולאה על משטחי `enforce:true`). `provision-system.yml` שולח את הרשם
למערכות חדשות. **אפס רגרסיה מוכחת:** ה-content_hash זהה בּית-בּית לישן; 5 ה-fixtures עוברים
זהה (no-op / חוסם בלי proof / חוסם זיוף / מעביר תקף / חוסם ישן); shellcheck/actionlint נקי.

**Changes:** `e2e-surfaces.json` (חדש), `scripts/lib.sh`, `scripts/check-e2e-proof.sh`,
`.github/workflows/provision-system.yml`.

## שלב 3 — משטח Deploy/Caddy-HMAC (enforce) — בנייה

המשטח השני: קצה ה-Caddy/HMAC. `scripts/deploy-verify.sh` מריץ את הקצה החי ומאמת
**התנהגות אבטחה**: `/webhook/*` בלי חתימה → 401, חתימה רעה → 401, חתימת HMAC-SHA256 תקפה
(header `X-Hub-Signature-256: sha256=<hex>`, מפתח `webhook-hmac-secret`) → לא-401, ו-burst
מקבילי → 429. ערך רשם `deploy-edge` (risk_tier high, enforce:true; trigger/hash על
Caddyfile/Dockerfile.caddy/caddy/hmacguard/deploy workflow). מפיקי-הוכחה `deploy-verify.yml`
(פקטורי+תבנית) — WIF, מריצים את ה-driver, חותמים `e2e-proofs/deploy-edge-<slug>.json`.
provision שולח את שניהם; allowlist (MCP) + registry-exempt (watchdog) + golden עודכנו.
**אין context חדש** — `check-e2e-proof.sh` surface-aware, ה-context הקיים מכסה. נבדק מקומית
(חסום בלי הוכחה / עובר עם / משטחים עצמאיים); אומת חי-מקדים על or-edri-4 (probe_endpoint:
healthz 200, webhook לא-חתום 401).

**Changes:** `scripts/deploy-verify.sh` (חדש), `e2e-surfaces.json`,
`.github/workflows/deploy-verify.yml` (חדש), `templates/system/.github/workflows/deploy-verify.yml`
(חדש), `.github/workflows/provision-system.yml`, `services/mcp-server/src/tools.ts`,
`monitoring/registry-exempt.txt`, `tests/golden/system/MANIFEST.sha256`.

**הוכחה חיה (or-edri-4):** retrofit (PR #9, merged) → dispatch `deploy-verify.yml`
(run 27384892330, success) → תעודת `deploy-edge-or-edri-4.json` עם checks אמיתיים:
healthz 200, no_signature 401, bad_signature 401, good_signature 404, rate_limit_429s 33.

## שלב 4 — שערי MCP כ-deploy-gate

3 שערי ה-MCP הם שירות אחד משותף, לכן ההגנה היא **בזמן deploy**, לא במיזוג (מודל can-i-deploy;
מכבד את אנטי-דפוס "שער-יחיד"). צעד **"Post-deploy MCP smoke gate"** ב-`deploy-mcp-server.yml`
מריץ את 3 ה-smokes הקיימים (`scripts/{factory,n8n,google}-mcp-smoke.py`, stdlib בלבד) מול
השרת שזה-עתה נפרס; כשל באחד → ה-deploy job נכשל (השרת השבור לא נחשב תקין). input חדש
`smoke_target` (default `or-edri-4`). 3 ערכים ב-`e2e-surfaces.json`
(`factory/n8n/workspace-mcp`, `scope:factory`, `gate:"deploy"`, `enforce:false`) — מתעדים את
המשטחים בלי לגעת ב-`check-e2e-proof.sh` (אפס סיכון לבלם המוכח). מתועד ב-
`docs/e2e-enforcement-standard.md` (מודל merge-gate מול deploy-gate). הוכחה: 3 ה-smokes
עוברים חי מול or-edri-4; ההרצה המלאה של ה-gate = ה-redeploy האוטומטי במיזוג (control-plane).

**Changes:** `e2e-surfaces.json`, `.github/workflows/deploy-mcp-server.yml`,
`docs/e2e-enforcement-standard.md`.

## שלב 5 — סגירה: Day-0 birth check + השלמת מפת-המשטחים (מייעץ)

סוגר את הפיתוח. **Day-0 birth check** ללא producer חדש: כיוון ש-`e2e-verify.yml` כבר נשלח
לכל מערכת ומוכח חי, בדיקת-הלידה היא תהליך — אחרי הפריסה הראשונה מדיחים `e2e-verify` על
המערכת החדשה כדי להוכיח שהבוט עונה. מתועד ב-`docs/e2e-enforcement-standard.md` + הופך את
צעד ה"verify live" ב-`docs/live-test-loop.md` משער-`/healthz`-אופציונלי לשער-E2E התנהגותי.
`observability-delivery` נרשם כמשטח advisory (`enforce:false`, `gate:"advisory"`, producer
עתידי = emit סינתטי → Axiom read-back). אין merge-gate חדש; enforced נשאר בוט+קצה
(`check-e2e-proof.sh` לא נגעו). blue-green ל-MCP + observability-verify מתועדים כ-future.

**Changes:** `e2e-surfaces.json` (advisory surface), `docs/e2e-enforcement-standard.md`
(rollout 1–5 + Day-0), `docs/live-test-loop.md` (Day-0 verify-live step).
