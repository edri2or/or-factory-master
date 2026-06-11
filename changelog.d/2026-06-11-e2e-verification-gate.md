## בלם אימות E2E אכיף (e2e-verification-gate) — שלב 1: מחקר ותיעוד הפער

סוכן הכריז "מאומת חי" על סמך לוג קונפיגורציה בלבד (`tools/list`) והמשיך לשלב הבא בלי
לשלוח הודעה אמיתית דרך מסלול ה-`Telegram → agent-router` ולבדוק תשובה — בדיוק דפוס
ה"כשל השקט" שגרם לבאג המקורי. השלב הזה ממפה היכן בפקטורי "ריצה ירוקה" מתחזה ל"הפיצ'ר
עובד", מתעד את הסטנדרט המקצועי לאכיפת E2E (עם מקורות מתוארכים), ומגדיר את ארכיטקטורת
הבלם (driver שמריץ התנהגות אמיתית → proof חתום → שער אכיף ברמת השרת).

**Changes:**
- `docs/e2e-verification-gate.md` — מסמך הייחוס: מפת "ירוק מתחזה לעובד" (עם ציטוטי
  `configure-agent-router.yml` / `docs/live-test-loop.md` / smoke workflows), הסטנדרט
  המקצועי המתוארך, שלושת רכיבי הבלם, וה"מבחן-העל".
- `devplans/e2e-verification-gate.md` — תוכנית הפיתוח החיה (6 שלבים, `/dev-stage-factory`).

## שלב 2 — ה-driver (`scripts/e2e-verify-inbound.sh`)

מנוע ההוכחה ההתנהגותי: שולח Telegram update סינתטי ל-`/webhook/telegram-in/inbound`
האמיתי (עם header הסוד), ואז — כי ה-webhook הוא `onReceived` (200 = "התקבל", לא "עובד")
— עושה poll ל-n8n Public API, מוצא את ה-execution לפי nonce, ומאמת **התנהגות**: הריצה
הסתיימה בהצלחה, **אף node לא נכשל** (תפיסת "כשל שקט"), והתשובה לא ריקה ולא נראית כשגיאה
(ועם `EXPECT_SUBSTR` — מכילה טוקן מצופה). הסקריפט generic וסוד-אגנוסטי (ה-workflow מזריק
סודות ב-env; לעולם לא מדפיס ערכים). shellcheck נקי; נבדק מקומית על execution סינתטי.

**Changes:** `scripts/e2e-verify-inbound.sh` (חדש).

## שלבים 3–4 — ה-workflow המייצר + השער האכיף

**שלב 3 — מייצר ההוכחה.** `e2e-verify.yml` (פקטורי) + תאומה ב-`templates/system/.github/workflows/`:
נדחף ב-`main` (כי ה-WIF CEL נעול ל-main) אך עושה checkout ל-`target_ref` (תוכן ה-branch),
מאמת WIF (deploy-sa במערכת / broker בפקטורי), קורא סודות מ-SM, מריץ את ה-driver, ורק
**כשההודעה האמיתית עברה** מחשב `content_hash`, חותם HMAC עם `mcp-server-bearer-signing-key`,
כותב `e2e-proofs/<slug>.json`, עושה commit ל-branch ו-upload artifact `e2e-proof`.

**שלב 4 — השער האכיף.** `scripts/check-e2e-proof.sh` (תאום ל-`check-devplan-updated.sh`):
no-op אם לא נגעו בקבצי-התנהגות; אחרת דורש `e2e-proofs/*.json` באותו דיף ומאמת —
`content_hash` תואם את הקבצים בדיף (עריכה אחרי ההוכחה → אדום), `result=pass`, טרי, וב-CI
cross-check ש-`run_id` הוא ריצת `e2e-verify.yml` מוצלחת על הריפו וה-artifact בייט-תואם —
**ללא ענן** (GitHub API ב-`GITHUB_TOKEN`). helpers משותפים ב-`scripts/lib.sh`
(`e2e_behavior_files/hash/changed`). השער מותקן כ-job בשם `E2E verification gate`
(`e2e-gate.yml` פקטורי+תבנית) ונוסף ל-`protect-main` ruleset (פקטורי 5→6) ול-
`REQUIRED_CONTEXTS_JSON` של המערכות (4→5). פרופגציה: `provision-system.yml` מעתיק 2 workflows
+ 2 scripts. `e2e-verify.yml` נוסף ל-allowlist של `dispatch_workflow` ב-MCP. Golden עודכן.

**Changes:** `.github/workflows/e2e-verify.yml`, `.github/workflows/e2e-gate.yml`,
`templates/system/.github/workflows/{e2e-verify,e2e-gate}.yml`, `scripts/check-e2e-proof.sh`,
`scripts/lib.sh`, `scripts/ensure-protect-main-ruleset.sh`, `.github/workflows/provision-system.yml`,
`services/mcp-server/src/tools.ts`, `tests/golden/system/MANIFEST.sha256`.
