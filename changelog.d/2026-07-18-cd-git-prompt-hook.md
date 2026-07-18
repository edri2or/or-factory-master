# PreToolUse hook — ביטול חלון האישור על `cd && git` ושרשראות בטוחות

הוספת PreToolUse hook (`.claude/hooks/allow-safe-bash.sh`, matcher `Bash`) שמאשר אוטומטית
פקודות טרמינל שכל מקטעיהן בקבוצה הבטוחה — כולל שרשראות `cd <repo> && git …` שנחסמו קודם ע"י
יוריסטיקת-הבטיחות המובנית של Claude Code (git עלול להריץ hooks מהתיקייה) ש**אף** כלל
ב-`permissions.allow` לא עוקף.

- `.claude/hooks/allow-safe-bash.sh` (חדש): שמרני מיסודו — מחזיר `permissionDecision: "allow"`
  רק כשכל מקטע בקבוצה הבטוחה ואין תחביר-סיכון (`$(`/backtick/`<(`/redirect-לקובץ); אחרת שותק
  ונופל לזרימת-ההרשאות הרגילה. **לעולם לא מחזיר `deny`** — יכול רק להסיר פרומפט, לא להוסיף/לחסום.
  הקבוצות הבטוחות זהות ל-`permissions.allow` שאושר (סבבים 1–2); מסוכן (rm/gcloud/sudo/curl/wget/
  git push/deploy) לא בקבוצה → נופל לפרומפט.
- `.claude/settings.json`: רישום ה-hook תחת `hooks.PreToolUse` (matcher `Bash`); שאר ה-hooks נשמרו.

**אושר במפורש ע"י Or** (הורדת פיקוח מודעת לקבוצה הבטוחה). נבדק: shellcheck נקי + 12 מקרי
pipe-test (שרשראות בטוחות → allow; rm/push/curl/gcloud/redirect/subst → פרומפט). התנהגות-סשן
בלבד; לא נוגע ב-gateway/workflows/backbone.
