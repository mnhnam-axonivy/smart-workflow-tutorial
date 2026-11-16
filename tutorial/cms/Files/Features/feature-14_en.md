# RAG as a Tool

Connect an OpenSearch vector store to let agents semantically search your business documents, knowledge bases, or internal data at query time.

## What is it?

**Retrieval-Augmented Generation (RAG)** is a pattern where an agent searches a document store for relevant content at query time, adds that content to its context, and generates a grounded response. Smart Workflow integrates with **OpenSearch** as the vector store for this purpose. For a conceptual overview of how RAG works, see [What is RAG (Appendix A)].

The key built-in tool is `openSearchSearch` — the agent calls this at runtime to perform semantic search against the indexed knowledge base.

## Why use it?

- Agents answer questions about your internal documents without including them all in the prompt
- Reduces hallucination — answers are grounded in retrieved documents
- Knowledge base chatbots, internal Q&A, policy assistants
- More cost-effective than adding all documents to the context window
- Documents can be updated independently of agent configuration

## How it works

**Ingestion (one-time or periodic):**

Upload documents → split into chunks → embedding model converts chunks to vectors → store in OpenSearch index.

> **Chunking strategy:** Smart Workflow currently supports a single built-in strategy — fixed-size recursive chunking via `RagDocumentSplitter`. Chunk size and overlap are configured through `AI.RAG.ChunkSize` and `AI.RAG.ChunkOverlap`. Additional strategies (such as heading-aware or contextual chunk headers) may be introduced in a future release if there is strong demand.

**Retrieval (per query):**

User query → Agent calls `openSearchSearch` tool → Query embedded to vector → Nearest chunks retrieved from OpenSearch → Chunks added to LLM context → Grounded response generated.

## The openSearchSearch tool

`openSearchSearch` is provided by the `smart-workflow-opensearch-rag` project. The agent fills in the parameters itself when it calls the tool:

| Parameter | Type | Description |
| --- | --- | --- |
| `collection` | String | Name of the index to query. **Required — there is no default.** |
| `query` | String | The search query used to find relevant content. |
| `maxResults` | Integer | Maximum number of segments to return. When empty, `AI.RAG.MaxResults` is used. |
| `minScore` | Double | Minimum similarity score (0.0–1.0). When empty, `AI.RAG.MinScore` is used. |

The tool returns the matching content segments together with their similarity scores.

## Example

variables.yaml — RAG configuration

```yaml
Variables:
  AI:
    RAG:
      MaxResults: "5"         # max chunks returned per search
      MinScore: "0.6"         # similarity threshold (0-1)
      ChunkSize: "300"        # characters per document chunk
      ChunkOverlap: "20"      # overlap between consecutive chunks
      EmbeddingModel:
        Provider: "OpenAI"
        Name: "text-embedding-3-small"
        #[password]
        ApiKey: ${decrypt:}
```

The embedding model turns the question into a vector, so it must be the **same model your documents were indexed with**. Only providers that support embedding are valid for `EmbeddingModel.Provider` — currently **OpenAI** and **Ollama**. When `Provider` is blank, `AI.DefaultProvider` is used.

The connection to OpenSearch is configured separately — see [Running a Local Vector Store] for a local setup:

```yaml
Variables:
  AI:
    RAG:
      OpenSearch:
        Url: "http://localhost:19600"
        # Leave the credentials blank when security is disabled.
        # Otherwise use ApiKey, or UserName and Password.
        #[password]
        ApiKey: ${decrypt:}
        UserName: ""
        #[password]
        Password: ${decrypt:}
        # Dev and test only. Never "true" in production.
        TrustSelfSignedCertificates: "false"
```

Enable openSearchSearch in agent

```java
// In AgenticProcessCall element "Tools" field:
["openSearchSearch"]
```

System message for RAG agent

```text
You are a knowledge base assistant.
You MUST always call the openSearchSearch tool before answering any question.
Use the collection <%=in.indexName%>.
Base your answers strictly on the retrieved documents.
Always cite the source document when providing information.
If no relevant documents are found, say so — do not answer from your own knowledge.
```

Three lines of this prompt do real work:

- **The collection name** — `collection` is a required tool parameter with no default, so an agent that is not told the index name cannot search. This is the most common reason a RAG agent answers from training data instead of your documents. Here the name comes from process data (`in.indexName`).
- **"MUST always call"** — without it, models answer directly whenever they think they know.
- **"Do not answer from your own knowledge"** — this makes an ungrounded answer visible instead of plausible.

> **Try the live demo:** start **Feature 14** from the tutorial. The wizard walks through four phases: configure your OpenSearch connection → upload `.txt`/`.md` files → inspect the embedded chunks → chat with the agent.

## Where to find it

- `tutorial/process/tutorial/features/Feature14.p.json` — the process that starts the RAG wizard
- `tutorial/dialog/tutorial/RagDemo/` — the RAG demo wizard (4-step UI)
- `smart-workflow-opensearch-rag` — the Smart Workflow project that provides the `openSearchSearch` tool and the OpenSearch connection variables

## Sample document for ingestion

If you need a ready-made document to test RAG ingestion, use the included sample:

- `doc/company-benefits.md` (in the repository root) — a fictional company HR benefits guide covering 14 topics (health insurance, leave, remote work, learning budget, and more). It is structured with clear headings per benefit, making it ideal for demonstrating chunk retrieval against specific HR questions such as *"How many days of annual leave do I get?"* or *"What is the parental leave policy?"*

## Key configuration

| Variable | Description | Default |
| --- | --- | --- |
| `AI.RAG.MaxResults` | Max chunks returned per semantic search. | `5` |
| `AI.RAG.MinScore` | Minimum similarity score (0.0–1.0). Lower = more results, less relevant. | `0.6` |
| `AI.RAG.ChunkSize` | Characters per document chunk during ingestion. | `300` |
| `AI.RAG.ChunkOverlap` | Character overlap between consecutive chunks. | `20` |
| `AI.RAG.EmbeddingModel.Provider` | Provider for the embedding model (can differ from the chat model). Must support embedding — OpenAI or Ollama. Empty falls back to `AI.DefaultProvider`. | *empty* |
| `AI.RAG.EmbeddingModel.Name` | Embedding model name. Empty uses the provider's `DefaultEmbeddingModel`. | *empty* |
| `AI.RAG.EmbeddingModel.ApiKey` | Optional separate API key for embedding calls. | *empty* |
| `AI.RAG.OpenSearch.Url` | Base URL of the OpenSearch server. | *empty* |
| `AI.RAG.OpenSearch.ApiKey` | API key for OpenSearch. Leave blank when using basic authentication or when security is disabled. | *empty* |
| `AI.RAG.OpenSearch.UserName` / `Password` | Basic authentication. | *empty* |
| `AI.RAG.OpenSearch.TrustSelfSignedCertificates` | Accept self-signed certificates. Dev and test only. | `false` |

## Common mistakes

- **MinScore too high** — A MinScore of 0.9+ will return very few results. Start at 0.6 and tune based on the quality and diversity of your documents.
- **Mismatched embedding models** — The same embedding model must be used for both ingestion and querying. If you re-embed with a different model, all previously stored vectors are incompatible. Re-ingest the entire document set.
- **Agent answering without searching** — Without explicit system message instructions, the agent may answer from training data instead of searching. Instruct it explicitly: "Always use openSearchSearch before answering domain questions."
- **Not telling the agent the collection name** — `collection` is required and has no default. An agent that does not know the index name cannot search and answers from training data instead.
- **An embedding provider that cannot embed** — `AI.RAG.EmbeddingModel.Provider` accepts only OpenAI or Ollama.

To learn more about what RAG is, how the ingestion and retrieval pipelines work, and why it is designed this way, see [What is RAG (Appendix A)].

## See also

- [Web Search Tool]
- [Java Tools]
- [Human in the Loop]
