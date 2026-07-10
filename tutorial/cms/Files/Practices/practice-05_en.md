# Agent Prompts: Clarity and Dynamic Context

The system prompt is the AI's primary instruction — it shapes how the agent reasons, what it focuses on, and how it calls tools. Two mistakes undermine this: referencing tool method names directly in the prompt, and hard-coding contextual values that change at runtime. Smart Workflow provides EL expressions in the `system` and `query` fields that inject live Java values — today's date, the user's locale, or any process data field — directly into the prompt at call time.

---

> **Examples from best-practices:** `PurchasingAgent.p.json` in `best-practices/processes/exercise/purchasing/agents/` demonstrates both principles. The Purchasing Manager Agent system prompt describes *what* to do in plain language, never naming a single tool method. The query uses `<%= in.region.getDisplayLanguage() %>` to inject the locale name dynamically at runtime.

## How it works

### System prompt and query

Every `AgenticProcessCall` has two text fields that together form the instruction the AI receives:

| Field | Role |
| --- | --- |
| `system` | Role description, ordered steps, and rules — who the agent is and what it must do |
| `query` | The specific request for this invocation: the data to process and any dynamic context |

Both fields support **EL expressions** (`<%= expression %>`). The engine evaluates them against the process data class before sending the text to the LLM — so any Java value accessible from the process can appear in the prompt.

### The `tools` array

The `tools` field lists which `CallSubStart` callables (tagged `tool`) the agent may call. The AI matches the goal to the correct tool using the `visual.description` on each `CallSubStart` — it does not need the method name repeated in the system prompt.

---

## Anti-pattern: naming tools in the system prompt

When a developer lists tool method names explicitly in the system prompt, the prompt becomes tightly coupled to the implementation:

```text
You are a Purchasing Manager Agent.
Your goal is to process extracted document text and produce a complete, analyzed purchasing object.

Follow these steps in order:
1. Use the "translate" tool to translate the extracted text to the target locale.
2. Use the "mapToPurchasingObject" tool to map the translated text into a structured PurchasingData object.
3. Use the "calculatePurchasingTax" tool to compute subtotal, tax per item type, and grand total.
4. Use the "calculateStatistics" tool to compute item count, unique product count, average unit price, and effective tax percentage.
5. Use the "createSummary" tool to generate an executive AI summary of the purchasing request.
6. Return the final PurchasingData object as your result.
```

**Why this is harmful:**

- **Brittle** — renaming a callable from `translate` to `translateText` silently breaks the agent; the prompt still says `"translate"` but no tool by that name exists
- **Redundant** — the LLM receives the tool name twice: once in the prompt and once in the tool schema. Repetition adds tokens without adding meaning
- **Maintenance trap** — every prompt must be updated when tools are refactored; nothing in the IDE links the string `"translate"` in the prompt to the `translate` callable

---

## Best practice: describe the action, not the tool name

The `visual.description` on each `CallSubStart` already tells the AI what the tool does. The system prompt only needs to describe the goal and the order of steps — not which function achieves each step.

This is the actual Purchasing Manager Agent system prompt from `PurchasingAgent.p.json`:

```text
You are a Purchasing Manager Agent.
Your goal is to process extracted document text and produce a complete, analyzed purchasing object.

Follow these steps in order using the available tools:
1. Translate the extracted text to the target locale.
2. Map the translated text into a structured PurchasingData object.
3. Compute subtotal, tax per item type, and grand total.
4. Compute item count, unique product count, average unit price, and effective tax percentage.
5. Generate an executive AI summary of the purchasing request.
6. Return the final PurchasingData object as your result.

Rules:
- Always call all five tools in the order above before returning.
- Do not fabricate data not present in the document.
- If the extracted text is empty, return null.
```

No tool name appears anywhere. The AI reads the `visual.description` on each `CallSubStart` and matches each step to the correct callable autonomously. Renaming a callable only requires updating its `visual.description` — the system prompt remains unchanged.

### Structure the system prompt in three parts

A well-structured system prompt has three parts:

```text
[Role]
One sentence identifying who the agent is and its core responsibility.

[Steps]
Ordered list of what the agent must do, described as actions — not tool names.

[Rules]
Constraints: what the agent must not do, how to handle edge cases, output format.
```

The Purchasing Manager Agent follows this structure exactly:

| Part | Content |
| --- | --- |
| Role | `You are a Purchasing Manager Agent. Your goal is to process extracted document text...` |
| Steps | `1. Translate the extracted text... 2. Map the translated text... 3. Compute subtotal...` |
| Rules | `Always call all five tools in the order above... Do not fabricate data... If empty, return null.` |

---

## Smart Workflow: inject live Java values into prompts

Smart Workflow evaluates EL expressions (`<%= ... %>`) in both the `system` and `query` fields before the text is sent to the LLM. This means any Java value reachable from the process data — dates, locale, session attributes, computed values — can appear in the prompt without a Script element to pre-build the string.

### Today's date

```json
{
  "system": "Today is <%= new java.text.SimpleDateFormat(\"yyyy-MM-dd\").format(new java.util.Date()) %>.\nYou are a purchasing analyst. Evaluate whether this request is urgent given today's date."
}
```

Use this when the AI must reason about deadlines, SLA windows, or time-sensitive decisions.

### The user's display language

```json
{
  "query": "Respond in: <%= ivy.session.contentLocale.getDisplayLanguage() %>\n\n<%= in.extractedText %>"
}
```

`ivy.session.contentLocale` returns the `java.util.Locale` of the currently logged-in user. `getDisplayLanguage()` converts it to the language name the LLM understands — `"Japanese"`, `"English"`, `"German"` — without any hardcoding.

### Process data — the purchasing example

In `PurchasingAgent.p.json`, the `purchasingManagerAgent` callable receives a `java.util.Locale region` parameter. The query injects the resolved language name directly:

```json
{
  "query": "Region: <%=in.region.getDisplayLanguage()%>\nSource text to extract purchasing object:\n<%=in.extractedText%>"
}
```

The `createSummary` tool receives the language as a plain `String` — already resolved by the caller. Its query simply references the field:

```json
{
  "query": "Target language: <%=in.language%>\n\nGenerate an executive summary for the following purchasing request and translate it into the target language:\n\n<%= in.purchasing %>"
}
```

Both are valid. Use `Locale` when the type system should enforce locale validity; use `String` when the value has already been resolved and passed as a parameter.

---

## Pros

- **Decoupled prompts** — tool method names are not embedded in text; renaming a callable does not break the prompt
- **Dynamic context** — dates, locales, and user attributes are injected at runtime with no Script element needed
- **Maintainable** — `visual.description` is the single source of truth for what a tool does; the system prompt stays focused on workflow logic
- **Token-efficient** — descriptions are written once on the `CallSubStart`; the system prompt stays concise

---

## Cons

- **EL errors fail at runtime** — a typo in `<%= in.region.getDisplayLanguge() %>` produces a runtime error in the server log, not a compile error in the IDE
- **Resolved prompt is not visible at design time** — you must check an observability trace or process log to see the exact text sent to the LLM
- **AI may not follow step order** — listing step 1 before step 2 does not guarantee the AI calls tools in that order; strict ordering must be enforced in process structure

---

## Common mistakes

- **Hardcoding tool method names in the system prompt** — if the callable is renamed, the prompt silently refers to a tool that no longer exists. Describe actions; let `visual.description` identify the tool.
- **Skipping `visual.description` on `CallSubStart`** — without a description the AI relies only on the method signature for tool selection. A one-sentence description dramatically improves accuracy.
- **Building prompt strings in a Script element** — unnecessary. `<%= %>` expressions in `system` and `query` achieve the same result with no extra process element.
- **Relying on prompt order to enforce tool call order** — listing step 1 before step 2 does not guarantee the AI calls tools in that order. Use chained `SubProcessCall` elements before the `AgenticProcessCall` if ordering is critical.
- **Including internal field names in the prompt** — the AI does not need to know that the result is stored in `in.purchasing` or that the class is `exercise.purchasing.PurchasingData`. Keep implementation details out of the prompt text.

---

## See also

- [Agent Organisation: Folder Structure and Naming Conventions]
- [Agent Pattern: Subprocess Design and Tool Co-location]
- [Callable Process Tools]
- [Observability]
