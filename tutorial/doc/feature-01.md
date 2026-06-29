# Basic Agent Setup

The **AgenticProcessCall** is the Axon Ivy element that adds an AI agent step directly inside a process. You define what to ask, what data to pass, and what to do with the answer — the element handles the LLM call automatically.

To set this up, open your process in the Designer, drag **AgenticProcessCall** from **Extension > Program Elements** onto the canvas, then double-click to open the configuration editor.

![AgenticProcessCall element](cms:/Files/Images/feature01-01)

---

> **Prerequisite:** Before any agent can run you need a provider and API key configured in `variables.yaml`. If you haven't done that yet, jump to the [Global configuration — variables.yaml](#global-configuration--variablesyaml) section first, then come back here.

> **Example used in this guide: Acme Corp invoice processing**
>
> Acme Corp receives supplier invoices by email. An employee opens the email, copies the invoice text, and pastes it into the **Import Invoice** task in Axon Ivy. The agent reads that text and returns a one-sentence plain-text summary — invoice number, supplier name, total amount, and due date — written directly into a String field of the process data.
>
> ![Example process](cms:/Files/Images/feature01-00)
>
> The finished process is at `tutorial/processes/tutorial/features/Feature01.p.json` — open it in the Designer to follow along as you read.

---

## Element configuration

### System Prompt

The system prompt is the agent's job description. It tells the LLM who it is, what it must do, and what format it must produce.

**Example for the invoice process:**

```text
You are an invoice summary agent for Acme Corp.
Read the invoice text and return a single sentence summary containing:
the invoice number, supplier name, total amount, and due date.
Do not add any other commentary.
```

**Why it matters:** The LLM has no knowledge of your business context. Without a clear system prompt it will guess what to do and return inconsistent results. The more specific you are — what to include, what to omit, what format to use — the more reliable the output.

**How it works:** The system prompt is sent to the LLM as the `system` role message before your data. It shapes every response the model produces in this agent call.

---

### Query (User Message)

The query is the actual input the agent reasons over — the data it will work on at runtime. It supports IvyScript expressions using `<%=...%>` syntax.

**Example:** Bind this to the process data field that holds the invoice text:

```text
<%=in.invoiceText%>
```

This expression is evaluated at runtime — `in.invoiceText` is the `invoiceText` field of the process data class `Feature01Data`.

**How it works:** The resolved value becomes the `user` role message in the LLM conversation. The agent reads it, applies the system prompt instructions, and produces a response. For document processing, pass the document's text content here. For conversational agents, pass the user's question.

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
> The editor also shows **Tools** and **AI Provider** fields — leave both blank for this basic setup. They are covered in [Callable Process Tools] and [Model Provider Selection].

---

## Global configuration — variables.yaml

### What is variables.yaml?

Every Axon Ivy application has a `variables.yaml` file — the standard place to declare configuration values that can differ between environments (development, test, production) without changing code. Think of it as your application's settings file: it lives in the project, it is version-controlled, and Axon Ivy reads it at startup.

Values declared here are available anywhere in IvyScript as `Ivy.var().variable("AI.DefaultProvider")`, but Smart Workflow reads them automatically so you never need to call that yourself.

### How Smart Workflow uses it

The Smart Workflow library reads the `AI` block from `variables.yaml` at startup to know:

- **Which provider to use by default** — so every `AgenticProcessCall` in the application uses the same LLM unless you explicitly override it on a specific element
- **How to authenticate** — each provider block holds the API key (and any extra settings like endpoint or deployment name) needed to make requests

This means you configure the AI connection once, centrally, and all agents in all processes share it automatically.

### Minimum required configuration

Before any agent can run, you need at least a provider and its API key:

```yaml
Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
```

`DefaultProvider` tells Smart Workflow which provider block to use. Set it to the name that matches the block you filled in.

### Supported providers

For a full breakdown of each provider's options, switching providers at runtime, and using multiple providers in the same application, see [Model Provider Selection].

### Where the file lives

In the Designer, open your project and find `config/variables.yaml`. For the tutorial project that is `smart-workflow-tutorial/config/variables.yaml`.

> **Note:** Never commit real API keys to source control. Use Axon Ivy's environment variable substitution (`${MY_SECRET_ENV_VAR}`) or override values per environment in the Engine administration UI.

---

## See also

- [Model Provider Selection]
- [Structured Output]
- [File Extraction]
- [Callable Process Tools]
