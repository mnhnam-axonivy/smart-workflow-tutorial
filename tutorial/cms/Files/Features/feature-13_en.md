# Human in the Loop

By default, AI agents make decisions autonomously. **Human in the Loop** pauses agent execution mid-task and routes a specific decision to a human user as an Axon Ivy task — then automatically resumes the agent with the user's input.

---

> **This builds on [Callable Process Tools] and [Conversation Memory].** The pattern uses a special callable tool that suspends the agent, plus `aiMemoryId` to restore agent context after the human task completes.
>
> **Example used in this guide:** an invoice approval agent. For invoices exceeding $2,000 the agent pauses and asks the human for a written justification. The agent then confirms approval, and a formal approval task is created with the justification in its description. Invoices below $1,000 are approved automatically without human intervention.
>
> The finished process is at `tutorial/processes/tutorial/features/Feature13.p.json`.

---

## Before you start

Some agent decisions require human judgement — a compliance check, an approval step, or a reason that must be recorded for audit. Without Human in the Loop, the agent would either make that choice autonomously or block waiting for input it cannot receive. This pattern lets the agent delegate any specific question to a real user and then continue processing with the free-text result.

---

## How does it work?

The pattern uses three coordinated components:

| Component | Role |
| --- | --- |
| `askUserFeedback` callable tool | Receives a `HumanFeedback` (question + answer) from the agent and throws a `human:decision` error to suspend execution |
| Error boundary + `UserTask` | Catches the error, shows the question to the user as a free-text dialog, and waits for input |
| `DecisionMaker.resolve()` | Writes the user's answer back into the agent's conversation memory, allowing the agent to continue |

The agent uses `aiMemoryId` to persist its state across the suspension. Without `aiMemoryId` in the data class, the agent cannot resume and `DecisionMaker.resolve()` has nowhere to write.

---

## Why use it?

- **Approval workflows** — agents that need a recorded human reason before taking action
- **Compliance gates** — a human must verify or justify before the agent proceeds
- **Audit trails** — human-provided reasons are captured in task descriptions
- **Transparent AI** — users see exactly what the agent is asking and retain control

---

## Step 1 — Create the askUserFeedback tool

Create a callable subprocess tagged `tool`. The tool receives a `HumanFeedback` and throws it as a `human:decision` error:

```text
CallSubStart (tagged "tool") → ErrorEnd "human:decision"
```

In the `ErrorEnd` output code:

```java
error.setAttribute("decision", in.feedback);
```

This attaches the `HumanFeedback` object (question + placeholder for the answer) to the error so the boundary event can read it.

> The `tool` tag on the `CallSubStart` is what makes the framework expose this callable to the agent. Without it, the agent cannot discover or call `askUserFeedback`.

---

## Step 2 — Configure the ProgramInterface

Add the tool and attach an `ErrorBoundaryEvent`:

| Field | Value |
| --- | --- |
| Tools | `["askUserFeedback"]` |
| System prompt | Instruct the agent to use `askUserFeedback` for invoices above $2,000 — ask a single direct question, do not suggest options |
| Error boundary code | `human:decision` — maps `error.getAttribute("decision")` to `in.decision` |

The boundary output mapping:

```java
out.decision = error.getAttribute("decision") as tutorial.HumanFeedback
```

The error boundary routes the flow to the `UserTask` while keeping the process instance alive and the agent's memory intact.

---

## Step 3 — Create the UserTask and dialog

Connect the error boundary to a `UserTask` with the `HumanDecision` dialog:

```json
"dialog": "tutorial.HumanDecision:start(tutorial.HumanFeedback)"
```

The dialog (`HumanDecision.xhtml`) shows the agent's question as plain text and provides a free-text area for the user's answer. After the user submits, connect the `UserTask` output back to the **same `ProgramInterface` element** — this re-enters the agent with its suspended context restored from memory.

---

## Step 4 — Resolve the decision

In the `UserTask` output code, call `DecisionMaker.resolve()` before the flow returns to the agent:

```java
import com.axonivy.utils.smart.workflow.tools.human.DecisionMaker;

new DecisionMaker(in.aiMemoryId).resolve(result.answer);
```

This writes the user's free-text answer into the agent's memory so the suspended `askUserFeedback` tool call returns the correct value when the agent resumes.

---

## Step 5 — Add aiMemoryId to the data class

Add `aiMemoryId: String` to your data class — the same convention as [Conversation Memory]:

```json
{ "name": "aiMemoryId", "comment": "name convention: field holding the memory id of an ongoing AI conversation" }
```

The framework writes a conversation ID here on the first agent call. `DecisionMaker` uses this ID to locate and update the suspended conversation.

> Without `aiMemoryId` the agent has no memory store, `DecisionMaker.resolve()` fails silently, and the agent cannot resume correctly.

---

## Example

![Example process](cms:/Files/Images/feature13-00)

The demo provides two start points to contrast both paths:

| Start | Invoice | Amount | Expected behaviour |
| --- | --- | --- | --- |
| **Tutorial Feature 13: Human in the Loop** | INV-2025-0892 (Apex Solutions) | $12,500 | Agent pauses — human must provide justification |
| **Tutorial Feature 13: Auto-approve (below $1000)** | INV-2025-0891 (Office Depot) | $85 | Agent approves automatically — no human task |

### How the flow runs (high-value path)

1. Mock query sends: `"Invoice #INV-2025-0892 from Apex Solutions Ltd. Total: $12,500 USD. Cloud infrastructure services. Due: 2025-08-01. Please process this invoice for approval."`
2. Agent detects the amount exceeds $2,000 — calls `askUserFeedback` with a direct question asking for the justification reason
3. `askUserFeedback` throws `human:decision` — agent execution suspends
4. A task **"Provide feedback for Invoice Approval Agent"** appears in the task list
5. User opens the task, reads the agent's question, and types a free-text justification
6. `DecisionMaker.resolve(answer)` writes the justification into the agent's memory
7. Agent resumes — confirms the invoice is approved and describes the approval task it will create
8. Flow continues to a `TaskSwitchEvent` that creates a formal task:
   - **Name:** `Invoice INV-2025-0892 Approval`
   - **Description:** `Justification reason: <the text the user typed>`

### How the flow runs (low-value path)

1. Mock query sends: `"Invoice #INV-2025-0891 from Office Depot. Total: $85 USD. Office stationery supplies. Due: 2025-08-01. Please process this invoice for approval."`
2. Agent detects the amount is below $2,000 — approves automatically without calling `askUserFeedback`
3. Flow proceeds directly to the approval `TaskSwitchEvent`

### Agent configuration

| Field | Value |
| --- | --- |
| System prompt | `You are an invoice approval assistant for Acme Corp. When an invoice total exceeds $2,000, you MUST pause and use the askUserFeedback tool to ask the human a single direct question requesting their justification reason. Do not suggest or list any options — the human will type their own free-text reason. After receiving the reason, confirm the invoice is approved and describe the approval task that will be created with that reason in its description.` |
| Tools | `["askUserFeedback"]` |
| Result mapping | `in.result` |
| Query | `<%=in.query%>` |

---

## Configuration reference

| Component | Key setting |
| --- | --- |
| `askUserFeedback` callable | Tagged `tool`; `ErrorEnd` throws `human:decision` with `HumanFeedback` attached via `error.setAttribute("decision", in.feedback)` |
| ProgramInterface error boundary | Error code `human:decision`; maps error attribute to `in.decision` as `tutorial.HumanFeedback` |
| `UserTask` | Dialog `tutorial.HumanDecision:start(tutorial.HumanFeedback)`; connects back to ProgramInterface |
| `UserTask` output code | `new DecisionMaker(in.aiMemoryId).resolve(result.answer)` |
| Data class | `aiMemoryId: String`, `decision: tutorial.HumanFeedback`, and `result: String` fields required |
| `TaskSwitchEvent` | Task name `Invoice <%=in1.invoiceId%> Approval`; description `Justification reason: <%=in1.result%>` |

---

## Common mistakes

- **Missing `aiMemoryId`** — `DecisionMaker.resolve()` cannot locate the agent's memory; the agent resumes with no tool result and may hallucinate or loop.
- **UserTask not connected back to the same ProgramInterface** — the agent never re-enters and the process ends prematurely.
- **Forgetting the `tool` tag** — without the `tool` tag on the `CallSubStart`, the agent cannot discover or call `askUserFeedback`.
- **Agent not instructed to use the tool** — if the system prompt does not mention `askUserFeedback`, the agent may decide autonomously instead of delegating to the human.
- **Listing options in the system prompt** — if the prompt suggests choices, the agent may embed them in its question. Keep the prompt directive: ask one question, expect free-text.

---

## See also

- [Basic Agent Setup]
- [Callable Process Tools]
- [Conversation Memory]
