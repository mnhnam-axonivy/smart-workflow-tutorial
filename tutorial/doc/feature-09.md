# Output Guardrail

An **Output Guardrail** validates the model's response before it reaches your process. Built-in guardrails catch common threats — such as sensitive data in AI responses — with no code required.

---

> **This builds on [Basic Agent Setup].** The agent configuration is the same — the only new element is an **Error Boundary Event** on the AgenticProcessCall to catch guardrail violations.
>
> **Example used in this guide: Sensitive data output guardrail**
>
> The agent receives a question designed to elicit sensitive data (API key examples). The `SensitiveDataOutputGuardrail` inspects the model's response and blocks it before it reaches the process. The Error Boundary Event catches the violation and logs the reason.
>
> ![Example process](cms:/Files/Images/feature09-00)
>
> The finished process is at `tutorial/process/tutorial/features/Feature09.p.json` — open it in the Designer to follow along as you read.

---

## Before you start

In [Basic Agent Setup] you saw how to call an agent and get a result back. The agent's response is powerful — and that power needs guardrails.

**Output guardrails inspect the model's response before it returns to your process.** When the guardrail detects a violation — sensitive credentials, API keys, restricted content — it blocks the response and throws a BPM error. Your process catches this with an **Error Boundary Event** and handles it gracefully.

---

## What is an output guardrail?

An output guardrail is a validation layer that runs after the LLM produces its response and before the result reaches `resultMapping`. Smart Workflow provides a built-in output guardrail:

| Guardrail | Description |
| --- | --- |
| `SensitiveDataOutputGuardrail` | Blocks responses that leak credentials — both your own configured API keys and anything matching a known key format. |

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

## Application-wide guardrails

Selecting a guardrail on every agent is not the only way. Two variables name the guardrails for **every agent that selects none** — set them in the **Engine Cockpit** under **Variables**, or in `variables.yaml`:

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput: PromptInjectionInputGuardrail
      DefaultOutput: SensitiveDataOutputGuardrail
```

To use more than one guardrail, separate the names with a comma. Both variables are empty by default, so no guardrail runs until you fill them in.

> **Important:** Empty guardrail fields on an agent do **not** mean "no guardrails" — the agent then uses these application defaults. This is the opposite of **Available tools**, where empty means no tools at all. What you select on an agent **replaces** the defaults for that agent.

---

## Example — Sensitive data output guardrail

### Mock data

The process pre-fills the query using a **Mock data** Script element so you can run it without any manual data entry:

```javascript
in.query = "What is the format of an OpenAI API key? Please give examples.";
```

### Agent configuration

**Output Guardrails:** `["SensitiveDataOutputGuardrail"]`

**User message:** `<%=in.query%>`

**Map result to:** `in.result`

### Result

The guardrail detects API key format examples in the model's response and blocks it. The **Show violation** Script element logs the outcome:

```javascript
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
```

An example output:

```text
Blocked by guardrail: The guardrail com.axonivy.utils.smart.workflow.guardrails.adapter.OutputGuardrailAdapter
failed with this message: The AI response was blocked because it contains sensitive data such as API keys or private keys
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
- **Assuming blank means unguarded** — blank guardrail fields inherit `AI.Guardrails.DefaultInput` and `DefaultOutput`. Remember this in tests, where a default guardrail can reject your fixture data.
- **Matching on the error message** — branch on the error **code**. The message is wrapped by Smart Workflow — as the example output shows, it names an internal adapter class — and is not a stable contract.
- **Expecting an output guardrail to retry** — it does not. The first failure discards the response; there is no second attempt with a re-prompt. An output guardrail that blocks legitimate answers costs you the whole call.

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/process/tutorial/features/Feature09.p.json` — the agent process
- `tutorial/dataclass/tutorial/Feature09Data.d.json` — the data class

Open the process in the Designer and inspect the `Assistant Agent` element — note the `Output Guardrails` field containing `["SensitiveDataOutputGuardrail"]` and the Error Boundary Event attached to it.

---

## See also

- [Basic Agent Setup]
- [Java Tools]
- [Callable Process Tools]
- [Web Search Tool]
- [Custom Guardrail]
