# 呼び出し可能プロセスツール

デフォルトでは、エージェントはクエリで与えられた情報のみで推論できます。**呼び出し可能プロセスツール** はこれを拡張します: エージェントは実行中にAxon Ivyプロセスにコールバックして、リアルタイムデータの取得・ビジネスルールの適用・副作用のトリガーを行い、その結果を応答に利用できます。

> **[エージェントの基本設定] をベースにしています。** エージェント設定は同じです — 追加点は **Tools** フィールドのみで、エージェントが呼び出せる呼び出し可能サブプロセスのリストを指定します。
>
> **このガイドで使用する例: Acme Corp 請求書承認**
>
> エージェントが請求書を読み取り、3つのツールを順番に呼び出します: 請求書通貨の適用税率を調べ、金額に承認が必要かどうかを判断し、担当承認者を選択します。3つの結果を組み合わせた意思決定を返します。プロセスはポリシーに基づき **Manager Review** タスクに進むか自動的に終了します。
>
> ![Example process](cms:/Files/Images/feature05-00)
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature05.p.json`、ツールは `tutorial/processes/tutorial/tools/Feature05Tools.p.json` にあります。両方をDesignerで開いて読み進めてください。

---

## はじめる前に

これまでのFeatureで、`AgenticProcessCall` がツールなしで単独でできることを見てきました。

- **Feature 01** — 請求書テキストを1文で要約する
- **Feature 02** — 請求書フィールドを型付きJavaオブジェクトとして抽出する
- **Feature 03** — 同じ抽出を1つのプロセス内で複数のプロバイダーに振り分ける
- **Feature 04** — 画像やPDFファイルから直接請求書を読み取る

これらはすべて単一目的のAI呼び出しです。エージェントに入力を渡し、推論させ、結果を返す — シンプルで強力ですが、渡したデータから導き出せる内容に限られます。

しかし、もっと複雑な処理が必要な場合はどうでしょうか？請求書の承認に、ERPシステムで承認ポリシーを確認し、請求書通貨の実効税率を計算し、ライブデータベースから担当承認者を選択する必要があるとしたら？エージェント単独ではそのいずれもできません — あなたのシステムへの接続手段がないからです。

そこでツールが力を発揮します。ツールを使うと、エージェントは実行中にAxon Ivyプロセスにコールバックできます — データベースへのクエリ、ビジネスルールの適用、外部APIの呼び出し、あらゆるワークフローロジックの実行 — そしてその結果を最終回答を生成する前の推論に利用できます。

Smart Workflowはエージェントのツールを定義するための2つの方法をサポートしています。

- **呼び出し可能プロセスツール** — Axon Ivy Designerで呼び出し可能サブプロセスとして実装されるツール。Javaは不要: 既存のプロセス要素・スクリプト・コネクター・サブプロセスをすべて使用できます。
- **Javaツール** — SPIパターンを使ってJavaクラスとして実装されるツール。ライブラリ作成者や高度な統合向けです。詳細は [Javaツール] を参照してください。

**アプリケーション開発には呼び出し可能プロセスツールを強く推奨します。** ツールロジックをプロセスモデル内に保持することで、どのAxon Ivy開発者でも可視・テスト・保守が可能です。Javaツールは内部拡張ポイントです — 共有ライブラリを構築する場合や、プロセスで表現できない機能が必要な場合のみ使用してください。

---

## 呼び出し可能ツールとは？

ツールは、エージェントが実行中に呼び出せる `tool` タグ付きの [呼び出し可能サブプロセス](https://developer.axonivy.com/doc/14.0/en/designer-guide/process-modeling/process-modeling/process-kinds.html#independent-subprocess-callable) です。エージェントから型付き入力を受け取り、実装したAxon Ivyロジック（データベース検索・計算・外部API呼び出し・ワークフローアクション）を実行し、エージェントが読み取って推論できる結果を返します。

![Callable process tool](cms:/Files/Images/feature05-01)

エージェントがツールを **いつ** 呼び出すかはツールの説明文とシステムプロンプトの指示に基づきます。ツールが **何をするか** はあなたが決めます — 実装は純粋なAxon Ivyです。

---

## なぜツールを使うのか？

- **リアルタイムデータ** — LLMはトレーニング時点で凍結されています。ツールはライブデータベースへのクエリや外部APIの呼び出しができます。
- **ビジネスルール** — 承認閾値・価格ロジック・コンプライアンスチェックなど、変化しプロンプトにハードコードすべきでないルール。
- **副作用** — タスクの作成・通知の送信・ERPシステムへの書き込みなど、LLMが単独ではできないアクション。

---

## 要素の設定

### Tools

エージェントが呼び出せる呼び出し可能サブプロセスをシグネチャ名のJSON配列として列挙します。

**例:**

```json
["lookupApprovalPolicy", "calculateEffectiveTaxRate", "chooseApprover"]
```

**仕組み:** 実行時に、Smart Workflowは列挙した各ツールを使用可能な関数としてLLMに登録します。エージェントのシステムプロンプトが、いつどのように使用するかを伝えます。LLMがツールを呼び出すと判断すると、Smart Workflowが一致する呼び出し可能サブプロセスを実行し、パラメータを渡し、結果をLLM会話にフィードバックします。エージェントは新しい情報を元に推論を続けます。

> **AI Provider** と **Model** フィールドは [エージェントの基本設定] と同様に機能します — グローバルデフォルトを使用するには空白のままにします。

---

## ツールプロセスの作成

ツールは標準的な **CALLABLE_SUB** プロセスで、1つだけ違いがあります: `CallSubStart` 要素が `tool` としてタグ付けされています。

### ツールシグネチャ

各 `CallSubStart` が1つのツールのインターフェースを定義します — 名前・入力パラメータ・戻り値。複数のツールを同じ呼び出し可能サブファイルに配置できます。

| ツール | 入力 | 結果 |
| --- | --- | --- |
| `lookupApprovalPolicy` | `amount: String` | `policy: String` — `STANDARD` または `REQUIRES_APPROVAL` |
| `calculateEffectiveTaxRate` | `currency: String` | `taxRate: String` — 例: `21%` |
| `chooseApprover` | `amount: String` | `approver: String` — 例: `bob.smith` |

各 `CallSubStart` の `tags: ["tool"]` マーキングが、Smart WorkflowにこのCallSub要素をエージェントツールとして使用できることを伝えます。

パラメータの型は `String` に限定されません。プリミティブ・データクラス・複雑なオブジェクトなど、任意のJava型を宣言できます。Smart WorkflowはLLMとプロセスの間でJSON形式でシリアライズ・デシリアライズします。金額や通貨コードなどのシンプルなスカラー値には `String` が最も簡単です。複数フィールドを持つ検索条件オブジェクトなどの構造化入力には、型付きデータクラスを宣言してください。

### 入力と結果のマッピング

各ツールの `CallSubStart` 設定には2つのマッピングセクションがあります。

**入力マップ** — エージェントが渡すパラメータをデータクラスフィールドにコピーし、スクリプトが読み取れるようにします。

```text
out.amount ← param.amount
```

**結果マップ** — データクラスフィールドをツールの戻り値としてエージェントにコピーします。

```text
result.policy ← in.policy
```

### LLMに送信される説明文

Smart Workflowは、登録された各ツールについて3種類の説明テキストをモデルに送信します。

| 種類 | 設定場所 | LLMが使用する目的 |
| --- | --- | --- |
| **ツールの説明** | `CallSubStart` 要素の **Description** フィールド | ツールの用途と呼び出すタイミングを理解する |
| **入力パラメータの説明** | 各入力パラメータの `desc` フィールド | どの値を何の形式で渡すかを知る |
| **結果パラメータの説明** | 各結果パラメータの `desc` フィールド | 戻り値が何を表すかを知る |

これらは合わせてモデルとのツールの完全な契約を形成します。説明が明確であるほど、エージェントは正しいツールを正しい入力で呼び出す信頼性が高まります — 詳細なシステムプロンプトがなくても。

**このガイドの例:**

`lookupApprovalPolicy`:

- **ツール:** *"Use this tool to determine the approval policy for an invoice amount. Returns STANDARD if the invoice can be auto-approved, or REQUIRES_APPROVAL if manual sign-off is needed."*
- **入力 `amount`:** *"Invoice total amount as a plain number string"*
- **結果 `policy`:** *"Approval policy: STANDARD or REQUIRES_APPROVAL"*

`calculateEffectiveTaxRate`:

- **ツール:** *"Use this tool to look up the applicable VAT rate for an invoice. Pass the ISO 4217 currency code (e.g. EUR, JPY) and receive the effective tax rate as a percentage string."*
- **入力 `currency`:** *"ISO 4217 currency code of the invoice"*
- **結果 `taxRate`:** *"Effective tax rate as a percentage string, e.g. 21%"*

`chooseApprover`:

- **ツール:** *"Use this tool to select the responsible approver for an invoice. Pass the total amount as a plain number string and receive the username of the approver who must sign off."*
- **入力 `amount`:** *"Invoice total amount as a plain number string"*
- **結果 `approver`:** *"Username of the responsible approver (e.g. alice.chen, bob.smith, or carol.jones)"*

> システムプロンプトで各ツールを明示的に指定している場合でも、適切な説明はセーフティネットとして機能します。モデルはそれを読んで何を渡し何を期待するかを正確に把握できるため、推測なしにツールを正しく呼び出せます。

### 実装

各 `CallSubStart` と `CallSubEnd` の間に、ツールのロジックを実装するAxon Ivy要素を追加します。この例では各ツールに1つのScript要素を使用します。

**lookupApprovalPolicy** — 承認閾値ルールを適用します。

```java
try {
  double amount = Double.parseDouble(in.amount.trim());
  in.policy = amount > 5000 ? "REQUIRES_APPROVAL" : "STANDARD";
} catch (NumberFormatException e) {
  in.policy = "STANDARD";
}
```

**calculateEffectiveTaxRate** — 請求書通貨のVATレートを返します。

```java
String currency = in.currency != null ? in.currency.toUpperCase() : "";
if ("EUR".equals(currency)) {
  in.taxRate = "21%";
} else if ("GBP".equals(currency)) {
  in.taxRate = "20%";
} else if ("USD".equals(currency)) {
  in.taxRate = "10%";
} else if ("JPY".equals(currency)) {
  in.taxRate = "8%";
} else {
  in.taxRate = "10%";
}
```

**chooseApprover** — 請求書金額に基づいて担当承認者のユーザー名を返します。

```java
try {
  double amount = Double.parseDouble(in.amount.trim());
  if (amount > 50000)      in.approver = "alice.chen";
  else if (amount > 10000) in.approver = "bob.smith";
  else                     in.approver = "carol.jones";
} catch (NumberFormatException e) {
  in.approver = "carol.jones";
}
```

実際のプロセスでは、これらのScript要素をデータベースクエリ・ERPへのREST呼び出し・その他のAxon Ivyロジックに置き換えられます。

---

## 例 — Acme Corp 請求書承認

### システムプロンプト

```text
You are an invoice approval assistant for Acme Corp.
Given invoice text:
1. Extract the total amount as a plain number string (digits and decimal point only) and the ISO 4217 currency code.
2. Call calculateEffectiveTaxRate with the currency code — use the result as effectiveTaxRate.
3. Call lookupApprovalPolicy with the total amount — set isAutoApprove to true if the result is STANDARD, false if REQUIRES_APPROVAL.
4. Call chooseApprover with the total amount — use the result as approverUsername.
5. Return a structured InvoiceDecision with all three fields populated.
```

**クエリ:** `<%=in.invoiceText%>`

**Tools:** `["lookupApprovalPolicy", "calculateEffectiveTaxRate", "chooseApprover"]`

**期待する結果の型:** `tutorial.InvoiceDecision.class`

**結果のマッピング先:** `in.invoiceDecision`

### 結果

エージェント要素の後、`in.invoiceDecision` は型付き `InvoiceDecision` オブジェクトになります — 各フィールドを直接読み取れます。

```javascript
in.invoiceDecision.effectiveTaxRate   // → "21%"
in.invoiceDecision.isAutoApprove      // → false
in.invoiceDecision.approverUsername   // → "bob.smith"
```

プロセスゲートウェイは `in.invoiceDecision.isAutoApprove == false` を確認し、**Manager Review** タスクまたは **Auto-approved** に振り分けます。文字列のパースは不要です。

---

## よくあるミス

- **ツールが見つからない** — `tools` 配列の名前は `CallSubStart` 要素の `signature` と完全に一致する必要があります。不一致はツール登録がサイレントに失敗し、エージェントはツールが利用できないかのように動作します。
- **`tool` タグがない** — `CallSubStart` に `tags: ["tool"]` がなければ、Smart WorkflowはそのCallSubをツールとして登録しません。エージェントは呼び出せません。
- **エージェントがツールを無視する** — ツールをいつどの入力で呼び出すかについてシステムプロンプトに明確な指示がない場合、LLMはそれをスキップして推測する可能性があります。各ツールに名前をつけ、期待する入力を明確に記述してください。
- **型の不一致** — ツールパラメータはあらゆるJava型をサポートしますが、LLMは会話コンテキストからその型の有効な値を構築できる必要があります。複雑なオブジェクト型を宣言する場合は、LLMが値を入力する方法を理解できるよう `desc` フィールドを明確にしてください。スカラー値には `String` が最も安全な選択肢です。

---

## サンプルプロセス

動作実装はチュートリアルプロジェクトで利用できます。

- `tutorial/processes/tutorial/features/Feature05.p.json` — Alternative ゲートウェイを持つエージェントプロセス
- `tutorial/processes/tutorial/tools/Feature05Tools.p.json` — 1つのCallSubに3つのツール全て

両方をDesignerで開きます。`Feature05.p.json` で `Invoice Approval Agent` 要素を確認してください — 3つのシグネチャがすべて記載された `Tools` フィールドがあります。`Feature05Tools.p.json` で各 `CallSubStart` を確認してください — `tool` タグ・個別の入力/結果パラメータマッピング・LLMに送信される **Description** フィールドがあります。

---

## 関連項目

- [エージェントの基本設定]
- [構造化出力]
- [Javaツール]
- [モデルプロバイダーの選択]
