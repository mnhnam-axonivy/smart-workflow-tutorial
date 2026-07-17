# What is RAG?

**Retrieval-Augmented Generation (RAG)** is a technique that gives an AI agent access to your own documents at the moment it answers a question — without retraining the model and without stuffing everything into the prompt.

---

## A real-life comparison: the open-book exam

Imagine a student sitting an exam with one rule: they are allowed to bring their textbook.

When a question appears, the student does not answer purely from memory. They scan the textbook, find the relevant chapter, read the key paragraph, and write their answer based on what they just found — not what they vaguely recalled.

This is exactly how RAG works:

| Open-book exam | RAG system |
| --- | --- |
| The exam question | User query |
| Scanning the textbook | Semantic search over the document store |
| Finding the relevant chapter and paragraph | Retrieved document chunks |
| Reading those paragraphs | Chunks injected into the LLM prompt |
| Writing the answer based on what was found | LLM generates a grounded response |

A student who answers purely from memory may get things wrong or out of date. A student who looks it up first gives a precise, evidence-based answer — and that is the difference RAG makes.

---

## The problem it solves

An LLM knows only what it was trained on. It has no knowledge of your company's internal documents, your product catalogue, your policies, or anything written after its training cutoff. You could paste all your documents into the prompt — but that quickly becomes too expensive, too slow, and hits context-window limits.

RAG solves this by letting the agent *search first, then answer*.

---

## The core idea

Instead of loading everything upfront, the agent looks up only the relevant pieces at the moment the question is asked — then uses those pieces to ground its answer.

> **Analogy:** Think of a consultant who, before answering your question, quickly searches the company knowledge base, pulls the two most relevant pages, reads them, and then gives you a precise answer based on those pages — rather than guessing from memory.

---

## How it works — the basic flow

At a high level, every RAG interaction goes through three steps:

1. The user's question is converted into a vector (a numerical representation of its meaning)
2. The vector store finds the document chunks most semantically similar to that vector
3. Those chunks are added to the prompt, and the LLM generates an answer grounded in them

---

## The RAG Pipeline

A RAG system is built from two distinct phases that run at different times.

---

### Part 1 — Ingestion

*Runs once, or whenever your documents change. Prepares the knowledge base.*

Your source documents are processed and stored so they can be searched later. The output is a populated vector store index ready for retrieval.

![Ingestion pipeline](cms:/Files/Images/appendix01-ingestion)

#### Step 1 — Data Sources

Collect the raw documents you want the agent to know about. These can come from many formats and locations.

Examples: a PDF employee handbook, a Markdown knowledge base article, a CSV product list, a Word policy document, a web page, or a database export. The more focused and well-structured your source documents are, the better the retrieval quality will be.

#### Step 2 — Load

Extract the raw text content from each source file. This step strips away formatting, layout, and binary encoding so only the readable text remains.

Example: a PDF invoice is parsed to extract `"Item: Laptop, Qty: 2, Unit Price: $1,200, Total: $2,400"` as plain text. A Markdown file has its `#` headings and `**bold**` markers preserved as plain characters.

#### Step 3 — Split

Break the extracted text into smaller, overlapping chunks that are easier to retrieve precisely. A single large document is split into many focused pieces so the search can return exactly the relevant paragraph — not the entire file.

Example: a 10-page HR policy document is split into chunks of ~300 characters each, with a 20-character overlap between consecutive chunks to avoid cutting a sentence mid-thought. The section on parental leave becomes its own chunk, separate from the section on annual leave.

#### Step 4 — Embed

Convert each text chunk into a vector — a list of numbers that represents the *meaning* of that chunk in a high-dimensional space. Chunks with similar meaning will produce vectors that are close to each other, regardless of the exact words used.

Example: the chunk `"Employees receive 20 days of paid leave per year"` is converted to a vector like `[0.23, -0.11, 0.78, ...]` (hundreds of dimensions). A user query `"How much vacation do I get?"` will produce a vector close to this one even though no word matches exactly.

#### Step 5 — Store

Write each vector together with its metadata into the vector store (OpenSearch). The metadata preserves context so the agent knows where a chunk came from when it retrieves it later.

Example: each stored entry contains the vector, the original chunk text, and metadata such as `{ "source": "company-benefits.md", "page": 2, "section": "Annual Leave" }`. This lets the agent cite the source when answering.

---

### Part 2 — Retrieval

*Runs on every user query. Finds the relevant content and generates the answer.*

When the user asks a question, the agent searches the vector store for the most relevant chunks and uses them to generate a grounded response.

![Retrieval pipeline](cms:/Files/Images/appendix01-retrieval)

#### Step 1 — User Query

The user asks a natural language question. There is no need for special syntax or keywords — the question is plain text, just like typing into a chat.

Example: `"How many days of annual leave do I get after 5 years?"` or `"What is the parental leave policy for secondary caregivers?"`

#### Step 2 — Embed Query

The question is converted into a vector using the exact same embedding model that was used during ingestion. This is critical — the query vector and the stored chunk vectors must live in the same space to be comparable.

Example: `"How many days of annual leave do I get?"` becomes `[0.21, -0.11, 0.78, ...]`. This vector captures the *meaning* of the question, not just its keywords.

#### Step 3 — Search Vector Store

The query vector is used to search the vector store for the most similar stored vectors. This is a mathematical nearest-neighbour search — it finds chunks whose meaning is closest to the question, even if they use different words.

Example: the query about annual leave is compared against all stored chunk vectors. Chunks from the "Annual Leave" section of `company-benefits.md` will score highly because their meaning is close to the query, even if the exact phrase "annual leave" does not appear in every chunk.

#### Step 4 — Rank Results

All matching chunks are ranked by their similarity score — a number between 0 and 1 indicating how closely the chunk's meaning matches the query. Only chunks that meet the minimum score threshold (`AI.RAG.MinScore`) are kept.

Example: the search returns `Chunk A (score 0.92)`, `Chunk B (score 0.85)`, `Chunk C (score 0.73)`, and discards lower-scoring chunks below the threshold.

#### Step 5 — Select Top-K

The top-K highest-scoring chunks are selected as the context to pass to the LLM. K is controlled by the `AI.RAG.MaxResults` setting.

Example: with `MaxResults: 3`, only Chunk A, Chunk B, and Chunk C are selected — even if 20 chunks passed the minimum score filter.

#### Step 6 — Provide Context

The selected chunks are injected into the LLM prompt alongside the original question. The LLM reads the retrieved content and generates an answer grounded in those specific passages — not from its training data.

Example: the LLM receives the question `"How many days of annual leave do I get after 5 years?"` together with the retrieved chunk `"After 5 years of service, annual leave increases to 25 days."` and responds with a precise, sourced answer.

---

## Summary

| | Ingestion | Retrieval |
| --- | --- | --- |
| **When it runs** | Once (or on document update) | Every user query |
| **Input** | Source documents | User question |
| **Output** | Populated vector store index | Grounded LLM answer |
| **Key step** | Embed and store document chunks | Embed query, search, augment prompt |

---

## See also

- [RAG / Semantic Search (Feature 14)]
- [Basic Agent Setup]
