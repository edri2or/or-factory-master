## תיקון-אמת: תיעוד ה-monitoring + רישום מחיקות סודות-שאריות

יישור תיעוד למציאות אחרי הקיפול, ורישום שתי מחיקות תפעוליות שנעשו היום ולא קיבלו עקבה ב-git.

- **`monitoring/README.md`** נכתב מחדש כדי לשקף רק את מה שחי. המנוע היומי ("שומר-על") + ה-dead-man's-switch
  + מנגנון מניעת-סחיפת-התיעוד תוארו כחיים אך למעשה **נמחקו בקיפול**: `meta-monitoring-watchdog.yml`
  (אצווה 1), `scripts/run-watchdog.sh` + `scripts/create-watchdog-heartbeat.sh` (אצווה 5א),
  `check-doc-facts.sh`/`check-doc-binding.sh` + `docs/doc-drift-prevention.md` (אצווה 7). מה ששרד
  ומתועד עכשיו נכון: הפנקס `watchdog-registry.json` + `registry-exempt.txt` + שער-ה-CI
  `check-watchdog-registry-updated.sh` (המנוע שהריץ את ההוכחות היומיות פורק; `proof_method` הוא כיום שריד).
- **`docs/telegram-chat-bot-factory.md`** — דוגמת ה-dispatch allowlist עודכנה: `meta-monitoring-watchdog.yml`
  (נמחק) הוחלף ברשימה הנוכחית בפועל (`DISPATCHABLE_WORKFLOWS` ב-`services/mcp-server/src/tools.ts`).
- **מחיקת 2 סודות-שאריות ב-control** (Telegram-gated, Or אישר): `watchdog-heartbeat-url` (יתום — המנוע שלו
  נמחק) ו-`preserved-n8n-telegram-bot-token-or-edri-4` (גיבוי ממערכת or-edri-4 שנמחקה; מנגנון השחזור נמחק
  ב-5א). אימות: `secretCount` בקרן-הבקרה **52→50**, שניהם נעדרים.

מסמכים בלבד — ללא שינוי קוד/תשתית, ללא redeploy.
