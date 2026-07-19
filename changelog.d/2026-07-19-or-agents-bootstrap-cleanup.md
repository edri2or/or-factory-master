# or-agents-bootstrap cleanup — הסרת כלי-ההקמה החד-פעמי

`bootstrap-system-infra.yml` + `scripts/copy-generic-secrets.sh` מולאו את תפקידם: הם העמידו את תשתית
`or-agents` (פרויקט GCP + WIF + זהויות + 73 סודות + משתני-ריפו), וה-runtime שלה נפרס ואומת חי
(Railway 6/6, מסלול n8n חי). לפי החלטת Or (2026-07-18) הכלי היה חד-פעמי — **מוסר עכשיו** כדי לכבד את הקיפול:
factory לא חוזר להיות מכונת-ייצור קבועה. אם תידרש מערכת עתידית, שני הקבצים ניתנים לשחזור מהיסטוריית git
(`be9fc99~1` / `efabc3d~1`) בדיוק כפי שהתחלנו כאן.

תוכנית הפיתוח `devplans/or-agents-bootstrap.md` נסגרה `status: completed`.
