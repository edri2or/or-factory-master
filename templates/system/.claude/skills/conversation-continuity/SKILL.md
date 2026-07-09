---
name: conversation-continuity
description: "Maintains a live context-file on disk (sessions/context/<slug>.md) — a single source of truth recording the goal, decisions, open points, timeline, and current state, so Claude stays consistent and can prove it remembers the whole conversation. The file is a real file Claude creates, reads, and updates with the file tools — not a block dumped into the chat. On every update Claude reads the file from disk in full and verifies it against the conversation before writing, to prevent memory drift. Activate immediately whenever the user wants Claude to remember, track, or lock the conversation context. Explicit Hebrew triggers — תזכור את השיחה, תעקוב אחרי השיחה, צור קובץ קונטקסט, תעדכן את הקובץ, תוכיח שאתה זוכר, נעל את ההקשר, /continuity. Explicit English triggers — track this conversation, remember our session, create a context file, update the context file, prove you remember, lock the context. Implicit triggers (activate on these too) — when the user says the conversation has become murky or messy and he wants Claude to remember (כשהשיחה נעשתה עכורה או מבולגנת), when he asks to lock context mid-way through a long conversation, or when he wants to make sure Claude is still consistent with what was agreed earlier. Distinction — this is a skill for consistency and continuity WITHIN the current conversation only; it does not hand the context off to another chat (that is a separate job, conversation-handoff). Do not activate for a simple factual question unrelated to conversation memory."
---

# Conversation Continuity

The skill's purpose: to maintain a **live context-file** — a structured source of truth that records the conversation's progress. The file is a working tool Claude uses to stay consistent, not a deliverable for the user.

The core principle, grounded in research on memory drift in LLM agents: long conversations degrade because the model loses focus on constraints, accumulates errors, and trusts what it wrote earlier instead of verifying. The solution is **verification-gated writing**: before every write to the file, read it in full **and verify it against the conversation itself** — don't trust the file's memory, verify against the source.

**The context-file is a real file on disk** — `sessions/context/<slug>.md` in the repo — that Claude creates and updates with the file tools (Write / Read / Edit). It is **not** a text block dumped into the chat. This is the professional upgrade: the state lives in one durable place Claude can re-open and work with directly, instead of being buried and re-emitted in the conversation window.

---

## Where the file lives

- **Path:** `sessions/context/<slug>.md` (create the `sessions/context/` directory if it doesn't exist — a `Write` to the path creates it).
- **`<slug>`:** a short kebab-case summary of the conversation topic (e.g. `push-notifications`, `invoice-flow`). Choose it on the first run and **reuse the same path for the whole conversation** — remember the path you created.
- **Finding the latest file on an update:** if you already know the path this session, use it. If not (e.g. after compaction), list the directory and pick the most recently modified — `ls -t sessions/context/*.md | head -1` — and confirm from its content that it's this conversation's file before appending to it.
- **Session-scoped, not committed.** `sessions/context/` is git-ignored — the file is a working file for the current session, not a project artifact, so it never pollutes commits or PRs. It lives for the session; there is no dependency on cross-session persistence.

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
- [החלטה] — כי [הנימוק]  ⟨מקור: "…ציטוט קצר במילים של אור…"⟩
- ~~[החלטה שבוטלה]~~ (הוחלף ב: [ההחלטה החדשה])
- ...

❓ נקודות פתוחות
- [מה לא הוכרע / ממתין]  ⟨מקור: "…ציטוט קצר…"⟩
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

**Verbatim anchoring (the `⟨מקור: "…"⟩` tag).** For the drift-critical fields only — decisions,
hard constraints, and open points — carry a **short exact quote** of what the user actually said,
not only your paraphrase. This is the single highest-value guard against drift: a controlled
ablation on long-conversation memory found that paraphrasing a constraint ("prefers type hints"
instead of the operator's "use type hints everywhere") collapses exact-match accuracy on
constraint questions from ~91% to ~14% — a 77-point gap. Keep the quote short, and use it **only**
on those critical items — never on the whole timeline (that would bloat the file). The quote
doubles as provenance: it shows where the decision came from.

**Supersede, never silently delete.** When a decision is reversed or an open point resolved, do
not just remove the line — strike it and record what replaced it (`~~[החלטה]~~ (הוחלף ב: …)`).
Silent deletion is over-aggressive compaction: it destroys the non-contradiction trail and hides
the fact that something changed. (This mirrors the system's own durable-memory doctrine —
update = supersede, never delete.)

---

## When to build, when to update

There are three activation modes. Identify the right one from the context:

**A. First run — building the file.** No context-file exists yet for this conversation. Go over the entire course of the conversation from the beginning up to the current moment, fill in all the fields, and **`Write` the file to `sessions/context/<slug>.md`**. This applies **even if you were activated mid-way through a long conversation** — in that case it is precisely critical to reconstruct everything that happened so far and prove that you remember from the start.

**B. Update.** A context-file already exists on disk. The user activated the skill again, said "תעדכן את הקובץ", or reached a natural point to update. **`Read` the file first**, run the verification protocol (below), then write the moved fields back (Edit the changed sections, or Write the whole updated file) and present the proof.

**C. Locking context mid-way.** The user says the conversation has become murky and he wants you to remember, or explicitly asks to "נעל את ההקשר". This is like a first run if there is no file, or like an update if there is — in both cases with heightened emphasis on a full proof of what happened up to this point.

---

## The verification protocol (the heart of the skill)

**Never update the file without reading it from disk in full first.** This is not a formality — it is the mechanism that prevents drift. The order is always:

1. **Read** the entire latest context-file **from disk** (`sessions/context/<slug>.md`). This is the point of the on-disk upgrade: you re-open the real last state, you don't rely on a block scrolled far up the chat.
2. **Read the new turns since the last update.** Locate where the last update stopped by its
   **content** — the last "📍 מצב נוכחי" line or the last "מה השתנה לאחרונה" entry in the file —
   and match it against the conversation, rather than trusting a numeric turn count (a model does
   not count turns reliably). Everything after that anchor is the new material; read it and fold it
   into the fields and into "מה השתנה לאחרונה". This is the incremental, cheap default that
   guarantees you capture what actually happened since last time — exactly what the user means by
   "read the last state and add the development from there".
3. **Verify** — run the grounding test on each field. Three checks per field: (a) **grounded** —
   is it backed by something actually said in the conversation? (b) **not contradicted** — has a
   later turn reversed or changed it? (if so, supersede it, don't keep both) (c) **not invented** —
   are you writing it because it was said, or because it sounds plausible? Content that fails a
   check — fix it, don't preserve an error. By default this pass is *light* (focus on the fields
   the new turns touched); run the **full** re-verification against the whole conversation on a
   trigger, at intervals in a long session, or whenever you suspect drift.
4. **Write** the moved fields back to the file (Edit the changed sections, or Write the full file), and in particular fill in "מה השתנה לאחרונה" and bump "עודכן".
5. **Present** a short proof in the chat (concise by default) — see below. The full file stays on disk; you do **not** paste it back into the conversation.

Do not inject information into the file that was not stated in the conversation. If you are not sure something was agreed — mark it as an open point, don't set it down as a decision.

---

## The proof mechanism — two levels

The proof is a short chat message showing the user you read and verified, not just wrote — and it also tells him **where the file is**, so he keeps a sense of control without you dumping the whole file into the chat. Two levels:

### Default: concise proof

After every update, present a short anchor-proof — 3–5 key points that show you remember the course of the conversation, a "what changed" line, and the file path. Format:

```
✓ נעלתי הקשר. אני זוכר:
• [נקודת מפתח 1]
• [נקודת מפתח 2]
• [נקודת מפתח 3]
מה השתנה מאז: [דלתא]
📋 הקובץ: sessions/context/<slug>.md
```

### On trigger: full proof

When the user says "תוכיח לעומק", "הוכחה מלאה", "תעבור על הכל", or expresses doubt that you remember — switch to the strong level: reconstruct the **entire timeline turn-by-turn** and verify each point against the conversation explicitly. Slower, but a full lock. Use this on your own initiative too if the conversation is especially long and the risk of drift is high.

The default is always the concise one — don't switch to full without a trigger or a clear drift risk.

---

## The no-flow-interruption rule

This skill runs in the background and serves the conversation — it does not take it over. After you write the file and present the proof, **return immediately to the topic of the conversation**. Don't ask the user to approve the file, don't ask "what now", and don't turn the update into an event. A good update is almost imperceptible: the user sees that you remembered (and where the file is), and you both carry on.

The only exception: on a first run or an explicit lock, the user likely expects confirmation that the file is set up — there you do pause briefly to present the path and a fuller proof.

---

## Why a file, not a chat block

A file on disk fixes the "lost in the middle" weakness of the old chat-block approach: models recall the start and end of a long context far better than the middle, so a context block written early gets buried and mis-recalled as the conversation grows. The on-disk file sidesteps this entirely — the source of truth is re-opened from disk on every update, never trusted from memory or from a scrolled-away block. Keep "📍 מצב נוכחי" as one short, unmissable line — it is the single most important thing to carry forward, so it must never be diluted into a paragraph.

---

## Truth discipline

The context-file is a factual record of the conversation, and "I remember X" is a factual claim.
Under the truth-protocol discipline: every line reflects what was **actually said** this session —
never inject a goal, decision, or rationale that wasn't stated. If you're unsure whether something
was agreed, verify against the conversation before writing it, or leave it out and say
"אין באפשרותי לאשר זאת" rather than inventing a decision. See the `truth-protocol` skill.

---

## Short example

**First run, mid-conversation about planning an app:**

The user: "תזכור את השיחה, היא נהיית ארוכה."

Response: reconstruct the full file from the start of the conversation (goal: app X; decisions:
chose React because… ⟨מקור: "בוא נלך על React, הצוות כבר מכיר"⟩, rejected Vue because…; open points:
main-screen design; timeline: 4 steps; current state: deliberating on navigation), **`Write` it to
`sessions/context/task-app.md`**, then present a short proof:

```
✓ נעלתי הקשר. אני זוכר:
• המטרה: אפליקציית X לניהול משימות
• בחרנו React (דחינו Vue בגלל עקומת הלמידה של הצוות)
• פתוח: עדיין לא הוכרע עיצוב המסך הראשי
מה השתנה מאז: ביסוס ראשוני
📋 הקובץ: sessions/context/task-app.md
```

Then continue straight into the navigation discussion. Without "רוצה שאוסיף משהו?".

**Later, the user says "תעדכן את הקובץ":** `Read` `sessions/context/task-app.md`, find the last
"📍 מצב נוכחי", read the turns since, verify, Edit the moved fields + "🔄 מה השתנה לאחרונה", and
present the concise proof with the delta — the file on disk now carries the whole development,
nothing lost.
