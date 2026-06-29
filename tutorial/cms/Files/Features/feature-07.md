# Web Search Tool

A built-in tool that lets agents search the internet via DuckDuckGo (or a custom engine) to retrieve up-to-date information during reasoning.

## What is it?

The `webSearch` built-in tool gives agents access to live internet data. When an agent encounters a question about current events, product prices, documentation, or any information not in its training data, it can call this tool to retrieve relevant results.

The tool returns a list of results with titles, URLs, and content snippets. Results can optionally be filtered by a whitelist of allowed domains, and a custom search engine can be plugged in via SPI.

## Why use it?

- LLM knowledge has a training cutoff — web search gives agents access to current data
- Support agents can look up known issues or documentation in real time
- Research agents can gather evidence from the web to back up their answers
- No external service setup needed — DuckDuckGo works out of the box, no API key required
- Domain whitelist lets you restrict results to trusted sources only

## How it works

The framework loads the registered search engine via SPI at startup. DuckDuckGo is bundled by default. The engine is called with the query and configured max results. The whitelist filter removes results from disallowed domains before returning to the LLM.

Flow: Agent decides to search → Calls webSearch("query") → WebSearchTool runs search engine → WhitelistDomainFilter applied → Results (title, URL, snippet) returned to LLM → LLM synthesises final answer.

## Example

Enable webSearch in the agent element

```java
// In the AgenticProcessCall element "Tools" field:
["webSearch"]
```

variables.yaml — configure search behaviour

```yaml
Variables:
  AI:
    Tool:
      WebSearch:
        # Search engine: "duckduckgo" (default) or name of a custom SmartWebSearchEngine
        Engine: "duckduckgo"
        # Maximum results per query
        MaxResults: "5"
        # Restrict results to these domains (empty = all domains allowed)
        WhitelistDomains: "developer.axonivy.com, docs.axonivy.com"
```

System prompt encouraging web search

```text
You are a support agent for Axon Ivy.
Use the webSearch tool to look up current documentation and known issues.
Always cite the source URL when you use information from a web search.
```

Implementing a custom search engine (optional)

```java
public class MySearchEngine implements SmartWebSearchEngine {
  @Override
  public String name() { return "myEngine"; }

  @Override
  public List<SmartWebSearchResult> search(String query, int maxResults) {
    // call your search API...
    return results;
  }
}

// Provider:
public class MySearchEngineProvider implements SmartWebSearchEngineProvider {
  @Override
  public List<SmartWebSearchEngine> getEngines() {
    return List.of(new MySearchEngine());
  }
}
```

> See `smart-workflow-demo/processes/Features/WebSearchDemo.p.json` for a full working example of an agent with web search enabled.

## Where to find it

- `smart-workflow/src/com/axonivy/utils/smart/workflow/tools/web/WebSearchTool.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/tools/web/SmartWebSearchEngine.java`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/tools/web/SmartWebSearchEngineProvider.java`
- `smart-workflow-demo/processes/Features/WebSearchDemo.p.json`
- `doc/TOOLS.md  (webSearch section)`

## Key configuration

| Variable | Description | Default |
|---|---|---|
| `AI.Tool.WebSearch.Engine` | Search engine name. Empty = first available. | `duckduckgo` |
| `AI.Tool.WebSearch.MaxResults` | Maximum results returned per query. | `5` |
| `AI.Tool.WebSearch.WhitelistDomains` | Comma-separated allowed domains. Empty = all. | *empty* |

## Common mistakes

- **No internet access in the deployment environment** — DuckDuckGo requires outbound HTTP access. In air-gapped or firewall-restricted environments, either configure a proxy or implement a custom search engine pointing to an internal search service.
- **Whitelist too restrictive** — If a whitelist is configured but results from permitted domains are rare, the agent may receive zero results and fallback to hallucination. Test your whitelist with representative queries.
- **Agent over-relying on search** — Without clear system prompt guidance, the agent may call webSearch for every question, including ones it can answer from training data. Add instructions on when to search vs. when to answer directly.

## See also

- [Callable Process Tools]
- [RAG / Semantic Search]
- [Query Expansion]
