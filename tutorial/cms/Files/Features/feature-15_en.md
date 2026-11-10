# Circuit Breaker

The **circuit breaker** is an application-wide kill switch for AI. When it is on, Smart Workflow stops **every** agent call in the application — regardless of which guardrails an individual agent configures, and also for processes that start after the switch was flipped. Each stopped call raises a BPM error, so your processes can take a non-AI path instead of failing.

---

> **This builds on [Output Guardrail].** The agent configuration is the same as in [Basic Agent Setup] — the only new element is an **Error Boundary Event** for `smartworkflow:stop` on the AgenticProcessCall.
>
> **Example used in this guide: Acme Corp invoice summary with a manual fallback**
>
> The Invoice Summary Agent from [Basic Agent Setup] normally summarises an invoice. When an operator switches the circuit breaker on, the same process no longer calls the model — the Error Boundary Event catches the stop and routes the invoice to manual review.
>
> The finished process is at `tutorial/processes/tutorial/features/Feature15.p.json` — open it in the Designer to follow along as you read.

---

## When do you need it?

Guardrails decide per message whether a single call may continue. Sometimes you need to take AI offline **for everything, immediately**:

- **Provider incident** — the model returns errors or nonsense
- **Runaway cost** — an agent loops or traffic spikes unexpectedly
- **Leaked prompt or data** — you must stop all calls while you investigate
- **Compliance hold** — legal or the data protection officer asks you to pause AI processing

The circuit breaker covers these cases with one switch, without redeploying the project or editing any agent.

---

## How it works

The circuit breaker is controlled by one Ivy variable:

```yaml
Variables:
  AI:
    # Emergency circuit breaker.
    CircuitBreaker:
      # "true" stops ALL AI agent calls in this application. "false" (or blank) allows them again.
      Enabled: "false"
```

| Value | Effect |
| --- | --- |
| `true` | All agent calls in the application are stopped |
| `false` or blank | Agents run normally |

Internally it runs as a built-in guardrail, `CircuitBreakerGuardrail`, which Smart Workflow applies to every agent automatically — on the way **in** (before the user message reaches the model) and on the way **out** (before the response reaches your process). When it blocks, Smart Workflow raises the error code:

```text
smartworkflow:stop
```

This is a different code from the guardrail violations (`smartworkflow:guardrail:input:violation` / `smartworkflow:guardrail:output:violation`), so you can give a stopped AI its own fallback.

---

## A stopped agent run is cancelled, not paused

When the circuit breaker blocks a call, that agent run **ends for good**:

- The `AgenticProcessCall` throws `smartworkflow:stop` and maps no result — the process continues on the Error Boundary path.
- Nothing is queued or kept. Switching the circuit breaker off later does **not** continue, retry or re-run the stopped call — its result is lost.
- Switching the circuit breaker off only affects agent calls that **start afterwards**.

So "switching AI back on" never brings back a stopped run. If the business still needs the AI result after an incident, model that explicitly — for example, let the fallback create a task *Retry AI summary* that loops back to the agent, or start the process again.

> This is the opposite of [Human in the Loop], where the agent is *suspended* and later continues the same conversation. A circuit breaker stop has no conversation to return to.

---

## Step 1 — Switch the circuit breaker

**From the Engine Cockpit (operators):** open the application, go to **Variables**, and set `AI.CircuitBreaker.Enabled` to `true`. Set it back to `false` to allow new agent calls again.

**From process code (an admin process, a scheduled check, a cost monitor):**

```java
import com.axonivy.utils.smart.workflow.guardrails.circuitbreaker.CircuitBreakerSignal;

CircuitBreakerSignal.stopAll();    // sets AI.CircuitBreaker.Enabled = true
CircuitBreakerSignal.resumeAll();  // sets AI.CircuitBreaker.Enabled = false
```

Both write the same variable, so the change takes effect application-wide on the next agent call.

> **Note:** Despite its name, `resumeAll()` does not resume anything that was stopped — it only lets **new** agent calls through again. See *A stopped agent run is cancelled, not paused* above.

---

## Step 2 — Add an Error Boundary Event

Attach an **Error Boundary Event** to the AgenticProcessCall element:

- **Error code:** `smartworkflow:stop`
- **Output mapping:** `out → in` and `out.error → error`

---

## Step 3 — Model the fallback

The fallback is an ordinary part of your process — anything you can model in the Designer is possible: hand the work to a person, take a rule-based path, tell the user AI is briefly unavailable, or create a task to run the AI step again once the incident is over.

In the tutorial the Script after the boundary event marks the invoice for manual review:

```java
in.isStopped = true;
in.summary = "AI is currently unavailable - invoice routed to manual review.";
ivy.log.warn("Agent stopped by circuit breaker: {0}", in.error.getMessage());
in.error = null;
```

> **Important:** Branch on the **error code**, never on the message text. The message (`All AI agent activities are currently stopped.`) is human-readable detail, not a contract.

### Agents inside a callable subprocess

When the agent lives in a reusable callable subprocess, the *caller* usually decides what to do. Do not let the error escape — return it as a result parameter instead:

1. In the subprocess, add an Error Boundary Event for `smartworkflow:stop` on the agent element.
2. From the boundary event, run a Script that sets a flag, for example `in.isStopped = true`.
3. Add `isStopped` to the subprocess result parameters, next to the agent result.
4. In the calling process, branch on that flag with an **Alternative** and take the non-AI path when it is `true`.

This is the same pattern as in [Agent Pattern: Subprocess Design and Tool Co-location] — the subprocess stays self-contained and the caller keeps control of the business flow.

---

## Example — Invoice summary with manual fallback

The example process has three starts:

| Start | Does |
| --- | --- |
| **Circuit breaker demo** | Runs the Invoice Summary Agent. Normally logs the AI summary; when the circuit breaker is on, the boundary event takes the **Fallback: manual review** path |
| **Stop all agents** | Calls `CircuitBreakerSignal.stopAll()` |
| **Re-enable agents** | Calls `CircuitBreakerSignal.resumeAll()` — new agent calls are allowed again |

Try it:

1. Start **Circuit breaker demo** — the **Axon Ivy Runtime Log** shows the AI summary.
2. Start **Stop all agents**.
3. Start **Circuit breaker demo** again — the log now shows:

   ```text
   Agent stopped by circuit breaker: ...All AI agent activities are currently stopped.
   AI is currently unavailable - invoice routed to manual review.
   ```

4. Start **Re-enable agents**. The run from step 3 stays on the manual review path — it is not continued.
5. Start **Circuit breaker demo** once more — this is a new run, and the log shows the AI summary again.

> **Remember step 4.** The switch is stored in the application's variables and stays on until you turn it off — it affects every other tutorial process too.

---

## Scope and limits

- **A call already in flight is not cancelled.** The breaker acts at the guardrail boundaries around the model call. A request that already reached the provider finishes its exchange — including a long tool loop — and is stopped when its output is evaluated — the response is discarded, but the tokens for that call are still spent.
- **It applies to the whole application.** Every agent is affected while the switch is on; there is no per-agent or per-process circuit breaker.
- **It is not a guardrail you select.** You do not add it to **Input guardrails** or **Output guardrails** — it is always active and only blocks while the variable is `true`.

---

## Observability

Stopped calls are recorded like any other guardrail evaluation, under the guardrail name `CircuitBreakerGuardrail` with the stop reason as failure message — both in the Ivy conversation history and as a `GUARDRAIL` span in Arize Phoenix. Use this to confirm afterwards which calls were stopped and when. See [Observability].

---

## Configuration reference

| Variable | Description | Default |
| --- | --- | --- |
| `AI.CircuitBreaker.Enabled` | `"true"` stops every agent call in the application. `"false"` or blank allows them again. | `"false"` |

For the full reference, see the [Smart Workflow circuit breaker guide](https://github.com/axonivy-market/smart-workflow/blob/master/doc/user/circuit-breaker.md).

---

## Common mistakes

- **No Error Boundary Event** — Without one, a stopped agent is an unhandled process error. Every agent call should have a `smartworkflow:stop` fallback, otherwise switching AI off breaks your processes instead of degrading them.
- **Catching the guardrail codes instead** — `smartworkflow:guardrail:input:violation` and `…:output:violation` do **not** catch a circuit breaker stop. Use `smartworkflow:stop`.
- **Forgetting to switch it off** — The variable stays `true` until someone sets it back. Make re-enabling AI part of your incident runbook.
- **Expecting stopped runs to continue** — Switching the circuit breaker off does not re-run calls that were stopped. If their AI result is still needed, your fallback must provide a way to run the AI step again.
- **Expecting an instant stop of running calls** — See *Scope and limits* above: in-flight requests still finish and are billed.

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/processes/tutorial/features/Feature15.p.json` — the agent process with the stop and re-enable starts
- `tutorial/dataclasses/tutorial/Feature15Data.d.json` — the data class

Open the process in the Designer and inspect the `Invoice Summary Agent` element — note the `Agent stopped` Error Boundary Event with error code `smartworkflow:stop`, and the two Script elements that call `CircuitBreakerSignal`.

---

## See also

- [Output Guardrail]
- [Input Guardrail]
- [Observability]
- [Agent Pattern: Subprocess Design and Tool Co-location]
