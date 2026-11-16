# Agent Pattern: Agent Pipeline

An agent pipeline is a linear chain of agents: each one does a single, focused job and hands its result to the next. Once a task needs more than one kind of thinking — read a document, then analyse it, then decide — splitting it into several small agents almost always beats one large agent asked to do everything.

---

> **Example from best-practices:** the purchasing exercise in `best-practices/process/exercise/purchasing/` is a three-stage pipeline:
>
> 1. **Read Document** (`agents/DocumentReader.p.json`) — a vision-capable agent turns the uploaded purchasing document into text
> 2. **Purchasing Manager Agent** (`agents/PurchasingAgent.p.json`) — works on that text with its tools and returns a typed `PurchasingData` object
> 3. **Decide Approval** (`Purchasing.p.json`) — reads the `PurchasingData` and returns a typed `ApprovalRecord`
>
> The smallest example is in the tutorial itself: `Feature03.p.json` chains *Invoice Analysis → Urgency Classifier → Supplier Risk Check* — see [Model Provider Selection].

## When to use it

Use a pipeline when the work breaks down into **ordered steps that each need a different instruction** — extract, then classify, then summarise. Every step gets its own short System message and produces a result you can inspect.

Do not build a pipeline for its own sake. If one agent with a clear System message does the job reliably, a second agent only adds cost and latency. And if the *order* of the steps is not fixed — the model should decide what to do next — give one agent several tools instead ([Callable Process Tools]).

---

## How it works

Each stage is an ordinary `AgenticProcessCall`. The stages are connected by **process data**, not by a shared conversation: an agent remembers nothing from the agent before it (see [Conversation Memory]), so everything a stage needs must be in its User message.

```text
uploaded document
      │
      ▼
┌──────────────────┐    extractedText     ┌──────────────────────────┐   PurchasingData  ┌──────────────────┐
│  Read Document   │ ───────────────────▶ │ Purchasing Manager Agent │ ────────────────▶ │ Decide Approval  │
│  vision model    │                      │ tools + typed result     │                   │ typed decision   │
└──────────────────┘                      └──────────────────────────┘                   └──────────────────┘
```

Three things connect the stages:

- **Map result to** writes the result of one stage into a process data field.
- **Expect result of type** makes that result a typed object, so the next stage — or a gateway — can read individual fields instead of parsing text ([Structured Output]).
- The **User message** of the next stage references the field with `<%=...%>`.

---

## What you gain

- **Visibility** — every stage has its own conversation record and its own trace, so you see what each one received and returned instead of reading one long exchange ([Observability]).
- **The right model per stage** — a vision model for reading documents, a strong model where the decision is hard, a cheap one for a simple classification ([Model Provider Selection]).
- **Guardrails per stage** — each agent validates what that stage actually needs.
- **Failure isolation** — a guardrail violation or a [Circuit Breaker] stop lands on one element. You can route that stage to a fallback while the results of the earlier stages stay in the process data.

---

## Best practice: pass typed objects between stages

Free text between stages forces the next agent to interpret prose again, and nothing checks that a value is present. Let each stage return a data class and pass that on:

| Stage | Expect result of type | Next stage reads |
| --- | --- | --- |
| Purchasing Manager Agent | `exercise.purchasing.PurchasingData.class` | `title`, `department`, `totalAmount`, `lineItems`, … |
| Decide Approval | `exercise.common.ApprovalRecord.class` | `isApproved` and `approvalNote` — see [Agent Pattern: AI Task] |

A typed result also lets the **process** take over where no AI is needed. In `Purchasing.p.json` the gateway *Total > 100,000?* decides on a number — it does not ask a model.

## Best practice: one job per stage

Keep the System message of each stage about that stage only. The reader does not need to know the approval rules; the approver does not need to know how to read a scan. When a stage starts to collect "and also" instructions, it is time for another stage.

Give each stage only the tools it needs. Every granted tool costs tokens in every request and gives the model another way to choose wrong.

## Best practice: give every stage a fallback

Any stage can be stopped — by a guardrail, by the [Circuit Breaker], by a provider outage. Attach an Error Boundary Event to each agent and decide what the process does then: retry later, hand the case to a person, or continue on a non-AI path. When a stage lives in a callable subprocess, catch the error inside and return a flag, as described in [Agent Pattern: Subprocess Design and Tool Co-location].

---

## Choosing between the patterns

| Situation | Pattern |
| --- | --- |
| Ordered steps, each needing different instructions | **Agent pipeline** (this page) |
| One capability, shipped and called as a unit | Self-contained agent — [Agent Pattern: Subprocess Design and Tool Co-location] |
| Several agents needing the same tools | Feature-grouped agents — [Agent Organisation: Folder Structure and Naming Conventions] |
| A decision a person used to make | [Agent Pattern: AI Task] |
| A step that sometimes needs a person | Any of the above, plus [Human in the Loop] |

---

## Common mistakes

- **Expecting a later agent to remember an earlier one** — nothing is carried over between agent calls. Pass the data in the User message.
- **Passing prose instead of a typed object** — the next stage has to guess, and a missing value goes unnoticed.
- **Splitting too early** — two agents where one would do doubles the cost and the latency.
- **One fallback for the whole pipeline** — a failure in stage 3 should not throw away the results of stages 1 and 2.
- **Using a model to decide what a gateway can decide** — a comparison of two numbers belongs in the process, not in a prompt.

---

## See also

- [Agent Pattern: AI Task]
- [Agent Pattern: Subprocess Design and Tool Co-location]
- [Agent Organisation: Folder Structure and Naming Conventions]
- [Structured Output]
- [Model Provider Selection]
