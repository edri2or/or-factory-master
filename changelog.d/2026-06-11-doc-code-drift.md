## תיקון פערי-תיעוד מול הקוד (README, רמז-קלט, הערות, SKILL)

תיעוד/הערות בלבד — אפס שינוי לוגיקה או התנהגות. יישור חמישה מקומות שסטו ממקור-האמת בקוד:

| סוג | קובץ | תיקון |
|---|---|---|
| docs | `README.md` | "4 repo variables" → **5** (תואם את 5 קריאות `_set_var` ב-`provision-system.yml`: `GCP_WIF_PROVIDER`/`GCP_DEPLOY_SA`/`GCP_PROJECT_ID`/`SYSTEM_NAME`/`QUEUE_MODE`). |
| docs | `README.md` | "16 generic secrets" → ניסוח דינמי בלי מספר-קבוע. הכמות נבנית דינמית ב-`copy-generic-secrets.sh` (control SM פחות תבנית-ההחרגה) — היום בפועל 47, כך שגם ה-"40" שבהערת ה-workflow כבר מיושן; לכן הוסר המספר מה-README במקום לקבע מספר חדש שיסטה שוב. |
| docs | `.github/workflows/provision-system.yml` | רמז-הקלט `system_name`: "4-30 chars" → **"6-30 chars"** (תואם את המינימום הנאכף ≥6 באותו קובץ). שינוי טקסט ה-`description` בלבד; ה-validation לא נגעו. |
| docs | `scripts/copy-generic-secrets.sh` | ההערה כבר לא טוענת "same rule the workflow enforces" — מבהירה שזו בדיקת-צורה בלבד ושמינימום ה-6 (GCP project ID) נאכף ב-workflow. הערה בלבד; ה-regex לא נגע. |
| docs | `skills/build-system/SKILL.md` | ה-regex `{4,28}` (שכבר מקודד 6–30 נכון וגם תואם את הצורה הקנונית ב-`CLAUDE.md`) סומן כצורה האפקטיבית, עם הבהרה שה-workflow ממש את אותו טווח כ-`{2,28}` + בדיקת אורך ≥6. נשמר `{4,28}` כי הוא הנכון לאימות-מקומי (החלפה ל-`{2,28}` הייתה מקבלת שמות 4–5 תווים בטעות). |
