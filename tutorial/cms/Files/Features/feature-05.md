# Callable Process Tools

By default an agent can only reason over the information you give it in the Query. **Callable Process Tools** extend this: the agent can call back into your Axon Ivy process during execution to fetch real-time data, apply business rules, or trigger side effects — and then use the result in its response.

> **This builds on [Basic Agent Setup].** The agent configuration is the same — the only addition is the **Tools** field, which lists the callable sub-processes the agent is allowed to invoke.
>
> **Example used in this guide: Acme Corp invoice approval**
>
> The agent reads an invoice and calls three tools in sequence: it looks up the applicable tax rate for the invoice currency, determines whether the amount requires approval, and selects the responsible approver. It returns a single-sentence decision combining all three results. The process then routes to a **Manager Review** task or ends automatically based on the policy.
>
> ![Example process](cms:/Files/Images/feature05-00)
>
> The finished process is at `tutorial/processes/tutorial/features/Feature05.p.json` and the tools at `tutorial/processes/tutorial/tools/Feature05Tools.p.json` — open both in the Designer to follow along.

---

## Before you start

In the previous features you have seen what `AgenticProcessCall` can do on its own — without any tools:

- **Feature 01** summarises an invoice from plain text into a single sentence
- **Feature 02** extracts invoice fields into a typed Java object
- **Feature 03** routes the same extraction through multiple providers in one process
- **Feature 04** reads an invoice directly from an image or PDF file

These are all single-purpose AI calls: you give the agent some input, it reasons over it, and it returns a result. Powerful — but limited to what the agent can derive from the data you hand it.

But what if the agent needs to do something more complex? What if approving an invoice requires checking the approval policy in your ERP system, calculating the effective tax rate for the invoice currency, and then selecting the right approver from a live database? The agent cannot do any of that on its own — it has no connection to your systems.

That is when tools shine. Tools let the agent call back into your Axon Ivy process during execution — to query a database, apply a business rule, call an external API, or trigger any workflow logic — and then use the result in its reasoning before producing a final answer.

Smart Workflow supports two ways to define tools for an agent:

- **Callable Process Tools** — tools implemented as callable sub-processes directly in the Axon Ivy Designer. No Java required: use any process element, script, connector, or sub-process you already know.
- **Java Tools** — tools implemented as Java classes using the SPI pattern. Intended for library authors and advanced integrations. See [Java Tools] for details.

**We strongly recommend callable process tools for application development.** They keep your tool logic inside the process model where it is visible, testable, and maintainable by any Axon Ivy developer. Java tools are an internal extension point — use them only if you are building a shared library or need capabilities that cannot be expressed in a process.

---

## What is a callable tool?

A tool is a [callable sub-process](https://developer.axonivy.com/doc/14.0/en/designer-guide/process-modeling/process-modeling/process-kinds.html#independent-subprocess-callable)  tagged with `tool` that the agent can invoke during execution. It receives typed input from the agent, runs any Axon Ivy logic you implement (database lookups, calculations, external API calls, workflow actions), and returns a result the agent reads and reasons over.

![Callable process tool](cms:/Files/Images/feature05-01)

The agent decides **when** to call a tool based on its description and your System Prompt instructions. You decide **what** the tool does — the implementation is pure Axon Ivy.

---

## Why use tools?

- **Real-time data** — LLMs are frozen at their training cutoff. A tool can query a live database or call an external API.
- **Business rules** — approval thresholds, pricing logic, compliance checks — rules that change and must not be hardcoded into a prompt.
- **Side effects** — create a task, send a notification, write to an ERP system — actions the LLM cannot do on its own.

---

## Element configuration

### Tools

Lists the callable sub-processes the agent is allowed to invoke, as a JSON array of signature names.

**Example:**

```json
["lookupApprovalPolicy", "calculateEffectiveTaxRate", "chooseApprover"]
```

**How it works:** At runtime, Smart Workflow registers each listed tool with the LLM as an available function. The agent's System Prompt tells it when and how to use them. When the LLM decides to call a tool, Smart Workflow invokes the matching callable sub-process, passes the parameters, and feeds the result back into the LLM conversation. The agent then continues reasoning with the new information.

> The **AI Provider** and **Model** fields work the same way as in [Basic Agent Setup] — leave them blank to use the global default.

---

## Creating a tool process

A tool is a standard **CALLABLE_SUB** process with one key difference: the `CallSubStart` element is tagged as `tool`.

### Tool signatures

Each `CallSubStart` defines one tool's interface — its name, input parameters, and return value. Multiple tools can live in the same callable sub file:

| Tool | Input | Result |
| --- | --- | --- |
| `lookupApprovalPolicy` | `amount: String` | `policy: String` — `STANDARD` or `REQUIRES_APPROVAL` |
| `calculateEffectiveTaxRate` | `currency: String` | `taxRate: String` — e.g. `21%` |
| `chooseApprover` | `amount: String` | `approver: String` — e.g. `Finance Manager` |

The `tags: ["tool"]` marking on each `CallSubStart` is what tells Smart Workflow the element can be used as an agent tool.

Parameter types are not limited to `String`. You can declare any Java type — a primitive, a data class, or a complex object. Smart Workflow serializes the value as JSON between the LLM and your process. For simple scalar values like amounts or currency codes, `String` is the easiest choice. For structured input (e.g. a search criteria object with multiple fields), declare a typed data class and the LLM will populate its fields from the conversation context.

### Input and result mapping

For each tool, the `CallSubStart` configuration has two mapping sections:

**Input map** — copies the parameter the agent passes into the data class field so the Script can read it:

```text
out.amount ← param.amount
```

**Result map** — copies the data class field back to the agent as the tool's return value:

```text
result.policy ← in.policy
```

### Descriptions sent to the LLM

Smart Workflow sends three kinds of description text to the model for every registered tool:

| What | Where you set it | What the LLM uses it for |
| --- | --- | --- |
| **Tool description** | **Description** field on the `CallSubStart` element | Understands what the tool does and when to call it |
| **Input parameter descriptions** | `desc` on each input parameter | Knows what value to pass and in what format |
| **Result parameter descriptions** | `desc` on each result parameter | Knows what the return value represents |

Together these form the tool's complete contract with the model. The clearer they are, the more reliably the agent will call the right tool with the right input — even without an exhaustive System Prompt.

**Examples from this guide:**

`lookupApprovalPolicy`:

- **Tool:** *"Use this tool to determine the approval policy for an invoice amount. Returns STANDARD if the invoice can be auto-approved, or REQUIRES_APPROVAL if manual sign-off is needed."*
- **Input `amount`:** *"Invoice total amount as a plain number string"*
- **Result `policy`:** *"Approval policy: STANDARD or REQUIRES_APPROVAL"*

`calculateEffectiveTaxRate`:

- **Tool:** *"Use this tool to look up the applicable VAT rate for an invoice. Pass the ISO 4217 currency code (e.g. EUR, JPY) and receive the effective tax rate as a percentage string."*
- **Input `currency`:** *"ISO 4217 currency code of the invoice"*
- **Result `taxRate`:** *"Effective tax rate as a percentage string, e.g. 21%"*

`chooseApprover`:

- **Tool:** *"Use this tool to select the responsible approver for an invoice. Pass the total amount as a plain number string and receive the username of the approver who must sign off."*
- **Input `amount`:** *"Invoice total amount as a plain number string"*
- **Result `approver`:** *"Username of the responsible approver (e.g. alice.chen, bob.smith, or carol.jones)"*

> Even when your System Prompt explicitly names each tool, good descriptions act as a safety net. The model reads them to know exactly what to pass and what to expect back, so it can invoke tools correctly without guessing.

### Implementation

Between each `CallSubStart` and its `CallSubEnd`, add the Axon Ivy elements that implement the tool's logic. In this example, each tool uses a single Script element:

**lookupApprovalPolicy** — applies the approval threshold rule:

```java
try {
  double amount = Double.parseDouble(in.amount.trim());
  in.policy = amount > 5000 ? "REQUIRES_APPROVAL" : "STANDARD";
} catch (NumberFormatException e) {
  in.policy = "STANDARD";
}
```

**calculateEffectiveTaxRate** — returns the VAT rate for the invoice currency:

```java
String currency = in.currency != null ? in.currency.toUpperCase() : "";
if ("EUR".equals(currency)) {
  in.taxRate = "21%";
} else if ("GBP".equals(currency)) {
  in.taxRate = "20%";
} else if ("USD".equals(currency)) {
  in.taxRate = "10%";
} else if ("JPY".equals(currency)) {
  in.taxRate = "8%";
} else {
  in.taxRate = "10%";
}
```

**chooseApprover** — returns the username of the responsible approver based on the invoice amount:

```java
try {
  double amount = Double.parseDouble(in.amount.trim());
  if (amount > 50000)      in.approver = "alice.chen";
  else if (amount > 10000) in.approver = "bob.smith";
  else                     in.approver = "carol.jones";
} catch (NumberFormatException e) {
  in.approver = "carol.jones";
}
```

In a real process, these Scripts could be replaced by database queries, REST calls to an ERP, or any other Axon Ivy logic.

---

## Example — Acme Corp invoice approval

### System Prompt

```text
You are an invoice approval assistant for Acme Corp.
Given invoice text:
1. Extract the total amount as a plain number string (digits and decimal point only) and the ISO 4217 currency code.
2. Call calculateEffectiveTaxRate with the currency code — use the result as effectiveTaxRate.
3. Call lookupApprovalPolicy with the total amount — set isAutoApprove to true if the result is STANDARD, false if REQUIRES_APPROVAL.
4. Call chooseApprover with the total amount — use the result as approverUsername.
5. Return a structured InvoiceDecision with all three fields populated.
```

**Query:** `<%=in.invoiceText%>`

**Tools:** `["lookupApprovalPolicy", "calculateEffectiveTaxRate", "chooseApprover"]`

**Expect result of type:** `tutorial.InvoiceDecision.class`

**Map result to:** `in.invoiceDecision`

### Result

After the agent element, `in.invoiceDecision` is a typed `InvoiceDecision` object — read each field directly:

```javascript
in.invoiceDecision.effectiveTaxRate   // → "21%"
in.invoiceDecision.isAutoApprove      // → false
in.invoiceDecision.approverUsername   // → "bob.smith"
```

The process gateway checks `in.invoiceDecision.isAutoApprove == false` and routes accordingly — to the **Manager Review** task or straight to **Auto-approved**. No string parsing needed.

---

## Common mistakes

- **Tool not found** — The name in the `tools` array must exactly match the `signature` of the `CallSubStart` element. A mismatch causes the tool registration to fail silently and the agent will act as if no tools are available.
- **Missing `tool` tag** — Without `tags: ["tool"]` on the `CallSubStart`, Smart Workflow does not register the callable sub as a tool. The agent will not be able to invoke it.
- **Agent ignores a tool** — If the System Prompt does not clearly instruct the agent to call a tool (when, with what input), the LLM may skip it and guess instead. Be explicit: name each tool and describe the input it expects.
- **Type mismatch** — Tool parameters support any Java type, but the LLM must be able to construct a valid value for that type from the conversation context. If you declare a complex object type, make sure its fields have clear `desc` values so the LLM knows how to populate them. When in doubt, `String` is the safest choice for scalar values.

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/processes/tutorial/features/Feature05.p.json` — the agent process with the Alternative gateway
- `tutorial/processes/tutorial/tools/Feature05Tools.p.json` — all three tools in one callable sub

Open both in the Designer. In `Feature05.p.json`, inspect the `Invoice Approval Agent` element — note the `Tools` field listing all three signatures. In `Feature05Tools.p.json`, inspect each `CallSubStart` — note the `tool` tag, the individual input/result parameter mappings, and the **Description** field that is sent to the LLM.

---

## See also

- [Basic Agent Setup]
- [Structured Output]
- [Java Tools]
- [Model Provider Selection]
