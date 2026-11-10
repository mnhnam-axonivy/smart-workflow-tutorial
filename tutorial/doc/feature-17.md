# Advanced Model Settings

[Model Provider Selection] decides *which* model answers an agent. **Advanced model settings** tune *how* that model answers — how much variety it puts into its wording, for example. They are optional: the defaults work for most agents, and you change them only when an agent needs a different behaviour.

---

> **This builds on [Model Provider Selection].** Provider and model stay as they are — advanced settings are extra fields on the same `AgenticProcessCall` element.
>
> **Example used in this guide: payment reminder subject lines**
>
> Acme Corp sends payment reminders for overdue invoices. Two agents write a subject line for the same invoice — one tuned for repeatable output, one for varied wording — so you can see what the setting changes.
>
> The finished process is at `tutorial/processes/tutorial/features/Feature17.p.json` — open it in the Designer to follow along as you read.

---

## Where to find them

Open the `AgenticProcessCall` element and go to the **⚙️ Advanced** group of the configuration editor. In Smart Workflow 14.0.0 the same fields are also shown under *Optional Settings* in the **🧠️ Model** group — both places edit the same value.

Like **Provider** and **Model**, advanced settings apply to this one element only. There is no global default in `variables.yaml`.

---

## Available settings

| Setting | Since | Default | Controls |
| --- | --- | --- | --- |
| **Temperature** | 14.0.0 | `0.0` | How much randomness the model puts into its answer |

More settings will be added to this page as Smart Workflow supports them.

---

## Temperature

Temperature controls how much randomness the model puts into its answer:

| Value | Behaviour | Use it for |
| --- | --- | --- |
| `0.0` *(default)* | Most deterministic — the same input gives (almost) the same output | Extraction, classification, structured output, anything the process branches on |
| `0.7` – `1.0` | More varied wording on every run | Drafting emails, summaries written for people, brainstorming |

The field is an IvyScript expression that resolves to a String:

```text
"0.7"
```

or a String field of your process data, so the value can be decided at runtime:

```text
in.temperature
```

**Things to know:**

- **Empty means `0.0`.** Smart Workflow then sends `0.0` to the model — it does not fall back to the provider's own default.
- **Invalid values are ignored silently.** A negative or non-numeric value also becomes `0.0`, without an error. If the output looks more deterministic than you expected, check the recorded temperature (see below).
- **The upper limit depends on the provider.** Smart Workflow does not cap the value — for example, OpenAI accepts `0`–`2` and Anthropic `0`–`1`. A value outside the provider's range is rejected by the provider.
- **Some OpenAI models fix the temperature themselves.** On the OpenAI provider, `o`-series reasoning models ignore the field and `gpt-5` models always run at `1`.

**Where to see it:** The temperature an agent actually used is stored in the built-in execution history, and Arize Phoenix records it under `llm.invocation_parameters` on the LLM span — see [Observability].

---

## Example — Payment reminder subject lines

### Mock data

The **Mock data** Script element pre-fills a short overdue invoice and the temperature for the creative agent:

```javascript
in.invoiceText = "Invoice Number: INV-2024-00123\n" +
"Supplier: Acme Supplies Ltd.\n" +
"Total Amount Due: JPY 10,560.00\n" +
"Due Date: 2024-06-30\n";
in.temperature = "1.0";
```

### Agent configuration

Both agents share the same system prompt and query:

```text
You write email subject lines for Acme Corp's accounts payable team.
Given an overdue invoice, write one friendly payment reminder subject line.
Return only the subject line. No quotes, no explanation.
```

**Query:** `<%=in.invoiceText%>`

| Agent | Temperature | Map result to |
| --- | --- | --- |
| **Reminder Subject (deterministic)** | `"0.0"` | `in.deterministicSubject` |
| **Reminder Subject (creative)** | `in.temperature` | `in.creativeSubject` |

Both agents use the global default provider, so the demo runs with whatever you configured in `variables.yaml`.

### Result

The **Show result from AI** Script element logs both subject lines to the **Axon Ivy Runtime Log**. Run the process several times and compare:

| Agent | Typical result over several runs |
| --- | --- |
| **Reminder Subject (deterministic)** | The same subject line every time |
| **Reminder Subject (creative)** | A differently worded subject line on each run |

---

## Common mistakes

- **Raising the temperature for structured output** — extraction and classification need repeatable answers. Keep `0.0` for anything the process branches on or maps into typed fields.
- **Not quoting the value** — Smart Workflow evaluates the field as a String. Write `"0.7"` (with quotes) or point to a String field, as the tutorial does.
- **Expecting an error for a bad value** — negative or non-numeric values silently become `0.0`. Check the recorded temperature when output does not vary as expected.
- **Assuming one range for all providers** — a value that works on OpenAI (up to `2`) can be rejected by Anthropic (up to `1`).

---

## Example process

The working implementation is available in the tutorial project:

- `tutorial/processes/tutorial/features/Feature17.p.json` — the two agents with different temperatures
- `tutorial/dataclasses/tutorial/Feature17Data.d.json` — the data class

Open the process in the Designer and compare the **⚙️ Advanced** group of the `Reminder Subject (deterministic)` and `Reminder Subject (creative)` elements.

---

## See also

- [Model Provider Selection]
- [Basic Agent Setup]
- [Observability]
