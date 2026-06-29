# 構造化出力

エージェントにプレーンテキストの代わりに **型付きJavaオブジェクト** を返すよう指示します。Smart WorkflowはクラスからJSONスキーマを導出し、LLMがそれに一致する出力を返すよう制約し、結果を自動的にデシリアライズします。文字列のパースは不要です。

> **[エージェントの基本設定] をベースにしています。** 基本設定ガイドではエージェントが請求書の1行テキストサマリーを返しました。ここではさらに進んで、同じ請求書を5つのフィールドを持つ型付き `InvoiceData` オブジェクトに抽出します。

---

## 構造化出力とは？

デフォルトでは `AgenticProcessCall` はプレーンテキストのStringを返します（[エージェントの基本設定] 参照）。**構造化出力** では、**期待する結果の型** フィールドに期待する出力型のJavaクラスを宣言します。Smart Workflowが：

1. クラスを解析してJSONスキーマを導出する
2. そのスキーマをレスポンス形式の制約としてLLMに送信する
3. クラスに一致するJSONをLLMから受け取る
4. Javaオブジェクトにデシリアライズし、指定したプロセスデータフィールドに書き込む

結果は型付きフィールドを持つ適切なJavaオブジェクトです。`ObjectMapper` も、文字列分割のnullチェックも不要です。

---

## なぜ使うのか？

- **型安全なフィールドアクセス** — `in.result.totalAmount` を文字列ではなく `BigDecimal` として読み取れる
- **文字列パースの排除** — 正規表現・部分文字列操作・脆弱な手動抽出が不要
- **Ivyデータクラスとの親和性** — `tutorial` パッケージ内の任意のデータクラスがそのまま使える
- **型の強制** — `totalAmount` は `BigDecimal`、`invoiceDate` は `LocalDate` として返される。形式が誤っていればレスポンスが拒否される

> **Geminiの制限:** Google GeminiはJSONスキーマ制約出力をネイティブにサポートしていません。構造化抽出にはOpenAI・Anthropic・Azure OpenAI・またはxAIを使用してください。Geminiを使用する場合は、プレーンテキスト出力でレスポンスを手動でパースしてください。

---

## 出力

構造化出力は要素エディタの標準的な **出力** セクションに **期待する結果の型** フィールドを追加します。**結果のマッピング先** とあわせて、この2つのフィールドがエージェントの返り値とその保存先を制御します。

### 期待する結果の型

エージェントに返させたいJavaクラスを宣言します。Smart Workflowがこのクラスを解析してJSONスキーマを導出し、レスポンス形式の制約としてLLMに送信します。LLMはクラスに完全に一致するJSONを返すよう強制されます。

**例:**

```java
tutorial.InvoiceData.class
```

`.class` サフィックスが必要です。これがなければ型を解決できません。

**重要な理由:** クラスのフィールド名と型がLLMに伝えられます。`invoiceNumber`・`totalAmount`・`invoiceDate` のようにフィールドに明確な名前をつければ、LLMが正確に値を入れてくれます。

**仕組み:** Smart Workflowは宣言されたクラスを読み取り、フィールドと型からJSONスキーマを生成し、そのスキーマをLLMリクエストに追加します。LLMはスキーマに一致するJSONを返し、宣言された型のJavaオブジェクトにデシリアライズされます。

---

### 結果のマッピング先

実行後にデシリアライズされたオブジェクトが書き込まれるプロセスデータフィールドを定義します。

**例:**

```java
in.result
```

これにより、`InvoiceData` オブジェクトが `Feature02Data` の `result` フィールドに書き込まれます。次のプロセスステップでは型付きフィールドを直接読み取れます。型変換もパースも不要です。

**仕組み:** デシリアライズ後、結果はここに入力したIvyScript式に代入されます。`in.fieldName` の形式で使用します（`fieldName` は、宣言した出力クラスと型が一致するプロセスデータクラスのフィールド名）。

---

## 例 — Acme Corp 請求書抽出

[エージェントの基本設定] と同じ請求書テキストを使用しますが、1行のサマリーを返す代わりに、エージェントが5つのフィールドすべてを型付き `InvoiceData` オブジェクトに抽出します。

### データクラス

`tutorial` パッケージに `InvoiceData` を作成し、抽出したいデータ1件ごとにフィールドを定義します。

| フィールド | 型 |
| --- | --- |
| `invoiceNumber` | `String` |
| `supplierName` | `String` |
| `totalAmount` | `java.math.BigDecimal` |
| `currency` | `String` |
| `invoiceDate` | `java.time.LocalDate` |

フィールド名はLLMに伝えられるため、明確な名前をつけてください。

### システムプロンプト

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

**クエリ:** `<%=in.invoiceText%>`

**期待する結果の型:** `tutorial.InvoiceData.class`

**結果のマッピング先:** `in.result`

### 結果

エージェント要素の後、プロセスの残りの部分で型付きオブジェクトを直接読み取れます。

```java
in.result.invoiceNumber    // → "INV-2024-001"
in.result.supplierName     // → "Acme Supplies GmbH"
in.result.totalAmount      // → 5000.00 (BigDecimal)
in.result.currency         // → "EUR"
in.result.invoiceDate      // → 2024-07-30 (LocalDate)
```

型変換もパースも不要 — オブジェクトはそのまま使用できます。

---

## 内部動作

Smart WorkflowはJSONスキーマを生成するために宣言された出力クラスを解析します。このスキーマはレスポンス形式の制約としてLLMリクエストに追加され、LLMはクラスにマッピングされる有効なJSONを返すよう強制されます。結果は標準的なJacksonデシリアライゼーションを使ってJavaオブジェクトに変換されます。

流れ: 要素に `resultType` を設定 → クラスからJSONスキーマを導出 → スキーマをLLMリクエストに追加 → LLMが一致するJSONを返す → Javaオブジェクトにデシリアライズ → `resultMapping` フィールドに書き込み。

---

## よくあるミス

- **Geminiの使用** — GeminiはJSONスキーマ制約出力をサポートしていません。リクエストが失敗するか、予期しないプレーンテキストが返されます。構造化抽出にはOpenAI・Anthropic・xAIに切り替えてください。
- **nullフォールバックのないプリミティブフィールド** — LLMが値を見つけられず、フィールドがプリミティブ型（例: `int`）の場合、デシリアライゼーションが失敗する可能性があります。Null許容型を使用してください: `int` の代わりに `Integer`、`double` の代わりに `BigDecimal`。
- **`.class` サフィックスの欠落** — `resultType` フィールドには `.class` サフィックスが必要です（例: `tutorial.InvoiceData` ではなく `tutorial.InvoiceData.class`）。これがなければ型を解決できません。
- **クラスパスにないクラス** — 出力クラスは実行時にアクセス可能である必要があります。Ivyデータクラスはそのまま使用できます。普通のJavaクラスはIARにコンパイルされる `src` フォルダに置く必要があります。

---

## サンプルプロセス

このガイドで説明したすべての動作実装がチュートリアルプロジェクトで利用できます。

`tutorial/processes/tutorial/features/Feature02.p.json`

Designerで開いて、`resultType` と `resultMapping` が完全に設定された `Invoice Analysis Agent` 要素と、`result: InvoiceData` フィールドを持つ `Feature02Data` データクラスを確認してください。

---

## 関連項目

- [エージェントの基本設定]
- [ファイル抽出]
- [モデルプロバイダーの選択]
