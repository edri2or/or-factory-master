## חידוד כלל ה-connector-gate (תובנת /dev-insights מפיתוח nuriel-coordinator)

חידוד תיעוד שנולד מ-`/dev-insights` על פיתוח `nuriel-coordinator`: סעיף ה-"Web-session connector gate"
ב-`CLAUDE.md` הבהיר עד כה ששני כלים (`dispatch_workflow`, `list_repos`) חסומים בשער-המחבר של
claude.ai, ומכך השתמע (בטעות) שכל כלי-כתיבה נחסם.

**התובנה (מוכחת חי):** השער הוא **לפי שם-כלי**, לא לפי סמנטיקת-כתיבה. כלי-MCP כתיבה **מותאם וצר** —
`route_to_agent` על `/coordinator/<repo>/mcp`, שהגיע דרך connector — **עבר** את השער ודיספּטץ' את
`agent-action.yml` בהצלחה (broker run `27788706190`, `triggering_actor=factory-master-broker[bot]`,
commit-תוצאה ב-`edri2or/nuriel`), בניגוד להנחה (כולל חיזוי מפורש לפני-הבדיקה) שכל כתיבה חסומה.

- **`CLAUDE.md`** — בּוּלֶט חדש בסעיף ה-connector-gate: השער לפי שם-כלי; אל תניח שכלי-כתיבה חדש/מותאם
  חסום — אמת חי; cross-link ל-`docs/mcp-connector-setup.md` › "Coordinator connector — Nuriel's door".

תיעוד-אמת בלבד (אין שינוי קוד). מונע מסשן עתידי לפסול בטעות ערוץ-עבודה תקֵף.
