# Model Provider Selection

Before configuring Smart Workflow, it helps to understand how AI model providers are categorised in the market — because the choice affects cost, data privacy, and infrastructure complexity.

---

## Types of AI model providers

### Self-Hosted Models

You download open-source models (e.g. Llama, Mistral, DeepSeek) and run them on your own servers or local hardware. You completely control the infrastructure.

**Pros:** Complete data privacy, no per-query costs, works offline, and highly customisable.

**Cons:** Requires purchasing or renting GPUs and managing your own server operations (DevOps).

### LLM Platforms

You access multiple AI models through a managed cloud platform instead of integrating with each model provider directly. The platform also provides enterprise features like security, monitoring, evaluation, and governance.

**Pros:** One integration for multiple models, built-in enterprise security and compliance, centralised monitoring and billing, and easier deployment of production AI applications.

**Cons:** More complex than calling a model API directly, may increase costs due to platform services, and can create dependency on a specific cloud provider (Google Cloud, AWS, or Azure).

### Direct Providers (Cloud APIs)

You access proprietary, closed-source models via an API. You pay the vendor directly based on usage (e.g. per-token cost).

**Pros:** Instant access to the most intelligent and capable models without needing to manage hardware.

**Cons:** Data is sent over the internet to a third party, and costs scale directly with your usage.

---

## What Smart Workflow supports

Smart Workflow ships with built-in support for six providers across all three categories. You switch between them by changing a single variable — no code changes required.

| Provider | Category | Key Models | Vision | PDF | Structured Output | Embedding |
| --- | --- | --- | --- | --- | --- | --- |
| **OpenAI** | Direct | gpt-4o, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5 | ✓ | ✓ | ✓ | ✓ |
| **Azure OpenAI** | Platform | Any vision-capable deployment | ✓ | ✓ | ✓ | — |
| **Google Gemini** | Direct | gemini-1.5-*, gemini-2.0-*, gemini-2.5-* | ✓ | ✓ | — | — |
| **Anthropic / Claude** | Direct | claude-opus-*, claude-sonnet-*, claude-haiku-* | ✓ | ✓ | ✓ | — |
| **xAI / Grok** | Direct | grok-4-1-* series | ✓ | — | ✓ | — |
| **Ollama** | Self-Hosted | llama3, gemma3, qwen, mistral, llava, … | ✓* | — | ✓ (not with tools) | ✓ |

> **Ollama note:** Vision requires a vision-capable model (e.g. `llava`, `llama3.2-vision`).
>
> **Gemini note:** Gemini does not support structured output. Requesting a typed result does not fail — Smart Workflow logs an error and falls back to a best-effort parse of the reply — so prefer plain text output on Gemini.
>
> **Ollama structured output:** A schema and tools cannot go into the same request. When an agent has both, the tools are kept and the schema is dropped silently.
>
> **Embedding:** Only needed for [RAG as a Tool], where the embedding model must come from a provider with a tick in this column.
>
> **Nothing is checked locally:** This table is knowledge, not an enforced contract. Smart Workflow does not stop an unsupported combination — a PDF sent to xAI, for example. The request fails at the provider, with the provider's own error message.
>
> **Vision image formats:** Vision input only accepts PNG, JPG, and JPEG. Other image formats are not supported.

---

## Two ways to configure a provider

There are two levels at which you can set the AI provider and model — one global, one per-agent.

### 1 — Global default via variables.yaml

Set the provider once for the entire application with the `AI.DefaultProvider` variable. Every `AgenticProcessCall` in every process will use this provider unless overridden.

Each provider's own variables are declared by its connector project (`smart-workflow-openai`, `smart-workflow-anthropic`, …), so install the project of the provider you want to use. The examples below show the variables in `variables.yaml` notation; on a running engine you set the same variables in the **Engine Cockpit** under **Variables**.

**Example — OpenAI:**

```yaml
Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        #[password]
        APIKey: ${decrypt:}
        DefaultModel: "gpt-4.1-mini"
```

**Example — Azure OpenAI:**

```yaml
Variables:
  AI:
    DefaultProvider: "AzureOpenAI"
    Providers:
      AzureOpenAI:
        Endpoint: "https://YOUR_RESOURCE.openai.azure.com/"
        DefaultDeployment: "my-gpt-4-1-mini"
        Deployments:
          my-gpt-4-1-mini:
            Model: "gpt-4.1-mini"
            #[password]
            APIKey: ${decrypt:}
```

Azure OpenAI is the only provider with a nested shape: there is no provider-level API key — every deployment carries its own model and key. Deployment names become variable names, so use kebab-case (lowercase letters, digits and hyphens, not starting with a digit).

**Example — Google Gemini:**

```yaml
Variables:
  AI:
    DefaultProvider: "Gemini"
    Providers:
      Gemini:
        #[password]
        APIKey: ${decrypt:}
        DefaultModel: "gemini-2.5-flash"
```

**Example — Anthropic:**

```yaml
Variables:
  AI:
    DefaultProvider: "Anthropic"
    Providers:
      Anthropic:
        #[password]
        APIKey: ${decrypt:}
        DefaultModel: "claude-sonnet-4-5"
```

**Example — xAI / Grok:**

```yaml
Variables:
  AI:
    DefaultProvider: "xAI"
    Providers:
      xAI:
        #[password]
        APIKey: ${decrypt:}
        DefaultModel: "grok-4-1-fast"
```

**Example — Ollama (no API key needed):**

```yaml
Variables:
  AI:
    DefaultProvider: "Ollama"
    Providers:
      Ollama:
        BaseUrl: "http://localhost:11434"
        DefaultModel: "llama3.2"
        # A local model on CPU can need minutes for large models or cold starts.
        TimeoutSeconds: "300"
```

#### Setting API keys securely in Engine Cockpit

Axon Ivy treats any variable annotated with `#[password]` as a secret — the value is encrypted at rest and decrypted only at runtime. You should **never type a real API key directly into variables.yaml** — it would stay readable there and end up in source control. Set it in the Engine Cockpit instead:

![Setting API key in Engine Cockpit](cms:/Files/Images/feature03-api-key-cockpit)

Open **Engine Cockpit → Applications → your application → Variables**, find the key field (e.g. `AI.Providers.OpenAI.APIKey`), and paste your key. The Engine encrypts it immediately. The `${decrypt:}` placeholder is what stays in `variables.yaml`.

> **Note:** Variables are read on **each agent call**. A key you add or rotate, or a default model you change, takes effect on the next call — no restart needed.

#### Variable reference

| Variable | Description | Example |
| --- | --- | --- |
| `AI.DefaultProvider` | Global default provider — `OpenAI`, `AzureOpenAI`, `Gemini`, `xAI`, `Anthropic` or `Ollama` | `OpenAI` |
| `AI.Providers.OpenAI.APIKey` | OpenAI API key (encrypted) | `${decrypt:…}` |
| `AI.Providers.OpenAI.DefaultModel` | OpenAI model used when an agent names none | `gpt-4.1-mini` |
| `AI.Providers.Anthropic.DefaultModel` | Anthropic model used when an agent names none | `claude-sonnet-4-5` |
| `AI.Providers.Ollama.BaseUrl` | Ollama server URL | `http://localhost:11434` |
| `AI.Providers.AzureOpenAI.Endpoint` | Azure endpoint URL | `https://…openai.azure.com` |
| `AI.Providers.AzureOpenAI.DefaultDeployment` | Azure deployment used when an agent names none | `my-gpt-4-1-mini` |
| `AI.Providers.AzureOpenAI.Deployments.<name>.Model` | Model behind that deployment | `gpt-4.1-mini` |
| `AI.Providers.AzureOpenAI.Deployments.<name>.APIKey` | API key of that deployment (encrypted) | `${decrypt:}` |

For every variable and its default, see [Quick Reference] or the upstream [Smart Workflow variables reference](https://github.com/axonivy-market/smart-workflow/blob/master/doc/user/reference/variables.md).

### 2 — Per-agent override in AgenticProcessCall

Open any **AgenticProcessCall** element and scroll to the **🧠️ Model** group in the configuration editor. Pick a **Provider** from the list and set the **Model** field to override the global default for that element only — all other agents in the process continue using the global setting.

- **Provider** — leave it empty to use `AI.DefaultProvider`. If the project of the selected provider is not installed, the agent call fails with `Unknown model provider <name>`.
- **Model** — leave it empty to use that provider's `DefaultModel`. This is a script field, so a fixed name must be quoted: `"gpt-4o"`, not `gpt-4o`. Because it is a script, the model can also be decided at runtime, for example `in.selectedModel`.

![Per-agent AI Provider override in AgenticProcessCall](cms:/Files/Images/feature03-per-agent-override)

**Example — Acme Corp invoice process with three agent steps:**

Acme Corp's process has three `AgenticProcessCall` elements in sequence. Each step has a different requirement, so each uses a different provider:

| Step | Agent | Provider / Model | Reason |
| --- | --- | --- | --- |
| 1 | **Invoice Analysis** | `OpenAI / gpt-4o` | Complex structured extraction of 5 typed fields — the more capable model produces reliable JSON and handles edge cases like unusual date formats |
| 2 | **Urgency Classifier** | `Anthropic / claude-haiku-4-5` | Three-value classification from a single number — a lightweight, cheap model is more than sufficient, and Haiku is the most cost-effective option in the Anthropic family |
| 3 | **Supplier Risk Check** | `Ollama / llama3.2` | Supplier names are sensitive business intelligence — this step must never send data to an external cloud API, so it runs on a local on-premise Ollama instance |

**Step 1 uses a capable model because accuracy is non-negotiable here.** The Invoice Analysis Agent extracts five typed fields from unstructured invoice text — amounts, dates, supplier names. A capable model handles edge cases reliably: unusual date formats, missing fields, amounts written in different conventions. An error at this step corrupts the data that flows into steps 2 and 3.

**Step 2 uses a cheap model because the task doesn't need more.** The Urgency Classifier reads a single number and returns one of three words. Any modern model handles this correctly — Anthropic's Haiku is the fastest and most cost-effective option in the Claude family, and it is more than sufficient for a three-value classification. No reason to pay for capability you don't need.

**Step 3 uses a local model because the data must not leave the company.** Supplier names are sensitive business intelligence. Sending them to an external cloud API creates a data-privacy risk Acme Corp wants to avoid entirely. By routing this step to Ollama, the data stays on-premise and never touches an external network.

> **Why this matters — Smart Workflow's flexibility advantage**
>
> Because every `AgenticProcessCall` can independently choose its own provider and model, you are never locked into a single AI vendor for an entire application. In a single process you can use the most capable model where accuracy is critical, drop down to the cheapest model where a simple classification is all you need, and route sensitive data exclusively to a self-hosted model that never leaves your infrastructure — all without changing a single line of Java code. As the AI market evolves, you can swap a provider on one step in minutes, compare results, and roll back just as fast.

---

## Model settings

**Provider** and **Model** decide *which* model answers. To tune *how* it answers — for example its **Temperature** — use the *Optional Settings* below **Provider** and **Model** in the same **🧠️ Model** group. These settings are covered in [Model Settings].

---

## Common mistakes

- **An unquoted model name** — **Model** is a script field; a bare `gpt-4o` does not compile. Write `"gpt-4o"`.
- **`Model` instead of `DefaultModel` in the variables** — a provider's default model variable is called `DefaultModel` (Azure OpenAI: `DefaultDeployment`). A variable with any other name is not read by Smart Workflow.
- **Choosing a provider before checking its capabilities** — Gemini cannot do structured output, xAI and Ollama cannot read PDFs, and only OpenAI and Ollama can embed. Nothing warns you until the provider rejects the request.
- **Committing a real API key** — keep `${decrypt:}` in `variables.yaml` and set the value in the Engine Cockpit.

---

## Example process

The working implementation of the three-agent process described in this guide is available in the tutorial project:

`tutorial/process/tutorial/features/Feature03.p.json`

Open it in the Designer to see all three `AgenticProcessCall` elements in sequence — each with its own provider and model configured — and the `Feature03Data` data class that carries the results between steps.

---

## See also

- [Basic Agent Setup]
- [Structured Output]
- [File Extraction]
- [Model Settings]
