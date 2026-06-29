# Web Search Tool

The **Web Search Tool** (`webSearch`) is a built-in tool that gives agents access to live internet data. Unlike Callable Process Tools or Java Tools, you do not implement anything — just add `"webSearch"` to the agent's Tools list and it is ready to use.

---

> **This builds on [Java Tools].** The agent configuration is the same — the only difference is that `webSearch` is already registered by the framework, so there is no implementation step.
>
> **Example used in this guide: Axon Ivy documentation search**
>
> The agent receives a search query, calls `webSearch` to retrieve current results from the internet, and returns a concise paragraph summarising the findings with source URLs.
>
> ![Example process](cms:/Files/Images/feature07-00)
>
> The finished process is at `tutorial/processes/tutorial/features/Feature07.p.json` — open it in the Designer to follow along as you read.

---

## Before you start

In [Callable Process Tools] and [Java Tools] you saw how to connect an agent to your own business logic — database queries, calculations, workflow actions.

**The Web Search Tool is different: it connects the agent to the live internet.** LLMs are frozen at their training cutoff. Any question about current events, latest software releases, live documentation, or recent news cannot be answered reliably from training data alone. `webSearch` solves this by letting the agent query the web in real time and reason over the retrieved results before producing its final answer.

When to use it:

- The agent needs information that changes frequently (release notes, prices, news)
- A support agent should look up current documentation or known issues
- A research agent needs to back up answers with cited sources
- The user's question is outside the LLM's training cutoff

---

## What is the webSearch tool?

`webSearch` is a `SmartWorkflowTool` built into Smart Workflow. It accepts a single `query` parameter, runs it through the configured search engine, applies an optional domain whitelist filter, and returns a structured result with titles, URLs, and content snippets.

| Property | Value |
|---|---|
| **Tool name** | `webSearch` |
| **Parameter** | `query` (String) — the search query |
| **Default engine** | DuckDuckGo — no API key required |
| **Configuration** | `variables.yaml` under `AI.Tool.WebSearch.*` |

The tool is registered globally by the framework at startup — no SPI registration or Java class is needed in your project.

---

## Why use it?

- **Current data** — LLMs have a training cutoff; web search gives agents access to live information
- **Zero setup** — DuckDuckGo works out of the box, no external service or API key needed
- **Source citation** — the agent can reference URLs, making answers verifiable
- **Domain whitelist** — restrict results to trusted domains only (e.g. `developer.axonivy.com`)
- **Custom engines** — plug in any search backend via the `SmartWebSearchEngineProvider` SPI

---

## Step 1 — Add webSearch to the Tools list

In the `AgenticProcessCall` configuration, add `"webSearch"` to the **Tools** field:

```json
["webSearch"]
```

That is the only required change. The tool is already implemented and registered by the framework.

---

## Step 2 — Instruct the agent when to search

The agent will not use the tool unless your System Prompt tells it to. Add explicit guidance:

```text
You are a research assistant.
Use the webSearch tool to look up current information on the internet.
Always cite the source URL for each fact you use.
Summarise the results in a clear, concise paragraph.
```

Be specific: name the tool, say when to call it, and describe what format to return. Without this guidance the LLM may answer from its training data and ignore the tool entirely.

---

## Step 3 — Configure search behaviour (optional)

Add the following variables to your project's `variables.yaml` to control search behaviour:

```yaml
Variables:
  AI:
    Tool:
      WebSearch:
        # Search engine: "duckduckgo" (default) or name of a custom SmartWebSearchEngine
        Engine: "duckduckgo"
        # Maximum results returned per query
        MaxResults: "5"
        # Restrict results to these domains (empty = all domains allowed)
        WhitelistDomains: ""
```

If these variables are not set, the defaults apply: DuckDuckGo, 5 results, no domain filter.

---

## Example — Axon Ivy documentation search

### Mock data

The process pre-fills the search query using a **Mock data** Script element:

```javascript
in.query = "What are the latest features in Axon Ivy 14?";
```

### System Prompt

```text
You are a research assistant.
Use the webSearch tool to look up current information on the internet.
Always cite the source URL for each fact you use.
Summarise the results in a clear, concise paragraph.
```

**Query:** `<%=in.query%>`

**Tools:** `["webSearch"]`

**Map result to:** `in.searchResult`

### Result

After the agent element, `in.searchResult` is a plain String containing the agent's synthesised answer. The **Show result** Script element logs it to the Axon Ivy Runtime Log:

```javascript
ivy.log.error(in.searchResult);
```

An example output:

```text
Axon Ivy 14 introduces Smart Workflow — an AI agent framework built directly into the
process engine. Key features include AgenticProcessCall for embedding LLM agents in
processes, support for six AI providers (OpenAI, Anthropic, Ollama, Mistral, Gemini,
Azure OpenAI), callable process tools, Java tools, web search, guardrails, and
observability via Arize Phoenix. Source: https://developer.axonivy.com/release-notes/14.0
```

---

## Configuration reference

| Variable | Description | Default |
|---|---|---|
| `AI.Tool.WebSearch.Engine` | Search engine name. Empty = first available. | `duckduckgo` |
| `AI.Tool.WebSearch.MaxResults` | Maximum results returned per query. | `5` |
| `AI.Tool.WebSearch.WhitelistDomains` | Comma-separated allowed domains. Empty = all. | *empty* |

---

## Common mistakes

- **Agent ignores the tool** — If the System Prompt does not explicitly instruct the agent to call `webSearch`, the LLM will answer from training data and skip the tool. Add a clear instruction: `"Use the webSearch tool to look up current information."`
- **No internet access in the deployment environment** — DuckDuckGo requires outbound HTTP access. In air-gapped or firewall-restricted environments, either configure a proxy or implement a custom `SmartWebSearchEngine` pointing to an internal search service.
- **Whitelist too restrictive** — If a whitelist is configured but results from permitted domains are rare, the agent may receive zero results and fall back to guessing. Test your whitelist with representative queries.
- **Agent over-relying on search** — Without guidance on when to search vs. when to answer directly, the agent may call `webSearch` for every question, including those it can answer reliably from training data. Add instructions that clarify when search is needed.

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/processes/tutorial/features/Feature07.p.json` — the agent process

Open the process in the Designer and inspect the `Web Search Agent` element — note the `Tools` field containing `["webSearch"]` and the System Prompt instructing the agent to always cite sources.

---

## See also

- [Java Tools]
- [Callable Process Tools]
- [Basic Agent Setup]
- [Model Provider Selection]
