---
name: conversation-continuity
description: "Maintains a live context-file within the conversation — a single source of truth recording the goal, decisions, open points, timeline, and current state, so Claude stays consistent and can prove it remembers the whole conversation. On every update Claude reads the file in full and verifies it against the conversation before writing, to prevent memory drift. Activate immediately whenever the user wants Claude to remember, track, or lock the conversation context. Explicit Hebrew triggers — תזכור את השיחה, תעקוב אחרי השיחה, צור קובץ קונטקסט, תעדכן את הקובץ, תוכיח שאתה זוכר, נעל את ההקשר, /continuity. Explicit English triggers — track this conversation, remember our session, create a context file, update the context file, prove you remember, lock the context. Implicit triggers (activate on these too) — when the user says the conversation has become murky or messy and he wants Claude to remember (כשהשיחה נעשתה עכורה או מבולגנת), when he asks to lock context mid-way through a long conversation, or when he wants to make sure Claude is still consistent with what was agreed earlier. Distinction — this is a skill for consistency and continuity WITHIN the current conversation only; it does not hand the context off to another chat (that is a separate job). Do not activate for a simple factual question unrelated to conversation memory."
---

# Conversation Continuity

The skill's purpose: to maintain a **live context-file** — a structured source of truth that lives inside the current conversation and records its progress. The file is a working tool Claude uses to stay consistent, not a deliverable for the user.

The core principle, grounded in research on memory drift in LLM agents: long conversations degrade because the model loses focus on constraints, accumulates errors, and trusts what it wrote earlier instead of verifying. The solution is **verification-gated writing**: before every write to the file, read it in full **and verify it against the conversation itself** — don't trust the file's memory, verify against the source.

The file is not a file on disk. It is stored as a structured text block **inside the conversation** (within Claude's replies), so it is always available as long as the conversation is open and is reconstructed from the history on every run. There is no dependency on cross-session memory.

---

## The structure of the context-file

Always use this exact structure. All headings stay in Hebrew. If a field is empty — write "—", don't omit it.

```
═══════════════════════════════════
📋 קובץ-קונטקסט — [נושא השיחה בקצרה]
עודכן: [תור #N]
═══════════════════════════════════

🎯 מטרת השיחה
[מה אנחנו מנסים להשיג, 1–2 משפטים]

✅ החלטות שהתקבלו
- [החלטה] — כי [הנימוק]
- ...

❓ נקודות פתוחות
- [מה לא הוכרע / ממתין]
- ...

🕐 ציר-זמן
1. [תור/שלב] — [מה קרה בקצרה]
2. ...

📍 מצב נוכחי
[איפה אנחנו עכשיו בדיוק — המשפט שהכי חשוב לדעת כדי להמשיך]

🔄 מה השתנה לאחרונה
[הדלתא מאז העדכון הקודם. בהפעלה ראשונה: "ביסוס ראשוני"]
═══════════════════════════════════
```

The "מה השתנה לאחרונה" field is the drift-detection mechanism: it forces an explicit identification of what moved, before the drift accumulates silently.

---

## When to build, when to update

There are three activation modes. Identify the right one from the context:

**A. First run — building the file.** There is no context-file in the conversation yet. Build it from scratch: go over the entire course of the conversation from the beginning up to the current moment, fill in all the fields, and present the full file. This applies **even if you were activated mid-way through a long conversation** — in that case it is precisely critical to reconstruct everything that happened so far and prove that you remember from the start.

**B. Update.** A context-file already exists. The user activated the skill again, said "תעדכן את הקובץ", or reached a natural point to update. Run the verification protocol (below) and then present the updated file + proof.

**C. Locking context mid-way.** The user says the conversation has become murky and he wants you to remember, or explicitly asks to "נעל את ההקשר". This is like a first run if there is no file, or like an update if there is — in both cases with heightened emphasis on a full proof of what happened up to this point.

---

## The verification protocol (the heart of the skill)

**Never update the file without reading it in full first.** This is not a formality — it is the mechanism that prevents drift. The order is always:

1. **Read** the entire latest context-file from the conversation (find the last block you wrote).
2. **Verify** each field against the real course of the conversation: is the goal still accurate? Was each decision actually made? Is anything in the file no longer true? Content that does not match the conversation — fix it, don't preserve an error.
3. **Update** the fields that moved, and in particular fill in "מה השתנה לאחרונה".
4. **Present** the updated file + proof (concise by default).

Do not inject information into the file that was not stated in the conversation. If you are not sure something was agreed — mark it as an open point, don't set it down as a decision.

---

## The proof mechanism — two levels

The proof is how you show the user that you read and verified, not just wrote. Two levels:

### Default: concise proof

After every update, present a short anchor-proof — 3–5 key points that show you remember the course of the conversation, then a "what changed" line. This is fast and doesn't interrupt the flow. Format:

```
✓ נעלתי הקשר. אני זוכר:
• [נקודת מפתח 1]
• [נקודת מפתח 2]
• [נקודת מפתח 3]
מה השתנה מאז: [דלתא]
```

### On trigger: full proof

When the user says "תוכיח לעומק", "הוכחה מלאה", "תעבור על הכל", or expresses doubt that you remember — switch to the strong level: reconstruct the **entire timeline turn-by-turn**, and verify each point against the conversation explicitly. Slower, but a full lock. Use this on your own initiative too if the conversation is especially long and the risk of drift is high.

The default is always the concise one — don't switch to full without a trigger or a clear drift risk.

---

## The no-flow-interruption rule

This skill runs in the background and serves the conversation — it does not take it over. After you present a file and proof, **return immediately to the topic of the conversation**. Don't ask the user to approve the file, don't ask "what now", and don't turn the update into an event. A good update is almost imperceptible: the user sees that you remembered, and you both carry on.

The only exception: on a first run or an explicit lock, the user likely expects to see the full file and get confirmation that you're done — there you do pause briefly to present.

---

## Short example

**First run, mid-conversation about planning an app:**

The user: "תזכור את השיחה, היא נהיית ארוכה."

Response: build the full file from the start of the conversation (goal: app X; decisions: chose React because…, rejected Vue because…; open points: main-screen design; timeline: 4 steps; current state: deliberating on navigation), present it, then:

```
✓ נעלתי הקשר. אני זוכר:
• המטרה: אפליקציית X לניהול משימות
• בחרנו React (דחינו Vue בגלל עקומת הלמידה של הצוות)
• פתוח: עדיין לא הוכרע עיצוב המסך הראשי
מה השתנה מאז: ביסוס ראשוני
```

Then continue straight into the navigation discussion. Without "רוצה שאוסיף משהו?".
