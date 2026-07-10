# エージェントプロンプト：明確さと動的コンテキスト

システムプロンプトはAIへの主要な指示であり、エージェントの推論方法・注目点・ツールの呼び出し方を決定します。2つの誤りがこれを損なわせます: プロンプト内でツールのメソッド名を直接参照すること、そして実行時に変化するコンテキスト値をハードコードすることです。Smart Workflowは`system`フィールドと`query`フィールドでEL式をサポートしており、今日の日付・ユーザーのロケール・任意のプロセスデータフィールドなど、実際のJava値を呼び出し時にプロンプトへ直接注入できます。

---

> **ベストプラクティスの例:** `best-practices/processes/exercise/purchasing/agents/` の `PurchasingAgent.p.json` は両方の原則を示しています。Purchasing Manager Agentのシステムプロンプトは、単一のツールメソッド名も使わず、*何をすべきか*を平易な言葉で説明しています。クエリは `<%= in.region.getDisplayLanguage() %>` を使って、実行時にロケール名を動的に注入します。

## 仕組み

### システムプロンプトとクエリ

すべての`AgenticProcessCall`には、AIが受け取る指示を構成する2つのテキストフィールドがあります:

| フィールド | 役割 |
| --- | --- |
| `system` | 役割の説明・手順・ルール — エージェントが誰で何をしなければならないか |
| `query` | この呼び出しに対する具体的なリクエスト: 処理するデータと動的コンテキスト |

両フィールドは**EL式**（`<%= expression %>`）をサポートします。エンジンはテキストをLLMに送信する前に、プロセスデータクラスに対して式を評価します — つまりプロセスからアクセス可能な任意のJava値をプロンプトに含めることができます。

### `tools` 配列

`tools`フィールドには、エージェントが呼び出せる`CallSubStart`の呼び出し可能プロセス（`tool`タグ付き）が列挙されています。AIは各`CallSubStart`の`visual.description`を使って目標を正しいツールと照合します — システムプロンプトにメソッド名を繰り返す必要はありません。

---

## アンチパターン：システムプロンプトにツール名を記述する

開発者がシステムプロンプトにツールのメソッド名を明示的に列挙すると、プロンプトが実装に密結合されます:

```text
You are a Purchasing Manager Agent.
Your goal is to process extracted document text and produce a complete, analyzed purchasing object.

Follow these steps in order:
1. Use the "translate" tool to translate the extracted text to the target locale.
2. Use the "mapToPurchasingObject" tool to map the translated text into a structured PurchasingData object.
3. Use the "calculatePurchasingTax" tool to compute subtotal, tax per item type, and grand total.
4. Use the "calculateStatistics" tool to compute item count, unique product count, average unit price, and effective tax percentage.
5. Use the "createSummary" tool to generate an executive AI summary of the purchasing request.
6. Return the final PurchasingData object as your result.
```

**なぜ有害か:**

- **脆弱** — 呼び出し可能プロセスを`translate`から`translateText`にリネームすると、エージェントが静かに壊れます。プロンプトは`"translate"`と書かれていますが、その名前のツールはもう存在しません
- **冗長** — LLMはツール名を2回受け取ります: プロンプトで1回、ツールスキーマで1回。繰り返しはトークンを増やすだけで意味を追加しません
- **メンテナンストラップ** — ツールをリファクタリングするたびにすべてのプロンプトを更新する必要があります。IDEはプロンプト内の文字列`"translate"`を`translate`呼び出し可能プロセスにリンクしません

---

## ベストプラクティス：ツール名ではなくアクションを説明する

各`CallSubStart`の`visual.description`は、そのツールが何をするかをすでにAIに伝えています。システムプロンプトは目標とステップの順序を説明するだけでよく、各ステップをどの関数が達成するかを記述する必要はありません。

`PurchasingAgent.p.json`の実際のPurchasing Manager Agentシステムプロンプトは以下のとおりです:

```text
You are a Purchasing Manager Agent.
Your goal is to process extracted document text and produce a complete, analyzed purchasing object.

Follow these steps in order using the available tools:
1. Translate the extracted text to the target locale.
2. Map the translated text into a structured PurchasingData object.
3. Compute subtotal, tax per item type, and grand total.
4. Compute item count, unique product count, average unit price, and effective tax percentage.
5. Generate an executive AI summary of the purchasing request.
6. Return the final PurchasingData object as your result.

Rules:
- Always call all five tools in the order above before returning.
- Do not fabricate data not present in the document.
- If the extracted text is empty, return null.
```

ツール名はどこにも登場しません。AIは各`CallSubStart`の`visual.description`を読み取り、各ステップを自律的に正しい呼び出し可能プロセスと照合します。呼び出し可能プロセスをリネームする場合は、その`visual.description`を更新するだけで、システムプロンプトは変更不要です。

### システムプロンプトを3つのパートで構成する

適切に構成されたシステムプロンプトは3つのパートで成り立ちます:

```text
[Role]
One sentence identifying who the agent is and its core responsibility.

[Steps]
Ordered list of what the agent must do, described as actions — not tool names.

[Rules]
Constraints: what the agent must not do, how to handle edge cases, output format.
```

Purchasing Manager Agentはこの構造に正確に従っています:

| パート | 内容 |
| --- | --- |
| Role | `You are a Purchasing Manager Agent. Your goal is to process extracted document text...` |
| Steps | `1. Translate the extracted text... 2. Map the translated text... 3. Compute subtotal...` |
| Rules | `Always call all five tools in the order above... Do not fabricate data... If empty, return null.` |

---

## Smart Workflow: プロンプトへのJava値のリアルタイム注入

Smart WorkflowはテキストをLLMに送信する前に、`system`フィールドと`query`フィールドの両方でEL式（`<%= ... %>`）を評価します。つまり、プロセスデータから到達可能な任意のJava値 — 日付・ロケール・セッション属性・計算済み値 — を、文字列を事前構築するScriptエレメントなしにプロンプトへ含められます。

### 今日の日付

```json
{
  "system": "Today is <%= new java.text.SimpleDateFormat(\"yyyy-MM-dd\").format(new java.util.Date()) %>.\nYou are a purchasing analyst. Evaluate whether this request is urgent given today's date."
}
```

AIが締め切り・SLAウィンドウ・時間に敏感な意思決定について推論する必要がある場合に使用します。

### ユーザーの表示言語

```json
{
  "query": "Respond in: <%= ivy.session.contentLocale.getDisplayLanguage() %>\n\n<%= in.extractedText %>"
}
```

`ivy.session.contentLocale`は現在ログイン中のユーザーの`java.util.Locale`を返します。`getDisplayLanguage()`はそれをLLMが理解できる言語名 — `"Japanese"`・`"English"`・`"German"` — に変換します。ハードコードは不要です。

### プロセスデータ — 購買の例

`PurchasingAgent.p.json`では、`purchasingManagerAgent`呼び出し可能プロセスが`java.util.Locale region`パラメータを受け取ります。クエリは解決済みの言語名を直接注入します:

```json
{
  "query": "Region: <%=in.region.getDisplayLanguage()%>\nSource text to extract purchasing object:\n<%=in.extractedText%>"
}
```

`createSummary`ツールは言語を通常の`String`として受け取ります — 呼び出し元がすでに解決済みです。そのクエリはフィールドを単純に参照します:

```json
{
  "query": "Target language: <%=in.language%>\n\nGenerate an executive summary for the following purchasing request and translate it into the target language:\n\n<%= in.purchasing %>"
}
```

どちらも有効です。型システムでロケールの妥当性を強制する必要がある場合は`Locale`を使用し、値がすでに解決されてパラメータとして渡される場合は`String`を使用してください。

---

## メリット

- **疎結合なプロンプト** — ツールのメソッド名がテキストに埋め込まれていないため、呼び出し可能プロセスをリネームしてもプロンプトが壊れません
- **動的コンテキスト** — 日付・ロケール・ユーザー属性をScriptエレメントなしに実行時注入できます
- **メンテナンス性** — `visual.description`がツールの機能に関する唯一の情報源となり、システムプロンプトはワークフローロジックに集中できます
- **トークン効率** — 説明は`CallSubStart`に一度記述するだけで、システムプロンプトを簡潔に保てます

---

## デメリット

- **ELエラーは実行時に発生** — `<%= in.region.getDisplayLanguge() %>`のタイポはIDEのコンパイルエラーではなく、サーバーログに実行時エラーとして現れます
- **解決済みプロンプトは設計時に見えない** — LLMに送信された正確なテキストを確認するには観測可能性トレースまたはプロセスログを確認する必要があります
- **AIがステップ順序に従わない可能性** — ステップ1をステップ2の前に列挙してもAIがその順序でツールを呼び出すことは保証されません。厳密な順序はプロセス構造で強制する必要があります

---

## よくある間違い

- **システムプロンプトにツールメソッド名をハードコードする** — 呼び出し可能プロセスをリネームすると、プロンプトは存在しないツールを静かに参照し続けます。アクションを説明し、ツールの識別は`visual.description`に任せてください。
- **`CallSubStart`の`visual.description`を省略する** — 説明がないと、AIはツール選択をメソッドシグネチャのみに頼ります。1文の説明で精度が大幅に向上します。
- **Scriptエレメントでプロンプト文字列を構築する** — 不要です。`system`と`query`の`<%= %>`式で、プロセスエレメントを追加することなく同じ結果を達成できます。
- **プロンプトの順序でツール呼び出し順序を強制しようとする** — ステップ1をステップ2の前に列挙してもAIがその順序でツールを呼び出すことは保証されません。順序が重要な場合は、`AgenticProcessCall`の前に連鎖した`SubProcessCall`エレメントを使用してください。
- **プロンプトに内部フィールド名を含める** — AIは結果が`in.purchasing`に格納されていることや、クラスが`exercise.purchasing.PurchasingData`であることを知る必要はありません。実装の詳細はプロンプトテキストから除外してください。

---

## 関連項目

- [プラクティス 03 — エージェント構成: フォルダ構造と命名規則]
- [プラクティス 02 — エージェントパターン: サブプロセス設計とツールの同一配置]
- [呼び出し可能プロセスツール]
- [観測可能性]
