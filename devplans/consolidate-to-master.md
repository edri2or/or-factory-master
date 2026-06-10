---
dev_name: איחוד שלוש המערכות ל-or-factory-master
slug: consolidate-to-master
opened: 2026-06-06
status: completed   # נסגר 2026-06-10 — כל 6 השלבים הושלמו; ראו הערת סגירה
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
| 3 | שער-סיכון GCP + גשר אישור טלגרם | completed (אומת חי: ירוק רץ, אדום→כרטיס; flag-strip ב-#333; באג double-gcloud בגשר תוקן + טסט ב-#334) | `.github/workflows/gcp-action.yml`, `services/mcp-server/src/gcp-approval.ts`, `index.ts` |
| 4 | איחוד סודות (כנראה ריק) | completed (אין מה להעביר — סודות הטלגרם כבר בבית) | — |
| 5 | פירוק הישן (כל מחיקה ב-✅ נפרד של Or) | completed (Railway org-reader נמחק; gcp-hands-control נמחק; factory-control-9piybr כבר היה inactive; 2 הריפוז מאורכבים ע"י archive-old-repos.yml) | `.github/workflows/archive-old-repos.yml` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
>
> נספח: ניקוי חד-פעמי של 200+ ריפו-זבל ישנים בארגון נעשה ב-`bulk-delete-repos.yml` (keep-list + dry-run, מחוץ ל-5 השלבים).
>
> **הערת סגירה (2026-06-10, נסגר אגב mcp-birth-bundle שלב 6):** כל השלבים בטבלה
> completed זה מכבר והתוכנית פשוט לא נסגרה רשמית. ראיות חיות מצטברות: כלי ה-org-read
> משרתים סשנים יום-יום, ו-gcp-action הופעל חי היום (ירוק/אדום+כרטיסי ✅) בפיתוח
> mcp-birth-bundle. תת-משימה פתוחה אחת הפכה ל-follow-up עומד: אימות `secrets:read`
> + `administration:read` ל-App של הברוקר עבור 3 כלי ה-Phase-4 המוגנים.

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
- [x] לאחר deploy: `verify_mcp_server` ירוק + קריאה חיה של `list_repos`/`search_code`/`get_file_contents` על ריפו שאינו or-factory-master. **(הוכח בשימוש יומיומי — למשל בסשן mcp-birth-bundle: ‏get_file_contents על or-adhd-agent/factory-test-047, ‏get_repo על מערכות-טסט.)**
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

> נספח 2: יכולת מחיקת-ריפו קבועה נעולת-טלגרם (AI מציע, Or מאשר ב-✅) נוספה ב-`repo-approval.ts` + `propose-repo-delete.yml` + סקיל `delete-repos`.

> נספח 3: כלי-עזר `create-throwaway-repo.yml` (zz-* בלבד) לאימות חי של מחיקת-ריפו.
