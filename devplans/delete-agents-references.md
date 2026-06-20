---
dev_name: מחיקת הסוכנים והריפוז + ניקוי אזכורים מטעים
slug: delete-agents-references
opened: 2026-06-20
status: active   # active עד שכל 6 הריפוז מאומתים מחוקים (404) אחרי אישור הטלגרם
---

# תוכנית פיתוח — מחיקת הסוכנים והריפוז

## מטרה

Or ביקש למחוק את הסוכנים נוריאל, נחשון, נתן (natan-research) וספי (sapi-docs), ואת הריפוז
personal-life ו-agent-builder — ולנקות כל אזכור *חי* שלהם שעלול להטעות. שני מסלולים: (א) מחיקת
6 הריפוז דרך שער-האישור בטלגרם; (ב) ניקוי כירורגי של הקוד/התיעוד, תוך השארת התשתית הכללית
(agent-repo product) רדומה והשארת התיעוד ההיסטורי (devplans/changelog) כפי שהוא.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | מחיקת 6 הריפוז דרך שער הטלגרם | in-progress | (GitHub — propose-repo-delete.yml) |
| 2 | ניקוי כירורגי של קוד/תיעוד | completed | CLAUDE.md, docs/**, policy/**, services/mcp-server/**, scripts/**, templates/**, tests/** |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — מחיקת 6 הריפוז דרך שער הטלגרם

**Acceptance:**
- [x] הצעת המחיקה נשלחה (`propose-repo-delete.yml`, correlation `del-agents-20260620`).
- [ ] Or לחץ ✅ בטלגרם.
- [ ] אומת ב-`get_repo` שכל 6 (`nuriel`, `nachshon`, `natan-research`, `sapi-docs`,
      `personal-life`, `agent-builder`) מחזירים 404, ונרשם כאן.

**הוכחה תפקודית (באותו שלב):** אימות `get_repo` לכל ריפו → 404 אחרי הלחיצה. כרגע ממתין ללחיצה.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הצעת המחיקה דוספטצ'ה; כרטיס ✅/❌ נשלח לטלגרם של Or. ממתין ללחיצה
ולאימות 404.

**שינוי תוכנית:** —

---

### שלב 2 — ניקוי כירורגי של קוד/תיעוד

**Acceptance:**
- [x] נמחקו מסמכי הדמות (`docs/agent-specs/{nuriel,firstwave}/**`) וקלפי-היכולת של הסוכנים
      שנמחקו (`docs/capability-cards/{nuriel-orchestration,firstwave-fanout,agent-repo-skills,agent-broker-handoff}.md`).
- [x] CLAUDE.md: סקשן הרוסטר נוסח מחדש ל"יכולת רדומה, אין סוכנים חיים"; אזכורי הקואורדינטור
      בסקשן ה-MCP נוקו.
- [x] קונפיג רוקן: `COORDINATOR_*_REPOS=""`, `worker_capabilities: {}`,
      `builder_allowed_targets: []`, `always_red_workers: []`.
- [x] קוד/טסטים/תבניות: שמות הסוכנים הוחלפו בגנריים; הגולדן (`tests/golden/agent-repo`) רוענן.
- [x] נשארו רק 3 הפניות היסטוריות מסומנות-"historical" (ל-`devplans/nuriel-coordinator.md`).

**הוכחה תפקודית (באותו שלב):** טסטי ה-MCP (138/138 PASS, tsc נקי), מסווג-הסיכון (8/8 PASS),
ה-bats של ה-extractor (4/4 PASS), shellcheck `--severity=error` נקי, yamllint נקי, golden תואם.

**הוכחת E2E (artifact):** לא-התנהגותי (אין שינוי בקבצי-התנהגות של בוט / n8n).

**הערת התקדמות אחרונה:** הושלם. נשארת רק תלות שלב 1 (אימות 404 אחרי לחיצת הטלגרם).

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

- שלב 2 הושלם — מחקתי את כל מה שמתאר את הסוכנים כקיימים *עכשיו* (טבלת הרוסטר, מסמכי הדמות,
  הקונפיג), השארתי את "המכונה" שיודעת לבנות סוכנים רדומה לעתיד, ולא נגעתי בהיסטוריה.
- שלב 1 ממתין — שלחתי לך כרטיס בטלגרם; אחרי שתאשר ✅ אמחק את 6 הריפוז ואאמת שהם נעלמו.
