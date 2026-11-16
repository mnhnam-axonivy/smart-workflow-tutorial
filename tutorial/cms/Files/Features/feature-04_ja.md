# ファイル抽出

`AgenticProcessCall` はテキストだけでなく、画像ファイルやPDFなどのバイナリコンテンツもユーザーメッセージフィールドに直接受け取れます。LLMがドキュメントを視覚的に読み取り、要求したデータを抽出し、型付きJavaオブジェクトとして返します。

> **[エージェントの基本設定] と [構造化出力] をベースにしています。** システムメッセージと出力の設定は同一です — 変更点はユーザーメッセージフィールドのみで、プレーンテキストの代わりにファイル参照を含めます。

> **このガイドで使用する例: Acme Corp 請求書画像**
>
> Acme CorpはサンプルのInvoice画像をCMSに保存しています。エージェントが画像を読み取り、[構造化出力] と同じ5つのフィールド（`invoiceNumber`・`supplierName`・`totalAmount`・`currency`・`invoiceDate`）を型付き `InvoiceData` オブジェクトとして抽出します。
>
> ![Example process](cms:/Files/Images/feature04-00)
>
> 完成したプロセスは `tutorial/process/tutorial/features/Feature04.p.json` にあります。Designerで開いて読み進めてください。

---

## ファイル抽出とは？

デフォルトではユーザーメッセージはプレーンテキストを受け取ります（[エージェントの基本設定] 参照）。ファイル抽出はこれを拡張します: ユーザーメッセージ内の `<%=...%>` 式がファイル（画像またはPDF）に解決されると、自動的にモデル用のコンテンツに変換されます。ファイルはCMSからでも、ユーザーがアップロードしたばかりのドキュメントからでも、プロセスデータ内のどこからでも取得できます。アップロードの手順も専用のファイルフィールドもありません。Smart Workflowがファイルを認識し、マルチモーダル入力としてLLMに転送します。モデルは人間と同様に画像を見るかPDFを読んで処理します。

出力の設定は [構造化出力] から変わりません — 引き続き **期待する結果の型** で出力クラスを宣言し、**結果のマッピング先** でプロセスデータフィールドにマッピングします。

---

## サポートされる形式

サポートされるファイルタイプとビジョン・PDFが使用できるかどうかは、使用するモデルとプロバイダーによって異なります。詳細は [モデルプロバイダーの選択] の機能比較表を確認してください。

| 形式 | タイプ |
| --- | --- |
| **画像** | PNG, JPG, JPEG |
| **PDF** | PDF |

> **注意:** 他の形式はサポートされていません。PDFはローカルでは解析されません。生のバイトがプロバイダーに送られ、プロバイダーが読み取ります。そのため、ページ数の上限やスキャン品質はプロバイダー側の制約になります。
>
> **重要:** Smart Workflowは、送信前にプロバイダーが何を読み取れるかをチェックしません。サポートされない組み合わせ（xAIやOllamaへのPDF、テキスト専用のOllamaモデルへの画像）は、プロバイダー側で、プロバイダー自身のエラーメッセージとともに失敗します。

---

## ユーザーメッセージ — ファイルの渡し方

テキスト変数にユーザーメッセージをバインドする代わりに、`ivy.cms.co()` を使ってCMSコンテンツオブジェクトを参照します。

```text
Extract the invoice data from this document:
<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>
```

`ivy.cms.co()` は指定されたパスのCMSコンテンツオブジェクトを返します。画像またはPDFのオブジェクトはファイルコンテンツになり、`txt`・`md`・プレーン文字列のオブジェクトは読み込まれてテキストとして埋め込まれます — 手動での変換は不要です。

**仕組み:** ユーザーメッセージ式が実行時に評価されると、解決されたコンテンツオブジェクトがシステムメッセージとともにLLMメッセージに含まれます。コンテンツが画像の場合はビジョン入力として添付されます。PDFはそのまま送信されます — Smart Workflowはテキストを抽出せず、プロバイダーがドキュメントを読み取ります。LLMはシステムメッセージの指示を適用して抽出結果を返します。

### プロセスデータからファイルを渡す

ファイルはCMSにある必要はありません。プロセスデータのフィールドを同じ方法で参照できます。例えば、ユーザーがアップロードしたばかりのドキュメントです。

```text
Extract the invoice data from this document:
<%=in.uploadedInvoice%>
```

プロセスですでに使用しているファイル型（`InputStream`・`Binary`・`Path`・`File`・`IDocument`）で動作します。それ以外に解決される式は、テキストとして埋め込まれます。

> **重要:** ファイルを扱えるのは**ユーザーメッセージ**だけです。**システムメッセージ**内のファイル式は `toString()` でテキストに変換されるため、モデルはドキュメントの代わりに `Binary@1a2b3c` のような文字列を受け取り、見ていないドキュメントについて自信を持って回答してしまいます。

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

### システムメッセージ

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

**ユーザーメッセージ:** `<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>`

**期待する結果の型:** `tutorial.InvoiceData.class`

**結果のマッピング先:** `in.invoiceResult`

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

- **プロバイダーがそのファイルタイプを読み取れない** — ローカルでは何もチェックされません。リクエストはプロバイダーに届き、そこで失敗します。xAIとOllamaはPDFをサポートしていません — 先にPDFを画像に変換してください。Ollamaで画像を扱うにはビジョン対応モデルが必要です。[モデルプロバイダーの選択] の機能比較表を確認してください。
- **ローカルでのPDF解析を期待する** — PDFを読み取るのはプロバイダーです。PDFの品質やページ数の上限は、Smart Workflowではなくプロバイダーの制約です。
- **CMSパスの誤り** — 明確なエラーは発生しません。モデルがドキュメントを見ていないかのように回答する場合は、プロンプトを疑う前にパスを確認してください。
- **CMS内の想定外のファイル拡張子** — `.tiff` や `.docx` のコンテンツオブジェクトは単にスキップされるのではなく、ユーザーメッセージ全体を空にします。その結果、エージェント呼び出しがエラーなしでスキップされます。ログで `Agent call was skipped, since there was no user query` を確認してください。
- **認識される拡張子のないファイル名** — 名前が `.png`・`.jpg`・`.jpeg`・`.pdf` で終わらない `Path`・`File`・`IDocument` は、ログに記録されずにメッセージから除外されます。`InputStream` と `Binary` はファイル名を持たないため対象外で、代わりに内容が検査されます。
- **非常に大きなファイル** — ファイルはbase64エンコードされ、サイズが約3分の1増えます。Smart Workflow自体にサイズ制限はなく、大きすぎるリクエストはプロバイダーが拒否します。

---

## サンプルプロセス

動作実装はチュートリアルプロジェクトで利用できます。

`tutorial/process/tutorial/features/Feature04.p.json`

Designerで開いて、ユーザーメッセージにCMSファイル参照が設定された `Invoice Extraction Agent` 要素と、`invoiceResult: InvoiceData` フィールドを持つ `Feature04Data` データクラスを確認してください。

---

## 関連項目

- [エージェントの基本設定]
- [構造化出力]
- [モデルプロバイダーの選択]
- [呼び出し可能プロセスツール]
