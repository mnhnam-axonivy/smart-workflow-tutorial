# PII Masking Guardrail

Automatically detect and pseudonymise personal data in agent inputs before sending to the LLM, then restore original values in the output — keeping PII out of third-party AI services.

## What is it?

The **PII Masking Guardrail** (`PiiMaskingGuardrail`) is a stateful guardrail that implements both `SmartWorkflowInputGuardrail` and `SmartWorkflowOutputGuardrail`. It detects personally identifiable information (names, emails, phone numbers, etc.) in the input, replaces them with placeholder tokens before the LLM sees them, then swaps the placeholders back to real values in the output.

This ensures PII never leaves your infrastructure and reaches the external LLM provider.

## Why use it?

- GDPR / CCPA compliance — personal data must not be sent to third-party processors without consent
- Data sovereignty — keep customer data within your control boundary
- Reduces risk of PII appearing in LLM training data or logs
- Compatible with all cloud providers since the LLM only sees anonymised text
- Transparent to the final user — original values are restored in the response

## How it works

The guardrail maintains an internal mapping of `placeholder → original value` per **invocation ID**. The input and output phases share this mapping via the `evaluate(message, invocationId)` method. Mappings are scoped to a single agent invocation and discarded afterwards.

Flow: Input with PII → Input guardrail: detect & replace PII with [PERSON_1], [EMAIL_1], etc. → Anonymised text sent to LLM → LLM responds with placeholders → Output guardrail: restore real values → Response with original PII returned to process.

## Example

Enable PII masking via variables.yaml

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput:  "PiiMaskingGuardrail"
      DefaultOutput: "PiiMaskingGuardrail"
```

What the masking does (conceptual)

```text
Original input:
  "Please summarise the contract for John Smith (john.smith@example.com)."

After input masking sent to LLM:
  "Please summarise the contract for [PERSON_1] ([EMAIL_1])."

LLM response (with placeholders):
  "The contract for [PERSON_1] expires on 31 December. Please notify [EMAIL_1]."

After output restoration:
  "The contract for John Smith expires on 31 December. Please notify john.smith@example.com."
```

PiiMaskingGuardrail interface (for reference)

```java
// Implements BOTH input and output interfaces — register it in both lists
public class PiiMaskingGuardrail
    implements SmartWorkflowInputGuardrail, SmartWorkflowOutputGuardrail {

  // Input phase: replace PII with tokens, store mapping keyed by invocationId
  @Override
  public GuardrailResult evaluate(String message, String invocationId) { ... }

  // Output phase: restore tokens using the stored mapping
  @Override
  public GuardrailResult evaluate(String message, String invocationId) { ... }
}
```

> `PiiMaskingGuardrail` must be registered in **both** `DefaultInput` and `DefaultOutput` (or per-agent input and output lists). If you only add it to input, the LLM response will contain placeholder tokens instead of real values.

## Where to find it

- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/pii/PiiMaskingGuardrail.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/guardrails/entity/SmartWorkflowGuardrail.java`
- `doc/GUARDRAILS.md`

## Key configuration

| Variable | Value | Notes |
|---|---|---|
| `AI.Guardrails.DefaultInput` | `PiiMaskingGuardrail` | Must also be in DefaultOutput |
| `AI.Guardrails.DefaultOutput` | `PiiMaskingGuardrail` | Must also be in DefaultInput |

Both input and output must reference the same guardrail name so the framework uses the same instance with the shared placeholder mapping for the same invocation.

## Common mistakes

- **Registering in input only, not output** — If only configured as an input guardrail, placeholders like `[PERSON_1]` appear in the final response. Always add it to both input and output.
- **LLM altering placeholders** — Some models may paraphrase or modify placeholder tokens (e.g. "Person 1" instead of "[PERSON_1]"). This breaks the restoration mapping. Test with your chosen model and adjust the placeholder format if needed.
- **Treating PII masking as a complete privacy solution** — PII masking reduces risk but is not a complete privacy solution. Metadata, IP addresses, session IDs, and contextual information may still reveal identity. Combine with data minimisation and privacy-by-design principles.

## See also

- [Guardrails (Basic)]
- [Custom Guardrails]
- [Observability & History]
