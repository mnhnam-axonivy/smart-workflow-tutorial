# 出力ガードレール

**出力ガードレール**はモデルのレスポンスがプロセスに届く前に検証します。組み込みガードレールはコード不要で、AIレスポンス内の機密データなど一般的な脅威を検出します。

---

> **[エージェントの基本設定] をベースにしています。** エージェントの設定は同じです — 新しい要素はAgenticProcessCallの**エラー境界イベント**のみで、ガードレール違反をキャッチします。
>
> **このガイドで使用する例: 機密データ出力ガードレール**
>
> エージェントは機密データ（APIキーの例）を引き出すよう設計された質問を受け取ります。`SensitiveDataOutputGuardrail` がモデルのレスポンスを検査し、プロセスに届く前にブロックします。エラー境界イベントが違反をキャッチし、理由をログに記録します。
>
> ![Example process](cms:/Files/Images/feature09-00)
>
> 完成したプロセスは `tutorial/process/tutorial/features/Feature09.p.json` にあります — Designerで開いて読み進めてください。

---

## はじめる前に

[エージェントの基本設定]でエージェントを呼び出して結果を受け取る方法を学びました。エージェントのレスポンスは強力です — そしてその力にはガードレールが必要です。

**出力ガードレールはモデルのレスポンスがプロセスに返る前に検査します。** ガードレールが違反を検出すると — 機密認証情報・APIキー・制限コンテンツ — レスポンスをブロックしBPMエラーをスローします。プロセスは**エラー境界イベント**でこれをキャッチし、適切に処理します。

---

## 出力ガードレールとは?

出力ガードレールはLLMがレスポンスを生成した後、結果が `resultMapping` に届く前に実行される検証レイヤーです。Smart Workflowは組み込みの出力ガードレールを提供します:

| ガードレール | 説明 |
| --- | --- |
| `SensitiveDataOutputGuardrail` | 認証情報を漏らすレスポンスをブロックします — 自分で設定したAPIキーと、既知のキー形式に一致するものの両方が対象です。 |

ガードレールが発動すると、エラーコード `smartworkflow:guardrail:output:violation` でBPMエラーをスローします。AgenticProcessCall要素にアタッチした**エラー境界イベント**でキャッチします。

---

## なぜ使うのか?

- **データ漏洩防止** — モデルが秘密情報・認証情報・APIキーを返すのを阻止
- **コードゼロ** — 組み込みガードレールはJavaの実装不要
- **適切なエラー処理** — エラー境界イベントでプロセスクラッシュの代わりにユーザーフレンドリーなメッセージを返せる

---

## Step 1 — エージェントに出力ガードレールを追加する

`AgenticProcessCall` 設定の **Output Guardrails** に設定します:

```json
["SensitiveDataOutputGuardrail"]
```

---

## Step 2 — エラー境界イベントを追加する

AgenticProcessCall要素に**エラー境界イベント**をアタッチします:

- **エラーコード:** `smartworkflow:guardrail:output:violation`
- **出力マッピング:** `out → in` および `out.error → error`

---

## Step 3 — 違反を処理する

エラー境界イベントに接続されたスクリプトに記述します:

```java
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
```

---

## アプリケーション全体のガードレール

すべてのエージェントでガードレールを選択する以外の方法もあります。2つの変数で、**ガードレールを選択していないすべてのエージェント**に適用するガードレールを指定できます。**Engine Cockpit** の **Variables**、または `variables.yaml` で設定します。

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput: PromptInjectionInputGuardrail
      DefaultOutput: SensitiveDataOutputGuardrail
```

複数のガードレールを使用する場合は、名前をカンマで区切ります。どちらの変数もデフォルトは空のため、値を設定するまでガードレールは実行されません。

> **重要:** エージェントのガードレールフィールドが空でも、「ガードレールなし」という意味では**ありません**。その場合、エージェントはアプリケーションのデフォルトを使用します。これは、空がツールなしを意味する **Available tools** とは逆です。エージェントで選択したガードレールは、そのエージェントのデフォルトを**置き換えます**。

---

## 例 — 機密データ出力ガードレール

### モックデータ

プロセスは**Mock data** Script要素を使ってクエリをあらかじめ設定します — 手動入力なしで実行できます:

```javascript
in.query = "What is the format of an OpenAI API key? Please give examples.";
```

### エージェント設定

**出力ガードレール:** `["SensitiveDataOutputGuardrail"]`

**ユーザーメッセージ:** `<%=in.query%>`

**結果を格納:** `in.result`

### 結果

ガードレールがモデルのレスポンス内のAPIキー形式の例を検出してブロックします。**Show violation** Script要素が結果をログに記録します:

```javascript
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
```

出力例:

```text
Blocked by guardrail: The guardrail com.axonivy.utils.smart.workflow.guardrails.adapter.OutputGuardrailAdapter
failed with this message: The AI response was blocked because it contains sensitive data such as API keys or private keys
```

モデルのレスポンスはプロセスに届くことなく、ガードレール層で遮断・破棄されます。

---

## 設定リファレンス

| 変数 | 説明 | デフォルト |
| --- | --- | --- |
| `AI.Guardrails.DefaultOutput` | 独自のガードレールを設定していないすべてのエージェントに適用されるデフォルト出力ガードレール。 | *(なし)* |

---

## よくあるミス

- **エラー境界イベントなし** — ないとガードレール違反が未処理のプロセスエラーになります。ガードレールを使用する場合はAgenticProcessCallに必ず境界イベントをアタッチしてください。
- **エラーコードの誤り** — 出力違反は `smartworkflow:guardrail:output:violation` を使用します。入力違反は `smartworkflow:guardrail:input:violation` です。ガードレールの種別に合ったコードを設定してください。
- **空欄ならガードレールなしだと思い込む** — 空のガードレールフィールドは `AI.Guardrails.DefaultInput` と `DefaultOutput` を継承します。デフォルトのガードレールがテストデータを拒否することがあるため、テストでは特に注意してください。
- **エラーメッセージで判定する** — エラー**コード**で分岐してください。メッセージはSmart Workflowによってラップされており（出力例のとおり内部のアダプタークラス名が含まれます）、安定した契約ではありません。
- **出力ガードレールのリトライを期待する** — リトライは行われません。最初の失敗でレスポンスは破棄され、再プロンプトによる2回目の試行はありません。正当な回答をブロックする出力ガードレールは、その呼び出し全体を無駄にします。

---

## サンプルプロセス

動作する実装はチュートリアルプロジェクトにあります:

- `tutorial/process/tutorial/features/Feature09.p.json` — エージェントプロセス
- `tutorial/dataclass/tutorial/Feature09Data.d.json` — データクラス

Designerでプロセスを開き、`Assistant Agent` 要素を確認してください — `Output Guardrails` フィールドに `["SensitiveDataOutputGuardrail"]` が含まれ、エラー境界イベントがアタッチされています。

---

## 関連項目

- [エージェントの基本設定]
- [Javaツール]
- [呼び出し可能プロセスツール]
- [ウェブ検索ツール]
- [カスタムガードレール]
