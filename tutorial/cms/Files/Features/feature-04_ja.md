# ファイル抽出

`AgenticProcessCall` はテキストだけでなく、画像ファイルやPDFなどのバイナリコンテンツもクエリフィールドに直接受け取れます。LLMがドキュメントを視覚的に読み取り、要求したデータを抽出し、型付きJavaオブジェクトとして返します。

> **[エージェントの基本設定] と [構造化出力] をベースにしています。** システムプロンプトと出力の設定は同一です — 変更点はクエリフィールドのみで、プレーンテキストの代わりにファイル参照を含めます。

> **このガイドで使用する例: Acme Corp 請求書画像**
>
> Acme CorpはサンプルのInvoice画像をCMSに保存しています。エージェントが画像を読み取り、[構造化出力] と同じ5つのフィールド（`invoiceNumber`・`supplierName`・`totalAmount`・`currency`・`invoiceDate`）を型付き `InvoiceData` オブジェクトとして抽出します。
>
> ![Example process](cms:/Files/Images/feature04-00)
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature04.p.json` にあります。Designerで開いて読み進めてください。

---

## ファイル抽出とは？

デフォルトではクエリはプレーンテキストを受け取ります（[エージェントの基本設定] 参照）。ファイル抽出はこれを拡張します: `ivy.cms.co()` を使ってバイナリコンテンツオブジェクト（画像またはPDF）をクエリに直接渡せます。Smart WorkflowがMIMEタイプを検出し、ファイルをマルチモーダル入力としてLLMに転送します。モデルは人間と同様に画像を見るかPDFを読んで処理します。

出力の設定は [構造化出力] から変わりません — 引き続き **期待する結果の型** で出力クラスを宣言し、**結果のマッピング先** でプロセスデータフィールドにマッピングします。

---

## サポートされる形式

サポートされるファイルタイプとビジョン・PDFが使用できるかどうかは、使用するモデルとプロバイダーによって異なります。詳細は [モデルプロバイダーの選択] の機能比較表を確認してください。

| 形式 | サポートされる画像タイプ |
| --- | --- |
| **画像** | PNG, JPG, JPEG |
| **PDF** | — |

> **注意:** ビジョン入力はPNG・JPG・JPEGのみをサポートします。他の画像形式はサポートされていません。

---

## クエリ — ファイルの渡し方

テキスト変数にクエリをバインドする代わりに、`ivy.cms.co()` を使ってCMSコンテンツオブジェクトを参照します。

```text
Extract the invoice data from this document:
<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>
```

`ivy.cms.co()` は指定されたパスのCMSコンテンツオブジェクトを返します。Smart WorkflowがそのMIMEタイプを検査し、正しい形式でファイルをLLMに送信します — 手動での変換は不要です。

**仕組み:** クエリ式が実行時に評価されると、解決されたコンテンツオブジェクトがシステムプロンプトとともにLLMメッセージに含まれます。コンテンツが画像の場合はビジョン入力として添付されます。PDFの場合はテキストとレイアウトが抽出されてコンテンツとして渡されます。LLMはシステムプロンプトの指示を適用して抽出結果を返します。

---

## 例 — Acme Corp 請求書画像抽出

### データクラス

`InvoiceData` は [構造化出力] で定義済みです — そのまま再利用してください。

| フィールド | 型 |
| --- | --- |
| `invoiceNumber` | `String` |
| `supplierName` | `String` |
| `totalAmount` | `java.math.BigDecimal` |
| `currency` | `String` |
| `invoiceDate` | `java.time.LocalDate` |

### システムプロンプト

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

**クエリ:** `<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>`

**期待する結果の型:** `tutorial.InvoiceData.class`

**結果のマッピング先:** `out.invoiceResult`

### 結果

エージェント要素の後、抽出されたオブジェクトが次のプロセスステップで利用可能になります。

```ivyscript
in.invoiceResult.invoiceNumber    // → "INV-2024-001"
in.invoiceResult.supplierName     // → "Acme Supplies GmbH"
in.invoiceResult.totalAmount      // → 5000.00 (BigDecimal)
in.invoiceResult.currency         // → "EUR"
in.invoiceResult.invoiceDate      // → 2024-07-30 (LocalDate)
```

型変換もパースも不要 — オブジェクトはそのまま使用できます。

---

## よくあるミス

- **プロバイダーがビジョンをサポートしていない** — ビジョン機能のないプロバイダーに画像を渡すとリクエストが失敗します。[モデルプロバイダーの選択] の機能比較表を確認してください。
- **すべてのプロバイダーがPDFをサポートするわけではない** — OllamaとxAIはPDF入力をサポートしていません。PDF抽出にはOpenAI・Azure OpenAI・Anthropic・またはGeminiを使用してください。
- **CMSコンテンツが見つからない** — `ivy.cms.co()` はパスが存在しない場合に `null` を返します。まずファイルをCMSにアップロードし、パスが正確に一致することを確認してください。
- **CMSのMIMEタイプが誤っている** — Smart WorkflowはコンテンツオブジェクトのMIMEタイプを使用してファイルの送信方法を判断します。CMSでタイプが誤って設定されている場合（例: PDFが `text/plain` として保存されている）、ファイルが誤った形式で送信されます。

---

## サンプルプロセス

動作実装はチュートリアルプロジェクトで利用できます。

`tutorial/processes/tutorial/features/Feature04.p.json`

Designerで開いて、クエリにCMSファイル参照が設定された `Invoice Extraction Agent` 要素と、`invoiceResult: InvoiceData` フィールドを持つ `Feature04Data` データクラスを確認してください。

---

## 関連項目

- [エージェントの基本設定]
- [構造化出力]
- [モデルプロバイダーの選択]
- [呼び出し可能プロセスツール]
