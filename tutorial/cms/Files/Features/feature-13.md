# Custom Guardrails

Implement `GuardrailProvider` SPI to add domain-specific input or output validation rules that the built-in guardrails don't cover.

## What is it?

Custom guardrails extend the built-in safety system with business-specific rules. You implement `SmartWorkflowInputGuardrail` or `SmartWorkflowOutputGuardrail` in Java, register them via a `GuardrailProvider` SPI, and reference them by name in agent configuration — exactly like the built-in ones.

Examples: block competitor mentions in output, reject messages containing specific product codes, enforce maximum response length, or validate that agent output matches a business rule schema.

## Why use it?

- Domain rules that are impossible to express in a generic regex
- Compliance requirements specific to your industry or jurisdiction
- Brand protection — block certain topics, competitors, or content from AI responses
- Data quality validation — reject agent output that doesn't meet business standards
- Same registration mechanism as built-in guardrails — no framework changes needed

## How it works

1. Implement `SmartWorkflowInputGuardrail` and/or `SmartWorkflowOutputGuardrail`.
2. Create a `GuardrailProvider` that returns your guardrail instances.
3. Register the provider via SPI in `META-INF/services/`.
4. Reference the guardrail by its `name()` in the agent element or `variables.yaml`.

The framework calls `evaluate(message)` (or `evaluate(message, invocationId)` for stateful guardrails like PII masking). Return `GuardrailResult.allow()` to pass, or `GuardrailResult.block(reason)` to reject.

## Example

A guardrail that blocks mentions of competitor product names in agent responses:

Custom Output Guardrail

```java
package com.example.guardrails;

import com.axonivy.utils.smart.workflow.guardrails.entity.GuardrailResult;
import com.axonivy.utils.smart.workflow.guardrails.entity.SmartWorkflowOutputGuardrail;

public class CompetitorMentionOutputGuardrail implements SmartWorkflowOutputGuardrail {

  private static final List<String> BLOCKED_NAMES = List.of(
      "CompetitorA", "CompetitorB", "OtherVendor"
  );

  @Override
  public String name() {
    return "CompetitorMentionOutputGuardrail";
  }

  @Override
  public GuardrailResult evaluate(String message) {
    boolean mentionsCompetitor = BLOCKED_NAMES.stream()
        .anyMatch(name -> message.toLowerCase().contains(name.toLowerCase()));

    if (mentionsCompetitor) {
      return GuardrailResult.block(
          "Response mentions a competitor. Please rephrase without referring to other vendors.");
    }
    return GuardrailResult.allow();
  }
}
```

Custom Input Guardrail

```java
public class ContentPolicyInputGuardrail implements SmartWorkflowInputGuardrail {

  @Override
  public String name() { return "ContentPolicyInputGuardrail"; }

  @Override
  public GuardrailResult evaluate(String message) {
    if (message.length() > 2000) {
      return GuardrailResult.block("Message exceeds maximum length of 2000 characters.");
    }
    return GuardrailResult.allow();
  }
}
```

Provider class

```java
public class MyGuardrailProvider implements GuardrailProvider {

  @Override
  public List<SmartWorkflowInputGuardrail> getInputGuardrails() {
    return List.of(new ContentPolicyInputGuardrail());
  }

  @Override
  public List<SmartWorkflowOutputGuardrail> getOutputGuardrails() {
    return List.of(new CompetitorMentionOutputGuardrail());
  }
}
```

SPI registration

```text
// File: src/META-INF/services/com.axonivy.utils.smart.workflow.guardrails.provider.GuardrailProvider
com.example.guardrails.MyGuardrailProvider
```

Use in variables.yaml or per-agent

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput: "PromptInjectionInputGuardrail, ContentPolicyInputGuardrail"
      DefaultOutput: "SensitiveDataOutputGuardrail, CompetitorMentionOutputGuardrail"
```

> The SPI registration file is **required**. Without it, Smart Workflow will never load your provider and your guardrails will be silently unavailable to all agents.

## Where to find it

- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/entity/SmartWorkflowInputGuardrail.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/entity/SmartWorkflowOutputGuardrail.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/provider/GuardrailProvider.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/entity/GuardrailResult.java`
- `smart-workflow-demo/src/com/axonivy/utils/smart/workflow/demo/guardrails/  (demo custom guardrails)`
- `doc/GUARDRAILS.md`

## Key configuration

| Step | What to do |
|---|---|
| 1 | Implement `SmartWorkflowInputGuardrail` or `SmartWorkflowOutputGuardrail` |
| 2 | Implement `GuardrailProvider` returning your guardrail(s) |
| 3 | Register provider in `META-INF/services/` |
| 4 | Add guardrail `name()` to `DefaultInput`/`DefaultOutput` in variables.yaml or per-agent |
| 5 | Add Error Boundary Event for `smartworkflow:guardrail:*:violation` |

## Common mistakes

- **Missing SPI file** — The most common mistake. The file must be in `src/META-INF/services/` with the exact interface name and contain the fully-qualified provider class name.
- **name() mismatch** — The string returned by `name()` must exactly match what you put in the variables or agent configuration. A typo means the guardrail is never applied.
- **Expensive logic in evaluate()** — `evaluate()` is called synchronously on every message. Avoid external HTTP calls, database queries, or heavy computation — these add latency to every agent interaction.

## See also

- [Guardrails (Basic)]
- [PII Masking Guardrail]
- [Java Tools (SPI pattern)]
