# File Extraction

`AgenticProcessCall` accepts not just text but also binary content — images and PDF files — directly in the User message field. The LLM reads the document visually, extracts the data you ask for, and returns it as a typed Java object.

> **This builds on [Basic Agent Setup] and [Structured Output].** The System message and Output configuration are identical — the only change is the User message field, which now contains a file reference instead of plain text.

> **Example used in this guide: Acme Corp invoice image**
>
> Acme Corp stores a sample invoice image in the CMS. The agent reads the image and extracts the same five fields as in [Structured Output] — `invoiceNumber`, `supplierName`, `totalAmount`, `currency`, and `invoiceDate` — into a typed `InvoiceData` object.
>
> ![Example process](cms:/Files/Images/feature04-00)
>
> The finished process is at `tutorial/process/tutorial/features/Feature04.p.json` — open it in the Designer to follow along as you read.

---

## What is it?

By default the User message accepts plain text (see [Basic Agent Setup]). File Extraction extends this: any `<%=...%>` expression in the User message that resolves to a file — an image or a PDF — is turned into model content for you. The file can come from the CMS, from a document a user has just uploaded, or from anywhere else in your process data. There is no upload step and no dedicated file field: Smart Workflow recognises the file and forwards it to the LLM as multimodal input. The model sees the image or reads the PDF and processes it exactly as a human would.

The Output configuration is unchanged from [Structured Output] — you still declare the output class in **Expect result of type** and map the result to a process data field via **Map result to**.

---

## Supported formats

Supported file types and whether vision or PDF is available at all depend on the model and provider you are using. Check the capability table in [Model Provider Selection] for the full breakdown.

| Format | Types |
| --- | --- |
| **Image** | PNG, JPG, JPEG |
| **PDF** | PDF |

> **Note:** Other formats are not supported. PDFs are not parsed locally — the raw bytes go to the provider, which does the reading, so page limits and scan quality are the provider's concern.
>
> **Important:** Smart Workflow does not check what the provider can read before sending. An unsupported combination — a PDF on xAI or Ollama, an image on a text-only Ollama model — fails at the provider, with the provider's own error message.

---

## User message — passing a file

Instead of binding the User message to a text variable, reference a CMS content object using `ivy.cms.co()`:

```text
Extract the invoice data from this document:
<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>
```

`ivy.cms.co()` returns the CMS content object at the given path. An image or PDF object becomes file content; a `txt`, `md` or plain string object is read and inlined as text — no manual conversion needed.

**How it works:** When the User message expression is evaluated at runtime, the resolved content object is included in the LLM message alongside the System message. If the content is an image, it is attached as a vision input. A PDF is sent as it is — Smart Workflow does not extract its text; the provider reads the document. The LLM then applies the System message instructions and returns the extraction result.

### Passing a file from process data

The file does not have to live in the CMS. Reference a field of your process data in the same way — for example a document a user has just uploaded:

```text
Extract the invoice data from this document:
<%=in.uploadedInvoice%>
```

This works with the file types you already have in a process: `InputStream`, `Binary`, `Path`, `File` and `IDocument`. An expression that resolves to anything else is inlined as text.

> **Important:** Only the **User message** handles files. A file expression in the **System message** is converted to text with `toString()`, so the model receives something like `Binary@1a2b3c` instead of your document — and answers confidently about a document it never saw.

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

### System message

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

**User message:** `<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>`

**Expect result of type:** `tutorial.InvoiceData.class`

**Map result to:** `in.invoiceResult`

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

- **Provider cannot read the file type** — nothing is checked locally; the request reaches the provider and fails there. xAI and Ollama have no PDF support — convert PDFs to images first. On Ollama, images need a vision-capable model. Check the capability table in [Model Provider Selection].
- **Expecting local PDF parsing** — the provider reads the PDF, so PDF quality and page limits are the provider's, not Smart Workflow's.
- **A wrong CMS path** — nothing fails loudly. If the model answers as though it never saw the document, verify the path before suspecting the prompt.
- **An unexpected file extension in the CMS** — a `.tiff` or `.docx` content object is not merely skipped: it empties the whole User message, so the agent call is skipped without an error. Look for `Agent call was skipped, since there was no user query` in the log.
- **A file name without a recognised extension** — a `Path`, `File` or `IDocument` whose name does not end in `.png`, `.jpg`, `.jpeg` or `.pdf` is dropped from the message with no log entry. `InputStream` and `Binary` are exempt — they have no file name, so their content is inspected instead.
- **Very large files** — files are base64-encoded, which adds roughly one third to their size. Smart Workflow enforces no size limit of its own; the provider rejects a request that is too large.

---

## Example process

The working implementation is available in the tutorial project:

`tutorial/process/tutorial/features/Feature04.p.json`

Open it in the Designer to see the `Invoice Extraction Agent` element with the CMS file reference in the User message, and the `Feature04Data` data class with the `invoiceResult: InvoiceData` field.

---

## See also

- [Basic Agent Setup]
- [Structured Output]
- [Model Provider Selection]
- [Callable Process Tools]
