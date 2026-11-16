# Conversation Memory

An agent remembers everything that happens **within one call** — and nothing from any earlier call. This guide explains what an `AgenticProcessCall` keeps in memory, what it does not, and what the `aiMemoryId` field is really for: carrying a **suspended** conversation across a human task.

---

> **Where to see it in action:** Feature 13 ([Human in the Loop]) uses `aiMemoryId` as a required part of its pattern — the invoice approval agent suspends mid-task while a human provides a written justification, then resumes with that input. That process is the live example of `aiMemoryId` at work. See `tutorial/process/tutorial/features/Feature13.p.json`.

---

## Before you start

It is tempting to think of an agent as a chat partner that remembers earlier conversations. In Smart Workflow it is not: an agent is one process step. Every call starts fresh from its System message and User message, which keeps each run predictable and repeatable.

| Scope | Remembered? | How |
| --- | --- | --- |
| **Within one agent call** | Yes — the full conversation, including every tool call and its result | Automatic |
| **Across a suspension** (the agent pauses for a human and resumes) | Yes — the suspended conversation | The `aiMemoryId` field |
| **Between separate agent calls** (another element, another run, another process instance) | No | Pass the context yourself — see below |

---

## Within one call

While an agent works, it keeps the complete message list: the System message, the User message, each tool call it made and each result it got back. That is why an agent can call `lookupApprovalPolicy`, then `chooseApprover`, and combine both results in its answer (see [Callable Process Tools]).

This list grows with every tool call and has **no cap**. Each new model request sends the whole list again, so a long tool loop gets more expensive with every step. Keep tool lists tight and tool results small.

---

## Between calls: nothing is carried over

When the agent finishes, its conversation is gone. The next call — the same element in a new run, or another agent later in the same process — knows only its own System message, its own User message, and whatever its tools return.

If a later agent needs something an earlier one produced, hand it over explicitly:

- **Through process data** — map the first agent's result to a field and reference it in the next agent's User message, for example `<%=in.summary%>`.
- **Through a tool** — give the agent a tool that loads what it needs, such as the earlier messages of a support case.

> **Building a multi-turn chat?** Smart Workflow 14.0.0 has no built-in chat history across calls. Store the earlier turns yourself (in process data or business data) and pass them to the agent in the User message on every turn.

---

## aiMemoryId — the suspend/resume handle

There is one situation in which a conversation must survive beyond a single pass through the element: the agent pauses for a human in the middle of its work ([Human in the Loop]). For this, the framework looks for a field named exactly **`aiMemoryId`** (type `String`) in your process data class:

1. While the agent runs normally, the field stays empty.
2. When a tool **suspends** the agent by throwing a BPM error, the framework stores the conversation so far and writes its ID into `in.aiMemoryId`.
3. When the flow re-enters the **same** `AgenticProcessCall` element and `in.aiMemoryId` has a value, the framework restores the stored conversation and continues it. The System message and User message of the element are **not** sent again.
4. When the agent completes, the stored conversation is deleted and `in.aiMemoryId` is cleared.

> **Important:** `aiMemoryId` is a suspend/resume handle, **not** a conversation history feature. Smart Workflow fills it in and clears it on its own.
>
> **Do not set it yourself.** An agent that starts with a value in `aiMemoryId` treats the call as a resumption: your System message and User message are both ignored, so the question you meant to ask is never sent.

---

## Step 1 — Add aiMemoryId to the data class

![Feature12Data data class — the aiMemoryId field is highlighted](cms:/Files/Images/feature12-00)

Add a `String` field named exactly `aiMemoryId` to your process data class:

```json
{ "name": "aiMemoryId", "type": "String" }
```

> The field name is a **framework convention**. It must be spelled exactly `aiMemoryId`. The framework will not pick up a differently named field — and it does not report the problem: the ID is simply never stored.

---

## Step 2 — Run the agent

No change to the `AgenticProcessCall` element is needed — its configuration has no setting for memory. The field in the data class is all it takes.

Run the [Human in the Loop] process (`Feature13.p.json`) with the high-value invoice. The agent cannot finish on its own: it asks a person and is suspended. At that moment Smart Workflow stores the conversation and writes its ID into `in.aiMemoryId`.

---

## Step 3 — Verify: trace the memory ID

The [Human in the Loop] invoice approval process (`Feature13.p.json`) shows the whole life cycle. Everything happens inside a **single process instance** — `aiMemoryId` is the thread that holds the agent's state across the suspension:

```text
1. Process starts — in.aiMemoryId = "" (empty)

2. Agent runs for the first time
   → in.aiMemoryId is still empty — the agent is working normally
   → Agent receives invoice INV-2025-0892 ($12,500)
   → Agent decides the amount exceeds $2,000 — calls askUserFeedback
   → askUserFeedback throws human:decision — agent execution suspends
   → Framework stores the conversation and writes its ID:
        in.aiMemoryId = "6407c9bd-be10-4334-9ca9-c9b846fc1f57"

3. UserTask "Provide feedback for Invoice Approval Agent" appears in the task list
   → Human opens the task and types: "Approved — covered by Q3 infrastructure budget"
   → UserTask output code runs:
        new DecisionMaker(in.aiMemoryId).resolve("Approved — covered by Q3 infrastructure budget")
   → The answer is written into the suspended conversation as the result of askUserFeedback

4. Flow returns to the same AgenticProcessCall element
   → in.aiMemoryId has a value — the framework restores the conversation instead of starting a new one
   → The suspended askUserFeedback tool call returns the human's answer
   → Agent confirms approval and finishes
   → in.result = "Invoice INV-2025-0892 approved. Reason: Approved — covered by Q3 infrastructure budget."
   → The stored conversation is deleted and in.aiMemoryId = "" again

5. TaskSwitchEvent creates a formal approval task
   → Name: "Invoice INV-2025-0892 Approval"
   → Description: "Justification reason: Approved — covered by Q3 infrastructure budget"
```

Without the `aiMemoryId` field, step 2 cannot store the ID, so `DecisionMaker.resolve()` in step 3 finds no suspended conversation and fails with an `IllegalStateException`.

---

## Configuration reference

| Field | Description |
| --- | --- |
| `aiMemoryId` (data class field) | Handle of a suspended agent conversation. Written by the framework when a tool suspends the agent, cleared when the agent completes. Never set it yourself. |

---

## Common mistakes

- **Using `aiMemoryId` as chat history** — it does not make an agent remember earlier calls. It only exists between a suspension and the resumption that follows.
- **Pre-setting `aiMemoryId`** — a value in the field turns the call into a resumption: the System message and User message are ignored. Leave the field to the framework.
- **Resetting the memory ID between turns** — if `in.aiMemoryId` is cleared after the person has answered and before the flow returns to the agent, the agent cannot find its suspended conversation. It starts from nothing, reads the invoice as if for the first time, and asks the same question again.
- **Expecting an agent to know what an earlier agent did** — every call is self-contained. Pass earlier results through the User message or a tool.
- **Missing or misspelled field** — the framework silently skips storing the ID, and the agent cannot be resumed.
- **Unbounded growth within a call** — the message list grows with every tool call and is sent again on every model request. Long tool loops consume more and more tokens.

---

## See also

- [Basic Agent Setup]
- [Callable Process Tools]
- [Human in the Loop]
