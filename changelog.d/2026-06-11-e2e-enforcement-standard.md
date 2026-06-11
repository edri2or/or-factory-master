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
