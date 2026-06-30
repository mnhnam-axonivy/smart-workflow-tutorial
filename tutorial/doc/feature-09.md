# Output Guardrail

An **Output Guardrail** validates the model's response before it reaches your process. Built-in guardrails catch common threats — such as sensitive data in AI responses — with no code required.

---

> **This builds on [Basic Agent Setup].** The agent configuration is the same — the only new element is an **Error Boundary Event** on the AgenticProcessCall to catch guardrail violations.
>
> **Example used in this guide: Sensitive data output guardrail**
>
> The agent receives a question designed to elicit sensitive data (API key examples). The `SensitiveDataOutputGuardrail` inspects the model's response and blocks it before it reaches the process. The Error Boundary Event catches the violation and logs the reason.
>
> ![Example process](cms:/Files/Images/feature07-00)
>
> The finished process is at `tutorial/processes/tutorial/features/Feature09.p.json` — open it in the Designer to follow along as you read.

---

## Before you start

In [Basic Agent Setup] you saw how to call an agent and get a result back. The agent's response is powerful — and that power needs guardrails.

**Output guardrails inspect the model's response before it returns to your process.** When the guardrail detects a violation — sensitive credentials, API keys, restricted content — it blocks the response and throws a BPM error. Your process catches this with an **Error Boundary Event** and handles it gracefully.

---

## What is an output guardrail?

An output guardrail is a validation layer that runs after the LLM produces its response and before the result reaches `resultMapping`. Smart Workflow provides a built-in output guardrail:

| Guardrail | Description |
| --- | --- |
| `SensitiveDataOutputGuardrail` | Blocks responses that contain API keys or private keys. |

When the guardrail fires, it throws a BPM error with the code `smartworkflow:guardrail:output:violation`. You catch it with an **Error Boundary Event** attached to the AgenticProcessCall element.

---

## Why use it?

- **Data leak prevention** — stop the model from returning secrets, credentials, or internal keys
- **Zero code** — the built-in guardrail requires no Java implementation
- **Graceful error handling** — the Error Boundary Event lets you respond with a user-friendly message instead of a process crash

---

## Step 1 — Add the output guardrail to the agent

In the `AgenticProcessCall` configuration, set **Output Guardrails**:

```json
["SensitiveDataOutputGuardrail"]
```

---

## Step 2 — Add an Error Boundary Event

Attach an **Error Boundary Event** to the AgenticProcessCall element:

- **Error code:** `smartworkflow:guardrail:output:violation`
- **Output mapping:** `out → in` and `out.error → error`

---

## Step 3 — Handle the violation

In the script connected to the Error Boundary Event:

```java
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
```

---

## Example — Sensitive data output guardrail

### Mock data

The process pre-fills the query using a **Mock data** Script element so you can run it without any manual data entry:

```javascript
in.query = "What is the format of an OpenAI API key? Please give examples.";
```

### Agent configuration

**Output Guardrails:** `["SensitiveDataOutputGuardrail"]`

**Query:** `<%=in.query%>`

**Map result to:** `in.result`

### Result

The guardrail detects API key format examples in the model's response and blocks it. The **Show violation** Script element logs the outcome:

```javascript
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
```

An example output:

```text
Blocked by guardrail: Output guardrail violated: SensitiveDataOutputGuardrail
```

The model's response never reaches the process — it is intercepted and discarded by the guardrail layer.

---

## Configuration reference

| Variable | Description | Default |
| --- | --- | --- |
| `AI.Guardrails.DefaultOutput` | Default output guardrail(s) applied to every agent that does not set its own. | *(none)* |

---

## Common mistakes

- **No Error Boundary Event** — Without one, a guardrail violation causes an unhandled process error. Always attach a boundary event to the AgenticProcessCall when using guardrails.
- **Wrong error code** — Output violations use `smartworkflow:guardrail:output:violation`. Input violations use `smartworkflow:guardrail:input:violation`. Use the code that matches the guardrail type.

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/processes/tutorial/features/Feature09.p.json` — the agent process
- `tutorial/dataclasses/tutorial/Feature09Data.d.json` — the data class

Open the process in the Designer and inspect the `Assistant Agent` element — note the `Output Guardrails` field containing `["SensitiveDataOutputGuardrail"]` and the Error Boundary Event attached to it.

---

## See also

- [Basic Agent Setup]
- [Java Tools]
- [Callable Process Tools]
- [Web Search Tool]
