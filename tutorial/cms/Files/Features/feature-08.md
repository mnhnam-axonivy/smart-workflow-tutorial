# Guardrails (Basic)

Enable built-in prompt injection detection and sensitive data blocking with a single variable — the first line of defence for production AI agents.

## What is it?

**Guardrails** validate agent inputs and outputs before and after LLM execution. Smart Workflow ships with three built-in guardrails:

| Guardrail | Type | Description |
|---|---|---|
| `PromptInjectionInputGuardrail` | Input | Regex-based detection of "ignore previous instructions", control chars, and injection patterns. Zero latency, no cost. |
| `AiPromptInjectionInputGuardrail` | Input | LLM-based YES/NO classifier — catches roleplay jailbreaks, authority spoofing, and subtle attacks missed by regex. Adds one LLM call per message. |
| `SensitiveDataOutputGuardrail` | Output | Blocks responses containing API keys or private key material. |

## Why use it?

- Prevent attackers from hijacking your agent with injected instructions
- Stop the agent from leaking secrets or credentials in its response
- Required for any customer-facing or production-grade AI feature
- Guardrail violations are logged in Ivy history and Arize Phoenix for audit

|  | PromptInjection (regex) | AiPromptInjection (LLM) |
|---|---|---|
| Detection | Keyword patterns | Intent-aware classifier |
| Catches | Basic attacks | Roleplay, authority claims, obfuscation |
| Latency | ~0 ms | +LLM call |
| Cost | Free | Token cost |
| When to use | Default / general | High-security, customer-facing |

## How it works

If any guardrail blocks, an exception with a specific error code is thrown. You catch this with an **Error Boundary Event** on the AgenticProcessCall element and handle it gracefully (e.g. show a friendly error message).

- Input blocked: error code `smartworkflow:guardrail:input:violation`
- Output blocked: error code `smartworkflow:guardrail:output:violation`

Flow: User message arrives → Input guardrails run (in order) → LLM call → Output guardrails run → Response returned to process.

## Example

variables.yaml — enable default guardrails

```yaml
Variables:
  AI:
    Guardrails:
      # Applied to every agent that doesn't configure its own list
      DefaultInput: "PromptInjectionInputGuardrail"
      DefaultOutput: "SensitiveDataOutputGuardrail"
```

Per-agent override (in element editor)

```java
// Input guardrails field:
["PromptInjectionInputGuardrail", "AiPromptInjectionInputGuardrail"]

// Output guardrails field:
["SensitiveDataOutputGuardrail"]
```

AI-based guardrail — pin a cheap model to reduce cost

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput: "AiPromptInjectionInputGuardrail"
      PromptInjection:
        Classifier:
          Provider: "OpenAI"       # use a cheap provider for the classifier
          Model: "gpt-4.1-nano"    # cheapest model for YES/NO classification
          MinLength: "20"          # skip LLM call for very short messages
```

BPMN — Error Boundary Event to handle violations

```text
AgenticProcessCall element
  └─ Error Boundary Event
       Error Code: smartworkflow:guardrail:input:violation
       → Show message: "Your message was blocked by our safety filter."
```

> Always add an Error Boundary Event. Without it, a guardrail violation will propagate as an unhandled exception and crash the process.

## Where to find it

- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/input/PromptInjectionInputGuardrail.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/input/AiPromptInjectionInputGuardrail.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/output/SensitiveDataOutputGuardrail.java`
- `smart-workflow-demo/processes/Features/GuardrailDemo.p.json`
- `doc/GUARDRAILS.md`

## Key configuration

| Variable | Description |
|---|---|
| `AI.Guardrails.DefaultInput` | Comma-separated input guardrail names applied to all agents by default. |
| `AI.Guardrails.DefaultOutput` | Comma-separated output guardrail names applied to all agents by default. |
| `AI.Guardrails.PromptInjection.Classifier.Provider` | AI provider for the LLM-based classifier. Falls back to DefaultProvider if empty. |
| `AI.Guardrails.PromptInjection.Classifier.Model` | Model for the classifier (use cheapest available). |
| `AI.Guardrails.PromptInjection.Classifier.MinLength` | Messages shorter than this (chars) skip the LLM check. Default: 0. |

## Common mistakes

- **No Error Boundary Event** — Guardrail violations throw exceptions. Without an Error Boundary Event catching the error code, the entire process fails unhandled. Always add one.
- **AiPromptInjection with no model configured** — Without a dedicated cheap classifier model, the guardrail uses your main agent model (e.g. GPT-4o) for every message — this doubles cost and latency.
- **Relying solely on guardrails for security** — Guardrails are a safety net, not a complete security solution. Still validate and sanitise inputs at the application level before they reach the agent.

## See also

- [Custom Guardrails]
- [PII Masking Guardrail]
- [Observability & History]
