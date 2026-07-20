# How LLMs Understand Language

When you type a question and an AI responds intelligently, it looks like the machine is reading and thinking. But under the hood, the model never sees words at all — it sees only numbers. This appendix explains the five steps that transform your text into contextual representations, and ultimately into a response:

1. Split text into tokens.
2. Convert tokens into numbers (token IDs).
3. Turn those numbers into embeddings that represent meaning.
4. Update those meanings using context (self-attention).
5. Predict the next token to generate the response.

![Full pipeline overview](cms:/Files/Images/appendix02-pipeline-overview)

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

How does a model that only understands numbers make sense of language? The answer is a five-step pipeline that converts text into rich numerical representations, processes them, and generates a response one token at a time.

---

## Step 1: Tokenization

Before anything else, the input text is broken into smaller units called **tokens**. A token can be a word, a part of a word, or a punctuation mark. The model never processes raw characters — it always works with tokens.

Example: the word `"unhappiness"` is not treated as one unit. A tokenizer using WordPiece notation splits it into `["un", "##happiness"]`. The `##` prefix means "this piece continues the previous token without a space."

Different tokenizers use different conventions:
- **WordPiece** (BERT): continuation pieces are prefixed with `##` → `["un", "##happiness"]`
- **SentencePiece** (LLaMA, Gemini): word-start pieces are prefixed with `▁` → `["▁un", "happiness"]`

Why split words? Because a finite vocabulary cannot contain every possible word in every language. Splitting into subwords lets the model handle rare words, typos, and new terms by combining known pieces.

![Tokenization example](cms:/Files/Images/appendix02-tokenization)

---

## Step 2: Token ID Conversion

Each token is mapped to a unique integer called a **token ID** by looking it up in the model's vocabulary dictionary. The vocabulary is fixed at training time and contains tens of thousands of entries.

Example: the sentence `"What is the weather?"` might tokenize and convert to (values are illustrative — actual IDs depend on the model's vocabulary):

| Token | Token ID |
| --- | --- |
| `What` | 3195 |
| `is` | 278 |
| `the` | 370 |
| `weather` | 15079 |
| `?` | 28804 |

The model now holds the array `[3195, 278, 370, 15079, 28804]`. Internally, the model now works only with numerical representations. The original text is no longer processed directly.

---

## Step 3: Embedding Lookup

Token IDs are integers, but integers alone carry no meaning — `3195` tells the model nothing about what "What" means or how it relates to other words. The next step converts each token ID into a **dense vector** called an embedding.

Each token ID is used to look up a learned embedding from a large table of vectors. These embeddings were learned during training and updated as the model learned language — they are not computed fresh for each input. Each embedding is a list of hundreds or thousands of floating-point numbers, where each number represents a dimension in a learned semantic space. Tokens with similar meanings end up with similar vectors — close to each other in that space.

Example: a classic illustration of semantic space from Word2Vec (2013) —

```
vector("king") - vector("man") + vector("woman") ≈ vector("queen")
```

This famous example illustrates how semantic relationships can emerge in vector spaces — "king" and "queen" are close in royalty dimensions; "man" and "woman" differ in the gender dimension. Modern transformer models use different embedding architectures, but the intuition remains useful.

![Embedding vector space](cms:/Files/Images/appendix02-embedding-space)

> **Note:** this example comes from Word2Vec, an older static embedding model. In modern LLMs, token embeddings at this stage are still context-free — the word `"bank"` gets the same initial vector regardless of whether it appears in `"river bank"` or `"savings bank"`. That context-sensitivity is added in Step 4 by self-attention.

### A note on RAG embeddings

The embeddings described above are the LLM's *internal* token-level representations, learned during training. RAG uses a different kind of embedding — a *sentence-level* embedding produced by a dedicated embedding model (such as `text-embedding-3-small`). That model encodes an entire sentence or paragraph into a single vector, which is what gets stored in OpenSearch and compared at search time.

The underlying principle is the same — meaning is encoded as position in a vector space — but the two are different models with different purposes. When you search for `"How many vacation days do I get?"`, the RAG embedding model converts the whole query into one vector and finds the closest stored chunk vectors. This is not the same as the token embeddings the LLM uses internally when generating a response.

---

## Step 4: Context-Based Updates (Self-Attention)

A raw embedding captures the meaning of a token in isolation. But most words mean different things depending on context. Before self-attention begins, the model also adds positional information to each token so it knows the order of the sequence — otherwise `"dog bites man"` and `"man bites dog"` would look identical.

**Self-attention** is then the mechanism that updates each token's embedding based on the other tokens in the same sequence. To determine which words matter most to each other, the transformer compares every token with every other token. It does this using three learned vectors called Query, Key, and Value. For every token, the model generates these three vectors:

| Vector | Role |
| --- | --- |
| **Query (Q)** | "What am I looking for?" |
| **Key (K)** | "What do I contain?" |
| **Value (V)** | "What information do I provide if selected?" |

The attention score between two tokens is the dot product of their Q and K vectors. A high score means the two tokens are strongly related in this context. The model uses these scores to blend the Value vectors — updating each token's representation to reflect the full context of the sentence.

Example: in `"I deposited money at the bank"`, the word `"bank"` should mean a financial institution. In `"We sat on the river bank"`, the same word should mean a riverbank. Self-attention uses the surrounding tokens to update `"bank"`'s embedding differently in each case.

This allows every word to change its meaning depending on the surrounding words — which is the core capability that makes LLMs so effective at language.

![Self-attention context example](cms:/Files/Images/appendix02-self-attention)

---

## Step 5: Predict the Next Token

After self-attention updates the token representations, the model predicts the most likely next token. That new token is added to the sequence, and the entire process repeats — the model generates the response one token at a time until the answer is complete.

---

## What LLMs actually do

It is important to be precise: **LLMs do not understand language the way humans do.** Today's LLMs do not have human-like comprehension, intent, or awareness. Instead, they generate responses by recognizing statistical patterns learned during training. What looks like understanding is the result of billions of learned numerical relationships between tokens and their contexts.

One important insight: the embedding introduced in Step 3 is only the starting point. Every transformer layer updates these representations, and the vectors continuously change until they encode increasingly rich contextual information by the final layer.

![LLM layer stack](cms:/Files/Images/appendix02-layer-stack)

This has practical implications:

- The model can be confidently wrong if the pattern matches but the facts do not
- It cannot know things that were not in its training data
- The same words in a different order can produce very different outputs

This is exactly why RAG exists: rather than relying on the model's learned patterns for factual questions, RAG retrieves the actual source text and grounds the model's generation in it.

---

## Summary

| Step | Purpose |
| --- | --- |
| **Tokenization** | Split text into manageable pieces |
| **Token IDs** | Map each piece to a vocabulary number |
| **Embeddings** | Represent the initial meaning of each token |
| **Self-attention** | Update meaning based on surrounding context |
| **Next-token prediction** | Generate the response one token at a time |

Although we interact with LLMs using words, every stage inside the model — from understanding the prompt to generating the reply — is performed entirely using numbers.

Now that you understand how an LLM processes text internally, you can better appreciate why RAG supplies relevant document chunks as additional context — the model receives those chunks as part of the token sequence and processes them through exactly this pipeline.

---

## See also

- [What is RAG (Appendix A)]
- [RAG as a Tool (Feature 14)]
- [Basic Agent Setup]
