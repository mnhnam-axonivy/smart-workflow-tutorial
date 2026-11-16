# Key Concepts

The vocabulary Smart Workflow uses, what each piece actually is, and the limits worth knowing before you design around them. Each section links to the guide that covers the topic in full.

---

## The agent

An **agent** is a single `AgenticProcessCall` element in a process. It is not a long-running service or a persistent assistant — it is one step that makes one model call (or several, if tools are involved) and writes a result into process data.

Everything an agent knows comes from three places:

- its **System message** — the standing instructions
- its **User message** — the data for this call
- whatever its **tools** return while it is working

Nothing else. The agent has no access to your database, your process history, or its own past runs unless a tool gives it one. See [Basic Agent Setup].

---

## Messages and prompts

| Field | Purpose | Example |
| --- | --- | --- |
| **System message** | How the agent should behave and which rules it must follow | `You are an invoice summary agent. Answer in one sentence.` |
| **User message** | The task and the data for this call — text, values from process data, or files | `<%=in.invoiceText%>` |

A **prompt** is the whole input that guides the model's response. People often use the word for a single instruction, but a request contains several messages — the System message and the User message are both part of it.

The model has general knowledge from its training, but it does not know your application data or current business information. Supply what it needs through messages and tools. See [Agent Prompts: Clarity and Dynamic Context].

---

## Context and tokens

**Context** is everything available to the model when it generates a response: your messages, the tool definitions, the tool results, and any files.

Models process text in **tokens** — a word, part of a word, or punctuation. Tokens matter for two reasons:

- **Capacity** — a model's *context window* limits how many tokens fit into one request.
- **Cost** — most providers charge per input and output token.

Long messages, large documents and repeated tool calls all increase token usage. Send what the task needs, and nothing else. For how tokens work inside the model, see [How LLMs Understand Language].

---

## Provider and model

The **provider** is the vendor integration — OpenAI, Anthropic, Ollama and others. The **model** is the specific model within it, such as `gpt-4.1-mini` or `claude-haiku-4-5`.

Both are chosen per element, and both fall back: an empty **Provider** uses `AI.DefaultProvider`, an empty **Model** uses that provider's `DefaultModel`. Because the choice is per element, one process can use several providers.

Providers differ in what they support — check the capability table before relying on file input, typed output or embedding. See [Model Provider Selection] and [Quick Reference].

---

## Tools

A **tool** is something the agent can decide to call. There are two kinds: a **callable sub-process** tagged `tool` (the normal case) and a **Java class** (for logic without workflow steps).

The model never sees your implementation. It sees the tool's description and the name, type and description of each input parameter, and decides from those alone whether to call it. That makes those descriptions the highest-leverage text in the whole system.

Tools are *offered*, not *invoked* — the agent chooses. If something must happen every time, put it into the process, not into a tool.

See [Callable Process Tools], [Java Tools] and [Web Search Tool].

---

## Structured output

By default an agent returns a `String`. Set **Expect result of type** to a class and it returns an instance of that class instead: a JSON schema is derived from the class, sent to the model as a response-format constraint, and the reply is deserialised.

This is what makes an agent usable *in a process* rather than just readable by a person. The field names you choose are what the model sees, so name them descriptively. Not every provider supports it. See [Structured Output].

---

## Guardrails

A **guardrail** inspects a message and allows, rewrites or blocks it. Input guardrails run before the model sees the User message; output guardrails run before the response is used.

See [Output Guardrail], [Input Guardrail], [PII Masking Guardrail] and [Custom Guardrail].

> **Two defaults that point in opposite directions**
>
> | Field left empty | Means |
> | --- | --- |
> | **Available tools** | The agent has **no tools at all** |
> | **Input guardrails** / **Output guardrails** | The agent uses the **application defaults** (`AI.Guardrails.DefaultInput` / `DefaultOutput`) |
>
> An agent that explains what it *would* do instead of doing it usually has no tools selected. An agent that is blocked although you never configured a guardrail is usually inheriting a default.

---

## Memory

Each agent call is self-contained. Within a call, the agent keeps the full conversation, including its tool results; that list grows with every tool call and has no cap. Between calls, nothing is carried over.

The one exception is a **suspended** call: when an agent pauses for a person, the `aiMemoryId` field of the process data holds the handle of the suspended conversation until the agent resumes. It is not a chat history. See [Conversation Memory].

---

## Human in the loop

**Human in the loop** means involving a person in an otherwise automated workflow — to provide missing information, to review a result, or to approve an action before it happens.

Use process steps to *enforce* a required approval. An instruction asking the agent to seek approval is not a substitute for an approval step in the workflow. When the agent itself should decide whether to ask, give it a tool that suspends it. See [Human in the Loop] and [Agent Pattern: AI Task].

---

## Retrieval-augmented generation (RAG)

**RAG** means retrieving relevant information from a source and supplying it to the model so that it can ground its answer in it. It does not retrain the model; it adds information to the current context.

RAG is useful for private or frequently changing information the model cannot know. Its quality depends on finding the right passages, and retrieved content uses up context space. See [What is RAG] and [RAG as a Tool].

---

## Configuration

Everything is configured through Ivy variables under a single `AI` block — no separate configuration file, no code. The variables are declared by the projects you install; you set their values, normally in the **Engine Cockpit**.

- Values are read on **each agent call**, so a change takes effect immediately, without a restart.
- API keys are declared as secrets. The Engine Cockpit encrypts them on entry; they never belong in source control.

See [Quick Reference] for the complete list of variables.

---

## See also

- [Basic Agent Setup]
- [Troubleshooting]
- [Quick Reference]
- [Agent Pattern: Agent Pipeline]
