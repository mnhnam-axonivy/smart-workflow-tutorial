# Javaツール

**Javaツール** は `SmartWorkflowTool` を実装したクラスで、名前付き・型付きの操作をAIエージェントに公開します。フレームワークはJava SPIメカニズムを通じてJavaツールを検出し、呼び出し可能プロセスツールと並んで任意のエージェントから利用できるようにします。

---

> **[呼び出し可能プロセスツール] をベースにしています。** エージェント設定は同じです — 違いはツールのロジックが呼び出し可能サブプロセスではなくJavaコードで実装されている点だけです。
>
> **このガイドで使用する例: Acme Corp 為替換算**
>
> Acme CorpはJPY建ての請求書を受け取ります。エージェントが請求書を読み取り、合計金額と通貨を抽出し、Javaツール（`convertToUSD`）を呼び出して固定為替レートでUSD換算額を計算し、請求書の詳細と換算額を組み合わせた1文の要約を返します。
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature06.p.json` にあります。Designerで開いて読み進めてください。

---

## はじめる前に

[呼び出し可能プロセスツール] では、呼び出し可能サブプロセスとしてツールを実装することで、エージェントにライブビジネスロジックへのアクセスを与える方法を見ました — Javaは不要でした。

**Javaツールは異なる状況向けの別のアプローチです。** ツールのロジックが純粋に計算処理であり — ワークフローのステップ・ユーザーダイアログ・Axon Ivy固有のAPIが不要で — プレーンJavaでよりクリーンに表現できる場合や、サードパーティのJava SDKをラップする必要がある場合に使用します。

| | 呼び出し可能プロセスツール | Javaツール |
|---|---|---|
| **実装場所** | Axon Ivy Designer | Javaクラス |
| **Ivy要素を使用可能** | はい | いいえ |
| **ランタイムなしでユニットテスト可能** | いいえ | はい |
| **サードパーティJava SDKのラップ** | 難しい | クリーン |
| **プロジェクト間での再利用** | プロセスのコピー | JAR依存関係 |
| **推奨用途** | アプリケーション開発 | ライブラリ作成者・純粋な計算処理 |

**可能な限り呼び出し可能プロセスツールを優先してください。** Javaツールはワークフローのステップが不要でプレーンJavaで表現するほうが適切なロジック向けです。

---

## Javaツールとは？

Javaツールは `SmartWorkflowTool` インターフェースを実装したクラスです。4つのメソッドがあります。

| メソッド | 用途 |
|---|---|
| `name()` | エージェントが `Tools` リストで使用するツール名 |
| `description()` | ツールの用途と呼び出しタイミングをLLMに伝える |
| `parameters()` | エージェントが提供する必要のある型付き入力を宣言する |
| `execute()` | 引数を受け取って結果を返す |

フレームワークはJava SPIを通じてJavaツールを検出します: `META-INF/services/` に `SmartWorkflowToolsProvider` を登録すると、フレームワークが起動時にロードします。

---

## なぜ使うのか？

- **Javaの完全な型システム** — パラメータは文字列だけでなくカスタムクラスや `List<T>` も使用できます
- **ユニットテスト可能** — Ivyランタイム不要。プレーンな `Map` で `execute()` をテストできます
- **サードパーティSDKのラップ** — `execute()` の中で任意のJavaライブラリをクリーンに統合できます
- **再利用可能** — ツールをJARとしてパッケージ化し複数のAxon Ivyプロジェクトで共有できます

---

## Step 1 — SmartWorkflowToolを実装する

`com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowTool` を実装するJavaクラスを作成します。

**例 — `FxRateConverterTool`:**

```java
public class FxRateConverterTool implements SmartWorkflowTool {

  private static final Map<String, Double> RATES_TO_USD = Map.of(
      "USD", 1.0, "EUR", 1.09, "GBP", 1.27, "JPY", 0.0067
  );

  @Override
  public String name() {
    return "convertToUSD";
  }

  @Override
  public String description() {
    return """
        Convert an invoice amount from its original currency to USD using fixed exchange rates.
        Pass the total amount as a plain number string and the ISO 4217 currency code.
        Returns the converted amount as a formatted string showing the original, USD equivalent, and rate.""";
  }

  @Override
  public List<ToolParameter> parameters() {
    return List.of(
        new ToolParameter("amount",
            "Invoice total amount as a plain number string (digits and decimal point only)",
            "String"),
        new ToolParameter("currency",
            "ISO 4217 currency code of the invoice (e.g. JPY, EUR, GBP, USD)",
            "String")
    );
  }

  @Override
  public Object execute(Map<String, Object> args) {
    String amountStr = (String) args.get("amount");
    String currency = ((String) args.get("currency")).toUpperCase().trim();
    double amount = Double.parseDouble(amountStr.replaceAll("[^0-9.]", ""));
    double rate = RATES_TO_USD.getOrDefault(currency, 1.0);
    double usd = amount * rate;
    return String.format("%.2f %s = %.2f USD (rate: %.4f)", amount, currency, usd, rate);
  }
}
```

**`name()`** はエージェントが使用する識別子です。エージェントの `Tools` リストの文字列と完全に一致する必要があります。

**`description()`** はLLMにそのまま送信されます。ツールが何をするのか・いつ使うのか・結果にどのような形式を期待するかを指示として記述してください。明確であるほど、エージェントがツールを正確に呼び出す信頼性が高まります。

**`parameters()`** は各入力を宣言します。`ToolParameter` の `type` フィールドは完全修飾Javaクラス名（またはプリミティブ名）である必要があります。フレームワークは `execute()` を呼び出す前にLLMのJSONからその型に自動的にデシリアライズします。

**`execute()`** はパラメータ名をキーとする `Map<String, Object>` を受け取ります。値を宣言した型にキャストし、任意のJavaオブジェクトを返してください — フレームワークがそれをJSONにシリアライズしてLLMにフィードバックします。

---

## Step 2 — SmartWorkflowToolsProviderを作成する

`SmartWorkflowToolsProvider` を実装して公開したいツールを列挙するクラスを作成します。

```java
public class TutorialToolProvider implements SmartWorkflowToolsProvider {

  @Override
  public List<SmartWorkflowTool> getTools() {
    return List.of(new FxRateConverterTool());
  }
}
```

1つのプロバイダーで複数のツールを公開できます。フレームワークは起動時に `getTools()` を呼び出し、返されたすべてのツールをグローバルに登録します。

---

## Step 3 — SPIで登録する

`src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider` ファイルを作成し、プロバイダーの完全修飾クラス名を追加します。

```text
tutorial.tool.TutorialToolProvider
```

このファイルがない場合、フレームワークはプロバイダーを読み込まず、クラスがクラスパスにあってもすべてのエージェントからツールが見えなくなります。

---

## Step 4 — エージェントのToolsリストに追加する

`AgenticProcessCall` の設定で、ツールの `name()` を **Tools** フィールドに追加します。

```json
["convertToUSD"]
```

ツールを登録するとグローバルに *利用可能* になりますが、エージェントは自身の設定に列挙されたツールのみを使用します。これによりエージェントの焦点を絞り、意図しないツール呼び出しを防ぎます。

---

## 例 — Acme Corp 為替換算

### Mock data

プロセスは **Mock data** Script要素を使って請求書テキストをあらかじめ設定するため、手動でのデータ入力なしに実行できます。

```text
INVOICE
Invoice Number: INV-2024-00123
Date: 2024-06-01
Due Date: 2024-06-30

Supplier:
Acme Supplies Ltd.
123 Commerce Street, Tokyo, Japan

Bill To:
Acme Corp
456 Business Avenue, Osaka, Japan

Description                  Qty   Unit Price   Total
Office Supplies              10    500.00       5,000.00
Printer Paper (A4, 500 pcs)   5    800.00       4,000.00
Desk Organizer                3    200.00         600.00

Subtotal: JPY 9,600.00
Tax (10%): JPY 960.00
Total Amount Due: JPY 10,560.00

Payment Terms: Net 30
Bank: Sumitomo Mitsui Banking Corporation
Account Number: 1234567890
```

### システムプロンプト

```text
You are an invoice analyst for Acme Corp.
Given an invoice text:
1. Extract the total amount as a plain number string (digits and decimal point only) and the ISO 4217 currency code.
2. Call convertToUSD with the amount and currency code.
3. Return a single sentence summary containing: the invoice number, supplier name, original total amount with currency, and the USD equivalent returned by convertToUSD.
```

**クエリ:** `<%=in.invoiceText%>`

**Tools:** `["convertToUSD"]`

**結果のマッピング先:** `in.summary`

### 結果

エージェント要素の後、`in.summary` は1文の要約を含むプレーンなStringになります。**Show result** Script要素がAxon Ivy Runtime Logに記録します。

```javascript
ivy.log.error(in.summary);
```

出力例:

```text
Invoice INV-2024-00123 from Acme Supplies Ltd. totals JPY 10,560.00,
which is equivalent to approximately 70.75 USD at a rate of 0.0067.
```

---

## サポートされるパラメータ型

| 種類 | 型文字列の例 |
|---|---|
| プリミティブ | `"String"`, `"int"`, `"boolean"`, `"double"` |
| Javaクラス | `"java.math.BigDecimal"`, `"com.example.MyClass"` |
| List | `"java.util.List<java.lang.String>"` |

配列はサポートされていません — 代わりに `List` を使用してください。フレームワークは `execute()` が呼び出される前にJSON引数を宣言したJava型に自動的にデシリアライズします。

---

## よくあるミス

- **SPIの登録ファイルを忘れる** — `META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider` がなければ、フレームワークはプロバイダーを読み込みません。クラスがコンパイルされてクラスパスにあっても、ツールはどのエージェントにも表示されません。
- **ツール名の不一致** — エージェントの `Tools` リストの文字列は `name()` の戻り値と完全に一致する必要があります。1文字の差異でエージェントはツールを見つけられません。
- **ListではなくArrayを使用する** — デシリアライザーはJava配列をサポートしていません。リストパラメータは常に `java.util.List<T>` として宣言してください。
- **エージェントのToolsリストにツールを追加しない** — ツールを登録するとグローバルに *利用可能* になります。エージェントは自身の `Tools` フィールドに明示的に列挙されたツールのみを使用します。

---

## サンプルプロセス

動作実装はチュートリアルプロジェクトで利用できます。

- `tutorial/processes/tutorial/features/Feature06.p.json` — エージェントプロセス
- `tutorial/src/tutorial/tool/FxRateConverterTool.java` — Javaツールの実装
- `tutorial/src/tutorial/tool/TutorialToolProvider.java` — SPIプロバイダー
- `tutorial/src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider` — SPI登録ファイル

DesignerでプロセスをOpenし、`Invoice Analyst Agent` 要素を確認してください — `["convertToUSD"]` が含まれた `Tools` フィールドがあります。`FxRateConverterTool.java` を開いて実装全体を確認してください。

---

## 関連項目

- [呼び出し可能プロセスツール]
- [エージェントの基本設定]
- [構造化出力]
- [モデルプロバイダーの選択]
