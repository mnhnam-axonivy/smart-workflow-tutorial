# Memory & State

Preserve conversation context across multiple turns using `IvyMemory` or `BusinessDataMemory` so agents maintain coherent multi-turn dialogues.

## What is it?

By default, each `AgenticProcessCall` is stateless — it processes a single message and forgets everything. **Memory** gives an agent a conversation history that is injected into each new LLM call, enabling coherent multi-turn dialogues.

Smart Workflow provides three memory implementations:

| Memory Type | Storage | Lifespan |
|---|---|---|
| `IvyMemory` | Ivy case/process data | Scoped to the Ivy process instance |
| `BusinessDataMemory` | Ivy Business Data (persistent DB) | Survives process restarts; cross-session |
| `IvyVolatileStore` | In-memory map | Session / JVM lifetime only |

## Why use it?

- Build chat-style UIs where users can refer back to earlier messages ("what was that price again?")
- Multi-step workflows where the agent needs context from previous steps
- Agents that collect information over several turns before taking an action
- `BusinessDataMemory` persists across sessions — users can resume a conversation after a browser refresh

## How it works

The memory ID is a string key that uniquely identifies a conversation thread. Multiple agents can share the same memory ID to access the same conversation history — useful in multi-agent pipelines.

Flow: Memory ID set in element → Framework loads previous messages from memory store → History prepended to LLM request → LLM responds with full context → New messages appended to memory store.

## Example

AgenticProcessCall element — memory configuration

```java
// Memory Type:  IvyMemory
// Memory ID:    in.sessionId   (a unique string per conversation)
```

Using IvyMemory (process-scoped)

```java
// The framework handles loading/saving automatically.
// Just configure the Memory Type and a stable Memory ID.
// Example: use a UUID generated at conversation start.

String sessionId = UUID.randomUUID().toString();
// Pass sessionId into the process data, bind it to the Memory ID field.
```

Using BusinessDataMemory (persistent)

```java
// Memory Type: BusinessDataMemory
// Memory ID:   ivy.session().getSessionUser().getName() + "-" + conversationId
// This persists the conversation in the Ivy database even after restart.
```

Multi-turn conversation flow (system prompt)

```text
You are a support assistant. You have access to the full conversation history.
When the user refers to something mentioned earlier (e.g. "that ticket",
"the issue I described"), use the conversation history to understand the reference.
Keep your answers concise.
```

> Keep memory IDs consistent across process steps. If the same user visits multiple pages in a wizard, use the same Memory ID everywhere to give agents the full picture.

## Where to find it

- `smart-workflow/src/com/axonivy/utils/smart/workflow/memory/IvyMemory.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/memory/BusinessDataMemory.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/memory/IvyVolatileStore.java`
- `smart-workflow-demo/processes/  (chat demos use IvyMemory)`

## Key configuration

| Element Field | Description |
|---|---|
| `Memory Type` | Choose `IvyMemory`, `BusinessDataMemory`, or `IvyVolatileStore`. |
| `Memory ID` | Unique string key identifying the conversation thread. Must be stable across turns. |

## Common mistakes

- **Different Memory IDs per turn** — If the Memory ID changes between calls (e.g. a new UUID each time), each turn starts with empty history and the agent has no context. Use a stable ID tied to the user session.
- **Unbounded memory growth** — Conversation history is prepended to every LLM call. Long conversations consume increasingly more tokens. Consider truncating old messages or summarising the history periodically.
- **Using IvyVolatileStore in production** — `IvyVolatileStore` lives only in JVM memory. A server restart or cluster failover wipes all conversations. Use `BusinessDataMemory` for production multi-turn chat.

## See also

- [Basic Agent Setup]
- [Human-in-the-Loop]
- [RAG Chatbot Pipeline]
