# Basic Agent Setup

The **AgenticProcessCall** is the Axon Ivy element that adds an AI agent step directly inside a process. You define what to ask, what data to pass, and what to do with the answer — the element handles the LLM call automatically.

To set this up, open your process in the Designer, drag **AgenticProcessCall** from **Extension > Program Elements** onto the canvas, then double-click to open the configuration editor.

![AgenticProcessCall element](cms:/Files/Images/feature01-01)

---

> **Prerequisite:** Before any agent can run you need a provider and its API key configured. If you haven't done that yet, jump to the [Global configuration — variables.yaml](#global-configuration--variablesyaml) section first, then come back here.

> **Example used in this guide: Acme Corp invoice processing**
>
> Acme Corp receives supplier invoices by email. An employee opens the email, copies the invoice text, and pastes it into the **Import Invoice** task in Axon Ivy. The agent reads that text and returns a one-sentence plain-text summary — invoice number, supplier name, total amount, and due date — written directly into a String field of the process data.
>
> ![Example process](cms:/Files/Images/feature01-00)
>
> The finished process is at `tutorial/process/tutorial/features/Feature01.p.json` — open it in the Designer to follow along as you read.

---

## Element configuration

### System message

The system message is the agent's job description. It tells the LLM who it is, what it must do, and what format it must produce.

**Example for the invoice process:**

```text
You are an invoice summary agent for Acme Corp.
Read the invoice text and return a single sentence summary containing:
the invoice number, supplier name, total amount, and due date.
Do not add any other commentary.
```

**Why it matters:** The LLM has no knowledge of your business context. Without a clear system message it will guess what to do and return inconsistent results. The more specific you are — what to include, what to omit, what format to use — the more reliable the output.

**How it works:** The system message is sent to the LLM as the `system` role message before your data. It shapes every response the model produces in this agent call.

Like the User message, the System message accepts `<%=...%>` expressions, so values that should not be hard-coded — a company policy, an approval limit — can come from process data. See [Agent Prompts: Clarity and Dynamic Context].

---

### User message

The User message is the actual input the agent reasons over — the data it will work on at runtime. It supports IvyScript expressions using `<%=...%>` syntax.

**Example:** Bind this to the process data field that holds the invoice text:

```text
<%=in.invoiceText%>
```

This expression is evaluated at runtime — `in.invoiceText` is the `invoiceText` field of the process data class `Feature01Data`.

**How it works:** The resolved value becomes the `user` role message in the LLM conversation. The agent reads it, applies the system message instructions, and produces a response. For document processing, pass the document's text content here. For conversational agents, pass the user's question.

> **Note:** If the User message resolves to nothing — an empty field, or an expression that fails — Smart Workflow skips the agent call and the process simply continues. Look for `Agent call was skipped, since there was no user query` in the log.

---

## Output

By default the agent returns a **plain text String**. This is the simplest case — no extra configuration needed.

### Map result to

Defines the process data field where the agent's output is written after execution.

**Example:**

```text
in.summary
```

This writes the agent's response into the `summary` field of `Feature01Data` — a plain String. The rest of the process can display it, log it, or pass it to the next step directly. No parsing, no casting — it is just a String.

> To return a **typed Java object** instead of a plain String (e.g. to extract multiple fields into individual typed variables), see [Structured Output].
>
> The editor also shows the **🛠️ Tools**, **🛡️ Guardrails** and **🧠️ Model** groups — leave them empty for this basic setup. Tools are covered in [Callable Process Tools], guardrails in [Output Guardrail], provider and model in [Model Provider Selection], and settings such as temperature in [Model Settings].

---

## Global configuration — variables.yaml

### What is variables.yaml?

Every Axon Ivy application has a `variables.yaml` file — the standard place to declare configuration values that can differ between environments (development, test, production) without changing code. Think of it as your application's settings file: it lives in the project and is version-controlled. On a running engine you can change the same variables in the **Engine Cockpit** under **Variables**, without touching the file.

Values declared here are available anywhere in IvyScript as `Ivy.var().variable("AI.DefaultProvider")`, but Smart Workflow reads them automatically so you never need to call that yourself.

### How Smart Workflow uses it

Smart Workflow reads the variables of the `AI` block to know:

- **Which provider to use by default** — so every `AgenticProcessCall` in the application uses the same LLM unless you explicitly override it on a specific element
- **How to authenticate** — each provider block holds the API key (and any extra settings like endpoint or deployment name) needed to make requests

This means you configure the AI connection once, centrally, and all agents in all processes share it automatically.

> **Note:** The variables are read on **each agent call**, not cached at startup. A changed provider, model or key takes effect on the next call — no restart needed.

### Minimum required configuration

Before any agent can run, two variables need a value:

| Variable | Value |
| --- | --- |
| `AI.DefaultProvider` | `OpenAI` |
| `AI.Providers.OpenAI.APIKey` | your API key |

The variables themselves are already declared by the provider project you installed (for example `smart-workflow-openai`) — you only set their values.

Set the **API key** in the **Engine Cockpit** under **Variables**. The Cockpit encrypts the key as you save it, so it is never stored in plain text — see [Model Provider Selection] for a screenshot.

`DefaultProvider` can be set in the same place, or in your project's `variables.yaml`:

```yaml
Variables:
  AI:
    DefaultProvider: "OpenAI"
```

`DefaultProvider` tells Smart Workflow which provider to use. It must name a provider whose project is installed.

### Supported providers

For a full breakdown of each provider's options, switching providers at runtime, and using multiple providers in the same application, see [Model Provider Selection].

### Where the file lives

In the Designer, open your project and find `config/variables.yaml`. For the tutorial project that is `smart-workflow-tutorial/config/variables.yaml`.

> **Note:** Never type a real API key into `variables.yaml` — it would stay readable there and end up in source control. Keep the `${decrypt:}` placeholder in the file and set the value in the Engine Cockpit.

---

## Common mistakes

A few things are easy to get wrong the first time. If the agent does not answer as expected, check this list:

| Symptom | Cause |
| --- | --- |
| No call was made at all | The User message resolved to nothing. Look for `Agent call was skipped, since there was no user query` in the log. |
| `in.summary` is empty but the log shows a call | **Map result to** failed, usually a type mismatch. Look for `Failed to map result to` in the log. |
| The reply contains `<%=in.invoiceText%>` literally | The expression could not be resolved — check the field name on the data class. |
| `Unknown model provider <name>` | `AI.DefaultProvider` does not match an installed provider project. |
| An authentication error from the provider | The API key is wrong, or was never set in the Engine Cockpit. |

For more symptoms and what to check, see [Troubleshooting].

---

## See also

- [Model Provider Selection]
- [Structured Output]
- [File Extraction]
- [Callable Process Tools]
- [Key Concepts]
- [Troubleshooting]
