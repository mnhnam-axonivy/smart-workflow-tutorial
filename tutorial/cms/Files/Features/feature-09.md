# Observability & History

Record every agent conversation to Ivy's built-in history and trace LLM calls, tool executions, and guardrail results in Arize Phoenix — with zero code changes.

## What is it?

Smart Workflow provides three complementary observability mechanisms:

- **Ivy History Recording** — conversations, tool calls, and guardrail results stored in Ivy's built-in case history, accessible from the Portal.
- **Arize Phoenix / OpenInference Tracing** — distributed trace spans for every LLM call, tool invocation, and guardrail check, visualised in the Arize Phoenix UI.
- **Custom Fields** — marks Ivy tasks/cases with an `aiAssisted` flag so AI-handled work is identifiable in dashboards.

## Why use it?

- Debug agent behaviour — see exactly which tools were called and why
- Audit trail for compliance — every AI decision is recorded with timestamps
- Token cost analysis — Arize Phoenix shows cost per call and model usage
- Guardrail visibility — see which inputs were blocked and by which guardrail
- Replay and compare requests to improve prompts over time

## How it works

**Ivy History:** When enabled, the framework records an `AgentConversationEntry` for each agent interaction. This entry contains nested records for tool executions and guardrail results, all stored in Ivy's case/task history store.

**OpenInference Tracing:** Each agent invocation creates a root trace span. Child spans are created for every LLM call, tool execution, and guardrail evaluation. Spans are exported to an Arize Phoenix server using the OpenInference protocol.

Both systems are enabled independently via variables — turn on one, both, or neither.

## Example

variables.yaml — enable Ivy history recording

```yaml
Variables:
  AI:
    Observability:
      Ivy:
        Enabled: "true"
```

variables.yaml — enable Arize Phoenix tracing

```yaml
Variables:
  AI:
    Observability:
      Openinference:
        Enabled: "true"
        # Set to "true" to hide sensitive message content from trace spans
        HideInputMessages: "false"
        HideOutputMessages: "false"
```

Arize Phoenix — what each span contains

```text
LLM span:
  input.value     = full prompt sent to the model
  output.value    = model response
  llm.token_count = prompt + completion tokens
  llm.model_name  = model used

Tool span:
  tool.name       = name of the tool called
  input.value     = arguments passed to the tool
  output.value    = tool return value

Guardrail span:
  openinference.span.kind = GUARDRAIL
  validator_name          = guardrail class name
  guardrail.result        = SUCCESS | FAILURE | FATAL
  guardrail.type          = INPUT | OUTPUT
```

Custom Fields — aiAssisted flag

```yaml
Variables:
  AI:
    Observability:
      CustomFields:
        Enabled: "true"   # marks tasks/cases with aiAssisted = "true"
```

> Arize Phoenix is an open-source LLM observability platform. Run it locally with Docker: `docker run -p 6006:6006 arizephoenix/phoenix`. Smart Workflow sends traces to `http://localhost:6006` by default.

## Where to find it

- `smart-workflow/src/com/axonivy/utils/smart/workflow/governance/history/  (Ivy history)`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/observability/  (OpenInference tracing)`
- `doc/observe/  (observability docs)`

## Key configuration

| Variable | Description | Default |
|---|---|---|
| `AI.Observability.Ivy.Enabled` | Record conversations to Ivy case history. | `false` |
| `AI.Observability.Openinference.Enabled` | Send OpenInference spans to Arize Phoenix. | `false` |
| `AI.Observability.Openinference.HideInputMessages` | Omit user message content from spans (privacy). | `false` |
| `AI.Observability.Openinference.HideOutputMessages` | Omit LLM response content from spans (privacy). | `false` |
| `AI.Observability.CustomFields.Enabled` | Mark AI-assisted tasks/cases with custom field. | `true` |

## Common mistakes

- **Sensitive data in traces** — If `HideInputMessages` and `HideOutputMessages` are false, full conversation content is sent to Arize Phoenix. In production with PII-sensitive data, set both to `true` or ensure your Arize instance is private.
- **Arize Phoenix not running** — If tracing is enabled but Phoenix is not reachable, trace export may fail silently or cause latency. Disable tracing (`Openinference.Enabled: "false"`) in environments where Phoenix is not deployed.

## See also

- [Guardrails (Basic)]
- [PII Masking Guardrail]
- [Basic Agent Setup]
