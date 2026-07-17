# How LLMs Understand Language

When you type a question and an AI responds intelligently, it looks like the machine is reading and thinking. But under the hood, the model never sees words at all — it sees only numbers. This appendix explains the four steps that transform your text into something the model can process, and back into a response you can read.

---

## A real-life comparison: reading sheet music

A musician does not hear music when they look at sheet music — they see symbols on a page. Each symbol has a name, a position on the staff, a duration. The musician translates those symbols into finger movements, which produce sound, which the audience hears as a melody.

An LLM does something similar with language:

| Sheet music | LLM processing |
| --- | --- |
| Written notes on the page | Raw text input |
| Naming each note (C, D, E…) | Tokenization |
| Assigning each note a position number | Token ID conversion |
| Knowing that the same note sounds different in a major vs minor key | Embedding — initial meaning of each token |
| Interpreting the phrase in the context of the whole piece | Self-attention — context-based updates |
| Playing the melody | Generating the response |

The musician does not need to understand what emotions the composer felt. They process the symbols according to learned rules — and the result sounds meaningful. LLMs work the same way.

---

## The key question

How does a model that only understands numbers make sense of language? The answer is a four-step pipeline that converts text into rich numerical representations, processes them, and converts the result back into text.

---

## Step 1 — Tokenization

Before anything else, the input text is broken into smaller units called **tokens**. A token can be a word, a part of a word, or a punctuation mark. The model never processes raw characters — it always works with tokens.

Example: the word `"unhappiness"` is not treated as one unit. A tokenizer using WordPiece notation splits it into `["un", "##happiness"]`. The `##` prefix means "this piece continues the previous token without a space."

Different tokenizers use different conventions:
- **WordPiece** (BERT): continuation pieces are prefixed with `##` → `["un", "##happiness"]`
- **SentencePiece** (LLaMA, Gemini): word-start pieces are prefixed with `▁` → `["▁un", "happiness"]`

Why split words? Because a finite vocabulary cannot contain every possible word in every language. Splitting into subwords lets the model handle rare words, typos, and new terms by combining known pieces.

---

## Step 2 — Token ID Conversion

Each token is mapped to a unique integer called a **token ID** by looking it up in the model's vocabulary dictionary. The vocabulary is fixed at training time and contains tens of thousands of entries.

Example: the sentence `"What is the weather?"` might tokenize and convert to (values are illustrative — actual IDs depend on the model's vocabulary):

| Token | Token ID |
| --- | --- |
| `What` | 3195 |
| `is` | 278 |
| `the` | 370 |
| `weather` | 15079 |
| `?` | 28804 |

The model now holds the array `[3195, 278, 370, 15079, 28804]`. The original text is gone — only numbers remain from this point forward.

---

## Step 3 — Embedding Lookup

Token IDs are integers, but integers alone carry no meaning — `3195` tells the model nothing about what "What" means or how it relates to other words. The next step converts each token ID into a **dense vector** called an embedding.

An embedding is a list of hundreds or thousands of floating-point numbers. Each number represents a dimension in a learned semantic space. Tokens with similar meanings end up with similar vectors — close to each other in that space.

Example: a classic illustration of semantic space from Word2Vec (2013) —

```
vector("king") - vector("man") + vector("woman") ≈ vector("queen")
```

This works because the embedding space captures relationships between concepts. "King" and "queen" are close in gender-neutral royalty dimensions; "man" and "woman" differ in the gender dimension. The arithmetic works because those relationships are encoded as directions in the vector space.

> **Note:** this example comes from Word2Vec, an older static embedding model. In modern LLMs, token embeddings at this stage are still context-free — the word `"bank"` gets the same initial vector regardless of whether it appears in `"river bank"` or `"savings bank"`. That context-sensitivity is added in Step 4 by self-attention.

### A note on RAG embeddings

The embeddings described above are the LLM's *internal* token-level representations, learned during training. RAG uses a different kind of embedding — a *sentence-level* embedding produced by a dedicated embedding model (such as `text-embedding-3-small`). That model encodes an entire sentence or paragraph into a single vector, which is what gets stored in OpenSearch and compared at search time.

The underlying principle is the same — meaning is encoded as position in a vector space — but the two are separate systems serving different purposes. When you search for `"How many vacation days do I get?"`, the RAG embedding model converts the whole query into one vector and finds the closest stored chunk vectors. This is not the same as the token embeddings the LLM uses internally when generating a response.

---

## Step 4 — Context-Based Updates (Self-Attention)

A raw embedding captures the meaning of a token in isolation. But most words mean different things depending on context. The word `"bank"` in `"river bank"` and `"savings bank"` should produce different representations.

**Self-attention** is the mechanism that updates each token's embedding based on the other tokens in the same sequence. For every token, the model generates three vectors:

| Vector | Role |
| --- | --- |
| **Query (Q)** | "What am I looking for?" |
| **Key (K)** | "What do I contain?" |
| **Value (V)** | "What information do I provide if selected?" |

The attention score between two tokens is the dot product of their Q and K vectors. A high score means the two tokens are strongly related in this context. The model uses these scores to blend the Value vectors — updating each token's representation to reflect the full context of the sentence.

Example: in the sentence `"The trophy did not fit in the suitcase because it was too big"`, the word `"it"` must resolve to either "trophy" or "suitcase". Self-attention calculates that `"it"` attends strongly to `"trophy"` (because "big" relates to the trophy, not the suitcase) and updates the embedding of `"it"` accordingly.

---

## What LLMs actually do

It is important to be precise: **LLMs do not understand language the way humans do.** There is no comprehension, no intent, no awareness. The model processes statistical patterns — relationships between tokens learned from vast amounts of text. What looks like understanding is the result of billions of learned numerical relationships between tokens and their contexts.

This has practical implications:

- The model can be confidently wrong if the pattern matches but the facts do not
- It cannot know things that were not in its training data
- The same words in a different order can produce very different outputs

This is exactly why RAG exists: rather than relying on the model's learned patterns for factual questions, RAG retrieves the actual source text and grounds the model's generation in it.

---

## Summary

| Step | Input | Output | What it does |
| --- | --- | --- | --- |
| **Tokenization** | Raw text | Token list | Splits text into manageable pieces |
| **Token ID conversion** | Token list | Integer array | Maps each piece to a vocabulary index |
| **Embedding lookup** | Integer array | Vector matrix | Converts IDs to meaning-rich numbers |
| **Self-attention** | Vector matrix | Updated vectors | Adjusts meaning based on context |

---

## See also

- [What is RAG (Appendix A)]
- [RAG / Semantic Search (Feature 14)]
- [Basic Agent Setup]
