# Agent Organisation: Folder Structure and Naming Conventions

Where a file lives and what it is named determine how quickly a developer can find, understand, and extend an agent. Getting these wrong leads to agent files scattered across the project that are hard to navigate, and callables that require opening just to understand their purpose.

---

> **Example from best-practices:** The `agents/` folder in `best-practices/processes/exercise/purchasing/agents/` contains four process files. Each file has a clear role — file name, callable name, data class name, and `visual.description` all follow the same conventions.

## When to use it

Apply this organisation when you have more than one callable subprocess in a domain, or when multiple developers work on the same project and consistent folder placement and naming are needed to prevent duplicates and confusion.

A single-callable, single-process project does not need the `agents/` folder structure. Do not invest in organisation before the design is stable — organise once the agent structure solidifies.

---

## How it works

### The `agents/` folder

Group all agent subprocesses in a dedicated `agents/` subfolder relative to the business process that owns them:

```text
processes/
  exercise/
    purchasing/
      Purchasing.p.json          ← business process
      agents/
        PurchasingAgent.p.json   ← orchestrating agent + specific tools
        DocumentReader.p.json    ← reusable: extract text
        TranslatorAgent.p.json   ← reusable: translate
        ObjectMapperAgent.p.json ← reusable: map to object
```

This makes it immediately clear which agents belong to which business domain and keeps the root process folder uncluttered.

---

## Best practice: consistent naming conventions

Consistent naming makes callables easy to identify in the IDE, in error logs, and in observability traces:

| Convention | Example |
| --- | --- |
| File name describes the agent's role | `DocumentReader.p.json`, `TranslatorAgent.p.json` |
| Callable name is a verb phrase matching the action | `extractDocument`, `translate`, `mapObject` |
| Data class name matches the file | `DocumentReaderData`, `TranslatorAgentData` |
| Parameters are typed, not `Object` | `java.io.InputStream`, `String`, `Class` |
| Process description field states the callable's purpose | Set `visual.description` on the `CallSubStart` |

The `visual.description` on `CallSubStart` appears as a tooltip in the IDE and is the text the AI uses to match a tool to a step in the system prompt — a one-sentence description dramatically improves tool selection accuracy:

```json
{
  "id": "f0",
  "type": "CallSubStart",
  "visual": {
    "description": "Use this tool to map extracted document text into a structured PurchasingData object"
  }
}
```

---

## See also

- [Practice 01 — Agent Pattern: AI Task]
- [Practice 02 — Agent Pattern: Subprocess Design and Tool Co-location]
- [Practice 05 — Agent Prompts: Clarity and Dynamic Context]
