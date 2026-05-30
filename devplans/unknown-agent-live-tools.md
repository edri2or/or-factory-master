---
dev_name: unknown-agent — אותם כלי קריאה חיים (GitHub + Railway + read_file)
slug: unknown-agent-live-tools
opened: 2026-05-30
status: active
---

# תוכנית פיתוח — כלי קריאה חיים גם ל-unknown-agent

## מטרה

אימות חי על `factory-test-025` חשף שהפער הוא **ניתוב**: שאלות כלליות ("מה אתה יכול?",
"מה כתוב ב-AGENT.md?") מנותבות ל-**unknown-agent** (סוכן השיחה הכללי), שאין לו את
`github_readonly`/`railway_readonly` (הם רק על ops). הכרעת Or: לתת ל-unknown-agent את אותם
כלי קריאה חיים, כך שיענה על שאלות GitHub/קבצים/Railway בכל ניסוח. **תבנית בלבד**, read-only,
שיקוף מדויק של מה שכבר נעשה ל-ops-agent.

**מחקר (אומת):** toolWorkflow על סוכן שיחה עם זיכרון — נתמך. אין מגבלת כלים קשיחה; ops כבר
רץ עם 4 כלים והוכח חי שבוחר נכון. unknown יעבור ל-5 — דומה; נשים לב לבחירת-כלי באימות החי.

## שלבים

| # | כותרת | סטטוס | קבצים |
|---|---|---|---|
| 1 | חיווט שני הכלים ל-unknown-agent + הרחבת ה-strip | completed | `templates/system/workflows/n8n/unknown-agent.json`, `templates/system/.github/workflows/configure-agent-router.yml` |
| 2 | תיעוד מערכת | pending | `templates/system/AGENTS.md.template`, `CHANGELOG.md`, `changelog.d/` |

---

### שלב 1 — חיווט + strip

- `unknown-agent.json`: שני נודי toolWorkflow (`github_readonly`/`railway_readonly`,
  id-prefix `c0000000-…0a/0b`) + חיבור ל-`Chat Agent` ב-`ai_tool` + עדכון בלוק
  "SYSTEM AWARENESS" (GitHub CI/commits/PRs+read_file, Railway deploy/logs, מותר קישורים).
- `configure-agent-router.yml`: הרחבת שני תנאי ה-strip לכלול `unknown-agent.json`.

**Acceptance:**
- [x] `jq .` תקין; Chat Agent מחובר ל-5 כלים; placeholders נוכחים; systemMessage מזכיר github/railway/read_file.
- [x] סימולציית sed+strip: 2 כלים קיימים עם ids / יורדים בחן כששניהם ריקים → JSON תקין, connections נקיים.
- [x] `shellcheck -S error` + `yamllint` נקיים על configure.

**הערת התקדמות אחרונה:** שיקפתי את ops-agent על unknown-agent: שני נודי toolWorkflow + חיבורי
ai_tool + עדכון SYSTEM AWARENESS. ה-strip ב-configure הורחב מ-`ops-agent.json` ל-
`{ops-agent.json || unknown-agent.json}`. אומת בסימולציה (בנייה + degradation).
**שינוי תוכנית:** —

---

### שלב 2 — תיעוד מערכת

**Acceptance:**
- [ ] `AGENTS.md.template` (unknown-agent נושא גם את הכלים) + `CHANGELOG.md` + פתק `changelog.d/`,
      בלי `${...}` חדש; `validate-templates.sh` עובר.

**הערת התקדמות אחרונה:** —
**שינוי תוכנית:** —

---

## אימות חי (דורש אישור Or — צעד נפרד)

מערכת test טרייה (`factory-test-026`): שרשרת מלאה → "מה אתה יכול?" + "מה כתוב ב-AGENT.md?"
בניסוח כללי; אימות ב-n8n ש-github_readonly רץ (read_file) והחזיר ok:true.

## יומן ל-Or (עברית)

- שלב 1 הושלם — נתתי לסוכן השיחה הכללי את אותם כלי גיטהאב+Railway (כולל קריאת קבצים), כדי שיענה בכל ניסוח.
