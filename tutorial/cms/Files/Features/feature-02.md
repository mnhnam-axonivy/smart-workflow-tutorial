# Structured Output

Instruct the agent to return a **typed Java object** instead of plain text. Smart Workflow derives a JSON schema from your class, constrains the LLM to match it, and deserialises the result automatically — no string parsing required.

> **This builds directly on [Basic Agent Setup].** In that guide the agent returns a one-line String summary of the invoice. Here we go further: the agent extracts the same invoice into a fully typed `InvoiceData` object with individual fields you can read directly in the next process step.

---

## What is it?

By default, `AgenticProcessCall` returns a plain text String (see [Basic Agent Setup]). **Structured Output** lets you declare a Java class as the expected output type via the **Expect result of type** field. Smart Workflow then:

1. Introspects the class to derive a JSON schema
2. Sends that schema to the LLM as a response format constraint
3. Receives JSON matching your class from the LLM
4. Deserialises it into a Java object and writes it to the process data field you specify

The result is a proper Java object with typed fields — no `ObjectMapper`, no null checks on string splits.

---

## Why use it?

- **Type-safe field access** — read `in.result.totalAmount` as a `BigDecimal`, not a string
- **Eliminates string parsing** — no regex, no substring operations, no fragile manual extraction
- **Works with Ivy data classes** — any data class in the `tutorial` package works out of the box
- **Enforced types** — `totalAmount` comes back as `BigDecimal`, `invoiceDate` as `LocalDate` — if the LLM returns a wrong format, the response is rejected

> **Gemini limitation:** Google Gemini does not support JSON schema-constrained output natively. For structured extraction, use OpenAI, Anthropic, Azure OpenAI, or xAI. If you must use Gemini, use plain text output and parse it manually.

---

## Output

Structured Output extends the standard **Output** section of the element editor with one additional field: **Expect result of type**. Together with **Map result to**, these two fields control what the agent returns and where it goes.

### Expect result of type

Declares the Java class you want the agent to return. Smart Workflow introspects this class, derives a JSON schema, and sends it to the LLM as a response format constraint — the LLM is forced to return JSON that matches your class exactly.

**Example:**

```java
tutorial.InvoiceData.class
```

Note the `.class` suffix — this is required. Without it the type cannot be resolved.

**Why it matters:** The field names and types of your class are what get communicated to the LLM. Name your fields clearly — `invoiceNumber`, `totalAmount`, `invoiceDate` — and the LLM will populate them correctly.

**How it works:** Smart Workflow reads the declared class, generates a JSON schema from its fields and types, and adds that schema to the LLM request. The LLM returns JSON matching the schema, which is then deserialised into a Java object of the declared type.

---

### Map result to

Defines the process data field where the deserialised object is written after execution.

**Example:**

```java
out.result
```

This writes the `InvoiceData` object into the `result` field of `Feature02Data`. The next process step reads typed fields directly — no casting, no parsing.

**How it works:** After deserialisation, the result is assigned to the IvyScript expression you enter here. Use `out.fieldName` where `fieldName` is a field of your process data class typed to match your declared output class.

---

## Example — Acme Corp invoice extraction

The same invoice text from [Basic Agent Setup] — but instead of returning a one-line summary, the agent extracts all 5 fields into a typed `InvoiceData` object.

### Data class

Create `InvoiceData` in the `tutorial` package with one field per piece of data you want extracted:

| Field | Type |
| --- | --- |
| `invoiceNumber` | `String` |
| `supplierName` | `String` |
| `totalAmount` | `java.math.BigDecimal` |
| `currency` | `String` |
| `invoiceDate` | `java.time.LocalDate` |

Name your fields clearly — the names are what gets communicated to the LLM.

### System Prompt

```text
You are an invoice extraction agent for Acme Corp.
You receive a supplier invoice as text and extract the following fields:
- invoiceNumber (String)
- supplierName (String)
- totalAmount (BigDecimal)
- currency (String, ISO 4217)
- invoiceDate (LocalDate, format yyyy-MM-dd)

Return only the structured data. Do not add commentary.
If a field is missing in the invoice, return null for that field.
```

**Query:** `<%=in.invoiceText%>`

**Expect result of type:** `tutorial.InvoiceData.class`

**Map result to:** `out.result`

### Result

After the agent element, the rest of the process reads the typed object directly:

```java
in.result.invoiceNumber    // → "INV-2024-001"
in.result.supplierName     // → "Acme Supplies GmbH"
in.result.totalAmount      // → 5000.00 (BigDecimal)
in.result.currency         // → "EUR"
in.result.invoiceDate      // → 2024-07-30 (LocalDate)
```

No casting, no parsing — the object is ready to use as-is.

---

## How it works internally

Smart Workflow introspects the declared output class to generate a JSON schema. This schema is added to the LLM request as a response format constraint — the LLM is forced to return valid JSON that maps to your class. The result is then deserialised into a Java object using standard Jackson deserialization.

Flow: `resultType` set in element → JSON schema derived from class → schema added to LLM request → LLM returns matching JSON → deserialised to Java object → written to `resultMapping` field.

---

## Common mistakes

- **Using Gemini** — Gemini does not support JSON schema-constrained output. The request will fail or return unexpected plain text. Switch to OpenAI, Anthropic, or xAI for structured extraction.
- **Primitive fields with no null fallback** — If the LLM cannot find a value and the field is a primitive (e.g. `int`), deserialisation may fail. Use nullable types: `Integer` instead of `int`, `BigDecimal` instead of `double`.
- **Missing `.class` suffix** — The `resultType` field requires the `.class` suffix (e.g. `tutorial.InvoiceData.class`, not just `tutorial.InvoiceData`). Without it the type cannot be resolved.
- **Class not on the classpath** — The output class must be accessible at runtime. Ivy data classes work out of the box; plain Java classes must be in a `src` folder compiled into the IAR.

---

## Example process

The working implementation of everything described in this guide is available in the tutorial project:

`tutorial/processes/tutorial/features/Feature02.p.json`

Open it in the Designer to see the `Invoice Analysis Agent` element fully configured with `resultType` and `resultMapping`, and the `Feature02Data` data class with the `result: InvoiceData` field.

---

## See also

- [Basic Agent Setup]
- [File Extraction]
- [Model Provider Selection]
