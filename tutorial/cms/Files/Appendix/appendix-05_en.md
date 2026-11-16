# Troubleshooting

Start from the symptom. Each entry says what to check and which guide has the detail.

> **Check the log first.** Most problems leave a line in the **Axon Ivy Runtime Log**, and that line usually identifies the cause on its own. Not every problem raises an error: an agent can finish without having answered, leaving only a log line behind.

---

## The agent did not answer

In rough order of how often it is the cause:

1. **The circuit breaker is on.** `AI.CircuitBreaker.Enabled` set to `"true"` stops every AI call in the application. See [Circuit Breaker].
2. **The User message was blank, or failed to expand.** The call is then skipped and the process continues. Look for `Agent call was skipped, since there was no user query`. See *Messages and expressions* below.
3. **A guardrail blocked it.** Blank guardrail fields still inherit the application defaults, so an agent you never configured can still be blocked. See [Output Guardrail].
4. **The result did not map.** The agent ran, but the target field stayed empty. A failed mapping is logged, not thrown, so the process carries on. Look for `Failed to map result to <expression>` — usually a type mismatch between the result type and the target field.
5. **A file emptied the User message.** A CMS file with an unsupported extension takes the whole message down with it and produces the same skipped-call log line as an empty message. See [File Extraction].
6. **No tools were selected**, so the agent could not do what you expected it to do.

---

## The agent answered, but not as expected

1. **It explains what it would do instead of doing it.** Usually no tools are selected — an empty **Available tools** field means the agent has no tools at all. See [Callable Process Tools].
2. **It never calls a tool you expected.** The tool is not selected on the element, the `tool` tag is missing on the `CallSubStart`, or the description does not tell the model when to use it.
3. **It ignores its own instructions**, or the reply contains a raw `<%=...%>` expression. See *Messages and expressions* below.
4. **It answers from general knowledge instead of your documents.** A RAG agent must be told the collection name in its System message, and told to always search. See [RAG as a Tool].
5. **It never pauses for a human.** The System message does not tell it to ask, so the model decides it can answer alone. See [Human in the Loop].
6. **It behaves as though it never saw your document.** A file can be dropped from the message without a log entry — a CMS path that does not exist, or a `Path`, `File` or `IDocument` whose name has no `.png`, `.jpg`, `.jpeg` or `.pdf` extension. Check what the expression actually resolves to before suspecting the prompt. See [File Extraction].
7. **The provider cannot read that file type.** Nothing is checked locally, so the request reaches the provider and fails there. See [Quick Reference].
8. **The agent cannot return a list.** A bare collection is not a supported result type. Declare a class with the list as one of its fields and use that class. See [Structured Output].
9. **A masked value was not restored in the reply.** `PiiMaskingGuardrail` puts a value back by finding its exact placeholder in the response. If the model paraphrases it — "the email address" instead of `<EMAIL_9f2c41ab77de>` — there is nothing to put back. Smaller and older models do this more often. Add the placeholder hint to the System message, or move the agent to a newer model. See [PII Masking Guardrail].
10. **On Ollama, a typed result came back as plain text.** Ollama cannot take a JSON schema and tools in the same request, so when an agent has both, Smart Workflow keeps the tools and leaves the schema off. Split the work across two agents, or use another provider.
11. **The output varies more — or less — than expected.** Check the **Temperature** the agent really used. An invalid value silently becomes `0.0`. See [Model Settings].

---

## Messages and expressions

Both messages accept `<%=...%>`. Four of their behaviours are easy to mistake for a bad prompt:

1. **A file in the System message is not read.** Only the User message handles files. A file expression in the System message is converted with `toString()`, so the model receives something like `Binary@1a2b3c` instead of your document — and answers confidently about a document it never saw.
2. **An unresolved expression is inserted as its own raw text.** If the model echoes back `<%=in.invoiceText%>`, the expression is wrong, not the prompt.
3. **If expanding the User message fails, the call is skipped entirely** and the process continues as if nothing happened. Look for `Agent call was skipped, since there was no user query`. A blank User message does the same — deliberately, so that a half-configured element does not fail while you build it.
4. **If expanding the System message fails, the agent runs without one.** It still answers, just without rules. Check here first when an agent suddenly stops behaving.

---

## Configuration

1. **`Unknown model provider <name>`.** `AI.DefaultProvider`, or the **Provider** field of the element, names a provider whose project is not installed.
2. **An authentication error from the provider.** The key is wrong, or was never set in the Engine Cockpit.
3. **A model name does not compile.** **Model** is a script field, so the value must be quoted: `"gpt-4o"`.
4. **The default model is ignored.** The variable is called `DefaultModel` (Azure OpenAI: `DefaultDeployment`), not `Model`.
5. **A variable change had no effect.** Variables are read on each call, so no restart is needed — check that you set the value on the right application in the Engine Cockpit.
6. **A guardrail blocks valid test data.** Blank guardrail fields inherit `AI.Guardrails.DefaultInput` and `DefaultOutput`.
7. **A custom tool or guardrail does not appear in the pickers.** The SPI registration file is missing, or your provider is not on its **first line**. See [Java Tools] and [Custom Guardrail].

---

## Human in the loop

`DecisionMaker.resolve()` does not fail quietly: it throws an `IllegalStateException` that names the missing part of the chain. These are not BPM errors and cannot be caught with a boundary event.

| Message | Meaning |
| --- | --- |
| `Found no pending ChatMemory for id` | No suspended conversation is stored under this ID — usually the `aiMemoryId` field is missing from the data class, so the ID was never stored. |
| `Found no pending AiMessage for id` | The stored conversation contains no model message that requested a tool call. |
| `Found no pending ToolExecutionRequest for id` | Every tool call of that message already has an answer — for example because `resolve()` was called twice. |

See [Human in the Loop] and [Conversation Memory].

---

## Errors you can catch

Guardrail violations, the circuit breaker, and errors thrown by your own tools all raise BPM errors that an Error Boundary Event can handle. The codes are listed in [Quick Reference].

---

## Finding out what really happened

When the log is not enough, look at what the model actually received:

- **Conversations in Ivy** — switch on `AI.Observability.Ivy.Enabled` and open the [Governance Dashboard] to read the exact System message, User message, tool calls and guardrail results of a Case.
- **Arize Phoenix** — follow each LLM call, tool call and guardrail as a trace. See [Observability].

---

## See also

- [Key Concepts]
- [Quick Reference]
- [Observability]
- [Governance Dashboard]
