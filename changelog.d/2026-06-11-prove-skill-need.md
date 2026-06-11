## prove-skill-need — skill חדש: כורה סשן ל-skills חדשים עם הוכחה במדדים אמיתיים

נוסף slash-command חדש `/prove-skill-need` (`audience: shared`) — תאום ממוקד-skills של
`/dev-insights`. בעוד ש-`dev-insights` מנתב תובנות ל-5 סוגי שיפור (skill חדש הוא רק אחד מהם,
עם מבחן ראיות איכותני), ה-skill הזה כורה סשן (או devplan/JOURNEY נתון) **אך ורק** להזדמנויות
ל-skill חדש, ולכל מועמד בונה **תיק-הוכחה במדדים אמיתיים מדודים** (דרישת המשתמש: "הוכחה עם מדדים
אמיתיים"), כל מספר מצטט ראיה אמיתית (turn / `file:line` / run id). פלט לצ'אט בלבד; לא בונה/כותב
דבר; מעביר מועמדים ששרדו ל-`/skill-research` ואז `/build-skill` רק אחרי אישור.

**שלוש ההוכחות לכל מועמד:**
- **Need** — ספירת מופעים `N` + עלות-למופע ב-tool-calls/steps/turns, עם רצפת Rule-of-Three
  (1×=נזרק, 2×=ניטור-לא-לבנות, ≥3× או ראיה חוצת-סשן=מוכן).
- **Value/ROI** — Before מול After (שכולל את עלות ההפעלה+קריאה של ה-skill עצמו, לעולם לא 0),
  net saving, ו-break-even שכולל מכפיל-בנייה ~פי-3 (רכיב לשימוש-חוזר יקר פי ~3 מחד-פעמי). מחלקת
  מדד שנייה ל-skill נדיר-אך-קריטי (סיכון/שגיאה שנמנעת) כדי ש-skill בטיחות לא ייפסל בגלל תדירות
  נמוכה.
- **Usage / "שלא יפספס אותו"** — מרווח-ניתוב מספרי (5-query routing test + Jaccard מול ה-sibling
  הקרוב האמיתי, יעד ≥0.05) + negative-control query, ואוצר-המילים שמדליק את ה-skill.

דירוג לפי net saving × recurrence (או severity), **לא** לפי ספירת-מופעים גולמית או מספר-מועמדים
(מלכודת מדד-ראווה). אם אין מה למדוד — null מובנה (תוצאה תקינה), בלי להמציא. שער anti-overlap
מנתב ל-`dev-insights` / `session-skill-harvest` / `workflow-to-skill` כשהם הבית הנכון.

**Changes:**
- `.claude/commands/prove-skill-need.md` (חדש).
- `templates/system/.claude/commands/prove-skill-need.md` (מראה, נוצר ע"י `sync-skills-mirror.sh`,
  byte-identical — `audience: shared` נשלח לכל מערכת חדשה).
- `tests/golden/system/MANIFEST.sha256` — רוענן (`check-system-golden.sh --update`) כי המראה תחת
  `templates/system/**`.

**אימות:** `check-skills-mirror.sh` (69 shared/3 factory-only), `check-system-golden.sh`,
`check-golden-sync.sh` — ירוקים. בדיקת-ניתוב: ה-description מנצח את `session-skill-harvest`
באוצר-המילים הייחודי (prove / metrics-backed / proof dossier / ROI / routing margin), מרווח >0.05.
תוכנן וגובה במחקר דרך `/skill-research` (Rule-of-Three, מלכודות ROI מנופח ומדד-ראווה) → `/build-skill`.
