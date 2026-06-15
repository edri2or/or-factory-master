## תיקון זהות חשבון ה-Workspace: התיעוד אמר edriorp38, האמת היא החשבון האישי edri2or@gmail.com (workspace-identity-truth)

תוך כדי בדיקת יכולת-הכתיבה ל-Drive (claude-drive-write) הוכחנו חי — בעלות על קובץ חדש שנוצר דרך
המחבר — שהטוקן של ה-Workspace MCP (`gmail-oauth-refresh-token`) מאמת בפועל מול **`edri2or@gmail.com`**
(החשבון האישי של Or), ולא `edriorp38@or-infra.com` כפי שתיעוד רב טען. `edriorp38` הוא חשבון אמיתי אבל
הוא זהות ה-GCP/קונסול/אדמין — לא חשבון-הנתונים. תיקון תיעוד בלבד (אין שינוי קונפיג; החלטת Or: להשאיר
על החשבון האישי + לשמור על השמירות).

- **אימות:** קובץ חדש שנוצר דרך המחבר חוזר בבעלות `edri2or@gmail.com` — חד-משמעי (לקובץ חדש אין שיתופים,
  אז הבעלים = החשבון המאמת).
- **תוקנו (פרוזה/הערות בלבד):** `docs/google-identities.md` (שוכתב — טבלת שני-החשבונות, purpose frame,
  התת-פרק על כלי-הכתיבה, ה-"Lesson", מקורות; + הוסרה הטענה השגויה על "אכיפת token==label"), `CLAUDE.md`
  (סעיף "Google identities (who is who)" + purpose frame), `services/workspace-mcp/{entrypoint.sh,README.md}`,
  `scripts/render-mcp-service-yaml.sh`, `scripts/google-mcp-smoke.py`, `scripts/check-golden-sync.sh`
  (הערה + הודעת-שגיאה — לוגיקת השער לא נגעה; היא עדיין חוסמת רק את `shared-google@` הבדוי).
- **לא נגעו (ערכים פונקציונליים — שינוי ישבור קוראים):** `WORKSPACE_GOOGLE_ACCOUNT_LABEL=edriorp38@or-infra.com`,
  פרמטרי `user_google_email=edriorp38@or-infra.com`, שם-קובץ-ההרשאה, וברירת-המחדל של ה-smoke. edriorp38
  נשאר כמפתח-אחזור (filename), לא כחשבון-נתונים.
- **נדחה (follow-up, מתועד ב-"Open flags" של `docs/google-identities.md`):** `templates/system/AGENTS.md.template`
  (+ ה-golden) ו-`templates/system/workflows/n8n/ops-agent.json` נושאים את אותה פרוזה ישנה. עריכתם מושכת
  golden re-render ו-(ל-ops-agent) שער E2E חי — לא פרופורציונלי לתיקון-נוסח; יתוקן בשינוי-provisioning הבא שכבר מריץ E2E.
- **הוכחה:** `shellcheck` + `python3 -m py_compile` ירוקים; `check-golden-sync.sh` עובר (לוגיקה לא נגעה);
  `grep` מאשר שכל ערך פונקציונלי נשמר = edriorp38.
