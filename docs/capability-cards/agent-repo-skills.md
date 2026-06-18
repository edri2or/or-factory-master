# Capability Card — agent-repo-skills

> Capability-first proof for the **skills-native** principle of the
> `nuriel-knowledge-action` development: **can a Claude Code session running in an
> agent-repo actually load and invoke a SKILL (`.claude/commands/<name>.md` / `/<name>`),
> and can the headless worker (`agent-main.yml`)?** This must be a recorded go/no-go
> **before** we build skills onto the fleet — skills in agent-repos are a capability the
> factory has never proven (an agent-repo is born today with **no** `.claude/commands` at all).
>
> NOTE: this is a factory orchestration/Claude-Code capability, not an n8n mould workflow,
> so `scripts/check-capability-card.sh` (which scans `templates/system/workflows/n8n/`) does
> **not** gate it. This card is the recorded go/no-go per the capability-first *process* rule
> in `CLAUDE.md`.

| יכולת (capability) | הוכחה גולמית (מחוץ לאבסטרקציה) | fixture אמיתי | פלט מצופה | הכרעה | סיכונים / הנחות |
|---|---|---|---|---|---|
| **(A) An interactive coordinator session (Nuriel)** loads a repo-local `.claude/commands/<name>.md` and invokes it as a `/<name>` skill | Nuriel is reached as **Claude Code on the web** on `edri2or/nuriel` (the repo is checked out). Claude Code surfaces every `.claude/commands/*.md` in the working repo as an available skill + exposes the `Skill` tool — the **identical** mechanism by which this factory session sees `.claude/commands/*.md` (e.g. `/dev-stage`). Land a skill on `nuriel` → it surfaces in Or's session | a real `/lead-dev` (or `/delegate`) skill landed on `edri2or/nuriel`, invoked from Or's nuriel session | the skill's instructions take effect (Nuriel follows them — e.g. `/delegate` shapes the `route_to_agent` hand-off) | **go** (mechanism-grounded; **live-confirmed in שלב 4** from Or's nuriel session) | (1) The skill is read-only instructions — it cannot widen Nuriel's tools; the narrow `/coordinator` route + RED gate are unchanged. (2) Live confirm in שלב 4 — not assumed. |
| **(B) The headless worker (`agent-main.yml`)** invokes a `/<name>` skill | The worker runs `claude_args: --model … --max-turns 12 --allowedTools Read,Grep,Glob --disallowedTools Bash,Edit,Write,MultiEdit,NotebookEdit,WebFetch,WebSearch` (`templates/agent-repo/.github/workflows/agent-main.yml:92`). The **`Skill` tool is NOT in the allowlist** → a non-interactive run cannot invoke a skill; the worker also has **no `.claude/commands`** and **no usable MCP** (factory `/mcp` needs gateway auth a headless run lacks; MCP tool names aren't in `--allowedTools`) | the as-shipped worker config | a `/skill` invocation is **denied** (tool not permitted) | **no-go (as-shipped)** | Making workers skills-native = a deliberate worker-config change (add `Skill` to `--allowedTools`) touching the read-only safety contract → **out of scope here; flagged as a future capability-first change.** Until then the inter-agent protocol is enforced **Nuriel-side** (a skill that shapes the hand-off) + embedded in each worker's **persona/AGENTS** (read as orientation, not invoked). |

verdict: go for (A) the interactive coordinator session (skills-native Nuriel) — live-confirmed in שלב 4; no-go for (B) the headless worker as-shipped (documented limit; future change)

## מה זה אומר לעיצוב (the design consequence)

- **נוריאל (וכל סשן-סוכן אינטראקטיבי) הוא skills-native** — בונים לו `.claude/commands/*.md`
  (מנכ"ל: `/lead-dev`, `/delegate`, `/report-to-or`) ונוחתים על הריפו החי. זה הליבה של עיקרון 3.
- **החיילים ה-headless אינם skills-native היום.** לכן:
  - **פרוטוקול-המסירה הבין-סוכני** מיושם בצד **נוריאל** — סקיל (`/delegate`) שמעצב את פורמט-המשימה
    היוצאת ומה לצפות בתוצאה. ה-worker לא מריץ סקיל; הוא קורא את ההוראות שבטקסט-המשימה (כ-DATA) ואת
    הפרסונה שלו.
  - **סקיל-התפקיד של כל חייל** נכתב לתוך ה-`AGENTS.md`/הפרסונה שלו (אוריינטציה נטענת בכל ריצה), לא
    כ-`/skill` נפרד שהוא מפעיל.
- **הרחבת החיילים ל-skills-native** (הוספת `Skill` ל-`--allowedTools` ב-`agent-main.yml`) היא שינוי
  עתידי נפרד עם capability-first משלו — בכוונה לא בפיתוח הזה (נוגע בחוזה-הבטיחות קריאה-בלבד של ה-worker).

## Evidence — dog-fooding (שלב 1, broker runs) ✅ PROVEN 2026-06-18

לולאת ה-broker הורצה חיה כ-dog-food (Or אישר את גבול-העלות), בשרשרת L1 מלאה (מחקר→תיעוד),
requester=`nuriel`, שני הצעדים `phase=propose`, classified **green**:

- **מחקר → `natan-research`** — broker run [`27792616149`](https://github.com/edri2or/or-factory-master/actions/runs/27792616149)
  (success), `results/nka-natan-1.json` ב-`nuriel`. נתן החזיר 3 עקרונות לסוכן-מנכ"ל (ניתוב-לפי-כוונה /
  הפרדת-יכולות / הרכבה-בלי-שיפוט) **והיה ישר על בסיס-הראיות** ("היגיון מובנה + אימות-חלקי מ-AGENTS.md;
  אין מסמכי-מחקר בריפו") — בדיוק כלל L2: עבד ביכולתו האמיתית, לא המציא.
- **תיעוד → `sapi-docs`** (משורשר אחרי נתן, כלל L1) — broker run [`27792785963`](https://github.com/edri2or/or-factory-master/actions/runs/27792785963)
  (success), `results/nka-sapi-1.json` ב-`nuriel`. ספי תיעד את ממצאי-נתן לרשומת-6-בלוקים מלאה
  (Admiralty: מקור B / מידע 3 / ביטחון בינוני; סיווג MECE קטגוריה 2 עם נימוק-תיקו; ציין שדות-חסרים)
  — **בלי לחקור ובלי להוסיף**, בדיוק תפקידו.

**מה זה מאשר:** (1) לולאת ה-broker חיה ונקייה (green, requester=nuriel, התוצאות נחתו); (2) שרשרת
L1 (מחקר→תיעוד) עובדת; (3) החיילים פועלים ביכולתם האמיתית והיו ישרים על מגבלותיהם — נתן ציין שאין
לו מסמכי-מחקר חיצוניים בריפו, מה שמאשש את מגבלת-החיילים שמצאנו בקוד: **חייל קורא רק את טקסט-המשימה
+ הריפו של עצמו, לא את הפקטורי**. זה מזין ישירות את חוזה-הניתוב של נוריאל (הוא מוסר לחייל את החומר,
לא שולח אותו "לקרוא בפקטורי").
