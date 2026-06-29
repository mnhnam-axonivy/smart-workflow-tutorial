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

| Provider | Category | Key Models | Vision | PDF | Structured Output |
| --- | --- | --- | --- | --- | --- |
| **OpenAI** | Direct | gpt-4o, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5 | ✓ | ✓ | ✓ |
| **Azure OpenAI** | Platform | Any vision-capable deployment | ✓ | ✓ | ✓ |
| **Google Gemini** | Direct | gemini-1.5-*, gemini-2.0-*, gemini-2.5-* | ✓ | ✓ | — |
| **Anthropic / Claude** | Direct | claude-opus-*, claude-sonnet-*, claude-haiku-* | ✓ | ✓ | ✓ (4.5+) |
| **xAI / Grok** | Direct | grok-4-1-* series | ✓ | — | ✓ |
| **Ollama** | Self-Hosted | llama3, gemma3, qwen, mistral, llava, … | ✓* | — | ✓ |

> **Ollama note:** Vision requires a vision-capable model (e.g. `llava`, `llama3.2-vision`).
>
> **Gemini note:** Gemini does not support structured output natively. Use plain text output and parse the response manually if you choose Gemini.
>
> **Vision image formats:** Vision input only accepts PNG, JPG, and JPEG. Other image formats are not supported.

---

## Two ways to configure a provider

There are two levels at which you can set the AI provider and model — one global, one per-agent.

### 1 — Global default via variables.yaml

Set the provider once for the entire application in `config/variables.yaml`. Every `AgenticProcessCall` in every process will use this provider unless overridden.

**Example — OpenAI:**

```yaml
Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "gpt-4.1-mini"
```

**Example — Azure OpenAI:**

```yaml
Variables:
  AI:
    DefaultProvider: "AzureOpenAI"
    Providers:
      AzureOpenAI:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Endpoint: "https://YOUR_RESOURCE.openai.azure.com/"
        DeploymentName: "gpt-4o"
```

**Example — Google Gemini:**

```yaml
Variables:
  AI:
    DefaultProvider: "Gemini"
    Providers:
      Gemini:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "gemini-2.0-flash"
```

**Example — Anthropic:**

```yaml
Variables:
  AI:
    DefaultProvider: "Anthropic"
    Providers:
      Anthropic:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "claude-sonnet-4-5"
```

**Example — xAI / Grok:**

```yaml
Variables:
  AI:
    DefaultProvider: "xAI"
    Providers:
      xAI:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "grok-4-1"
```

**Example — Ollama (no API key needed):**

```yaml
Variables:
  AI:
    DefaultProvider: "Ollama"
    Providers:
      Ollama:
        BaseUrl: "http://localhost:11434"
        Model: "llama3.2"
```

#### Setting API keys securely in Engine Cockpit

Axon Ivy treats any variable annotated with `#[password]` as a secret — the value is encrypted at rest and decrypted only at runtime. You should **never type a real API key directly into variables.yaml** in the Designer. Instead, set it in the Engine Cockpit after deployment:

![Setting API key in Engine Cockpit](cms:/Files/Images/feature03-api-key-cockpit)

Open **Engine Cockpit → Applications → your application → Variables**, find the key field (e.g. `AI.Providers.OpenAI.APIKey`), and paste your key. The Engine encrypts it immediately. The `${decrypt:…}` placeholder in variables.yaml is only used during local development in the Designer.

#### Variable reference

| Variable | Description | Example |
| --- | --- | --- |
| `AI.DefaultProvider` | Global default provider name | `OpenAI` |
| `AI.Providers.OpenAI.APIKey` | OpenAI API key (encrypted) | `${decrypt:…}` |
| `AI.Providers.OpenAI.Model` | Model to use for OpenAI | `gpt-4.1-mini` |
| `AI.Providers.Anthropic.Model` | Model to use for Anthropic | `claude-sonnet-4-5` |
| `AI.Providers.Ollama.BaseUrl` | Ollama server URL | `http://localhost:11434` |
| `AI.Providers.AzureOpenAI.Endpoint` | Azure endpoint URL | `https://…openai.azure.com` |

### 2 — Per-agent override in AgenticProcessCall

Open any **AgenticProcessCall** element and scroll to the **AI Provider** section in the configuration editor. Set the **Provider** and **Model** fields to override the global default for that element only — all other agents in the process continue using the global setting.

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

## Example process

The working implementation of the three-agent process described in this guide is available in the tutorial project:

`tutorial/processes/tutorial/features/Feature03.p.json`

Open it in the Designer to see all three `AgenticProcessCall` elements in sequence — each with its own provider and model configured — and the `Feature03Data` data class that carries the results between steps.

---

## See also

- [Basic Agent Setup]
- [Structured Output]
- [File Extraction]
