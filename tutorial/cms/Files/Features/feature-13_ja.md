# ヒューマンインザループ

デフォルトでは、AIエージェントは自律的に決定を下します。**ヒューマンインザループ**は、エージェントの実行をタスクの途中で一時停止し、特定の決定をAxon Ivyタスクとして人間のユーザーにルーティングします — その後、ユーザーの入力に基づいてエージェントが自動的に再開します。

---

> **[呼び出し可能プロセスツール]と[会話メモリ]の知識が必要です。** このパターンは、エージェントを一時停止する特殊な呼び出し可能ツールと、人間タスク完了後にエージェントのコンテキストを復元するための`aiMemoryId`を使用します。
>
> **このガイドの例：** 請求書承認エージェント。$2,000を超える請求書に対してエージェントが一時停止し、人間に書面による理由を求めます。エージェントは承認を確認し、その理由を説明に含む正式な承認タスクが作成されます。$1,000未満の請求書は人間の介入なしに自動承認されます。
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature13.p.json` にあります。

## 始める前に

エージェントの決定の中には、人間の判断が必要なものがあります — コンプライアンスチェック、承認ステップ、または監査のために記録が必要な理由など。ヒューマンインザループがなければ、エージェントはその選択を自律的に行うか、受け取れない入力を待ち続けるかのどちらかです。このパターンにより、エージェントは特定の質問を実際のユーザーに委任し、フリーテキストの回答を使って処理を継続できます。

## 仕組み

このパターンは3つの連携するコンポーネントを使用します：

| コンポーネント | 役割 |
| --- | --- |
| `askUserFeedback`呼び出し可能ツール | エージェントから`HumanFeedback`（質問と回答）を受け取り、`human:decision`エラーをスローして実行を一時停止する |
| エラー境界イベント + `UserTask` | エラーをキャッチし、フリーテキストダイアログとしてユーザーに質問を表示し、入力を待つ |
| `DecisionMaker.resolve()` | ユーザーの回答をエージェントの会話メモリに書き込み、エージェントが継続できるようにする |

エージェントは一時停止中に状態を保持するために`aiMemoryId`を使用します。データクラスに`aiMemoryId`がないと、エージェントは再開できず、`DecisionMaker.resolve()`は書き込み先を持ちません。

---

## なぜ使うのか？

- **承認ワークフロー** — アクションを起こす前に記録された人間の理由が必要なエージェント
- **コンプライアンスゲート** — エージェントが進む前に人間が確認または理由を説明しなければならない
- **監査証跡** — 人間が提供した理由がタスクの説明に記録される
- **透明なAI** — ユーザーはエージェントが何を尋ねているかを正確に把握し、制御を保持する

---

## ステップ1 — データクラスにaiMemoryIdを追加する

パターン全体が依存する基盤として、最初にデータクラスに`aiMemoryId: String`を追加します：

```json
{ "name": "aiMemoryId", "comment": "name convention: field holding the memory id of an ongoing AI conversation" }
```

フレームワークは最初のエージェント呼び出し時にここに会話IDを書き込みます。`DecisionMaker`はこのIDを使用して、人間タスク完了時にサスペンドされた会話を見つけて更新します。

> `aiMemoryId`がないと、エージェントはメモリストアを持てず、`DecisionMaker.resolve()`はサイレントに失敗し、エージェントは正しく再開できません。

---

## ステップ2 — askUserFeedbackツールを作成する

![askUserFeedbackツールプロセス](cms:/Files/Images/feature13-02)

`tool`タグが付いた呼び出し可能サブプロセスを作成します。ツールは`HumanFeedback`を受け取り、`human:decision`エラーとしてスローします。`ErrorEnd`の出力コード：

```java
error.setAttribute("decision", in.feedback);
```

これにより、`HumanFeedback`オブジェクト（質問と回答のプレースホルダー）がエラーにアタッチされ、境界イベントが読み取れるようになります。

> `CallSubStart`の`tool`タグにより、フレームワークがこの呼び出し可能をエージェントに公開します。これがないと、エージェントは`askUserFeedback`を発見したり呼び出したりできません。

---

## ステップ3 — AgenticProcessCallを設定する

ツールを追加し、`ErrorBoundaryEvent`をアタッチします：

| フィールド | 値 |
| --- | --- |
| ツール | `["askUserFeedback"]` |
| システムプロンプト | $2,000を超える請求書に対して`askUserFeedback`を使用するよう指示 — 1つの直接的な質問をし、オプションは提示しない |
| エラー境界コード | `human:decision` — `error.getAttribute("decision")`を`in.decision`にマップ |

境界出力マッピング：

```java
out.decision = error.getAttribute("decision") as tutorial.HumanFeedback
```

エラー境界はプロセスインスタンスを維持し、エージェントのメモリを保持しながら、フローを`UserTask`にルーティングします。

---

## ステップ4 — UserTaskとダイアログを作成する

![HumanDecisionダイアログ](cms:/Files/Images/feature13-01)

エラー境界を`HumanDecision`ダイアログを持つ`UserTask`に接続します。ダイアログ（`HumanDecision.xhtml`）はエージェントの質問をプレーンテキストで表示し、ユーザーの回答用のフリーテキストエリアを提供します。ユーザーが送信した後、`UserTask`の出力を**同じ`AgenticProcessCall`要素**に戻るように接続します — これにより、メモリから復元されたサスペンドされたコンテキストでエージェントが再エントリーします。

---

## ステップ5 — 決定を解決する

`UserTask`の出力コードで、フローがエージェントに戻る前に`DecisionMaker.resolve()`を呼び出します。

`result`はダイアログの出力オブジェクトです — `HumanDecision:start(tutorial.HumanFeedback)`が返すデータクラスです。その`answer`フィールドにユーザーが入力したフリーテキスト文字列が格納されます。

```java
import com.axonivy.utils.smart.workflow.tools.human.DecisionMaker;

new DecisionMaker(in.aiMemoryId).resolve(result.answer);
```

これにより、ユーザーのフリーテキスト回答がエージェントのメモリに書き込まれ、エージェントが再開したときにサスペンドされた`askUserFeedback`ツール呼び出しが正しい値を返します。

---

## 例

![プロセス例](cms:/Files/Images/feature13-00)

デモでは2つのスタート地点を用意し、両方のパスを対比できます：

| スタート | 請求書 | 金額 | 期待される動作 |
| --- | --- | --- | --- |
| **チュートリアル フィーチャー13：ヒューマンインザループ** | INV-2025-0892（Apex Solutions） | $12,500 | エージェントが一時停止 — 人間が理由を入力する必要がある |
| **チュートリアル フィーチャー13：自動承認（$1000未満）** | INV-2025-0891（Office Depot） | $85 | エージェントが自動承認 — 人間タスクなし |

### フローの流れ（高額請求書パス）

1. モッククエリが送信：`"Invoice #INV-2025-0892 from Apex Solutions Ltd. Total: $12,500 USD. Cloud infrastructure services. Due: 2025-08-01. Please process this invoice for approval."`
2. エージェントが金額が$2,000を超えることを検出 — 理由を求める直接的な質問とともに`askUserFeedback`を呼び出す
3. `askUserFeedback`が`human:decision`をスロー — エージェントの実行が一時停止
4. タスクリストに**「Provide feedback for Invoice Approval Agent」**タスクが表示される
5. ユーザーがタスクを開き、エージェントの質問を読み、フリーテキストで理由を入力する
6. `DecisionMaker.resolve(answer)`がエージェントのメモリに理由を書き込む
7. エージェントが再開 — 請求書が承認されたことを確認し、作成される承認タスクを説明する
8. フローが正式タスクを作成する`TaskSwitchEvent`に続く：
   - **名前：** `Invoice INV-2025-0892 Approval`
   - **説明：** `Justification reason: <ユーザーが入力したテキスト>`

### フローの流れ（低額請求書パス）

1. モッククエリが送信：`"Invoice #INV-2025-0891 from Office Depot. Total: $85 USD. Office stationery supplies. Due: 2025-08-01. Please process this invoice for approval."`
2. エージェントが金額が$2,000未満であることを検出 — `askUserFeedback`を呼び出さずに自動承認する
3. フローが直接承認の`TaskSwitchEvent`に進む

このパスにプロセス設定の変更は不要です — エージェントはシステムプロンプトに基づいて自分自身で閾値チェックを適用します。`askUserFeedback`ツールは単純に呼び出されません。

### エージェントの設定

| フィールド | 値 |
| --- | --- |
| システムプロンプト | *下記のプロンプトを参照* |
| ツール | `["askUserFeedback"]` |
| 結果マッピング | `in.result` |
| クエリ | `<%=in.query%>` |

```text
You are an invoice approval assistant for Acme Corp. When an invoice total exceeds $2,000,
you MUST pause and use the askUserFeedback tool to ask the human a single direct question
requesting their justification reason. Do not suggest or list any options — the human will
type their own free-text reason. After receiving the reason, confirm the invoice is approved
and describe the approval task that will be created with that reason in its description.
```

---

## 設定リファレンス

| コンポーネント | 主要設定 |
| --- | --- |
| `askUserFeedback`呼び出し可能 | `tool`タグ付き；`ErrorEnd`が`error.setAttribute("decision", in.feedback)`で`HumanFeedback`をアタッチして`human:decision`をスロー |
| AgenticProcessCallエラー境界 | エラーコード`human:decision`；エラー属性を`tutorial.HumanFeedback`として`in.decision`にマップ |
| `UserTask` | ダイアログ`tutorial.HumanDecision:start(tutorial.HumanFeedback)`；AgenticProcessCallに戻る接続 |
| `UserTask`出力コード | `new DecisionMaker(in.aiMemoryId).resolve(result.answer)` |
| データクラス | `aiMemoryId: String`、`decision: tutorial.HumanFeedback`、`result: String`フィールドが必須 |
| `TaskSwitchEvent` | タスク名 `Invoice <%=in1.invoiceId%> Approval`；説明 `Justification reason: <%=in1.result%>` |

---

## よくある間違い

- **`aiMemoryId`がない** — `DecisionMaker.resolve()`がエージェントのメモリを見つけられず、エージェントはツール結果なしで再開し、幻覚を起こすかループする可能性がある。
- **UserTaskが同じAgenticProcessCallに戻る接続がない** — エージェントが再エントリーできず、プロセスが途中で終了する。
- **`tool`タグを忘れる** — `CallSubStart`に`tool`タグがないと、エージェントは`askUserFeedback`を発見したり呼び出したりできない。

---

## 関連項目

- [エージェントの基本設定]
- [呼び出し可能プロセスツール]
- [会話メモリ]
