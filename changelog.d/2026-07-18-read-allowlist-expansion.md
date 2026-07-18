# הרחבת ה-allowlist לכיסוי כל פקודות הקריאה הנפוצות

המשך ל-`2026-07-18-permission-allowlist.md`: הרחבת `permissions.allow` ב-`.claude/settings.json`
כך שכל פקודות הקריאה הנפוצות ירוצו בלי חלון-אישור (לא רק תת-קבוצה).

- נוספו פקודות read-only: `stat`, `file`, `du`, `df`, `printenv`, `printf`, `seq`, `expr`, `cut`,
  `tr`, `comm`, `nl`, `tac`, `rev`, `fold`, `paste`, `join`, `column`, `less`, `more`, `readlink`,
  `realpath`, `basename`, `dirname`, `od`, `xxd`, `hexdump`, `strings`, `cksum`, `md5sum`,
  `sha1sum`, `sha256sum`, `date`, `cal`, `whoami`, `id`, `uname`, `hostname`, `groups`, `tty`,
  `locale`, `ps`, `free`, `uptime`, `pstree`, `lsof`, ותת-פקודות git-קריאה נוספות (`blame`,
  `describe`, `cat-file`, `ls-tree`, `for-each-ref`, `reflog`, `shortlog`, `grep`, `whatchanged`,
  `name-rev`, `merge-base`).
- `env` נוסף כ**התאמה-מדויקת בלי ארגומנטים** (`Bash(env)`, לא `env:*`) — כי `env VAR=x <cmd>`
  מריץ פקודה שרירותית; `env` לבד רק מדפיס משתני-סביבה.
- **נשאר מחוץ בכוונה (עדיין מבקש אישור):** `curl`/`wget` (קריאות-רשת), וכל כתיבה/מחיקה
  (`tee`, `dd`, `split`, `truncate`, `rm`, `git push`, `gcloud`, deploy).

**ללא שינוי התנהגות-ריצה** — הרשאות סשן בלבד; לא נוגע ב-gateway/workflows/backbone.
