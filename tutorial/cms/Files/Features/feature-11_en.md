# PII Masking Guardrail

A **PII Masking Guardrail** automatically detects personally identifiable information in a user message before the LLM sees it, replaces sensitive values with opaque placeholder tokens, then restores the original values in the model's response — keeping real personal data out of third-party AI services.

Unlike the guardrails in [Input Guardrail] and [Output Guardrail], `PiiMaskingGuardrail` does not block requests. It is a **stateful, transparent** guardrail: the user receives a natural response with real values restored, while the LLM only ever processes anonymised placeholders.

---

> **This builds on [Input Guardrail].** You should be comfortable adding guardrails to the `AgenticProcessCall` element before attempting this feature.
>
> **Example used in this guide:** a single process sends a message containing 7 PII types to a customer support agent — all values are anonymised before the LLM call and restored in the output.
>
> The finished process is at `tutorial/processes/tutorial/features/Feature11.p.json`.

---

## Before you start

GDPR, CCPA, and other privacy regulations restrict sending personal data to third-party processors. With `PiiMaskingGuardrail`, your process can forward user messages to any cloud LLM provider without exposing real PII — the LLM sees only placeholder tokens, and the response is automatically de-anonymised before it reaches the user.

---

## How does it work?

`PiiMaskingGuardrail` implements **both** `SmartWorkflowInputGuardrail` and `SmartWorkflowOutputGuardrail`. It must be registered in both the agent's **Input Guardrails** and **Output Guardrails** to work correctly.

**On input:** the guardrail scans the message for PII patterns, replaces each value with a deterministic token in the format `<TYPE_hash>` (e.g. `<EMAIL_a1b2c3d4e5f6>`), and stores the mapping keyed by the invocation ID.

**On output:** the guardrail uses the stored mapping to substitute every placeholder back to its original value.

PII types detected:

| Type | Example |
| --- | --- |
| Email | `john.doe@example.com` |
| Phone | `+1-555-123-4567` |
| Credit / debit card | `4532015112830366` |
| SSN | `123-45-6789` |
| Date of birth | `15/06/1990` |
| IP address | `192.168.1.42` |
| MAC address | `00:1A:2B:3C:4D:5E` |

> Credit card numbers are validated with the **Luhn algorithm** — random digit strings that fail the checksum are not masked.

---

## Why use it?

- **GDPR / CCPA compliance** — personal data never leaves your infrastructure boundary
- **Data sovereignty** — keep customer data within your control
- **Transparent to the user** — original values are restored in the final response
- **Zero code** — no Java implementation required
- **Compatible with all cloud providers** — the LLM only processes anonymised text

---

## Step 1 — Add PiiMaskingGuardrail to both lists

In the `AgenticProcessCall` configuration, set both **Input Guardrails** and **Output Guardrails**:

| Field | Value |
| --- | --- |
| Input Guardrails | `["PiiMaskingGuardrail"]` |
| Output Guardrails | `["PiiMaskingGuardrail"]` |

> Setting it in input only will result in `<TYPE_hash>` placeholders appearing in the final user response. Always register it in both.

---

## Step 2 — Set a system prompt

This step is optional, but without it output restoration may silently fail.

The output guardrail restores PII by scanning the model's response for the exact `<TYPE_hash>` tokens it inserted. If the LLM paraphrases a token (e.g. writes "the email address" instead of `<EMAIL_a1b2c3d4e5f6>`), the token is not found and the original value is **not restored** — no error is thrown, the placeholder simply stays missing.

Adding a system prompt reduces this risk:

```text
Values formatted as <TYPE_hash> are anonymized placeholders — the original sensitive data was removed before reaching you. Treat each placeholder as an opaque token and echo it back as-is.
```

---

## Example

![Example process](cms:/Files/Images/feature11-00)

### Mock data

A message containing 7 PII types:

```
in.query = "Please echo back all fields: MAC 00:1A:2B:3C:4D:5E, email john.doe@example.com, " +
           "phone +1-555-123-4567, card 4532015112830366, SSN 123-45-6789, " +
           "born 15/06/1990, IP 192.168.1.42.";
```

> The above data is entirely fictional and does not correspond to any real person, account, or system.

### Agent configuration

| Field | Value |
| --- | --- |
| System prompt | `Values formatted as <TYPE_hash> are anonymized placeholders...` |
| Input Guardrails | `["PiiMaskingGuardrail"]` |
| Output Guardrails | `["PiiMaskingGuardrail"]` |

### What the LLM receives

Before the message reaches the model, all PII values are replaced with tokens:

```text
Please echo back all fields: MAC <MAC_ADDRESS_3c4d5e01a2b3>, email <EMAIL_a1b2c3d4e5f6>,
phone <PHONE_55512345678a>, card <CREDIT_DEBIT_CARD_NUMBER_11283036>, SSN <SSN_456789abc123>,
born <DATE_OF_BIRTH_06199042de56>, IP <IP_ADDRESS_168001042bcd>.
```

### Result

After the LLM responds using placeholders, the guardrail restores original values:

```text
MAC: 00:1A:2B:3C:4D:5E
Email: john.doe@example.com
Phone: +1-555-123-4567
Card: 4532015112830366
SSN: 123-45-6789
Born: 15/06/1990
IP: 192.168.1.42
```

---

## Configuration reference

| Variable | Description | Default |
| --- | --- | --- |
| `AI.Guardrails.DefaultInput` | Apply `PiiMaskingGuardrail` globally to all agents. | *(none)* |
| `AI.Guardrails.DefaultOutput` | Apply `PiiMaskingGuardrail` globally to all agents. | *(none)* |

To enable globally via `variables.yaml`:

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput:  "PiiMaskingGuardrail"
      DefaultOutput: "PiiMaskingGuardrail"
```

---

## Common mistakes

- **Registering in input only** — placeholders appear in the response instead of real values. Always add to both input and output.
- **LLM altering placeholders** — some models may rephrase `<EMAIL_a1b2c3d4e5f6>` as "the email address", breaking restoration. Add the system prompt hint and test with your chosen model.
- **Treating this as a complete privacy solution** — PII masking reduces risk but is not a full privacy guarantee. Metadata, session IDs, and contextual cues may still identify individuals. Combine with data minimisation and privacy-by-design principles.

---

## See also

- [Input Guardrail]
- [Output Guardrail]
- [Basic Agent Setup]
