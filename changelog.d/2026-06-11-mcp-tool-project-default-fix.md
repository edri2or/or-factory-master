## תיקון ברירת-המחדל של כלי-MCP לפרויקט-הבקרה החי + תיעוד ה-allowlist של probe_endpoint (mcp-tool-fixes)

שני תיקונים שעלו מ-`/dev-insights` על סשן `google-wallet-unify` (תקלות-כלי שנתקלנו בהן חי):

- **`inspect_cloud_run` + `list_secret_metadata` הצביעו על פרויקט-הבקרה הישן הנטוש `factory-control-9piybr`**
  כברירת-מחדל (כשלא מועבר `project`), ולכן החזירו `403 PERMISSION_DENIED` — והרי אסור לגעת בפרויקט הישן
  (CLAUDE.md:75). תוקן ב-`services/mcp-server/src/tools.ts`: נוסף קבוע מרכזי `CONTROL_PROJECT =
  'or-factory-master-control'` (כמו הדפוס ב-`index.ts:89`), ושתי ברירות-המחדל מצביעות עליו עכשיו (האח
  `tail_cloud_run_logs` כבר היה תקין → drift א-סימטרי). גם `services/mcp-server/scripts/smoke.mjs`
  (סקריפט-עזר ידני, **לא** ב-CI) עודכן לשם-השירות + הפרויקט החיים (`factory-master-actions-mcp` /
  `or-factory-master-control`). דורש פריסה-מחדש של ה-MCP כדי שייכנס לתוקף (הכלים אפויים ב-image).
  הוכחה חיה אחרי הפריסה: `inspect_cloud_run({serviceName:"factory-master-actions-mcp"})` בלי `project`
  → מחזיר רוויזיה, לא 403.
- **תיעוד ה-allowlist של `probe_endpoint`** ב-`CLAUDE.md`: הכלי מוגבל ל-`.or-infra.com`/`.up.railway.app`/
  `.run.app` (הגנת-SSRF מכוונת ב-`services/mcp-server/src/probe.ts` — **לא** מרחיבים). מארחים חיצוניים
  כמו `accounts.google.com` נדחים ב-`allowlist_rejected` → אי-אפשר לאמת כתובת-OAuth חיצונית דרך probe;
  מאמתים דרך המסלול התפקודי החי (consent + `google-mcp-smoke`) או `WebFetch`. (המקור: `/dev-insights`
  חשף שתוכנית `google-wallet-unify` תכננה בשלב 1/6 צעד-אימות-probe לכתובת גוגל שלא ניתן להריץ.)
