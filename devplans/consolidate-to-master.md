---
dev_name: איחוד שלוש המערכות ל-or-factory-master
slug: consolidate-to-master
opened: 2026-06-06
status: active   # active בזמן פיתוח → completed בשלב 5 (משחרר את שער ה-CI)
---

# תוכנית פיתוח — איחוד שלוש המערכות ל-or-factory-master

## מטרה

לאחד את שלוש המערכות המחוברות לסשן (`or-factory-master`, `gcp-hands`, `factory` הישנה)
למערכת פאקטורי אחת — `or-factory-master` — שבולעת את שתי היכולות הייחודיות של האחרות
(קריאה רוחבית של כל הריפוז = "org-reader"; שער-סיכון 🟢🟡🔴 לפעולות GCP עם אישור טלגרם),
ואז מפרקת את הישן. בסוף: בית אחד, MCP אחד, כספת-סודות אחת.

עיקרון: **יכולות קודם, פירוק אחרון.** שום דבר ישן לא נמחק לפני שהתחליף חי ומאומת.
מחיקות בלתי-הפיכות נעצרות תמיד לאישור מפורש של Or.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 0 | צילום מצב (קריאה בלבד) | completed | — |
| 1 | קיפול כלי org-reader ל-MCP הקיים | completed (מוזג ב-PR #331, deploy 00059 חי) | `services/mcp-server/src/{org-read-tools.ts,github-client.ts,index.ts}` |
| 2 | פורט מסווג-סיכון GCP (לוגיקה בלבד) | completed (מוזג ב-PR #331, self-test 9/9 ✅) | `scripts/gcp-classify.sh`, `policy/gcp-risk-tiers.yml`, `tests/gcp-classify-fixtures.yml`, `scripts/test-gcp-classify.sh`, `pipeline-tests.yml` |
| 3 | שער-סיכון GCP + גשר אישור טלגרם | in-progress (מוזג ב-PR #331; תיקון flag-strip בדרך; ממתין לאימות חי) | `.github/workflows/gcp-action.yml`, `services/mcp-server/src/gcp-approval.ts`, `index.ts` |
| 4 | איחוד סודות (כנראה ריק) | pending | (אופציונלי) `.github/workflows/import-secret-from-control.yml` |
| 5 | פירוק הישן (כל מחיקה ב-✅ נפרד של Or) | pending | — |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — קיפול כלי org-reader ל-MCP הקיים

ה-MCP של הבית כבר חזק (39 כלים) אבל חסר לו קריאה רוחבית של כל ריפוז הארגון — ההתמחות
היחידה של שרת ה-`org-reader` הישן (Railway, מהתמונה של Or). מקפלים את 20 הכלים הנטו-חדשים
לתוך אותו MCP במקום להשתלט על שרת ה-Railway. אימות = `installationToken()` של ה-App של
הברוקר (כבר ארגוני) — בלי סודות חדשים, בלי App-קורא נפרד.

**Acceptance:**
- [x] `org-read-tools.ts` מוסיף 20 כלים נטו (ללא הכפלת 8 כלי-ה-Actions שכבר קיימים).
- [x] `github-client.ts` מקבל `orgGet`/`searchGet`/`fetchFileContents`/`repoGet`/`ORG`, חוזרים על `installationToken()` הקיים.
- [x] `tsc` עובר נקי.
- [ ] לאחר deploy: `verify_mcp_server` ירוק + קריאה חיה של `list_repos`/`search_code`/`get_file_contents` על ריפו שאינו or-factory-master.
- [ ] תת-משימה: לבדוק אם ל-App של הברוקר יש `secrets:read` + `administration:read` ל-3 כלי ה-Phase-4; אם לא — קליק הרחבת-הרשאות של Or (שאר 17 הכלים לא תלויים בזה).

### שלב 2 — מסווג-סיכון GCP (לוגיקה בלבד)

פורט של `classify.sh` + `risk-tiers.yml` + fixtures מ-gcp-hands. רק מתייג 🟢🟡🔴, עדיין לא
מבצע. ברירת-מחדל בטוחה = אדום.

**Acceptance:**
- [ ] self-test ירוק בכל ה-fixtures.

### שלב 3 — שער-סיכון GCP + גשר אישור טלגרם

workflow כניסה אחד שרץ ירוק/צהוב לבד דרך ה-broker SA, ומנתב אדום לגשר האישור הקיים
(`oil-approval.ts`) דרך ה-`/telegram-webhook` המאוחד — מוסיף namespace חדש (`gcpok:`/`gcpno:`),
לא בונה מערכת אישור חדשה. JIT נדחה (בחירת Or: הכי פשוט) — תיעוד כחוב מודע.

**Acceptance:**
- [ ] ירוק רץ בלי אישור; אדום שולח כרטיס ✅/❌ בטלגרם; ❌/timeout = דחייה כברירת-מחדל.

### שלב 4 — איחוד סודות

דה-דופ מול שלב 0: `telegram-bot-token`/`telegram-chat-id` כבר בבית → לא מעתיקים, לא דורסים.
שאר הסודות שייכים ל-Apps/MCPים שנסגרים → לא מעתיקים. צפי: לא מעתיקים כלום.

**Acceptance:**
- [ ] אישור מפורש שאף דבר חי לא קורא מ-`gcp-hands-control`/`factory-control-9piybr` → פותח את הפירוק.

### שלב 5 — פירוק הישן

כל פעולה בלתי-הפיכה (כיבוי Railway, מחיקת Cloud Run כפול, soft-delete של 2 הכספות, archive
של 2 הריפוז) נעצרת ל-✅ נפרד של Or, אחרי בדיקת-בטיחות קריאה-בלבד שאף אחד חי לא תלוי בה.

**Acceptance:**
- [ ] בית יחיד נשאר; `verify_*` ירוק מקצה-לקצה; OIL + n8n עדיין עובדים.
