# Agent Pipeline Pattern

Chain multiple specialised agents in sequence — each agent receives the previous agent's output as its input — to decompose complex tasks into focused, testable steps.

## What is it?

An **Agent Pipeline** is a sequential chain of `AgenticProcessCall` elements in a BPMN process. Each agent is specialised for one concern and passes its result to the next. The final agent (or a regular process step) assembles the combined output.

This is one of the core patterns in Smart Workflow for breaking large tasks into manageable, independently testable units.

## Why use it?

- **Separation of concerns** — each agent has one clear job and one clear system prompt
- **Testability** — test each agent step independently with known inputs/outputs
- **Reuse** — individual agents can be reused in other pipelines
- **Prompt clarity** — focused prompts outperform one huge prompt trying to do everything
- **Error isolation** — if one step fails, you know exactly which agent caused it

## How it works

Each `AgenticProcessCall` element in the chain reads from and writes to process data variables. The BPMN flow connects them in sequence. Each agent has its own system prompt, tools, and output type, but they all share the same process data context.

Flow: User request → Agent 1: Classify → Agent 2: Extract → Agent 3: Enrich → Agent 4: Respond → Final output.

## Example

A support ticket processing pipeline:

Step 1 — Classifier agent

```java
// System prompt:
// "Classify the support ticket into one of: BUG, FEATURE_REQUEST, QUESTION, BILLING.
//  Also extract the product name and urgency level (LOW/MEDIUM/HIGH)."
// Output Type: TicketClassification
// Output: out.classification
```

Step 2 — Information check agent

```java
// Input: in.classification (from step 1), in.ticketText
// System prompt:
// "Given the ticket classification, identify any missing information
//  needed to resolve it. Return a list of questions to ask the user."
// Output Type: MissingInfoCheck
// Output: out.missingInfo
```

Step 3 — Response drafter agent

```java
// Input: in.ticketText, in.classification, in.missingInfo
// Tools: ["searchKnowledgeBase", "lookupTicketHistory"]
// System prompt:
// "Draft an initial response to the support ticket. If information is missing,
//  include the clarifying questions. If you found relevant KB articles, link them."
// Output: out.draftResponse (String)
```

Process data flow (Ivy dataclass)

```java
public class SupportPipelineData {
  public String ticketText;
  public TicketClassification classification;  // from step 1
  public MissingInfoCheck missingInfo;          // from step 2
  public String draftResponse;                 // from step 3
}
```

> Use **Structured Output (#03)** for intermediate agents so each step produces a typed Java object, not free text. This makes the next agent's input unambiguous and avoids prompt engineering to parse text.

## Where to find it

- `smart-workflow-demo/processes/Patterns/  (pipeline pattern examples)`
- `smart-workflow-demo/processes/Business/  (shopping demo uses a 4-agent pipeline)`

## Key configuration

| Consideration | Recommendation |
|---|---|
| Output types | Use Structured Output for each intermediate step to get typed objects. |
| Process data | Use a single Ivy dataclass to carry all pipeline state across steps. |
| System prompts | Keep each prompt focused on one task. Avoid duplicating context that belongs in another step. |
| Error handling | Add Error Boundary Events on each agent element to handle step-level failures independently. |

## Common mistakes

- **Overloading one agent** — If an agent does classification AND extraction AND drafting in one step, prompts become complex and hard to debug. Split into focused agents even if it feels like more work up front.
- **Passing raw text between steps instead of structured data** — If step 1 returns "Category: BUG, Urgency: HIGH" as a string, step 2 must re-parse it. Use Structured Output to get a typed `TicketClassification` object instead.
- **No error isolation** — A single Error Boundary Event at the end of the pipeline catches all failures but loses the step context. Add one per agent element for precise error handling.

## See also

- [Structured Output]
- [Human-in-the-Loop]
- [Multi-Agent Orchestration]
