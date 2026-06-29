# Human-in-the-Loop

Pause agent execution at a critical decision point, assign a human review task, and resume the workflow automatically once approval is given.

## What is it?

Human-in-the-Loop (HITL) is a pattern where an AI agent proposes an action or decision, then the workflow *hibernates* and creates a human task for review. Once a human approves or modifies the proposal, the process resumes with the human's input.

This is implemented using standard Axon Ivy constructs — User Tasks, intermediate events, and process data — combined with a callable process tool that triggers the hibernation.

## Why use it?

- High-stakes decisions (data deletion, financial approvals, customer communications) need human sign-off
- Builds trust in AI systems — humans verify before irreversible actions
- Regulatory or compliance requirements mandating human oversight
- Graceful degradation — humans can correct agent mistakes before they have impact
- Works naturally with Ivy Portal's task inbox

## How it works

The key is that the `requestApproval` tool is a **Callable Process Tool** (#05) that creates a User Task and then waits via an intermediate event. The agent is suspended at that point. When the human completes the task, the process resumes and returns the human's decision back to the agent.

Flow: Agent proposes action → Tool: "requestApproval" called → Ivy User Task created for reviewer → Process hibernates (waits) → Reviewer approves / rejects → Process resumes with decision → Agent continues with approval result.

## Example

An agent that drafts a customer email and requires human approval before sending:

requestApproval tool (callable subprocess)

```text
Process:      requestApproval
Tags:         tool
Description:  Request a human reviewer to approve or reject a proposed action.
              Returns the reviewer's decision and optional feedback.
              Always use this tool before sending external communications or
              making irreversible changes.

Input:
  String proposedAction   - description of what the agent wants to do
  String draftContent     - the draft content (e.g. email text) to review

Output:
  String decision         - "approved" | "rejected"
  String reviewerFeedback - optional comments from the reviewer
```

System prompt guiding approval use

```text
You are a customer communications agent.
When asked to send an email, first draft the content, then call requestApproval
with the draft. Only confirm the send after receiving "approved".
If rejected, revise based on the reviewer's feedback and request approval again.
```

Process flow (pseudo-BPMN)

```text
Start
  → AgenticProcessCall (agent drafts email, calls requestApproval tool)
      → [inside requestApproval subprocess]
          → Create User Task "Review Draft Email"
          → Intermediate Wait Event (process hibernates)
          → [Reviewer approves in Portal task inbox]
          → Resume → return decision + feedback
  → AgenticProcessCall continues with approval result
  → [If approved] → Send Email gateway → End
  → [If rejected] → Loop back to agent with feedback
```

> Combine with **Memory & State (#10)** so the agent retains the full conversation history while waiting for approval. This allows reviewers to see context and allows the agent to reference the review in follow-up turns.

## Where to find it

- `smart-workflow-demo/processes/Patterns/  (HITL pattern demos)`
- `smart-workflow-demo/src/com/axonivy/utils/smart/workflow/demo/handler/  (approval handlers)`

## Key configuration

| What | How |
|---|---|
| Approval tool | Create a callable subprocess tagged `tool` with a User Task and intermediate wait event. |
| System prompt | Explicitly instruct the agent to call the approval tool before critical actions. |
| Reviewer assignment | Set task assignment in the User Task element (role, user, or expression). |
| Timeout handling | Add a Timer Boundary Event to the User Task to handle cases where reviewers don't respond. |

## Common mistakes

- **Agent bypassing the approval tool** — LLMs can reason around instructions if the prompt is weak. Use a strict system prompt: "You MUST call requestApproval before any external action. Never skip this step." Test with adversarial prompts.
- **No timeout on the User Task** — If the reviewer never opens the task, the process waits indefinitely. Always add a Timer Boundary Event with escalation handling (e.g. re-assign or auto-reject after N hours).
- **Insufficient context for the reviewer** — The approval task should show the reviewer everything they need: the agent's reasoning, the proposed action, and relevant business context. A bare "approve/reject" form is not enough.

## See also

- [Callable Process Tools]
- [Memory & State]
- [Agent Pipeline Pattern]
