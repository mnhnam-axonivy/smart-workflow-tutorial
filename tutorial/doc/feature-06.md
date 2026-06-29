# Java Tools

A **Java Tool** is a class that implements `SmartWorkflowTool` and exposes a named, typed operation to AI agents. The framework discovers Java Tools through the Java SPI mechanism and makes them available to any agent alongside Callable Process Tools.

---

> **This builds on [Callable Process Tools].** The agent configuration is identical — the only difference is that the tool logic lives in Java code instead of an Axon Ivy callable sub-process.
>
> **Example used in this guide: Acme Corp FX conversion**
>
> Acme Corp receives invoices in JPY. The agent reads the invoice, extracts the total amount and currency, calls a Java tool (`convertToUSD`) to calculate the USD equivalent using fixed exchange rates, and returns a one-sentence summary combining the invoice details with the converted amount.
>
> ![Example process](cms:/Files/Images/feature06-00)
>
> The finished process is at `tutorial/processes/tutorial/features/Feature06.p.json` — open it in the Designer to follow along as you read.

---

## Before you start

In [Callable Process Tools] you saw how to give an agent access to live business logic by implementing tools as callable sub-processes inside the Axon Ivy Designer — no Java required.

**Java Tools are a different approach for a different situation.** Use them when the tool logic is purely computational — no workflow steps, no user dialogs, no Axon Ivy-specific APIs — and where plain Java expresses the logic more cleanly, or where you need to wrap a third-party Java SDK.

| | Callable Process Tools | Java Tools |
|---|---|---|
| **Implemented in** | Axon Ivy Designer | Java class |
| **Can use Ivy elements** | Yes | No |
| **Unit testable without runtime** | No | Yes |
| **Wraps third-party Java SDKs** | Awkward | Clean |
| **Reusable across projects** | Copy process | JAR dependency |
| **Recommended for** | Application development | Library authors, pure computation |

**Prefer Callable Process Tools whenever possible.** Java Tools are for logic that has no workflow steps and is better expressed in plain Java.

---

## What is a Java tool?

A Java Tool is a class that implements the `SmartWorkflowTool` interface. It has four methods:

| Method | Purpose |
|---|---|
| `name()` | The tool name the agent uses in the `Tools` list |
| `description()` | Tells the LLM what the tool does and when to call it |
| `parameters()` | Declares the typed inputs the agent must provide |
| `execute()` | Receives the arguments and returns the result |

The framework discovers Java Tools via Java SPI: you register a `SmartWorkflowToolsProvider` in `META-INF/services/`, and the framework loads it at startup.

---

## Why use it?

- **Full Java type system** — parameters can be custom classes or `List<T>`, not just strings
- **Unit-testable** — no Ivy runtime needed; test `execute()` with a plain `Map`
- **Wraps third-party SDKs** — integrate any Java library cleanly inside `execute()`
- **Reusable** — package the tool as a JAR and share it across multiple Axon Ivy projects

---

## Step 1 — Implement SmartWorkflowTool

Create a Java class that implements `com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowTool`:

**Example — `FxRateConverterTool`:**

```java
public class FxRateConverterTool implements SmartWorkflowTool {

  private static final Map<String, Double> RATES_TO_USD = Map.of(
      "USD", 1.0, "EUR", 1.09, "GBP", 1.27, "JPY", 0.0067
  );

  @Override
  public String name() {
    return "convertToUSD";
  }

  @Override
  public String description() {
    return """
        Convert an invoice amount from its original currency to USD using fixed exchange rates.
        Pass the total amount as a plain number string and the ISO 4217 currency code.
        Returns the converted amount as a formatted string showing the original, USD equivalent, and rate.""";
  }

  @Override
  public List<ToolParameter> parameters() {
    return List.of(
        new ToolParameter("amount",
            "Invoice total amount as a plain number string (digits and decimal point only)",
            "String"),
        new ToolParameter("currency",
            "ISO 4217 currency code of the invoice (e.g. JPY, EUR, GBP, USD)",
            "String")
    );
  }

  @Override
  public Object execute(Map<String, Object> args) {
    String amountStr = (String) args.get("amount");
    String currency = ((String) args.get("currency")).toUpperCase().trim();
    double amount = Double.parseDouble(amountStr.replaceAll("[^0-9.]", ""));
    double rate = RATES_TO_USD.getOrDefault(currency, 1.0);
    double usd = amount * rate;
    return String.format("%.2f %s = %.2f USD (rate: %.4f)", amount, currency, usd, rate);
  }
}
```

**`name()`** is the identifier the agent uses. It must exactly match the string in the agent's `Tools` list.

**`description()`** is sent verbatim to the LLM. Write it as an instruction: what the tool does, when to use it, and what format to expect in the result. The clearer it is, the more reliably the agent calls the tool correctly.

**`parameters()`** declares each input. The `type` field of `ToolParameter` must be the fully qualified Java class name (or a primitive name). The framework serialises the argument from the LLM's JSON into that type automatically before calling `execute()`.

**`execute()`** receives a `Map<String, Object>` where each key is a parameter name. Cast the value to the declared type and return any Java object — the framework serialises it to JSON and feeds it back to the LLM.

---

## Step 2 — Create a SmartWorkflowToolsProvider

Create a class that implements `SmartWorkflowToolsProvider` and lists the tools you want to expose:

```java
public class TutorialToolProvider implements SmartWorkflowToolsProvider {

  @Override
  public List<SmartWorkflowTool> getTools() {
    return List.of(new FxRateConverterTool());
  }
}
```

One provider can expose multiple tools. The framework calls `getTools()` at startup and registers all returned tools globally.

---

## Step 3 — Register via SPI

Create the file `src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider` and add your provider's fully qualified class name:

```text
tutorial.tool.TutorialToolProvider
```

Without this file the framework will never load your provider and the tool will be invisible to all agents — regardless of whether the class is on the classpath.

---

## Step 4 — Add to agent Tools list

In the `AgenticProcessCall` configuration, add the tool's `name()` to the **Tools** field:

```json
["convertToUSD"]
```

Registering a tool makes it globally *available*, but an agent only uses the tools listed in its own configuration. This keeps agents focused and prevents unintended tool calls.

---

## Element configuration

### System Prompt

Tell the agent what to extract, when to call the tool, and what format to return.

**Example:**

```text
You are an invoice analyst for Acme Corp.
Given an invoice text:
1. Extract the total amount as a plain number string (digits and decimal point only) and the ISO 4217 currency code.
2. Call convertToUSD with the amount and currency code.
3. Return a single sentence summary containing: the invoice number, supplier name, original total amount with currency, and the USD equivalent returned by convertToUSD.
```

### Query

Bind to the process data field holding the invoice text:

```text
<%=in.invoiceText%>
```

### Map result to

The agent returns a plain String summary — no structured output needed for this example:

```text
in.summary
```

---

## Supported parameter types

| Kind | Type string example |
|---|---|
| Primitive | `"String"`, `"int"`, `"boolean"`, `"double"` |
| Java class | `"java.math.BigDecimal"`, `"com.example.MyClass"` |
| List | `"java.util.List<java.lang.String>"` |

Arrays are not supported — use `List` instead. The framework deserialises JSON arguments to the declared Java type automatically before `execute()` is called.

---

## Common mistakes

- **Forgetting the SPI registration file** — Without `META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider`, the framework never loads your provider. The tool will not appear in any agent, even if the class compiles and is on the classpath.
- **Tool name mismatch** — The string in the agent's `Tools` list must exactly match the return value of `name()`. A single character difference and the agent cannot find the tool.
- **Using arrays instead of Lists** — The deserialiser does not support Java arrays. Always declare list parameters as `java.util.List<T>`.
- **Not adding the tool to the agent's Tools list** — Registering a tool makes it globally *available*. Agents only use tools that are explicitly listed in their own `Tools` field.

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/processes/tutorial/features/Feature06.p.json` — the agent process
- `tutorial/src/tutorial/tool/FxRateConverterTool.java` — the Java tool implementation
- `tutorial/src/tutorial/tool/TutorialToolProvider.java` — the SPI provider
- `tutorial/src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider` — the SPI registration file

Open the process in the Designer and inspect the `Invoice Analyst Agent` element — note the `Tools` field containing `["convertToUSD"]`. Open `FxRateConverterTool.java` to see the full implementation.

---

## See also

- [Callable Process Tools]
- [Basic Agent Setup]
- [Structured Output]
- [Model Provider Selection]
