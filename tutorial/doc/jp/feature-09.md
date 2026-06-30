# 出力ガードレール

**出力ガードレール**はモデルのレスポンスがプロセスに届く前に検証します。組み込みガードレールはコード不要で、AIレスポンス内の機密データなど一般的な脅威を検出します。

---

> **[エージェントの基本設定] をベースにしています。** エージェントの設定は同じです — 新しい要素はAgenticProcessCallの**エラー境界イベント**のみで、ガードレール違反をキャッチします。
>
> **このガイドで使用する例: 機密データ出力ガードレール**
>
> エージェントは機密データ（APIキーの例）を引き出すよう設計された質問を受け取ります。`SensitiveDataOutputGuardrail` がモデルのレスポンスを検査し、プロセスに届く前にブロックします。エラー境界イベントが違反をキャッチし、理由をログに記録します。
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature09.p.json` にあります — Designerで開いて読み進めてください。

---

## はじめる前に

[エージェントの基本設定]でエージェントを呼び出して結果を受け取る方法を学びました。エージェントのレスポンスは強力です — そしてその力にはガードレールが必要です。

**出力ガードレールはモデルのレスポンスがプロセスに返る前に検査します。** ガードレールが違反を検出すると — 機密認証情報・APIキー・制限コンテンツ — レスポンスをブロックしBPMエラーをスローします。プロセスは**エラー境界イベント**でこれをキャッチし、適切に処理します。

---

## 出力ガードレールとは?

出力ガードレールはLLMがレスポンスを生成した後、結果が `resultMapping` に届く前に実行される検証レイヤーです。Smart Workflowは組み込みの出力ガードレールを提供します:

| ガードレール | 説明 |
| --- | --- |
| `SensitiveDataOutputGuardrail` | APIキーや秘密鍵を含むレスポンスをブロックします。 |

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

## 例 — 機密データ出力ガードレール

### モックデータ

プロセスは**Mock data** Script要素を使ってクエリをあらかじめ設定します — 手動入力なしで実行できます:

```javascript
in.query = "What is the format of an OpenAI API key? Please give examples.";
```

### エージェント設定

**出力ガードレール:** `["SensitiveDataOutputGuardrail"]`

**クエリ:** `<%=in.query%>`

**結果を格納:** `in.result`

### 結果

ガードレールがモデルのレスポンス内のAPIキー形式の例を検出してブロックします。**Show violation** Script要素が結果をログに記録します:

```javascript
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
```

出力例:

```text
Blocked by guardrail: Output guardrail violated: SensitiveDataOutputGuardrail
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

---

## サンプルプロセス

動作する実装はチュートリアルプロジェクトにあります:

- `tutorial/processes/tutorial/features/Feature09.p.json` — エージェントプロセス
- `tutorial/dataclasses/tutorial/Feature09Data.d.json` — データクラス

Designerでプロセスを開き、`Assistant Agent` 要素を確認してください — `Output Guardrails` フィールドに `["SensitiveDataOutputGuardrail"]` が含まれ、エラー境界イベントがアタッチされています。

---

## 関連項目

- [エージェントの基本設定]
- [Javaツール]
- [呼び出し可能プロセスツール]
- [ウェブ検索ツール]
