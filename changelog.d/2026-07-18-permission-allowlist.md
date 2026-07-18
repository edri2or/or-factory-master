# רשימת-הרשאות לפקודות טרמינל — הפסקת בקשות-האישור החוזרות בפיתוח/בדיקות

הוספת בלוק `permissions.allow` ל-`.claude/settings.json` (checked-in) כדי שפקודות פיתוח/בדיקה
בטוחות ירוצו בלי חלון-אישור בכל שיחה, תוך שמירה על אישור-לפני-ביצוע לפעולות מסוכנות.

- `.claude/settings.json`: נוסף `permissions.allow` עם פקודות קריאה/פיתוח/בדיקה בטוחות
  (`cd`, `echo`, `cat`, `ls`, `grep`, `rg`, `find`, `jq`, `sed`, `awk`, `node`, `npm`, `npx`,
  `python`, `pytest`, `bats`, `shellcheck`, `yamllint`, `actionlint`, ותת-פקודות git בטוחות:
  `status`/`diff`/`log`/`add`/`commit`/`fetch`/`checkout`…). ה-`hooks` הקיים נשמר כמות-שהוא.
- **מחוץ ל-allowlist בכוונה — ימשיך לבקש אישור:** `git push`, `rm`, `gcloud`, `sudo`,
  `curl`/`wget`, `chmod`, וכל סקריפט deploy. גישת allowlist טהורה בלי `deny` — "מסוכן" *שואל*,
  לא *נחסם*.

**ללא שינוי התנהגות ריצה במערכת** — שינוי חוויית-פיתוח מקומי בלבד (הרשאות סשן), לא נוגע
ב-gateway, ב-workflows, או ב-backbone.
