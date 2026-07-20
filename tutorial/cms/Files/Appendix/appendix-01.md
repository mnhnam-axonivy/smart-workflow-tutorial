# What is RAG?

**Retrieval-Augmented Generation (RAG)** lets an AI answer questions using your own documents. Instead of relying only on what it learned during training, the AI first searches your knowledge base for relevant information, then uses that information to generate an answer.

---

## The problem it solves

An LLM knows only what it was trained on. It has no knowledge of your company's internal documents, your product catalogue, your policies, or anything written after its training cutoff. You could paste all your documents into the prompt — but that quickly becomes too expensive, too slow, and hits context-window limits.

Even if you share documents during a conversation, the model does not permanently learn them. Without RAG, every new conversation starts without knowledge of your organisation's documents.

![RAG Explanation](cms:/Files/Images/appendix01-explanation)

---

## A real-life comparison: the librarian

You walk into a library and ask: *"Why did the Roman Empire fall?"*

A good librarian does not answer from memory:

1. First, they search the catalog for relevant books.
2. Then, they pull only the most relevant chapters — skipping everything about Roman architecture or daily life.
3. Next, they quickly read through those pages.
4. Finally, they explain: "Historians generally agree it was a combination of political instability, economic decline, military pressure from barbarian invasions, and internal corruption."

This is exactly how RAG works:

| The librarian | RAG system |
| --- | --- |
| Your question | User query |
| Searching the catalog | Semantic search over the vector store |
| Pulling the relevant chapters | Retrieved document chunks |
| Reading those pages | Chunks injected into the LLM prompt |
| Explaining in their own words | LLM generates a grounded response |

The librarian doesn't memorise every book — they know how to find the right information quickly. RAG gives an LLM that same ability.

---

## How it works — the basic flow

Instead of matching exact keywords, RAG searches by meaning — this is called **semantic search**. To make this possible, both documents and questions are converted into numerical representations called **embeddings**. Similar meanings produce embeddings that are mathematically close, even when the exact words differ.

At a high level, every RAG interaction goes through three steps:

1. The user's question is converted into an embedding.
2. The vector store finds document chunks whose embeddings are most similar.
3. Those chunks are added to the prompt, and the LLM generates an answer grounded in them.

> **Important:** RAG does not retrain or fine-tune the LLM. The model remains unchanged — it simply receives additional context alongside each question.

---

## The RAG Pipeline

Think of RAG as having two halves:

- **Ingestion** prepares your documents for searching — runs once, or when documents change.
- **Retrieval** searches those documents whenever a user asks a question — runs on every query.

---

### Part 1: Ingestion

*Runs once, or whenever your documents change. Prepares the knowledge base.*

Your source documents are processed and stored so they can be searched later. The output is a populated vector store index ready for retrieval.

![Ingestion pipeline](cms:/Files/Images/appendix01-ingestion)

#### Step 1: Data Sources

Collect the raw documents you want the agent to know about. These can come from many formats and locations.

Examples: a PDF employee handbook, a Markdown knowledge base article, a CSV product list, a Word policy document, a web page, or a database export. The more focused and well-structured your source documents are, the better the retrieval quality will be.

#### Step 2: Load

Extract the raw text content from each source file. This step strips away formatting, layout, and binary encoding so only the readable text remains.

Example: a PDF invoice is parsed to extract `"Item: Laptop, Qty: 2, Unit Price: $1,200, Total: $2,400"` as plain text. A Markdown file has its `#` headings and `**bold**` markers preserved as plain characters.

#### Step 3: Split

Break the extracted text into smaller, overlapping chunks. Smaller chunks improve retrieval accuracy because the search can return only the relevant section instead of an entire document. Chunk size depends on the content and application — the goal is chunks that are focused enough to be retrieved precisely, but large enough to make sense on their own.

Example: a long HR policy document is split so that the section on parental leave becomes its own chunk, separate from the section on annual leave. Chunks overlap slightly to avoid cutting a sentence mid-thought.

#### Step 4: Create Embeddings

Convert each text chunk into an embedding — a list of numbers that captures the *meaning* of that chunk. Chunks with similar meaning will produce embeddings that are close to each other, regardless of the exact words used.

Example: the chunk `"Employees receive 20 days of paid leave per year"` is converted into an embedding. A user query `"How much vacation do I get?"` will produce an embedding close to this one even though no word matches exactly.

> To understand how embeddings work inside the LLM — how text becomes numbers, and how meaning is encoded in vector space — see [How LLMs Understand Language].

#### Step 5: Store

Write each embedding together with its metadata into the vector store (OpenSearch). The metadata preserves context so the agent knows where a chunk came from when it retrieves it later.

Example: each stored entry contains the embedding, the original chunk text, and metadata such as `{ "source": "company-benefits.md", "page": 2, "section": "Annual Leave" }`. This metadata can later be used to show citations or links back to the original source document.

The quality of retrieval depends heavily on document quality, chunking strategy, and the choice of embedding model.

---

### Part 2: Retrieval

*Runs on every user query. Finds the relevant content and generates the answer.*

When the user asks a question, the agent searches the vector store for the most relevant chunks and uses them to generate a grounded response.

![Retrieval pipeline](cms:/Files/Images/appendix01-retrieval)

#### Step 1: User Query

The user asks a natural language question. There is no need for special syntax or keywords — the question is plain text, just like typing into a chat.

Example: `"How many days of annual leave do I get after 5 years?"` or `"What is the parental leave policy for secondary caregivers?"`

#### Step 2: Embed Query

The question is converted into an embedding using the exact same model that was used during ingestion. This is critical — the query embedding and the stored chunk embeddings must be produced by the same model to be comparable.

Example: `"How many days of annual leave do I get?"` becomes an embedding that captures the *meaning* of the question, not just its keywords.

#### Step 3: Search Vector Store

The query embedding is used to search the vector store for the most similar stored embeddings. This is a mathematical nearest-neighbour search — it finds chunks whose meaning is closest to the question, even if they use different words.

Example: the query about annual leave is compared against all stored chunk embeddings. Chunks from the "Annual Leave" section of `company-benefits.md` will score highly because their meaning is close to the query, even if the exact phrase "annual leave" does not appear in every chunk.

#### Step 4: Rank Results

All matching chunks are ranked by their similarity score. Higher scores indicate that the chunk is more relevant to the user's question. Chunks below a minimum threshold (`AI.RAG.MinScore`) are discarded.

Example: the search returns `Chunk A (score 0.92)`, `Chunk B (score 0.85)`, `Chunk C (score 0.73)`, and discards lower-scoring chunks below the threshold.

#### Step 5: Select Top-K

The top-K highest-scoring chunks are selected as the context to pass to the LLM. K is controlled by the `AI.RAG.MaxResults` setting.

Example: with `MaxResults: 3`, only Chunk A, Chunk B, and Chunk C are selected — even if 20 chunks passed the minimum score filter.

#### Step 6: Provide Context

The selected chunks are injected into the LLM prompt alongside the original question. The LLM reads the retrieved content and generates an answer grounded in those specific passages — not from its training data.

Example: the LLM receives the question `"How many days of annual leave do I get after 5 years?"` together with the retrieved chunk `"After 5 years of service, annual leave increases to 25 days."` and responds with a precise, sourced answer.

#### Why not just use SQL?

A natural question at this point: documents and their text are just strings — why not store them in a relational database and query with `WHERE content LIKE '%annual leave%'`?

The problem is keyword matching. SQL looks for exact character sequences. A user asking *"how much vacation do I get?"* contains none of the words in a chunk titled *"Annual Leave Policy"*. The query returns nothing, even though the meaning is identical.

Vector search works differently. Both the query and the stored chunks are converted into embeddings — numerical representations of meaning. The search finds chunks whose meaning is closest to the query, regardless of the exact words used.

![SQL vs vector store](cms:/Files/Images/appendix01-sql-vs-vector)

---

> **Note:** Although RAG greatly improves factual accuracy by grounding answers in retrieved documents, the LLM can still misinterpret retrieved information. The quality of source documents remains critical.

---

## Summary

| | Ingestion | Retrieval |
| --- | --- | --- |
| **Runs** | When documents change | Every user question |
| **Purpose** | Prepare knowledge for search | Find relevant knowledge |
| **Main input** | Documents | User query |
| **Main output** | Searchable embedding index | Grounded response |
| **Uses LLM?** | Embedding model only | Embedding model + generative LLM |

---

## What's next?

Now that you understand the basic RAG pipeline, the following topics build on this foundation. This tutorial does not cover them — we encourage you to explore them through external resources.

- **Chunking strategies**: how you split documents affects retrieval quality. Different strategies (fixed size, recursive, semantic) suit different content types.
- **Embedding models**: the choice of model determines how well meaning is captured. Models differ in language support, domain specialisation, and performance.
- **Vector databases**: specialised databases optimised for storing and searching embeddings at scale (e.g. OpenSearch, Pinecone, Weaviate).
- **Hybrid search**: combines semantic search with keyword search to improve recall, especially for exact terms like product codes or proper names.
- **Re-ranking**: a second pass that re-scores retrieved chunks using a more accurate model before passing them to the LLM.
- **Metadata filtering**: narrows the search by filtering on document attributes (e.g. department, date range) before or after the vector search.

---

## Key Takeaways

- RAG lets an LLM use your own documents without retraining.
- Documents are prepared once during ingestion.
- Every question triggers a retrieval search.
- Only the most relevant document chunks are sent to the LLM.
- Better source documents lead to better answers.
