---
name: conversation-handoff
description: "Turns the conversation so far into a structured handoff tailored to the next agent — from a context-file if one exists in the conversation, or directly from the conversation if not. The handoff is not a raw copy but a focused briefing that passes only what the next agent needs to continue: goal, state, decisions and their rationale, what to avoid, and the next step. Activate immediately whenever the user wants to move the conversation elsewhere or continue it in a new chat. Explicit Hebrew triggers — תכין הנדאוף, תעביר לצ'אט חדש, נמשיך בשיחה חדשה, תנסח מסירה, תכין הודעת המשך, /handoff. Explicit English triggers — create a handoff, make a handoff, move to a new chat, continue in a fresh session, hand this off, draft a handoff prompt. Implicit triggers (activate on these too) — when the user says he wants to continue somewhere else, that the conversation has gotten too long and needs a clean start (בוא נמשיך את זה איפשהו אחר), or that he is handing the work to another agent or person. Distinction — this hands the context OUT to another chat or agent, unlike conversation-continuity which keeps consistency within the current conversation. Do not activate to update an internal context-file (that is a separate job)."
---

# Conversation Handoff

Purpose of the skill: turn the conversation so far into a **structured handoff** — a ready-to-copy block the user pastes into a new chat (or hands to a person/tool), so the next agent continues immediately without rebuilding the context from scratch.

The core principle, grounded in research on agent-to-agent handoff failures: the big trap is a **context dump** — passing too much raw context. That amplifies noise and loses the decision logic. A good handoff passes **only what the next agent needs for the next step**: goals, constraints, prior decisions with their rationale, and what to avoid. Not a conversation copy, not a dense summary — an operational briefing.

The difference from `conversation-continuity`: there the file stays inside the conversation to preserve consistency. Here the goal is the opposite — to package the context and take it out, to another agent.

---

## Usage flow — four steps

### Step 1 — identify the source

Check whether a **context file** exists in the conversation (the output of the `conversation-continuity` skill — a block with the heading "📋 קובץ-קונטקסט"):

- **Exists** → use it as the basis. Its fields map almost one-to-one to the handoff, so most of the work is already done. Review it and update against the conversation if anything has shifted since.
- **Doesn't exist** → build the handoff directly from the conversation. Go over the conversation from the start and extract the fields yourself.

In both cases — the handoff reflects the **actual state of the conversation**, not assumptions. If something wasn't said, it doesn't go in.

### Step 2 — a clarifying question about the target (only if unclear)

The phrasing of the handoff changes according to **who receives it**. If the target isn't clear from context, ask one short question before phrasing it. Four target types:

- **Claude in another project** — you can refer to tools, skills, and project structure. An "internal" phrasing.
- **Plain Claude / a new chat** — a rich phrasing but without assumptions about specific tools.
- **Another agent (ChatGPT, Gemini, etc.)** — a fully generic phrasing, without Claude-specific terms.
- **A person** — less of a "prompt", more of a readable summary. Omit the opening instruction to the model.

If the target is clear from context (the user said "תעביר ל-ChatGPT" or "אני ממשיך בפרויקט הפיתוח") — skip the question and phrase it directly. Don't ask what's already known.

### Step 3 — phrase the handoff

Use the proven seven-field structure (below). Adapt the depth and terms to the target from Step 2. Keep the principle: only what's needed for the next step.

### Step 4 — delivery

Present the handoff as a **ready-to-copy block** (inside a code block, so it's easy to copy in one go). After the block — just one short line explaining where to paste it. No long preambles.

---

## Handoff structure (seven fields + an opening instruction)

This is the format. Any empty field → "—", don't omit it. The headings are in Hebrew (or in the target's language if the user asked).

```
═══════════════════════════════════
🔄 הנדאוף — [נושא בקצרה]
═══════════════════════════════════

🎯 מטרה
[מה מנסים להשיג. משפט-שניים.]

📍 מצב נוכחי
- הושלם: [...]
- בתהליך: [...]
- נותר: [...]

🧭 הקשר חשוב
[קהל, טון, אילוצים, העדפות, מקורות/קישורים/קבצים מרכזיים, קריטריוני הצלחה]

✅ החלטות שהתקבלו
- [החלטה] — כי [נימוק קצר]
- ...

🚫 מה להימנע
[ניסיונות כושלים, כיוונים שגויים, דברים מחוץ-לתחום — כדי שהסוכן הבא לא יחזור עליהם]

❓ שאלות / חסמים פתוחים
- [מה לא הוכרע]
- ...

▶️ הצעד הבא
[מה לעשות ראשון. ספציפי ואופרטיבי.]

───────────────────────────────────
הוראה לסוכן הבא:
השתמש בהנדאוף הזה כמקור-האמת הנוכחי. התחל בסיכום קצר של ההבנה שלך,
המשך מכאן במקום להתחיל מאפס, ואם חסר משהו קריטי — שאל רק את המינימום הנדרש.
═══════════════════════════════════
```

**The "מה להימנע" (what to avoid) field is the most important one and is usually omitted.** It's what stops the next agent from wasting time on a direction that was already rejected. Don't drop it if there were failed attempts in the conversation.

**The opening instruction** is what turns raw text into a "prompt" the next agent knows to act on. Omit it only when the target is a person.

---

## Anti-context-dump principle

The handoff is **not** a summary of everything said, nor a copy of the conversation. It's a compressed operational state. A simple test for every line: "does the next agent need this to perform the next step?" If not — it doesn't go in.

Raw history feels comfortable because it contains everything — and that's exactly the problem: the next agent has to guess what's still relevant. The handoff separates history from state, and passes only the state.

---

## Short example

**There's a context file in the conversation, and the user says "תכין הנדאוף, אני ממשיך בפרויקט הפיתוח":**

The target is clear (Claude in another project) — skip the clarifying question. Take the context file, map it to the seven fields, and present:

```
═══════════════════════════════════
🔄 הנדאוף — מנגנון התראות באפליקציה
═══════════════════════════════════

🎯 מטרה
להוסיף התראות push לאפליקציית ניהול המשימות.

📍 מצב נוכחי
- הושלם: בחירת ספק (Firebase), אישור ארכיטקטורה
- בתהליך: עיצוב מבנה ההודעה
- נותר: מימוש, בדיקות, פריסה

🧭 הקשר חשוב
צוות קטן, מעדיפים פתרון מנוהל על self-hosted. הקוד ב-React Native.

✅ החלטות שהתקבלו
- Firebase ולא OneSignal — כי כבר משתמשים ב-Firebase ל-auth
- התראות רק על משימות עם deadline — כי החלטנו לא להציף את המשתמש

🚫 מה להימנע
- לא לחזור לרעיון של polling — נדחה כי מבזבז סוללה

❓ שאלות / חסמים פתוחים
- האם לתמוך ב-iOS מההתחלה או רק אנדרואיד?

▶️ הצעד הבא
לסיים את מבנה ה-payload של ההודעה, ואז להתחיל מימוש בצד הקליינט.

───────────────────────────────────
הוראה לסוכן הבא:
השתמש בהנדאוף הזה כמקור-האמת הנוכחי. התחל בסיכום קצר של ההבנה שלך,
המשך מכאן במקום להתחיל מאפס, ואם חסר משהו קריטי — שאל רק את המינימום הנדרש.
═══════════════════════════════════
```

Then one line: "מוכן — הדבק את הבלוק בצ'אט החדש בפרויקט הפיתוח."
