## טעינת טוקן Google מחדש בכל פריסה (workspace-token-reload)

תיקון באג: חידוש (re-consent) של טוקן Google המשותף לא נכנס לתוקף עד ש-Workspace-MCP sidecar
מאותחל, אבל `gcloud run services replace` עם אותו commit/config הוא no-op ב-Cloud Run (אין
revision חדש, אין restart) — אז פריסה חוזרת על אותו commit השאירה את ה-sidecar עם הטוקן הישן.
נוסף `DEPLOY_NONCE` (`${GITHUB_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}`) שנפלט ל-template
ב-`scripts/render-mcp-service-yaml.sh`, מחושב פעם אחת ב-`deploy-mcp-server.yml` ומועבר ל-render:
כל פריסה משנה את ה-template → Cloud Run יוצר revision חדש → ה-sidecar קורא מחדש את
`gmail-oauth-refresh-token:latest`. כך חידוש טוקן (למשל אחרי שינוי סיסמת Google שמבטל טוקנים עם
הרשאות Gmail) תמיד נכנס לתוקף בפריסה הבאה, ולא נשאר תקוע בטוקן boot-time מבוטל.
