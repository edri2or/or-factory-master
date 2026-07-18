# ניקוי-אמת סופי של הקיפול (Tier A) — skills-מפעל מתות + יישור תיעוד

חקירה מחודשת גילתה שהקיפול (`factory-dismantle`, סגור) נותר עם שאריות אמיתיות של מכונת-הייצור
ועם סחף-תיעוד — בניגוד להנדאוף שטען "אין קצוות פתוחים". Tier A מנקה את החלק הבטוח (skills+תיעוד);
Tier B (הסרת ערוץ `fulfill-system-request` על שזירתו ב-gateway) יגיע ב-PR נפרד עם אישור-פריסה מפורש.

- **נמחקו 5 מיומנויות-מפעל מתות** שתיארו את המפעל המפורק כחי: `skills/build-system`,
  `skills/register-system-app`, `skills/decommission-system`, `skills/decommission-test-system`,
  `skills/health-check`. (`skills/build-site`+`skills/publish-site` נשמרו — מנוע ה-publish-static-site הקיים.)
- **תוקן תיאור-אמת ב-`CLAUDE.md`:** ה-OIL auto-fix **לא** "כבר נמחק" — `services/mcp-server/src/oil-autofix.ts`
  עדיין שזור ב-gateway (רק מודול `oil-approval` הוסר, batch 5b). הפסקאות "being removed" עודכנו למצב אמיתי;
  אזכורי workflows שכבר לא קיימים (`mirror`/`preserve`/`restore`/`grant-secret-accessor`,
  `trigger-system-workflow`, `remove-system-n8n-workflow`, `bs-incidents-to-telegram`, `decommission-test-system.yml`) הוסרו.
- **`README.md`:** הוסרה שורת `monitoring/` (התיקייה נמחקה בפירוק).
- **8 מסמכי `docs/` קיבלו באנר "הערה היסטורית"** המסמן שאזכורי מכונת-הייצור בהם הם רקע היסטורי, לא מצב חי:
  `external-state`, `openrouter-integration`, `observability`, `telegram-chat-bot-factory`,
  `parallel-development`, `capability-first`, `bootstrap-record`, `mcp-connector-setup`.
- **`docs/google-identities.md`:** תוקן ה-follow-up על templates המערכתיים ל"moot" (ה-mould + golden נמחקו בקיפול).
- **נמחקה `docs/capability-cards/`** (README + publish-static-site) — תת-מערכת מתה (`templates/system/` + `check-capability-card.sh` כבר לא קיימים; אין הפניה חיה).

לא נגעו: OIL (load-bearing), `github-client.ts`, `repo-approval.ts`, allowlist של `dispatch_workflow`,
ומסלול Google/n8n/telegram. שינוי מסמכים/skills בלבד — לא נוגע ב-gateway/workflows/backbone.
