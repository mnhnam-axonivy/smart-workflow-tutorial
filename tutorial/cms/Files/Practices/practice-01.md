# Agent Pattern: AI Task

As AI becomes smarter, companies want to leverage it for real business decisions — not just content generation, but decisions that affect process flow: approvals, risk assessments, routing, classification. The question is not whether AI can make those decisions, but **how to make AI decisions trustworthy and auditable** inside a production workflow.

Axon Ivy is a traditional BPMN engine with a mature case and task system built for governance. Every human decision in a workflow produces a task with an owner, a timestamp, and a trail. **The AI Task pattern extends that same discipline to AI decisions**: whenever the AI makes a decision that affects the business process, it creates a dedicated task — not for a human to action, but as a record that the AI acted, why it acted, and what it decided.

> **AI concepts in brief:**
>
> - *AI Governance* (audience: executives, compliance officers, legal) — the set of policies and controls that keep AI decisions within ethical, legal, and business boundaries.
> - *AI Observability* (audience: operations engineers, platform teams) — the ability to see what an AI did, when, and why, retrievable without reading logs or source code.
> - *AI Provenance* (audience: auditors, business analysts, process owners) — the documented origin of a specific AI decision: who made it, on what data, with what reasoning.
>
> This pattern is specifically about AI Provenance — giving every AI decision the same traceable footprint as a human one.
> ![Safe AI conceps](cms:/Files/Images/practice01-03)
---

> **Example from best-practices:** In `Purchasing.p.json`, every purchasing request is evaluated by AI before any human sees it. The `Decide Approval` element returns an `ApprovalRecord` containing a professional review note and an approval decision. This record is added to `purchasingData.approvalRecords`. The `AI Approval Review` task — hidden from the task list but fully present in the case — carries the AI's reasoning as its description and as a case note, and is stamped with the `aiAssisted` custom field. For requests over 100,000, an additional human approval task is created on top of the AI review.
>
> The full process is at `best-practices/processes/exercise/purchasing/Purchasing.p.json`.
> ![Example process](cms:/Files/Images/practice01-00)

## When to use it

Use this pattern when the decision criteria are well-defined and the AI can follow them reliably, volume makes human review impractical, and a human fallback already covers the high-risk edge cases — as in the purchasing example where the `Alternative` routes requests over 100,000 to a named approver.

Do not use it when regulatory or legal approval requires a human signature, when the stakes of a wrong decision are unrecoverable, or when the decision depends on context that is not present in the process data.

The AI does not replace the governance system — it participates in it.

---

## How it works

The pattern has four elements working together:

| Step | Element | Purpose |
| --- | --- | --- |
| 1 | `ProgramInterface` (`AgenticProcessCall`) | AI evaluates the data and returns a structured decision object |
| 2 | `Script` | Sets deterministic fields (approver name, list initialisation) and appends the record to the process data |
| 3 | `TaskSwitchEvent` (`skipTasklist: true`) | Creates a hidden task that carries the AI provenance: description, custom field, case note |
| 4 | `Alternative` | Routes the process based on business rules — human escalation when needed |

### The AI approver

![AgenticProcessCall-details](cms:/Files/Images/practice01-01)

The `AgenticProcessCall` acts as the AI approver. It receives the request data and must return a structured decision — not a free-text response, but a typed Java object (`ApprovalRecord`) that the process can act on directly.

**What to give the AI:**

- **System prompt** — define the AI's role clearly: who it is, what criteria it must apply, and what it must return. Be explicit about the output fields. The AI does not infer structure from the result type alone; the prompt must describe `approvalNote` and `isApproved` by name and explain what each should contain.
- **Query** — pass all data the AI needs to make a fair decision: title, requester, department, total amount, notes, and line items. Use EL expressions (`<%= in.purchasingData.title %>`) to inject process data at runtime. Do not hardcode values or leave out fields the AI will need.
- **Result type** — set `resultType` to the fully qualified class name (`exercise.common.ApprovalRecord.class`). The engine maps the AI's structured response onto the Java object automatically.
- **Result mapping** — set `resultMapping` to the process data field that will hold the result (`in.approvalRecord`). This field must exist in the process data class.

**The system prompt has three components:**

**1 — Role.** Tell the AI who it is and what its job is. This anchors every decision the AI makes to a specific professional context.

```text
You are a professional purchasing approval agent.
Review the purchasing request thoroughly and...
```

**2 — Output structure.** Explicitly name every field the AI must populate and describe what each field should contain. The AI does not infer structure from the Java class alone — it needs the prompt to describe `approvalNote` and `isApproved` by name. This is also where you ask for reasoning: asking for a *"concise professional review covering business justification, cost reasonableness, and any concerns"* means the AI produces an explanation alongside its decision. That explanation becomes the case note and task description — the auditability comes from the prompt, at no extra cost.

```text
...return an ApprovalRecord with:
- approvalNote: a concise professional review (2-3 sentences)
  covering business justification, cost reasonableness, and any concerns
- isApproved: true if the request should be approved, false if rejected
```

**3 — Decision criteria.** List the explicit rules the AI must apply. Concrete criteria reduce hallucination and make the AI's behaviour predictable and testable.

```text
Approval criteria:
- Clear business justification in the notes
- Line items are reasonable and appropriate for the department
- Requester information is complete
- No items appear unnecessary, duplicated, or excessive in quantity
```


### The AI task — provenance in the case system

The `TaskSwitchEvent` after the AI call is what gives the pattern its governance value. It creates a task that:

- **Is hidden from users** (`skipTasklist: true`) — it is not an action item; it is a record
- **Carries the AI's reasoning as its description** — `<%= in1.approvalRecord.approvalNote %>` so the decision rationale is visible in Portal
- **Is stamped with a custom field** — `aiAssisted: true` so reports and queries can separate AI decisions from human ones
- **Writes a case note** — via `NoteCreator.addNote(in1.approvalRecord.approvalNote)` in the task `code` block, so the reasoning appears in the case history

![Task details](cms:/Files/Images/practice01-02)

---

## Best practice: give every AI decision full provenance

Three things make an AI decision auditable in Axon Ivy:

### 1 — A typed result object with reasoning

Ask the AI to return not just a decision but a justification. A `Boolean` alone is unauditable. A structured object with an `approvalNote` field gives you the reasoning alongside the decision — and it lands in the process data, not in a log file.

### 2 — A case note with the AI's reasoning

Use `NoteCreator.addNote(...)` in the task `code` block to write the AI's `approvalNote` into the case history. This is the human-readable audit trail — visible in Portal's case view without opening any process files.

> All three together — structured result, task custom field, case note — make an AI decision as traceable as a human one. None alone is sufficient.

### 4 — Choose your execution mode with `skipTasklist`

The `skipTasklist` attribute on the `TaskSwitchEvent` controls whether the AI runs the task automatically or waits for a human to trigger it. This is a deliberate system design decision:

| `skipTasklist` | Behaviour | When to use |
| --- | --- | --- |
| `true` | Axon Ivy executes the task immediately — the AI makes the decision without any human interaction | Fully automated decisions where AI authority is accepted |
| `false` (default) | The task appears in the task list; a user must open and start it before the AI runs | Human-in-the-loop: a person triggers the AI review and can inspect the context before it runs |

In the purchasing example `skipTasklist: true` is set — the AI evaluates every request automatically. If you want a reviewer to consciously start the AI evaluation (for example, to allow them to add comments first), remove `skipTasklist` or set it to `false`. The rest of the pattern — provenance, case note, custom field — works identically in both modes.

---

## See also

- [Practice 02 — Agent Pattern: Subprocess Design and Tool Co-location]
- [Practice 03 — Agent Organisation: Tool Tags and Folder Structure]
- [Practice 05 — Agent Prompts: Clarity and Dynamic Context]
