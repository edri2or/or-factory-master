<!--
מסמך-תוכנית פיתוח (DEVPLAN) — מנוהל על ידי /dev-stage-factory.
הזיכרון/המצפן של הסוכן. Or לא פותח אותו; הסוכן מסכם לו בעברית פשוטה לפי דרישה.
-->
---
dev_name: כתיבת Drive דרך claude.ai
slug: claude-drive-write
opened: 2026-06-15
status: completed   # active בזמן פיתוח → completed בסיום (משחרר את שער ה-CI)
---

# תוכנית פיתוח — כתיבת Drive דרך claude.ai

## מטרה

לחשוף ל-Claude (דרך claude.ai) יכולת למחוק-לסל, לערוך תוכן (Google Docs/Sheets/Slides בלבד),
להעביר ולשנות-שם ב-Google Drive של אור. **לא בונים כלי חדש** — הכלי `update_drive_file` כבר
קיים ופרוס ב-sidecar `workspace-mcp==1.21.1` של ה-gateway. העבודה היא חיווט + אבטחה + תיעוד:
4 שינויי-ריפו (הידוק שער-הגישה, הרחבת בדיקת-עשן, תיקון הערה, תיעוד). שינויים 2 ו-3 (חיבור
ה-connector + כיבוי כלים/Research) הם צעדי-UI ש-Or מבצע ב-claude.ai — לא עבודת-ריפו.

> **הקשר חשוב:** זהו פיתוח control-plane + תיעוד (נוגע ל-deploy של ה-gateway ולמסמכי-הפקטורי),
> **לא** פלט-provisioning (`templates/system/**`, `provision-system.yml`, deploy המערכת אינם
> נוגעים). לכן אין הוכחת-תבנית על `or-edri-4`; ה"הוכחה החיה" כאן היא ריצת `google-mcp-smoke.yml`
> מול ה-gateway הפרוס, אחרי מיזוג ל-`main`.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | הידוק שער-הגישה (חוסם) | completed | `.github/workflows/deploy-mcp-server.yml` |
| 2 | הוכחת חשיפת כלי-הכתיבה (smoke) | completed | `scripts/google-mcp-smoke.py` |
| 3 | תיקון הערה ישנה ("read-only") | completed | `scripts/render-mcp-service-yaml.sh` |
| 4 | תיעוד (כתיבה/Research/סל/Google-native) | completed | `docs/google-identities.md`, `CLAUDE.md` |
| 5 | אימות + קידום (PR → מיזוג → smoke חי) | completed | `changelog.d/2026-06-15-claude-drive-write.md` |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.
> אף שלב כאן אינו נוגע בקבצי-התנהגות-בוט (`workflows/n8n/*.json` / `configure-agent-router.yml`),
> לכן כולם "לא-התנהגותי" לעניין שער ה-E2E.

---

### שלב 1 — הידוק שער-הגישה (חוסם)

**Acceptance:**
- [x] `OAUTH_ALLOWED_EMAILS` מאומת = `edri2or@gmail.com` בלבד (כבר כך; מתועד למה זה השער היחיד).
- [x] נוסף guard ב-deploy שמפיל את ה-deploy בקול (`::error::`) אם ה-allowlist ריק/רווחים.
- [x] `WORKSPACE_ALLOWED_SYSTEMS="*"` נשאר — עם הערה למה (זהות משותפת → ה-bearer הוא הגבול;
      נעילה תשבור מערכות אחרות ולא מוסיפה אבטחה).

**הוכחה תפקודית (באותו שלב):** `yamllint` על הקובץ עובר; `bash -n` על ה-run-step החדש; קריאה
חוזרת מאשרת שה-guard קורא את `OAUTH_ALLOWED_EMAILS` מ-env-הג'וב ומדפיס `::error::` כשריק.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. שלוש עריכות ל-`deploy-mcp-server.yml`: הערה מחוזקת על
`OAUTH_ALLOWED_EMAILS` (השער היחיד על כלי-הכתיבה), preflight-step חדש שמפיל deploy בקול אם
ריק, והערת-הסבר על `WORKSPACE_ALLOWED_SYSTEMS="*"`. `yamllint` ירוק; ה-guard נבדק (עובר על
לא-ריק, תופס ריק/רווחים).

**שינוי תוכנית:** —

---

### שלב 2 — הוכחת חשיפת כלי-הכתיבה (smoke)

**Acceptance:**
- [x] `scripts/google-mcp-smoke.py` כולל assertion ייעודי `[5b/6]` שנכשל אם `update_drive_file`
      לא ב-`tools/list` (בדיקת נוכחות בלבד — אין `tool_call` הרסני).
- [x] ה-docstring מעודכן לכלול את שלב 5b.
- [x] `python3 -m py_compile` עובר.

**הוכחה תפקודית (באותו שלב):** `py_compile` ירוק; ה-assertion מחקה את האידיום הקיים של שלב 5
(list-comprehension על `names`). ההוכחה החיה מול ה-gateway היא בשלב 5 (post-merge).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. נוסף בלוק `[5b/6]` אחרי שלב 5 שמוודא `update_drive_file ∈ names`
(נוכחות בלבד; אומת שאין `tool_call("update_drive_file"...)`), + עדכון docstring. `py_compile` ירוק.

**שינוי תוכנית:** —

---

### שלב 3 — תיקון הערה ישנה ("read-only")

**Acceptance:**
- [x] `scripts/render-mcp-service-yaml.sh` שורה ~174 כבר לא אומרת "read-only (v1)" אלא משקפת
      write-enabled, מיושר להערה הנכונה שכבר קיימת בשורות 195-197.
- [x] `shellcheck` עובר (שינוי הערה בלבד).

**הוכחה תפקודית (באותו שלב):** תוכן בלבד (הערה); `shellcheck`/`bash -n` ירוקים.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. ההערה "Single-user, read-only (v1)" הוחלפה ב-WRITE-enabled,
מיושרת להערה ליד `WORKSPACE_MCP_READ_ONLY="0"`. `shellcheck`+`bash -n` ירוקים.

**שינוי תוכנית:** —

---

### שלב 4 — תיעוד

**Acceptance:**
- [x] `docs/google-identities.md`: תת-פרק חדש "Drive write tools exposed to claude.ai" — כלי
      `update_drive_file` יחיד (סל הפיך/העברה/שינוי-שם/עריכת-Google-native בלבד); השער הוא
      `OAUTH_ALLOWED_EMAILS`=רק Or; ⚠️ לכבות ב-Research; לצמצם כלים מסוכנים ב-UI; לא לגעת ב-scopes;
      הקשחה עתידית (SA ממוקד-תיקייה) — מתועד בלבד.
- [x] `CLAUDE.md`: הערה תמציתית ליד פסקת ה-Workspace sidecar + עדכון "6-step" → מציין גם בדיקת
      `update_drive_file`; בלי לגעת ב-"6-scope"/`WORKSPACE_MCP_SCOPES`.

**הוכחה תפקודית (באותו שלב):** תוכן בלבד.

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. תת-פרק מלא ב-`docs/google-identities.md` + הערה תמציתית
ב-`CLAUDE.md` (כולל "6-step" → מציין גם בדיקת `update_drive_file`). `WORKSPACE_MCP_SCOPES` לא נגע.

**שינוי תוכנית:** —

---

### שלב 5 — אימות + קידום

**Acceptance:**
- [x] `changelog.d/2026-06-15-claude-drive-write.md` נוצר (פותר את שער-ה-changelog ל-`.sh`/`.yml`).
- [x] PR פתוח (ready for review) על `claude/sleepy-carson-7e0xhl` — PR #478.
- [x] CI ירוק: Playground tests (כולל `google-oauth.test.mjs` — scopes לא נגעו), Changelog gates
      (fragment + נגיעת-devplan), shellcheck+yamllint, secret-scan, supply-chain — כל 6 ירוקות.
- [x] מיזוג ל-`main` (squash `e2255cf`).
- [x] הוכחה חיה: `google-mcp-smoke.yml` על `main` (run 27577863231, SUCCESS) → `PASS [5b/6]
      tools/list includes update_drive_file` + `SMOKE PASS 6/6`. ללא redeploy.
- [x] התוכנית נסגרת (`status: completed`); דיווח ל-Or בעברית.

**הוכחה תפקודית (באותו שלב):** ריצת ה-smoke החיה היא ההוכחה (presence-in-code ≠ presence-in-runtime).

**הוכחת E2E (artifact):** לא-התנהגותי.

**הערת התקדמות אחרונה:** הושלם. מוזג ב-squash `e2255cf`; `google-mcp-smoke` run 27577863231
ירוק עם `PASS [5b/6] ... update_drive_file` (58 כלי-Google ב-`tools/list`, presence בלבד — לא
נקרא) ו-`SMOKE PASS 6/6`. ללא redeploy (הכלי כבר טעון, השער מכוון ל-Or). נשאר ל-Or: 2 צעדי-UI
ב-claude.ai (חיבור connector + צמצום כלים/Research).

**שינוי תוכנית:** —

---

## יומן ל-Or (עברית)

> שורה פשוטה אחת לכל שלב שהסתיים.

- שלב 1 הושלם — נעלנו את שער-הכניסה: רק אתה יכול להפעיל את כלי-הכתיבה, ויש "בלם" שצועק אם השער נפתח בטעות.
- שלב 2 הושלם — בדיקת-העשן עכשיו מוודאת שכלי-הכתיבה (`update_drive_file`) באמת חי בשרת (בלי לגעת בקבצים).
- שלב 3 הושלם — תיקנו הערה ישנה בקוד שכתבה "קריאה-בלבד" בעוד שבפועל זו כתיבה.
- שלב 4 הושלם — תיעדנו הכל: כתיבה=כן, מחיקה=סל הפיך, עריכה=Google בלבד, ולכבות ב-Research.
- שלב 5 הושלם — מוזג ל-main, והבדיקה החיה הוכיחה שכלי-הכתיבה חי על השרת. הפיתוח הושלם ✅
