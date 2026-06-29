# File Extraction

`AgenticProcessCall` accepts not just text but also binary content — images and PDF files — directly in the Query field. The LLM reads the document visually, extracts the data you ask for, and returns it as a typed Java object.

> **This builds on [Basic Agent Setup] and [Structured Output].** The System Prompt and Output configuration are identical — the only change is the Query field, which now contains a file reference instead of plain text.

> **Example used in this guide: Acme Corp invoice image**
>
> Acme Corp stores a sample invoice image in the CMS. The agent reads the image and extracts the same five fields as in [Structured Output] — `invoiceNumber`, `supplierName`, `totalAmount`, `currency`, and `invoiceDate` — into a typed `InvoiceData` object.
>
> ![Example process](cms:/Files/Images/feature04-00)
>
> The finished process is at `tutorial/processes/tutorial/features/Feature04.p.json` — open it in the Designer to follow along as you read.

---

## What is it?

By default the Query accepts plain text (see [Basic Agent Setup]). File Extraction extends this: you can pass a binary content object — an image or PDF — directly in the Query using `ivy.cms.co()`. Smart Workflow detects the MIME type and forwards the file to the LLM as multimodal input. The model sees the image or reads the PDF and processes it exactly as a human would.

The Output configuration is unchanged from [Structured Output] — you still declare the output class in **Expect result of type** and map the result to a process data field via **Map result to**.

---

## Supported formats

Supported file types and whether vision or PDF is available at all depend on the model and provider you are using. Check the capability table in [Model Provider Selection] for the full breakdown.

| Format | Supported image types |
| --- | --- |
| **Image** | PNG, JPG, JPEG |
| **PDF** | — |

> **Note:** Vision input is limited to PNG, JPG, and JPEG. Other image formats are not supported.

---

## Query — passing a file

Instead of binding the Query to a text variable, reference a CMS content object using `ivy.cms.co()`:

```text
Extract the invoice data from this document:
<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>
```

`ivy.cms.co()` returns the CMS content object at the given path. Smart Workflow inspects its MIME type and sends the file to the LLM in the correct format — no manual conversion needed.

**How it works:** When the Query expression is evaluated at runtime, the resolved content object is included in the LLM message alongside the System Prompt. If the content is an image, it is attached as a vision input. If it is a PDF, the text and layout are extracted and passed as content. The LLM then applies the System Prompt instructions and returns the extraction result.

---

## Example — Acme Corp invoice image extraction

### Data class

`InvoiceData` is already defined from [Structured Output] — reuse it as-is:

| Field | Type |
| --- | --- |
| `invoiceNumber` | `String` |
| `supplierName` | `String` |
| `totalAmount` | `java.math.BigDecimal` |
| `currency` | `String` |
| `invoiceDate` | `java.time.LocalDate` |

### System Prompt

```text
You are an invoice extraction agent for Acme Corp.
You receive an invoice document (image or PDF) and extract the following fields:
- invoiceNumber (String)
- supplierName (String)
- totalAmount (BigDecimal)
- currency (String, ISO 4217)
- invoiceDate (LocalDate, format yyyy-MM-dd)

Return only the structured data. Do not add commentary.
If a field is missing in the document, return null for that field.
```

**Query:** `<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>`

**Expect result of type:** `tutorial.InvoiceData.class`

**Map result to:** `out.invoiceResult`

### Result

After the agent element, the extracted object is available in the next process step:

```ivyscript
in.invoiceResult.invoiceNumber    // → "INV-2024-001"
in.invoiceResult.supplierName     // → "Acme Supplies GmbH"
in.invoiceResult.totalAmount      // → 5000.00 (BigDecimal)
in.invoiceResult.currency         // → "EUR"
in.invoiceResult.invoiceDate      // → 2024-07-30 (LocalDate)
```

No casting, no parsing — the object is ready to use as-is.

---

## Common mistakes

- **Provider does not support vision** — If you pass an image to a provider without vision capability, the request will fail. Check the capability table in [Model Provider Selection].
- **PDF not supported by all providers** — Ollama and xAI do not support PDF input. Use OpenAI, Azure OpenAI, Anthropic, or Gemini for PDF extraction.
- **CMS content not found** — `ivy.cms.co()` returns `null` if the path does not exist. Upload the file to the CMS first and verify the path matches exactly.
- **Wrong MIME type in CMS** — Smart Workflow uses the content object's declared MIME type to decide how to send the file. If the type is misconfigured in the CMS (e.g. a PDF saved as `text/plain`), the file will be sent in the wrong format.

---

## Example process

The working implementation is available in the tutorial project:

`tutorial/processes/tutorial/features/Feature04.p.json`

Open it in the Designer to see the `Invoice Extraction Agent` element with the CMS file reference in the Query, and the `Feature04Data` data class with the `invoiceResult: InvoiceData` field.

---

## See also

- [Basic Agent Setup]
- [Structured Output]
- [Model Provider Selection]
- [Callable Process Tools]
