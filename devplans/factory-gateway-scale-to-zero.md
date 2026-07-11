---
dev_name: הרדמת שער-הפקטורי לאפס (חיסכון עלות)
slug: factory-gateway-scale-to-zero
opened: 2026-07-11
status: active   # active עד שאומת שהעלות צנחה בפועל → אז completed
---

# תוכנית פיתוח — הרדמת שער-הפקטורי לאפס (scale-to-zero)

## מטרה

לחסוך ~429 ₪/חודש שמייצר שירות ה-Cloud Run `factory-master-actions-mcp` (השער המשותף
בפרויקט-הבקרה). or-aios כבר עצמאית ממנו בזמן-ריצה, ואין מערכת חיה שתלויה בשער בזמן-ריצה —
אז במקום מופע חם 24/7 נותנים לשירות "להירדם" כשאין בקשות. חוסך כמעט את כל העלות, שומר את
בוט הטלגרם + כפתורי האישור + החיבורים האינטראקטיביים חיים (עם עיכוב התעוררות קטן), והפיך מיד.

## שלבים

| # | כותרת השלב | סטטוס | קבצים מושפעים |
|---|---|---|---|
| 1 | שינוי הקונפיג ל-scale-to-zero | in-progress | `scripts/render-mcp-service-yaml.sh` |
| 2 | Deploy אוטומטי + אימות מצב חי | pending | (deploy-mcp-server.yml, push-trigger) |
| 3 | אימות החיסכון בחיוב וסגירה | pending | devplan + changelog fragment |

> סטטוס לכל שלב: `pending` / `in-progress` / `completed`.

---

### שלב 1 — שינוי הקונפיג ל-scale-to-zero

**Acceptance:**
- [x] `render-mcp-service-yaml.sh`: `minScale "1"→"0"`, `cpu-throttling "false"→"true"`,
      `maxScale "1"` + `sessionAffinity "true"` נשמרים.
- [x] הערת-ההסבר מעל השורות עודכנה כדי לא לסתור את המצב החדש (מציינת שהעמידות ל-n8n-live
      מגיעה מ-`SESSION_STORE_ENABLED="1"` / Firestore, לא ממופע-תמידי).
- [ ] CI ירוק (Changelog gates / shellcheck+yamllint / secret-scan / supply-chain).

**הוכחה תפקודית (באותו שלב):** תוכן/קונפיג בלבד — אין לבנת-קוד רצה חדשה. ההוכחה התפקודית
האמיתית היא בשלב 2 (deploy + probe חי), כי שינוי-קונפיג מוכיח את עצמו רק כשהוא נפרס.

**הוכחת E2E (artifact):** לא-התנהגותי — לא נוגע בקבצי-התנהגות של בוט מערכת
(`templates/system/workflows/n8n/*.json` / `configure-agent-router.yml`). זהו קונפיג-השער עצמו,
ולכן גם שער ה-E2E-proof-על-or-edri-4 אינו חל כאן.

---

### שלב 2 — Deploy אוטומטי + אימות מצב חי

**Acceptance:**
- [ ] merge ל-main → `deploy-mcp-server.yml` נפרס דרך ה-push-trigger (הנתיב
      `scripts/render-mcp-service-yaml.sh` בו). לא להריץ ידנית במקביל.
- [ ] `inspect_cloud_run` מראה `minScale=0` על הרוויזיה החדשה.
- [ ] `probe_endpoint` על `/health` של השער מחזיר 200 (מתעורר מאפס).
- [ ] בוט הטלגרם/אישורים עדיין עונים (webhook חי אחרי cold-start).

**הוכחה תפקודית (באותו שלב):** probe חי של `/health` שחוזר 200 אחרי idle + אימות
`inspect_cloud_run` שהאנוטציה `minScale=0` נחתה.

**הוכחת E2E (artifact):** לא-התנהגותי.

---

### שלב 3 — אימות החיסכון בחיוב וסגירה

**Acceptance:**
- [ ] אחרי 24–48ש' (lag של billing export): `get_billing_costs(groupBy=service)` מראה ששורת
      Cloud Run של `factory-master-actions-mcp` צנחה. (הכלי חסום ב-session web → יורץ מטרמינל.)
- [ ] התוצאה המאומתת נרשמת ב-fragment; `status: completed`.

**הוכחה תפקודית (באותו שלב):** מספר החיוב לפני מול אחרי, מ-`get_billing_costs`.

**הוכחת E2E (artifact):** לא-התנהגותי.

---

## הערות אמת
- ה-429₪ לא אומת מחדש חי בשיחה שבה נפתח הפיתוח (`get_billing_costs` חסום ב-connector של web) —
  יאומת בשלב 3 מ-session טרמינל.
- Rollback: להחזיר `minScale "1"` + `cpu-throttling "false"` → redeploy. דקות.
- פרישת or-edri-4 היא מעקב-המשך **נפרד ואופציונלי** (חוסך עלות Railway משלה, הרסני-ידני,
  אישור-אור נפרד) — **אינה נדרשת** לחיסכון הזה כי scale-to-zero משאיר את משטחי or-edri-4 חיים.
