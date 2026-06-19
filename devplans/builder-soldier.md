---
dev_name: חייל-הבנאי (the builder-soldier)
slug: builder-soldier
opened: 2026-06-19
status: active   # active בזמן פיתוח → completed בסיום
---

# תוכנית פיתוח — חייל-הבנאי (the builder-soldier)

## מטרה

להוסיף לצוות-הסוכנים חייל חדש בעל-יכולת-כתיבה ("הבנאי") שיכול לבנות קוד לתוך
`edri2or/personal-life` — אבל **בלי לשבור את חוק האבטחה מס' 1 של הפקטורי**: הכל עובר דרך
דלת אחת שמורה (הברוקר), שום סוכן לא כותב ישירות. בפועל: החייל רק *מציע* קבצים (בארגז-חול,
בלי שום מפתח GitHub), והברוקר הקיים פותח PR-טיוטה ל-personal-life — עם ✅ של Or בטלגרם בכל
ריצה. הצעד האחרון (חובה): רישום הבנאי כחייל ש-Nuriel יכול לנתב אליו (`route_to_agent`).

> **תיקון-עיגון מול הבלופרינט של נוריאל:** הבלופרינט הניח שה-worker יחזיק מפתח-כתיבה משלו
> (GitHub App ייעודי + SA חדש `agent-builder-sa@`) וידחוף בעצמו. זה סותר את מודל-הברוקר
> ("רק הברוקר כותב; הכל דרך הדלת האחת"). העיצוב המעוגן: **אין App חדש, אין SA חדש, אין WIF
> חדש** — ה-worker מציע קבצים, הברוקר (App ארגוני קיים, טוקן מצומצם ל-personal-life לכל ריצה)
> מיישם כ-PR-טיוטה. בטוח יותר וגם פחות תשתית. 4 נקודות-הלברור הוכרעו בהתאם (ראו למטה).

### 4 נקודות-הלברור — הוכרעו
1. **SA חדש?** לא. ה-worker משתמש ב-SA המשותף `agent-repo-runtime-sa@factory-test-25`
   (קורא רק `anthropic-api-key`), כמו כל agent-repo. הכתיבה ל-GitHub היא של הברוקר.
2. **אחסון audit?** אין bucket חדש. ה-trail = אירועי `factory.agent_action.*` ב-Axiom +
   ה-PR-טיוטה עצמו + commits עם trailer `[builder-agent]` + `results/<corr>.json`.
3. **סף-קבצים?** השער ממילא RED→טלגרם לכל ריצה; בלם-בטיחות קשיח בברוקר: מסרב מעל
   **50 קבצים או ~256KB**, ומציג את מספר-הקבצים בכרטיס הטלגרם.
4. **מיקום allowlist?** נאכף **אצל הברוקר** (הכותב האמיתי), 3 שכבות: L3 טוקן מצומצם
   ל-`edri2or/personal-life` (GitHub API דוחה כל ריפו אחר) > L1 בדיקת `builder_allowed_targets`
   ב-`policy/agent-risk-tiers.yml` (fail-closed) > L2 איסור מפורש ב-AGENTS.md.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | הוכחת-יכולת (capability-first) — הלבנה הקשה | pending | spike (throwaway repo + סקריפט) |
| 1 | מדיניות-סיכון: builder כ-write + allowlist + סף | pending | `policy/agent-risk-tiers.yml`, `scripts/agent-classify.sh` |
| 2 | נתיב-כתיבה בברוקר (apply→draft PR), שער RED | pending | `.github/workflows/agent-action.yml` |
| 3 | תבנית worker כותב (Write/Edit לתוך `out/`, בלי Bash/טוקן) | pending | `templates/agent-repo-builder/**` |
| 4 | הקמת ריפו-הבנאי `edri2or/agent-builder` 🔴 | pending | `provision-agent-repo.yml`, `refresh-agent-repo.yml` |
| 5 | יצירת `edri2or/personal-life` + הגנת-main 🔴 | pending | `scripts/ensure-protect-main-ruleset.sh` |
| 6 | dry-run → ריצה אמיתית ראשונה 🔴 | pending | (תפעולי — dispatch דרך הברוקר) |
| 7 | רישום ב-`route_to_agent` (חובה אחרון) 🔴 | pending | `deploy-mcp-server.yml`, `policy/…`, `docs/agent-specs/nuriel.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`. 🔴 = עוצר לאישור-Or בטלגרם.

---

### שלב 0 — הוכחת-יכולת (capability-first) — הלבנה הקשה

**Acceptance:**
- [ ] Claude Code בארגז-חול (Write/Edit, בלי Bash, בלי טוקן) מייצר scaffold תקין לתוך `out/`.
- [ ] טוקן App מצומצם לריפו-זרוק יחיד פותח branch+PR-טיוטה שם — ונדחה (403) על כל ריפו אחר.
- [ ] רשומת go/no-go.

**הוכחה תפקודית (באותו שלב):** spike על ריפו-זרוק — צפייה בעיניים ב-PR שנוצר ובדחיית 403.

**הוכחת E2E (artifact):** לא-התנהגותי (agent-repo, לא n8n).

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 1 — מדיניות-סיכון

**Acceptance:**
- [ ] `worker_capabilities` כולל את הבנאי כ-`write`; `builder_allowed_targets: [edri2or/personal-life]`.
- [ ] דפוסי cross-repo-write = RED; סף 50-קבצים/256KB.
- [ ] `agent-classify.sh` לא מוריד RED→yellow ל-worker כותב (אימות).

**הוכחה תפקודית (באותו שלב):** הרצת `agent-classify.sh` על משימת-בנאי לדוגמה → tier=red, worker_capability=write.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 2 — נתיב-כתיבה בברוקר

**Acceptance:**
- [ ] `agent-action.yml` מושך `out/`, מאמת target∈allowlist + סף, מנפק טוקן מצומצם, פותח DRAFT PR, כותב `results/<corr>.json`.
- [ ] כתיבה cross-repo עוברת בשער RED→טלגרם הקיים לפני execute.

**הוכחה תפקודית (באותו שלב):** הוכחה משלב 0 + ריצת-broker אמיתית בשלב 6.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 3 — תבנית worker כותב

**Acceptance:**
- [ ] worker variant עם `--allowedTools Read,Grep,Glob,Write,Edit`, בלי Bash, בלי טוקן GitHub, מעלה `out/`.
- [ ] שערי golden / skills-mirror ירוקים.

**הוכחה תפקודית (באותו שלב):** render + הרצת ה-worker בשלב 6.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 4 — הקמת ריפו-הבנאי 🔴

**Acceptance:**
- [ ] `edri2or/agent-builder` קיים, WIF-bound, עם worker כותב + AGENTS.md מותאם (allowlist + איסור).

**הוכחה תפקודית (באותו שלב):** `verify_github_system` + קריאת AGENTS.md החי.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 5 — יצירת personal-life + הגנת-main 🔴

**Acceptance:**
- [ ] `edri2or/personal-life` קיים (פרטי) עם ruleset `protect-main` (PR-required, no force-push/deletion).

**הוכחה תפקודית (באותו שלב):** `list_branch_protection_rules` / `verify_github_system`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 6 — dry-run → ריצה אמיתית ראשונה 🔴

**Acceptance:**
- [ ] DRY_RUN: Or רואה את רשימת-הקבצים בכרטיס; ואז ריצה אמיתית פותחת PR-טיוטה ל-personal-life; Or ממזג ידנית.
- [ ] אומת: `results/<corr>.json`, ה-PR, אירועי Axiom, trailer `[builder-agent]`.

**הוכחה תפקודית (באותו שלב):** צפייה ב-PR החי + תוצאת ה-broker.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

### שלב 7 — רישום ב-route_to_agent (חובה אחרון) 🔴

**Acceptance:**
- [ ] `agent-builder` נוסף ל-`COORDINATOR_WORKER_REPOS` + capability ב-policy + שורה ברוסטר `nuriel.md`.
- [ ] לאחר redeploy של ה-MCP: `route_to_agent(worker_repo=agent-builder)` מ-Nuriel מצליח (broker run + result).

**הוכחה תפקודית (באותו שלב):** קריאת `route_to_agent` חיה → broker run + `results/<corr>.json`.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** —

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- 2026-06-19: הוקם הפיתוח. תיקנתי את הבלופרינט של נוריאל לעיצוב מאובטח (בלי App/SA חדשים — הברוקר כותב). ממתין לאישורך בטלגרם לפני הצעד הרגיש הראשון (הוכחת-היכולת, שדורשת ריפו-זרוק זמני).
