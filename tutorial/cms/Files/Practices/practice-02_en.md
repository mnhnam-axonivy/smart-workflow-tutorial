# Agent Pattern: Subprocess Design and Tool Co-location

In Axon Ivy, any callable subprocess can be used as an agent building block. The key design decision is **how it is invoked**: a callable subprocess can be called as an AI-discoverable tool or as a deterministic Axon Ivy element, and choosing correctly determines whether the AI controls the call or the process does.

---

> **Example from best-practices:** `PurchasingAgent.p.json` in `best-practices/processes/exercise/purchasing/agents/` uses both invocation modes in the same orchestration flow:
>
> - `translate` is called as a **tool** — tagged `tool` on its `CallSubStart`, the Purchasing Manager Agent calls it autonomously when the system prompt instructs it to translate the extracted text
> - `DocumentReader` is called via **SubProcessCall** before the agent starts — the document is always read unconditionally, before the AI has any involvement

## When to use it

Use callable subprocesses when the same AI task appears in more than one process — translation, OCR, classification, summarisation all qualify — and the task has a well-defined, stable interface with a fixed set of typed inputs and a typed output. A single authoritative prompt means one change fixes all callers with no risk of divergent copies, and a callable subprocess can be started and tested independently.

Do not extract a callable subprocess when the task is used only once (the abstraction adds complexity with no reuse benefit), when the prompt is highly context-specific and would need to be fully parameterised to be useful elsewhere, or when you need error boundary events on the AI call — error boundaries must be placed on the `ProgramInterface` inside the subprocess, not on the `SubProcessCall` element.

---

## How it works

A callable subprocess can be as simple as `CallSubStart` → `AgenticProcessCall` → `CallSubEnd`, or as complex as your business requires — multiple scripts, branches, or nested calls between start and end. The invocation mode is determined by how it is called from the orchestrating process.

![Simple callable agent](cms:/Files/Images/practice02-00)

### Calling as a tool — AI-driven

> See [Callable Process Tools] for the full setup guide for this feature.

**Use this when** the AI should decide if and when to call the subprocess based on the current context.

The callable can live in any dependent Ivy project. For example, `TranslationAgent.p.json` in `smart-workflow-demo` is available as a tool to `PurchasingAgent.p.json` in `best-practices` — no duplication required.

![Callable agent as tool](cms:/Files/Images/practice02-01)

### Calling as a SubProcessCall — deterministic

Use a `SubProcessCall` element in the process to call the subprocess at a fixed point — independent of the AI. The AI is not involved and cannot skip or reorder the call.

In `PurchasingAgent.p.json`, `DocumentReader` is called via `SubProcessCall` **before** the `AgenticProcessCall` element. The document is always read first; the AI receives the extracted text and never sees the raw stream.

> **Example:** `DocumentReader` in `PurchasingAgent.p.json` reads the uploaded file unconditionally — the AI cannot skip or reorder this step. Only after the text is extracted does the Purchasing Manager Agent start.

![Callable agent in Axon Ivy process](cms:/Files/Images/practice02-02)

**Use this when** the step must always execute in a fixed order, regardless of what the AI decides.

---

## Best practice: co-locate agent-specific tools in the same process

When a set of tools is only ever used by one specific agent, define those tools as `CallSubStart` elements **inside the same `.p.json` file** as the orchestrating agent. This keeps everything that belongs to one agent in one place, and avoids polluting the `agents/` folder with files that no other agent will ever call.

![PurchasingAgent.p.json](cms:/Files/Images/practice02-03)

`PurchasingAgent.p.json` demonstrates this mixed approach:

| Tool callable | Where defined | Reason |
| --- | --- | --- |
| `translate` | `TranslatorAgent.p.json` (separate file) | General-purpose — any agent that needs translation can call it |
| `mapToPurchasingObject` | Inside `PurchasingAgent.p.json` (same file) | Purchasing-specific — only the Purchasing Manager Agent uses it |
| `calculatePurchasingTax` | Inside `PurchasingAgent.p.json` (same file) | Purchasing-specific — only the Purchasing Manager Agent uses it |
| `calculateStatistics` | Inside `PurchasingAgent.p.json` (same file) | Purchasing-specific — only the Purchasing Manager Agent uses it |
| `createSummary` | Inside `PurchasingAgent.p.json` (same file) | Purchasing-specific — only the Purchasing Manager Agent uses it |

`DocumentReader` is called via `SubProcessCall` **before** the agent element starts — not listed in the Purchasing Manager Agent's tools array. Three reasons justify this:

1. **Token efficiency** — document extraction can produce large volumes of text depending on the file size and detail level. Running it as a deterministic step isolates this token cost from the agent's reasoning loop, keeping the Purchasing Manager Agent's context lean and focused.
2. **Separation of concerns** — extraction is pure I/O work that requires no AI reasoning. Keeping it deterministic makes it easy to test and debug independently, without needing an LLM in the loop.
3. **Caching and idempotency** — the extracted text is a stable artifact for any given document. A deterministic step can be cached or pre-computed; an AI tool call might be skipped entirely or invoked multiple times unpredictably.

### Decision rule

```text
Is this tool used by more than one agent?
  Yes → separate file, reusable callable subprocess
  No  → same file as the orchestrating agent
```

### Use a process lane to separate tools from the orchestrator

When tools live in the same file, add a **process lane** named `Tools` to visually separate the tool callables from the main orchestration flow. In `.p.json`:

```json
"layout": {
  "lanes": [
    { "name": "Tools", "offset": 160, "size": 512 }
  ]
}
```

Place the orchestrating flow (main agent `CallSubStart` → `SubProcessCall` → `AgenticProcessCall` → `CallSubEnd`) in the default lane at `y` values above the lane offset. Place each tool `CallSubStart` in the Tools lane at `y` values inside the lane range. This mirrors how `PurchasingAgent.p.json` is laid out:

```text
y ≈ 72   ← orchestrating flow (main lane)
y ≈ 232  ← calculatePurchasingTax tool  ┐
y ≈ 352  ← mapToPurchasingObject tool   │ Tools lane
y ≈ 480  ← calculateStatistics tool     │
y ≈ 608  ← createSummary tool           ┘
```

### Updated folder view

After applying the co-location rule, the folder looks like:

```text
processes/
  exercise/
    purchasing/
      Purchasing.p.json          ← main business process
      agents/
        PurchasingAgent.p.json   ← orchestrating agent + its specific tools
        DocumentReader.p.json    ← reusable: extract text (shared)
        TranslatorAgent.p.json   ← reusable: translate (shared)
        ObjectMapperAgent.p.json ← reusable: map to object (shared)
```

`PurchasingAgent.p.json` grows to contain the orchestrator and all purchasing-specific tools. The three shared agents remain in their own files, unchanged.

---

## See also

- [Practice 01 — Agent Pattern: AI Task]
- [Practice 03 — Agent Organisation: Tool Tags and Folder Structure]
- [Practice 05 — Agent Prompts: Clarity and Dynamic Context]
