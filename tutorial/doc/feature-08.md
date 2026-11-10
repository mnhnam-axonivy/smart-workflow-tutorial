# Observability

Once agents run in real processes, you need to know what they did: which Cases used AI, what each agent was asked and answered, which tools it called, what it cost, and which guardrails fired. Smart Workflow provides this at the **application level** — every agent is covered automatically, with no change to the agent configuration and no extra code.

---

> **This builds on [Basic Agent Setup].** The agent configuration does not change — observability is switched on with variables and applies to all agents in the application.
>
> **Example used in this guide:** Run any tutorial process — for example `Feature01.p.json` (invoice summary) or `Feature09.p.json` (output guardrail) — after enabling a channel, then inspect the result as described in each section.

---

## Three observability channels

Smart Workflow offers three independent channels. Each answers a different question:

| Channel | Answers | Variable | Default |
| --- | --- | --- | --- |
| **AI-assisted marker** | Did AI take part in this Case or Task? | `AI.Observability.CustomFields.Enabled` | on |
| **Conversations in Ivy** | What did each agent say, call and block? | `AI.Observability.Ivy.Enabled` | off |
| **Arize Phoenix tracing** | What happened inside each call — prompts, tools, tokens, cost? | `AI.Observability.Openinference.Enabled` | off |

They work well together: the marker tells you *which* Cases involved AI, and the other two tell you *what happened* inside them. Set the variables in `config/variables.yaml` during development, or in the **Engine Cockpit** under **Variables** on a running engine.

---

## AI-assisted marker

Whenever an agent runs in the context of a Task or Case, Smart Workflow writes a custom field on it:

| Field key | Type | Label | Scope | Value |
| --- | --- | --- | --- | --- |
| `aiAssisted` | STRING | AI-assisted | Task, Case | `SMART_WORKFLOW` |

This is the only channel that is **on by default**. It gives you a lightweight way to find AI-assisted work directly in the workflow data — for example to filter the task list or to report how many Cases used AI — without any external platform.

To switch it off:

```yaml
Variables:
  AI:
    Observability:
      CustomFields:
        Enabled: "false"
```

---

## Recording conversations in Ivy

Smart Workflow can record every agent conversation into the Ivy repository as a durable **governance audit** record. No external platform is needed.

```yaml
Variables:
  AI:
    Observability:
      Ivy:
        # Enable chat history recording for governance audit.
        Enabled: "true"
```

The tutorial project already switches this channel on in `tutorial/config/variables.yaml`, so the [Governance Dashboard] has data to show.

Each conversation is stored against the current Case and Task, under the agent's **element name**, and captures four kinds of entry:

- **Agent responses** — what the model returned, with model name, token counts, duration and the temperature used
- **Tool executions** — which tools ran, with their arguments and results
- **Input guardrail** evaluations
- **Output guardrail** evaluations

Because records are grouped by element name, give every `AgenticProcessCall` a meaningful name such as `Invoice Summary Agent` rather than leaving the default.

To browse, filter and analyse these records in a web UI, use the [Governance Dashboard].

> **Note:** This is a durable record of prompts, responses and tool arguments. Treat it like any other personal-data store when you decide on retention, and prefer masking personal data *before* it reaches the model with the [PII Masking Guardrail] over cleaning up records afterwards.

---

## Tracing with Arize Phoenix

[Arize Phoenix](https://phoenix.arize.com/) is an open-source tracing platform for LLM applications. Smart Workflow exports every agent call as an **OpenInference** trace, so in Phoenix you can see each prompt, tool call, token count and cost, and replay a real request with a different model or prompt.

### Step 1 — Start Arize Phoenix

Run Phoenix locally with Docker:

```bash
docker run --rm -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:nightly
```

Or create a `compose.yml` and start it with `docker compose up`:

```yaml
services:
  phoenix:
    image: arizephoenix/phoenix:nightly
    ports:
      - "6006:6006"
      - "4317:4317"
```

Open [http://localhost:6006](http://localhost:6006) to check that it is running.

### Step 2 — Point the engine at Phoenix

**In VS Code**, open the Settings, search for *Axon Ivy*, and set **AxonIvy › Engine: VM args** to:

```text
-Dotel.traces.exporter=otlp -Dotel.exporter.otlp.endpoint=http://localhost:6006 -Dotel.resource.attributes=openinference.project.name=smart-workflow
```

Then reload the window (**Developer: Reload Window**).

**On a standalone engine**, add the same options to `configuration/jvm.options` and restart the engine:

```properties
# OpenTelemetry -> Arize Phoenix
-Dotel.traces.exporter=otlp
-Dotel.exporter.otlp.endpoint=http://localhost:6006
-Dotel.resource.attributes=openinference.project.name=smart-workflow
```

### Step 3 — Enable the export

```yaml
Variables:
  AI:
    Observability:
      Openinference:
        Enabled: "true"
```

Run a tutorial process. Its trace appears in Phoenix under the **smart-workflow** project.

### Finding LLM calls

In Phoenix, open the **smart-workflow** project, enter the filter `span_kind == 'LLM'`, and switch from **Root Spans** to **All** next to the filter bar.

Every span carries the Ivy Case and Task UUID, so you can follow all AI activity of one business case:

```text
span_kind == 'LLM' and ivy.case == '6407c9bd-be10-4334-9ca9-c9b846fc1f57'
span_kind == 'LLM' and ivy.task == '2afa6db6-35d6-4f72-af05-711963888b0b'
```

### Invocation parameters

Since Smart Workflow 14.0.0, the model settings an agent was called with are recorded on the LLM span under `llm.invocation_parameters`. When you set a **Temperature** on an agent (see [Advanced Model Settings]), you can confirm here which value the model actually received — useful when output is more, or less, varied than expected.

### Hiding message content

Traces contain the full prompt and response by default. When that content is too sensitive to export, leave it out:

```yaml
Variables:
  AI:
    Observability:
      Openinference:
        Enabled: "true"
        HideInputMessages: "true"   # leave out system and user messages
        HideOutputMessages: "true"  # leave out the reply and the tool calls it requested
```

The rest of the span is unchanged — model name, token counts, and Case and Task IDs are still recorded, so cost and usage reporting keeps working.

---

## Guardrail records

Every guardrail evaluation shows up in both the Ivy conversation history and Phoenix:

| | Ivy conversation history | Arize Phoenix |
| --- | --- | --- |
| Where | A guardrail entry next to the tool executions | A dedicated span with `openinference.span.kind = "GUARDRAIL"` |
| Guardrail | `guardrailName` | `validator_name` |
| Input or output | `type` — `INPUT` / `OUTPUT` | `guardrail.type` |
| Outcome | `result` — `SUCCESS` / `FAILURE` / `FATAL` | `guardrail.result` |
| Why it blocked | `failureMessage` | `guardrail.failure_message` |

This lets you prove afterwards which messages a guardrail blocked and why — see [Output Guardrail], [Input Guardrail] and [PII Masking Guardrail]. The [Circuit Breaker] is recorded the same way, under the guardrail name `CircuitBreakerGuardrail`.

---

## Configuration reference

| Variable | Description | Default |
| --- | --- | --- |
| `AI.Observability.CustomFields.Enabled` | Mark Cases and Tasks with the `aiAssisted` custom field. | `"true"` |
| `AI.Observability.Ivy.Enabled` | Record every conversation into the Ivy repository for governance audit. | off |
| `AI.Observability.Openinference.Enabled` | Export OpenInference traces to Arize Phoenix. | off |
| `AI.Observability.Openinference.HideInputMessages` | Leave prompts out of exported traces. | off |
| `AI.Observability.Openinference.HideOutputMessages` | Leave responses out of exported traces. | off |

For the full reference, see the [Smart Workflow observability guide](https://github.com/axonivy-market/smart-workflow/blob/master/doc/user/observability.md).

---

## Common mistakes

- **No traces in Phoenix** — Both parts are required: the `-Dotel…` JVM options *and* `AI.Observability.Openinference.Enabled: "true"`. JVM options only take effect after the engine (or the VS Code window) restarts.
- **Only root spans visible** — LLM calls are child spans. Switch the Phoenix view from **Root Spans** to **All**.
- **Conversations not recorded** — `AI.Observability.Ivy.Enabled` is off by default; unlike the AI-assisted marker it must be switched on explicitly.
- **Sensitive data in traces** — Phoenix receives full prompts and responses unless you set `HideInputMessages` / `HideOutputMessages`.

---

## See also

- [Basic Agent Setup]
- [Advanced Model Settings]
- [Output Guardrail]
- [Circuit Breaker]
- [Governance Dashboard]
