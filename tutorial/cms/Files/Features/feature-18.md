# Custom Guardrail

The built-in guardrails cover generic risks — prompt injection, leaked credentials, personal data. A **custom guardrail** covers *your* rules: a company policy, a compliance check, a redaction pass. It is a small Java class, and once it is registered you use it exactly like a built-in: select it on an agent, or apply it to every agent in the application.

---

> **This builds on [Input Guardrail] and [Java Tools].** Handling a violation works exactly as in [Input Guardrail], and the registration uses the same SPI mechanism as [Java Tools].
>
> **Example used in this guide: two Acme Corp policies**
>
> Acme Corp runs an internal assistant for its employees. Two rules must hold for every message, whatever the prompt says:
>
> - Confidential project codenames must never be sent to an AI model → a guardrail that **blocks** the message.
> - Employee IDs must not leave the company → a guardrail that **rewrites** the message and replaces each ID with a placeholder.
>
> The finished process is at `tutorial/process/tutorial/features/Feature18.p.json` — open it in the Designer to follow along as you read.

---

## Before you start

You could write both rules into the System message of every agent. That has two problems. A prompt is a request, not a guarantee — the model has already received the message by the time it reads your rule. And the rule would live in many places, so a policy change means editing every agent.

A guardrail runs in Java **before** the message reaches the model (input) or before the response reaches your process (output). The rule is enforced in one place, deterministically, at no token cost.

---

## What is a custom guardrail?

A custom guardrail implements one of two interfaces from `com.axonivy.utils.smart.workflow.guardrails.entity` — or both, if it belongs on both sides:

| Interface | Appears in | Inspects |
| --- | --- | --- |
| `SmartWorkflowInputGuardrail` | **Input guardrails** | The user message, before the model sees it |
| `SmartWorkflowOutputGuardrail` | **Output guardrails** | The model's response, before it is used |

Both have a single method to implement, `evaluate(String message)`, which returns one of four outcomes:

| Result | Effect |
| --- | --- |
| `GuardrailResult.allow()` | Pass the message through unchanged. |
| `GuardrailResult.allowWithRewrite(String)` | Pass it through, but replace the message with your version. Use it for redaction or normalisation instead of rejection. |
| `GuardrailResult.block(String reason)` | Reject the message. The reason is surfaced in the BPM error. |
| `GuardrailResult.block(String reason, Throwable cause)` | Reject, and attach a cause so that callers can tell *which* guardrail blocked without reading the reason text. |

`name()` is optional. It defaults to the simple class name, and that is the name shown in the pickers and used in the variables.

---

## Why use it?

- **One place for a policy** — instead of repeating the rule in every System message
- **Deterministic** — plain Java decides, not a model; the same message always gets the same verdict
- **No token cost** — an input guardrail that blocks saves the model call entirely
- **Works like a built-in** — selectable per agent, usable as an application default, and recorded in [Observability] like every other guardrail

---

## Step 1 — Implement a guardrail that blocks

`ConfidentialProjectGuardrail` rejects any message that mentions a confidential project codename:

```java
public class ConfidentialProjectGuardrail implements SmartWorkflowInputGuardrail {

  private static final List<String> CODENAMES = List.of("project falcon", "project aurora", "project titan");

  @Override
  public GuardrailResult evaluate(String message) {
    if (message == null) {
      return GuardrailResult.allow();
    }
    String lower = message.toLowerCase(Locale.ROOT);
    for (String codename : CODENAMES) {
      if (lower.contains(codename)) {
        return GuardrailResult.block("Message blocked: it mentions the confidential project '" + codename
            + "'. Confidential project names must not be sent to an AI model.");
      }
    }
    return GuardrailResult.allow();
  }
}
```

Write the reason for the person who will read it in a log or an error dialog: say what was found and what the rule is.

---

## Step 2 — Implement a guardrail that rewrites

Not every rule has to end the call. `EmployeeIdRedactionGuardrail` lets the message through, but replaces every employee ID such as `EMP-004211` first:

```java
public class EmployeeIdRedactionGuardrail implements SmartWorkflowInputGuardrail {

  private static final Pattern EMPLOYEE_ID = Pattern.compile("\\bEMP-\\d{4,6}\\b");
  private static final String PLACEHOLDER = "[EMPLOYEE-ID]";

  @Override
  public GuardrailResult evaluate(String message) {
    if (message == null) {
      return GuardrailResult.allow();
    }
    Matcher matcher = EMPLOYEE_ID.matcher(message);
    if (!matcher.find()) {
      return GuardrailResult.allow();
    }
    return GuardrailResult.allowWithRewrite(matcher.replaceAll(Matcher.quoteReplacement(PLACEHOLDER)));
  }
}
```

The model only ever sees `[EMPLOYEE-ID]`. Unlike the [PII Masking Guardrail], this guardrail does not put the original value back into the response — it is a one-way redaction.

---

## Step 3 — Create a GuardrailProvider

A provider lists the guardrails your project offers. Override `getInputGuardrails()`, `getOutputGuardrails()`, or both:

```java
public class TutorialGuardrailProvider implements GuardrailProvider {

  @Override
  public List<SmartWorkflowInputGuardrail> getInputGuardrails() {
    return List.of(new ConfidentialProjectGuardrail(), new EmployeeIdRedactionGuardrail());
  }
}
```

One provider can expose as many guardrails as you like.

---

## Step 4 — Register via SPI

Create the file `src/META-INF/services/com.axonivy.utils.smart.workflow.guardrails.provider.GuardrailProvider` and add the fully qualified class name of your provider:

```text
tutorial.guardrail.TutorialGuardrailProvider
```

> **Important:** Without this file Smart Workflow never discovers your guardrails. The classes compile, the guardrails never run, and nothing warns you.
>
> Only the **first line** of the file is read, so one Axon Ivy project registers one guardrail provider. Add new guardrails to that provider instead of adding a second line.

---

## Step 5 — Select the guardrail on an agent

Open the `AgenticProcessCall` element. In the **🛡️ Guardrails** group, your guardrails now appear in the **Input guardrails** picker next to the built-in ones. The tutorial selects both:

```json
["ConfidentialProjectGuardrail", "EmployeeIdRedactionGuardrail"]
```

To apply a guardrail to **every** agent instead, name it in the application default — see [Output Guardrail]:

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput: PromptInjectionInputGuardrail, ConfidentialProjectGuardrail
```

> **Note:** What you select on an agent **replaces** the application defaults for that agent. If the agent should keep a default guardrail as well, select that one too.

---

## Step 6 — Handle the violation

A blocking custom guardrail raises the same BPM error as a built-in one. Attach an **Error Boundary Event** to the agent element:

- **Error code:** `smartworkflow:guardrail:input:violation` (for an output guardrail: `smartworkflow:guardrail:output:violation`)
- **Output mapping:** `out → in` and `out.error → error`

```java
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
in.error = null;
```

A guardrail that only rewrites never raises an error — the call simply continues with the rewritten message.

---

## Example — Acme Corp internal assistant

The example process has three starts that all lead to the same agent:

| Start | Message | What happens |
| --- | --- | --- |
| **18a: Custom guardrail - blocked** | Asks about the budget of *Project Falcon* | `ConfidentialProjectGuardrail` blocks it — the model is never called |
| **18b: Custom guardrail - allowed** | Asks for a reminder about expense reports | Both guardrails allow it — the agent answers normally |
| **18c: Custom guardrail - rewritten** | Asks for a confirmation for employee `EMP-004211` | `EmployeeIdRedactionGuardrail` replaces the ID — the model sees `[EMPLOYEE-ID]` |

### Agent configuration

| Field | Value |
| --- | --- |
| System message | *see below* |
| User message | `<%=in.query%>` |
| Input guardrails | `["ConfidentialProjectGuardrail", "EmployeeIdRedactionGuardrail"]` |
| Map result to | `in.result` |

```text
You are an internal assistant for Acme Corp employees. Answer in one or two sentences.
Placeholders in square brackets, such as [EMPLOYEE-ID], stand for data that was removed before it reached you. Keep them exactly as they are.
```

### Result

**18a** — the guardrail finds the codename and blocks the message. The **Show violation** Script logs:

```text
Blocked by guardrail: The guardrail com.axonivy.utils.smart.workflow.guardrails.adapter.InputGuardrailAdapter
failed with this message: Message blocked: it mentions the confidential project 'project falcon'.
Confidential project names must not be sent to an AI model.
```

**18b** — nothing matches, so the agent answers. The **Show result** Script logs, for example:

```text
Agent answer: Reminder: please submit your expense reports by the end of the day on Friday.
```

**18c** — the agent answers, but it never saw the employee ID:

```text
Agent answer: The leave request of employee [EMPLOYEE-ID] has been approved.
```

---

## Things to know

- **A guardrail instance is shared.** The same object serves all agents and all concurrent calls, so do not keep per-call state in fields. If a guardrail has to connect the input and the output of the same agent call, implement the two-argument `evaluate(String message, String invocationId)` and key your state on the invocation ID — that is how the [PII Masking Guardrail] pairs masking with restoring.
- **Rewriting works on the output side too.** An output guardrail can return `allowWithRewrite` to clean up a response instead of discarding it.
- **Output guardrails do not retry.** A blocked response is gone; a guardrail that blocks legitimate answers costs you the whole call.
- **Custom guardrails are recorded like built-in ones** — in the Ivy conversation history and as a `GUARDRAIL` span in Arize Phoenix, under the guardrail's `name()`. See [Observability].

---

## Common mistakes

- **Forgetting the SPI registration** — the guardrail never appears in the pickers and never runs, without any warning.
- **Adding a second provider line to the services file** — only the first line is read. Put all guardrails into one provider.
- **Keeping state in the guardrail** — the instance is shared across agents and concurrent calls.
- **Expecting the application defaults to stay active** — selecting any guardrail on an agent replaces the defaults for that agent.
- **Catching the wrong error code** — an input guardrail raises `smartworkflow:guardrail:input:violation`, an output guardrail `smartworkflow:guardrail:output:violation`.
- **Matching on the error message** — branch on the error code. The message is wrapped by Smart Workflow and names an internal adapter class, not your guardrail.

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/process/tutorial/features/Feature18.p.json` — the agent process with the three starts
- `tutorial/dataclass/tutorial/Feature18Data.d.json` — the data class
- `tutorial/src/tutorial/guardrail/ConfidentialProjectGuardrail.java` — the blocking guardrail
- `tutorial/src/tutorial/guardrail/EmployeeIdRedactionGuardrail.java` — the rewriting guardrail
- `tutorial/src/tutorial/guardrail/TutorialGuardrailProvider.java` — the provider
- `tutorial/src/META-INF/services/com.axonivy.utils.smart.workflow.guardrails.provider.GuardrailProvider` — the SPI registration file

Open the process in the Designer and inspect the `Internal Assistant Agent` element — note both custom guardrails in the **Input guardrails** field and the Error Boundary Event attached to it.

---

## See also

- [Input Guardrail]
- [Output Guardrail]
- [PII Masking Guardrail]
- [Java Tools]
- [Observability]
