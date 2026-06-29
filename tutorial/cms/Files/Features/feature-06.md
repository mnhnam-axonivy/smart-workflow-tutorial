# Java Tools

Implement the `SmartWorkflowTool` interface in Java for pure-code tool logic, then register via SPI so any agent can discover and call it.

## What is it?

A **Java Tool** is a class that implements `SmartWorkflowTool` and exposes a named, typed operation to AI agents. The framework discovers Java Tools through the SPI mechanism and makes them available to agents alongside Callable Process Tools.

Java Tools are best for logic that is entirely computational — no workflow steps, no user dialogs, no Ivy-specific APIs needed. Think tax calculators, data transformers, or third-party SDK wrappers.

## Why use it?

- Full Java type system for complex parameter structures (custom classes, Lists)
- Unit-testable without an Ivy runtime
- Wraps third-party Java SDKs cleanly
- Reusable across multiple projects via JAR dependency

> **Prefer Callable Process Tools (#05)** over Java Tools whenever possible. Use Java Tools only when the logic has no workflow steps and is better expressed in plain Java.

## How it works

1. Implement `SmartWorkflowTool` with `name()`, `description()`, `parameters()`, and `execute()`.
2. Create a `SmartWorkflowToolsProvider` that returns your tool(s).
3. Register the provider via Java SPI in `META-INF/services/`.
4. Add the tool name to the agent's `Tools` list.
5. At runtime the framework loads all providers, builds tool schemas, and passes them to the LLM.

## Example

A tax calculator tool from the demo project:

Step 1 — Implement SmartWorkflowTool

```java
public class TaxCalculatorTool implements SmartWorkflowTool {

  @Override
  public String name() {
    return "calculateTax";
  }

  @Override
  public String description() {
    return """
        Calculate the tax amount for each line item of an invoice.
        Pass the full invoice object and receive per-item tax calculations.
        Use this tool when the user asks about tax, VAT, or price breakdown.""";
  }

  @Override
  public List<ToolParameter> parameters() {
    return List.of(
        new ToolParameter("invoice", "The invoice to calculate tax for",
            "com.axonivy.utils.ai.Invoice")
    );
  }

  @Override
  public Object execute(Map<String, Object> args) {
    // The framework deserializes the JSON argument to Invoice automatically
    Invoice invoice = (Invoice) args.get("invoice");
    List<TaxLineItem> taxItems = invoice.lineItems().stream()
        .map(item -> new TaxLineItem(
            item.description(),
            item.unitPrice().multiply(BigDecimal.valueOf(0.19))
        ))
        .toList();
    return new TaxCalculationResult(invoice.invoiceNumber(), taxItems);
  }

  public record TaxCalculationResult(String invoiceNumber, List<TaxLineItem> items) {}
  public record TaxLineItem(String description, BigDecimal taxAmount) {}
}
```

Step 2 — Create provider

```java
public class DemoToolProvider implements SmartWorkflowToolsProvider {
  @Override
  public List<SmartWorkflowTool> getTools() {
    return List.of(new TaxCalculatorTool());
  }
}
```

Step 3 — Register via SPI

```text
// File: src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider
com.example.DemoToolProvider
```

Supported parameter types

| Kind | Type string example |
|---|---|
| Primitive | `"int"`, `"boolean"`, `"double"` |
| Java class | `"java.lang.String"`, `"com.example.Invoice"` |
| List | `"java.util.List<java.lang.String>"` |

Arrays are not supported — use `List` instead. The framework deserializes JSON arguments to the declared Java type automatically.

## Where to find it

- `smart-workflow/src/com/axonivy/utils/smart/workflow/tools/provider/SmartWorkflowTool.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/tools/provider/SmartWorkflowToolsProvider.java`
- `smart-workflow-demo/src/com/axonivy/utils/smart/workflow/demo/tool/TaxCalculatorTool.java`
- `smart-workflow-demo/src/com/axonivy/utils/smart/workflow/demo/tool/DemoToolProvider.java`
- `doc/TOOLS.md`

## Key configuration

| Step | Location | What to do |
|---|---|---|
| 1 | Java class | Implement `SmartWorkflowTool` |
| 2 | Java class | Implement `SmartWorkflowToolsProvider` |
| 3 | `src/META-INF/services/` | Register provider class name |
| 4 | Agent element | Add tool `name()` to the Tools list |

## Common mistakes

- **Forgetting the SPI registration file** — Without the file in `META-INF/services/`, the framework will never load your provider and the tool will be invisible to all agents.
- **Using arrays instead of Lists** — The deserializer does not support Java arrays. Always declare list parameters as `java.util.List<T>`.
- **Not adding the tool to the agent's Tools list** — Registering a tool makes it globally *available*, but agents only use tools listed in their configuration.

## See also

- [Callable Process Tools]
- [Web Search Tool]
- [Custom Model Provider (SPI)]
