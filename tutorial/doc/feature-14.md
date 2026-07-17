# RAG / Semantic Search

Connect an OpenSearch vector store to let agents semantically search your business documents, knowledge bases, or internal data at query time.

## What is it?

**Retrieval-Augmented Generation (RAG)** is a pattern where an agent searches a document store for relevant content at query time, adds that content to its context, and generates a grounded response. Smart Workflow integrates with **OpenSearch** as the vector store for this purpose.

Two built-in processes support RAG:

- `createVectorStore` — ingest documents, chunk them, embed them, and store in OpenSearch
- `openSearchSearch` — a built-in tool the agent calls to perform semantic search at runtime

## Why use it?

- Agents answer questions about your internal documents without including them all in the prompt
- Reduces hallucination — answers are grounded in retrieved documents
- Knowledge base chatbots, internal Q&A, policy assistants
- More cost-effective than adding all documents to the context window
- Documents can be updated independently of agent configuration

## How it works

**Ingestion (one-time or periodic):**

Upload documents → `createVectorStore` callable → Split into chunks → Embedding model converts chunks to vectors → Store in OpenSearch index.

**Retrieval (per query):**

User query → Agent calls `openSearchSearch` tool → Query embedded to vector → Nearest chunks retrieved from OpenSearch → Chunks added to LLM context → Grounded response generated.

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

Enable openSearchSearch in agent

```java
// In AgenticProcessCall element "Tools" field:
["openSearchSearch"]
```

System prompt for RAG agent

```text
You are a knowledge base assistant.
Use the openSearchSearch tool to search the documentation before answering.
Base your answers strictly on the retrieved documents.
Always cite the source document when providing information.
If no relevant documents are found, say so — do not invent answers.
```

> **Try the live demo:** start **"RAG Chatbot Demo"** from the portal (`smart-workflow-demo/processes/Features/RagChatBotDemo.p.json`). The wizard walks through all four phases with a full UI: configure your OpenSearch connection → upload `.txt`/`.md` files → inspect the embedded chunks → chat with the agent.
>
> For the minimal code skeleton (just the `AgenticProcessCall` wired to `openSearchSearch`), see `tutorial/processes/tutorial/features/Feature14.p.json`.

## Where to find it

- `rag/  (RAG module with OpenSearch integration)`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/rag/  (RAG search pipeline)`
- `tutorial/processes/tutorial/features/Feature14.p.json`
- `smart-workflow-demo/processes/Features/RagChatBotDemo.p.json`
- `doc/RAG.md`

## Sample document for ingestion

If you need a ready-made document to test RAG ingestion, use the included sample:

- `doc/company-benefits.md` — a fictional company HR benefits guide covering 14 topics (health insurance, leave, remote work, learning budget, and more). It is structured with clear headings per benefit, making it ideal for demonstrating chunk retrieval against specific HR questions such as *"How many days of annual leave do I get?"* or *"What is the parental leave policy?"*

## Key configuration

| Variable | Description | Default |
| --- | --- | --- |
| `AI.RAG.MaxResults` | Max chunks returned per semantic search. | `5` |
| `AI.RAG.MinScore` | Minimum similarity score (0.0–1.0). Lower = more results, less relevant. | `0.6` |
| `AI.RAG.ChunkSize` | Characters per document chunk during ingestion. | `300` |
| `AI.RAG.ChunkOverlap` | Character overlap between consecutive chunks. | `20` |
| `AI.RAG.EmbeddingModel.Provider` | Provider for the embedding model (can differ from chat model). | *empty* |
| `AI.RAG.EmbeddingModel.Name` | Embedding model name. | *empty* |
| `AI.RAG.EmbeddingModel.ApiKey` | API key for the embedding provider. | *empty* |

## Common mistakes

- **MinScore too high** — A MinScore of 0.9+ will return very few results. Start at 0.6 and tune based on the quality and diversity of your documents.
- **Mismatched embedding models** — The same embedding model must be used for both ingestion and querying. If you re-embed with a different model, all previously stored vectors are incompatible. Re-ingest the entire document set.
- **Agent answering without searching** — Without explicit system prompt instructions, the agent may answer from training data instead of searching. Instruct it explicitly: "Always use openSearchSearch before answering domain questions."

## See also

- [RAG Chatbot Pipeline]
- [Web Search Tool]
- [Java Tools]
- [Human in the Loop]
