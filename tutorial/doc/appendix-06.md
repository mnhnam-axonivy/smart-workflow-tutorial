# Quick Reference

Look-up tables for Smart Workflow 14.0.0: what each provider supports, every `AI.*` variable, and every BPM error an agent can raise. The feature guides explain the topics; this page is where you check a name or a default.

---

## Provider capabilities

| Provider | Category | PNG / JPEG | PDF | Structured output | Embedding |
| --- | --- | :---: | :---: | :---: | :---: |
| **OpenAI** | Direct cloud API | ✓ | ✓ | ✓ | ✓ |
| **Azure OpenAI** | Managed platform | ✓ | ✓ | ✓ | — |
| **Gemini** | Direct cloud API | ✓ | ✓ | — | — |
| **Anthropic** | Direct cloud API | ✓ | ✓ | ✓ | — |
| **xAI** | Direct cloud API | ✓ | — | ✓ | — |
| **Ollama** | Self-hosted | ✓ | — | ✓ *(not with tools)* | ✓ |

> **Important:** This table is knowledge, not an enforced contract. Smart Workflow builds image and PDF content unconditionally and checks nothing before a request is sent. An unsupported combination fails **at the provider**, with the provider's own error message.

**Notes per provider**

- **Azure OpenAI** — what a deployment can do depends on the model behind it, not on its name. Use a vision-capable model for file extraction.
- **Gemini** — no structured output. Requesting a typed result does not fail: Smart Workflow logs an error and falls back to a best-effort parse of the reply. Prefer plain text output.
- **xAI** — no PDF support. Convert PDFs to images first.
- **Ollama** — images need a vision-capable model (`ollama pull llava`); no PDF support. A schema and tools cannot go into the same request, so the schema is dropped silently when the agent has tools.
- **File size** — files are base64-encoded (about one third larger). Smart Workflow enforces no size limit; the provider's request limit applies.

### Models

Taken from each provider's `DefaultModel` list. A name outside the list is not rejected, but it is not guaranteed to work.

| Provider | Models |
| --- | --- |
| **OpenAI** | `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-5` |
| **Azure OpenAI** | Any deployment in your resource |
| **Gemini** | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-exp`, `gemini-1.5-pro`, `gemini-1.5-flash` |
| **Anthropic** | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-1`, `claude-opus-4-0`, `claude-sonnet-4-0` |
| **xAI** | `grok-4-1-fast`, `grok-4-1-mini`, `grok-4-1-large`, `grok-4-1-max`, and the `-code` variants |
| **Ollama** | Any model pulled in your instance (`llama3.2`, `gemma3:27b`, `qwen3:30b`, `llava`, …) |

Embedding models: OpenAI offers `text-embedding-3-small`, `text-embedding-3-large` and `text-embedding-ada-002`; on Ollama, pull a dedicated embedding model such as `nomic-embed-text` or `mxbai-embed-large`.

See [Model Provider Selection], [File Extraction] and [Structured Output].

---

## Variables

All settings live under `AI` and are set in the **Engine Cockpit** under **Variables**. The variables are declared by the projects you install — you set their values.

> **Note:** Variables are read on **each agent call**. A changed provider, key, model or switch takes effect on the next call, without a restart.
>
> Variables marked 🔒 are secrets: keep `${decrypt:}` in `variables.yaml` and set the real value in the Engine Cockpit, which encrypts it on entry.

### Core

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI.DefaultProvider` | *(empty)* | Provider used by agents that do not name one: `OpenAI`, `AzureOpenAI`, `Gemini`, `xAI`, `Anthropic` or `Ollama`. |
| `AI.CircuitBreaker.Enabled` | `"false"` | `"true"` stops **every** agent call in the application. See [Circuit Breaker]. |

### Providers

| Variable | 🔒 | Purpose |
| --- | :---: | --- |
| `AI.Providers.OpenAI.APIKey` | 🔒 | OpenAI API key. |
| `AI.Providers.OpenAI.BaseUrl` | | Override the API endpoint. Empty means the vendor default. |
| `AI.Providers.OpenAI.DefaultModel` | | Model used when an agent names none. |
| `AI.Providers.OpenAI.DefaultEmbeddingModel` | | Embedding model used for RAG. |
| `AI.Providers.AzureOpenAI.Endpoint` | | URL of your Azure OpenAI resource. |
| `AI.Providers.AzureOpenAI.DefaultDeployment` | | Deployment used when an agent names no model. |
| `AI.Providers.AzureOpenAI.Deployments.<name>.Model` | | The model behind that deployment. |
| `AI.Providers.AzureOpenAI.Deployments.<name>.APIKey` | 🔒 | Key of that deployment. Azure has no provider-level key. |
| `AI.Providers.Gemini.APIKey` | 🔒 | Google Gemini API key. |
| `AI.Providers.Gemini.BaseUrl` / `DefaultModel` | | As for OpenAI. |
| `AI.Providers.Anthropic.APIKey` | 🔒 | Anthropic API key. |
| `AI.Providers.Anthropic.BaseUrl` / `DefaultModel` | | As for OpenAI. |
| `AI.Providers.xAI.APIKey` | 🔒 | xAI API key. |
| `AI.Providers.xAI.BaseUrl` / `DefaultModel` | | As for OpenAI. |
| `AI.Providers.Ollama.BaseUrl` | | Your Ollama server, for example `http://localhost:11434`. No API key. |
| `AI.Providers.Ollama.DefaultModel` | | Any model pulled in your instance. |
| `AI.Providers.Ollama.DefaultEmbeddingModel` | | For example `nomic-embed-text`. |
| `AI.Providers.Ollama.TimeoutSeconds` | | Default `"300"`. A local model on CPU can need minutes. |

### Guardrails

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI.Guardrails.DefaultInput` | *(empty)* | Comma-separated input guardrails for every agent that selects none. |
| `AI.Guardrails.DefaultOutput` | *(empty)* | Comma-separated output guardrails for every agent that selects none. |
| `AI.Guardrails.PromptInjection.Classifier.Provider` | *(empty)* | Provider for the `AiPromptInjectionInputGuardrail` classifier. Empty falls back to `AI.DefaultProvider`. |
| `AI.Guardrails.PromptInjection.Classifier.Model` | *(empty)* | Pin a cheap model for the classifier, for example `gpt-4.1-nano`. Empty uses the provider default. |
| `AI.Guardrails.PromptInjection.Classifier.SystemPrompt` | *(empty)* | Custom classifier prompt. Must instruct the model to reply only `YES` or `NO`. |
| `AI.Guardrails.PromptInjection.Classifier.MinLength` | `"0"` | Skip the LLM call for messages shorter than this many characters. |

### Web search

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI.Tool.WebSearch.Engine` | `duckduckgo` | Name of the search engine. Empty uses the first available engine. |
| `AI.Tool.WebSearch.MaxResults` | *(empty)* | Results per query. Empty falls back to `5`. |
| `AI.Tool.WebSearch.WhitelistDomains` | *(empty)* | Comma-separated allowed domains. Empty allows all. |

### RAG

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI.RAG.MaxResults` | `"5"` | Segments returned per query. The agent can override it per call. |
| `AI.RAG.MinScore` | `"0.6"` | Similarity threshold, 0.0–1.0. The agent can override it per call. |
| `AI.RAG.ChunkSize` | `"300"` | Chunk size at ingestion, in **characters**. Applies to new documents only. |
| `AI.RAG.ChunkOverlap` | `"20"` | Overlap between consecutive chunks, in characters. |
| `AI.RAG.EmbeddingModel.Provider` | *(empty)* | Must support embedding — OpenAI or Ollama. Empty falls back to `AI.DefaultProvider`. |
| `AI.RAG.EmbeddingModel.Name` | *(empty)* | Empty uses the provider's `DefaultEmbeddingModel`. |
| `AI.RAG.EmbeddingModel.ApiKey` 🔒 | *(empty)* | Optional separate key for embedding calls. |
| `AI.RAG.OpenSearch.Url` | *(empty)* | Base URL of the OpenSearch server. |
| `AI.RAG.OpenSearch.ApiKey` 🔒 | *(empty)* | Leave blank when using basic authentication or when security is disabled. |
| `AI.RAG.OpenSearch.UserName` | *(empty)* | Basic authentication user. |
| `AI.RAG.OpenSearch.Password` 🔒 | *(empty)* | Basic authentication password. |
| `AI.RAG.OpenSearch.TrustSelfSignedCertificates` | `"false"` | Dev and test only. |

### Observability

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI.Observability.CustomFields.Enabled` | `"true"` | Mark Cases and Tasks with the `aiAssisted` custom field. **On by default.** |
| `AI.Observability.Ivy.Enabled` | off | Record every conversation into the Ivy repository. Needed for the [Governance Dashboard]. |
| `AI.Observability.Openinference.Enabled` | off | Export OpenInference traces to Arize Phoenix. |
| `AI.Observability.Openinference.HideInputMessages` | off | Leave prompts out of exported traces. |
| `AI.Observability.Openinference.HideOutputMessages` | off | Leave responses out of exported traces. |

See [Observability].

---

## Error codes

Every BPM error Smart Workflow can raise on an `AgenticProcessCall` element. They are separate codes with separate causes, and a boundary event catches exactly one of them — mixing them up is a common reason for "my error handler never fires".

| Error code | Raised when | Guide |
| --- | --- | --- |
| `smartworkflow:guardrail:input:violation` | An input guardrail blocked the User message before it reached the model. | [Input Guardrail] |
| `smartworkflow:guardrail:output:violation` | An output guardrail blocked the model's response. | [Output Guardrail] |
| `smartworkflow:stop` | The circuit breaker is on; the call was refused. | [Circuit Breaker] |
| *your own code* | A human-in-the-loop tool threw a `BpmError` to suspend the agent. You choose the code; the tutorial uses `human:decision`. | [Human in the Loop] |

### Catching one

1. Add an **Error Boundary Event** to the `AgenticProcessCall` element.
2. Set its error code to the one you want to catch.
3. Model the fallback — a friendly message, an audit entry, a non-AI path.

```java
in.result = in.error.getMessage();
```

> **Important:** Branch on the **error code**, never on the message text. For guardrail violations the message is wrapped by Smart Workflow — it names an internal adapter class, not your guardrail — and its format is not a stable contract.

### Problems without an error code

Not every problem raises a BPM error. A skipped call, a result that could not be mapped, or a file that was dropped leave only a log line — or nothing. Those cases are collected in [Troubleshooting].

---

## Editor fields

The fields of the `AgenticProcessCall` configuration editor in 14.0.0, and the name each one has in the process file:

| Group | Field | Stored as | Empty means |
| --- | --- | --- | --- |
| Message | **System message** | `system` | The agent runs without standing instructions |
| Message | **User message** | `query` | The agent call is skipped |
| 🛠️ Tools | **Available tools** | `tools` | No tools at all |
| 🛡️ Guardrails | **Input guardrails** | `inputGuardrails` | The application defaults apply |
| 🛡️ Guardrails | **Output guardrails** | `outputGuardrails` | The application defaults apply |
| 🧠️ Model | **Provider** | `provider` | `AI.DefaultProvider` |
| 🧠️ Model | **Model** | `model` | The provider's `DefaultModel` |
| 🧠️ Model | **Temperature** | `temperature` | `0.0` |
| Output | **Expect result of type** | `resultType` | Plain text (`String`) |
| Output | **Map result to** | `resultMapping` | The result is not stored |

---

## See also

- [Key Concepts]
- [Troubleshooting]
- The complete upstream reference: [Smart Workflow documentation](https://github.com/axonivy-market/smart-workflow/blob/master/README.md)
