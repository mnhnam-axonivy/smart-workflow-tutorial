# Conversation Memory

By default, each `AgenticProcessCall` is stateless — it processes a single message and forgets everything. **Conversation Memory** gives an agent access to its full conversation history on every turn, enabling coherent multi-turn dialogues.

---

> **Where to see it in action:** Feature 13 ([Human in the Loop]) uses `aiMemoryId` as a required part of its pattern — the invoice approval agent suspends mid-task while a human provides a written justification, then resumes with that input. That process is the best live example of `aiMemoryId` at work. See `tutorial/processes/tutorial/features/Feature13.p.json`.
>
> ![Feature 12 data class](cms:/Files/Images/feature12-00)

---

## Before you start

Stateless agents answer each question in isolation. If a user asks "what was that price again?" or "can you refine your previous answer?", a stateless agent cannot respond — it has no record of the earlier exchange. Conversation memory solves this by storing the full message history and injecting it into every subsequent LLM call.

---

## How does it work?

Add a field named exactly **`aiMemoryId`** (type `String`) to your process data class. The framework recognises this field by name and automatically:

1. Generates a unique memory ID for the conversation on the first agent call
2. Writes the ID to `in.aiMemoryId`
3. Reads `in.aiMemoryId` before every subsequent call
4. Loads the stored message history and prepends it to the LLM request

Three storage backends are available:

| Memory Type | Storage | Use case |
| --- | --- | --- |
| `IvyVolatileStore` | JVM memory | Default — development or single-server |
| `IvyMemory` | Ivy case/process data | Process-scoped conversation |
| `BusinessDataMemory` | Ivy Business Data (DB) | Production — survives restarts, cross-session |

---

## Why use it?

- **Multi-turn dialogues** — users can refer back to earlier messages ("what was that price again?")
- **Context-aware follow-ups** — agents can refine, summarise, or elaborate on previous answers
- **Wizard-style flows** — collect information over several turns before taking action
- **Zero code** — no Java implementation required, just the `aiMemoryId` field

---

## Step 1 — Add aiMemoryId to the data class

Add a `String` field named exactly `aiMemoryId` to your process data class:

```json
{ "name": "aiMemoryId", "type": "String" }
```

> The field name is a **framework convention**. It must be spelled exactly `aiMemoryId`. The framework will not pick up a differently named field.

---

## Step 2 — Run the agent

No changes to the `AgenticProcessCall` element are needed. Memory is fully automatic once `aiMemoryId` is present in the data class.

**First process instance:** a memory ID is generated and written to `in.aiMemoryId`. The exchange (user message + agent reply) is stored under that ID.

**Next process instance** (e.g. the user sends a follow-up message): pass the same `in.aiMemoryId` from the previous instance. The framework loads the stored history and prepends it to the LLM request — the agent remembers the full conversation.

> Keep `in.aiMemoryId` stable across all turns of a conversation. Do not reset or regenerate it between calls — that would start a new empty conversation.

---

## How memory works across process instances

The [Human in the Loop] invoice approval process (`Feature13.p.json`) is the clearest demonstration. Everything happens inside a **single process instance** — `aiMemoryId` is the thread that holds the agent's state across the suspension:

```text
1. Process starts — in.aiMemoryId = "" (empty)

2. Agent runs for the first time
   → Framework generates a memory ID and writes it: in.aiMemoryId = "mem-8f3a2c"
   → Agent receives invoice INV-2025-0892 ($12,500)
   → Agent decides the amount exceeds $2,000 — calls askUserFeedback
   → askUserFeedback throws human:decision — agent execution suspends
   → in.aiMemoryId = "mem-8f3a2c" is still held in process data

3. UserTask "Provide feedback for Invoice Approval Agent" appears in the task list
   → Human opens the task and types: "Approved — covered by Q3 infrastructure budget"
   → UserTask output code runs:
        new DecisionMaker("mem-8f3a2c").resolve("Approved — covered by Q3 infrastructure budget")
   → The answer is written into the suspended conversation stored under "mem-8f3a2c"

4. Flow returns to the same ProgramInterface element
   → Agent resumes with in.aiMemoryId = "mem-8f3a2c" — full conversation history intact
   → The suspended askUserFeedback tool call returns the human's answer
   → Agent confirms approval and finishes
   → in.result = "Invoice INV-2025-0892 approved. Reason: Approved — covered by Q3 infrastructure budget."

5. TaskSwitchEvent creates a formal approval task
   → Name: "Invoice INV-2025-0892 Approval"
   → Description: "Justification reason: Approved — covered by Q3 infrastructure budget"
```

Without `aiMemoryId`, step 4 would start a brand-new empty conversation — the agent would have no record of the invoice it was processing and `DecisionMaker.resolve()` would have no memory store to write into.

---

## Configuration reference

| Field | Description |
| --- | --- |
| `aiMemoryId` (data class field) | Unique string identifying the conversation thread. Generated automatically on the first call. Pass it forward on every subsequent request to maintain history. |

---

## Common mistakes

- **Resetting the memory ID between turns** — if `in.aiMemoryId` is cleared or regenerated between process instances, each turn starts with empty history and the agent has no context.
- **Unbounded memory growth** — conversation history is prepended to every LLM call. Long conversations consume increasingly more tokens. Consider summarising history for very long sessions.
- **Using `IvyVolatileStore` in production** — the default volatile store lives only in JVM memory. A server restart or cluster failover wipes all conversations. Use `BusinessDataMemory` for production multi-turn chat.

---

## See also

- [Basic Agent Setup]
- [Human in the Loop]
- [Output Guardrail]
- [Input Guardrail]
- [PII Masking Guardrail]
