## טיפוס-מוצר "ריפו-סוכן" (agent-repo-product) — שלב 5: לולאת ה-refresh ("iterate על ריפו-סוכן חי")

התאום של `refresh-system-agents.yml` לטיפוס ריפו-סוכן — מחיל תיקון-תבנית על ריפו-סוכן קיים
**בלי re-provision**, כדי לאפשר איטרציה זולה (0 קליקים, 0 עלות חדשה) על לוגיקת-העובד.

- **`.github/workflows/refresh-agent-repo.yml` (חדש)** — מופעל על or-factory-master (WIF,
  main-locked, broker SA). קלטים: `agent_repo_name`, `paths` (ברירת-מחדל `.github/workflows/agent-main.yml`),
  `source_ref` (להוכיח שינוי-עובד מענף לפני מיזוג). מנפיק token מתוחם לריפו-היעד בלבד
  (`contents`+`workflows`), משכפל אותו, מעתיק את ה-subpaths המבוקשים מעץ-הפקטורי, ו**דוחף ישירות
  ל-main** (main של ריפו-סוכן כתיב — tradeoff מתועד מ-שלב 3, בניגוד לתאום-המערכת שעובר PR מוגן +
  reimport ל-n8n). אידמפוטנטי (אין diff → אין דחיפה). **מסרב קבצי `.template`** (רינדור-מחדש דורש
  ערכים פר-ריפו — קבצי-האוריינטציה המרונדרים מחוץ ל-scope כאן; היעד הוא ה-`agent-main.yml`
  ה-verbatim). מסרב control/factory. לא על allowlist ה-`dispatch_workflow` (מופעל דרך GitHub API,
  סימטרי ל-`mirror-secret-to-system.yml`) — ללא שינוי משטח-ה-MCP.
- **`templates/agent-repo/.github/workflows/agent-main.yml`** — נוסף `timeout-minutes: 15` ל-job
  של העובד (חוסם ריצה תקועה מלהחזיק runner שעות; שיפור-עמידוּת קטן ובטוח). זה גם ה-diff שעליו
  מוכחת לולאת ה-refresh חיה (push אמיתי, לא רק נתיב ה-no-diff).
- **`tests/golden/agent-repo/MANIFEST.sha256`** — רוענן ל-sha החדש של `agent-main.yml`
  (שער ה-golden-sync דורש זאת באותו diff).
- **`monitoring/registry-exempt.txt`** — `refresh-agent-repo.yml` נוסף (dispatch-only, אין cadence).

נבדק מקומית: yamllint נקי, secret-scan נקי, golden עובר. ההוכחה החיה (refresh ל-`zz-agentrepo-prov1`
→ אימות ש-`timeout-minutes` נחת בקובץ החי) מתבצעת אחרי המיזוג (workflow_dispatch זמין רק מ-main).
אין נגיעה ב-`templates/system/**` ולא בקבצי-התנהגות-בוט-n8n.
