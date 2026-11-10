# 観測可能性

エージェントを実際のプロセスで動かすと、エージェントが何をしたかを把握する必要が出てきます — どのケースでAIが使われたか、各エージェントが何を尋ねられ何を答えたか、どのツールを呼び出したか、コストはいくらか、どのガードレールが作動したか。Smart Workflowはこれを **アプリケーションレベル** で提供します — すべてのエージェントが自動的に対象となり、エージェント設定の変更も追加のコードも不要です。

---

> **[エージェントの基本設定] をベースにしています。** エージェントの設定は変更しません — 観測可能性は変数で有効化され、アプリケーション内のすべてのエージェントに適用されます。
>
> **このガイドで使用する例:** チャネルを有効にした後、任意のチュートリアルプロセス — 例えば `Feature01.p.json`（請求書要約）や `Feature09.p.json`（出力ガードレール）— を実行し、各セクションの説明に従って結果を確認します。

---

## 3つの観測チャネル

Smart Workflowは3つの独立したチャネルを提供します。それぞれ異なる問いに答えます。

| チャネル | 答える問い | 変数 | デフォルト |
| --- | --- | --- | --- |
| **AI利用マーカー** | このケースやタスクにAIが関与したか？ | `AI.Observability.CustomFields.Enabled` | オン |
| **Ivyでの会話記録** | 各エージェントが何を発言し、何を呼び出し、何をブロックしたか？ | `AI.Observability.Ivy.Enabled` | オフ |
| **Arize Phoenixトレース** | 各呼び出しの内部で何が起きたか — プロンプト、ツール、トークン、コスト？ | `AI.Observability.Openinference.Enabled` | オフ |

3つを組み合わせると効果的です: マーカーで *どの* ケースにAIが関与したかが分かり、残りの2つでその中で *何が起きたか* が分かります。開発中は `config/variables.yaml` で、稼働中のエンジンでは **Engine Cockpit** の **Variables** で変数を設定します。

---

## AI利用マーカー

タスクまたはケースのコンテキストでエージェントが実行されると、Smart Workflowはそのタスク・ケースにカスタムフィールドを書き込みます。

| フィールドキー | 型 | ラベル | 対象 | 値 |
| --- | --- | --- | --- | --- |
| `aiAssisted` | STRING | AI-assisted | Task, Case | `SMART_WORKFLOW` |

これは **デフォルトでオン** になっている唯一のチャネルです。外部プラットフォームなしで、AIが関与した作業をワークフローデータから直接見つけられます — 例えばタスクリストの絞り込みや、AIを使用したケース数のレポートなどに使えます。

無効にするには:

```yaml
Variables:
  AI:
    Observability:
      CustomFields:
        Enabled: "false"
```

---

## Ivyでの会話記録

Smart Workflowは、すべてのエージェントの会話を永続的な **ガバナンス監査** 記録としてIvyリポジトリに記録できます。外部プラットフォームは不要です。

```yaml
Variables:
  AI:
    Observability:
      Ivy:
        # Enable chat history recording for governance audit.
        Enabled: "true"
```

チュートリアルプロジェクトでは、[ガバナンスダッシュボード] にデータが表示されるよう、`tutorial/config/variables.yaml` でこのチャネルをすでに有効にしています。

各会話は現在のケースとタスクに紐づけて、エージェントの **要素名** の下に保存され、4種類のエントリを記録します。

- **エージェントの応答** — モデルが返した内容（モデル名・トークン数・処理時間・使用されたtemperatureを含む）
- **ツールの実行** — 実行されたツールとその引数・結果
- **入力ガードレール** の評価
- **出力ガードレール** の評価

記録は要素名でグループ化されるため、すべての `AgenticProcessCall` にはデフォルト名のままにせず、`Invoice Summary Agent` のような意味のある名前を付けてください。

これらの記録をWeb UIで閲覧・絞り込み・分析するには、[ガバナンスダッシュボード] を使用します。

> **注意:** これはプロンプト・応答・ツール引数の永続的な記録です。保持期間を決める際は他の個人データ保存先と同様に扱ってください。また、記録を後から消去するよりも、[PIIマスキングガードレール] で個人データをモデルに届く *前に* マスキングすることを推奨します。

---

## Arize Phoenixによるトレース

[Arize Phoenix](https://phoenix.arize.com/) はLLMアプリケーション向けのオープンソースのトレースプラットフォームです。Smart Workflowはすべてのエージェント呼び出しを **OpenInference** トレースとしてエクスポートするため、Phoenixで各プロンプト・ツール呼び出し・トークン数・コストを確認でき、実際のリクエストを別のモデルやプロンプトで再実行することもできます。

### Step 1 — Arize Phoenixを起動する

DockerでPhoenixをローカル起動します。

```bash
docker run --rm -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:nightly
```

または `compose.yml` を作成し、`docker compose up` で起動します。

```yaml
services:
  phoenix:
    image: arizephoenix/phoenix:nightly
    ports:
      - "6006:6006"
      - "4317:4317"
```

[http://localhost:6006](http://localhost:6006) を開いて起動していることを確認します。

### Step 2 — エンジンの送信先をPhoenixに設定する

**VS Codeの場合**、設定を開いて *Axon Ivy* を検索し、**AxonIvy › Engine: VM args** に次を設定します。

```text
-Dotel.traces.exporter=otlp -Dotel.exporter.otlp.endpoint=http://localhost:6006 -Dotel.resource.attributes=openinference.project.name=smart-workflow
```

その後、ウィンドウを再読み込みします（**Developer: Reload Window**）。

**スタンドアロンエンジンの場合**、同じオプションを `configuration/jvm.options` に追加し、エンジンを再起動します。

```properties
# OpenTelemetry -> Arize Phoenix
-Dotel.traces.exporter=otlp
-Dotel.exporter.otlp.endpoint=http://localhost:6006
-Dotel.resource.attributes=openinference.project.name=smart-workflow
```

### Step 3 — エクスポートを有効にする

```yaml
Variables:
  AI:
    Observability:
      Openinference:
        Enabled: "true"
```

チュートリアルプロセスを実行すると、Phoenixの **smart-workflow** プロジェクトにトレースが表示されます。

### LLM呼び出しを探す

Phoenixで **smart-workflow** プロジェクトを開き、フィルター `span_kind == 'LLM'` を入力し、フィルターバー横の **Root Spans** を **All** に切り替えます。

すべてのスパンにはIvyのケースとタスクのUUIDが付与されているため、1つのビジネスケースのAI活動をすべて追跡できます。

```text
span_kind == 'LLM' and ivy.case == '6407c9bd-be10-4334-9ca9-c9b846fc1f57'
span_kind == 'LLM' and ivy.task == '2afa6db6-35d6-4f72-af05-711963888b0b'
```

### 呼び出しパラメータ

Smart Workflow 14.0.0 から、エージェントの呼び出しに使われたモデル設定がLLMスパンの `llm.invocation_parameters` に記録されます。エージェントに **Temperature** を設定した場合（[高度なモデル設定] を参照）、モデルが実際に受け取った値をここで確認できます — 出力のばらつきが想定より大きい・小さい場合に役立ちます。

### メッセージ内容を非表示にする

トレースにはデフォルトでプロンプトと応答の全文が含まれます。内容の機密性が高くエクスポートできない場合は、除外します。

```yaml
Variables:
  AI:
    Observability:
      Openinference:
        Enabled: "true"
        HideInputMessages: "true"   # システムメッセージとユーザーメッセージを除外
        HideOutputMessages: "true"  # 応答と、応答が要求したツール呼び出しを除外
```

スパンの残りの部分は変わりません — モデル名・トークン数・ケースとタスクのIDは引き続き記録されるため、コストや利用状況のレポートはそのまま機能します。

---

## ガードレールの記録

すべてのガードレール評価は、Ivyの会話履歴とPhoenixの両方に記録されます。

| | Ivyの会話履歴 | Arize Phoenix |
| --- | --- | --- |
| 記録場所 | ツール実行と並ぶガードレールエントリ | `openinference.span.kind = "GUARDRAIL"` の専用スパン |
| ガードレール | `guardrailName` | `validator_name` |
| 入力か出力か | `type` — `INPUT` / `OUTPUT` | `guardrail.type` |
| 結果 | `result` — `SUCCESS` / `FAILURE` / `FATAL` | `guardrail.result` |
| ブロック理由 | `failureMessage` | `guardrail.failure_message` |

これにより、どのメッセージがなぜブロックされたかを後から証明できます — [出力ガードレール]・[入力ガードレール]・[PIIマスキングガードレール] を参照してください。[サーキットブレーカー] も同じ方法で、ガードレール名 `CircuitBreakerGuardrail` として記録されます。

---

## 設定リファレンス

| 変数 | 説明 | デフォルト |
| --- | --- | --- |
| `AI.Observability.CustomFields.Enabled` | ケースとタスクに `aiAssisted` カスタムフィールドを付与します。 | `"true"` |
| `AI.Observability.Ivy.Enabled` | ガバナンス監査のため、すべての会話をIvyリポジトリに記録します。 | オフ |
| `AI.Observability.Openinference.Enabled` | OpenInferenceトレースをArize Phoenixにエクスポートします。 | オフ |
| `AI.Observability.Openinference.HideInputMessages` | エクスポートするトレースからプロンプトを除外します。 | オフ |
| `AI.Observability.Openinference.HideOutputMessages` | エクスポートするトレースから応答を除外します。 | オフ |

詳細なリファレンスは [Smart Workflow 観測可能性ガイド](https://github.com/axonivy-market/smart-workflow/blob/master/doc/user/observability.md) を参照してください。

---

## よくあるミス

- **Phoenixにトレースが表示されない** — `-Dotel…` のJVMオプション *と* `AI.Observability.Openinference.Enabled: "true"` の両方が必要です。JVMオプションはエンジン（またはVS Codeウィンドウ）の再起動後に有効になります。
- **ルートスパンしか表示されない** — LLM呼び出しは子スパンです。Phoenixの表示を **Root Spans** から **All** に切り替えてください。
- **会話が記録されない** — `AI.Observability.Ivy.Enabled` はデフォルトでオフです。AI利用マーカーと異なり、明示的に有効にする必要があります。
- **トレースに機密データが含まれる** — `HideInputMessages` / `HideOutputMessages` を設定しない限り、Phoenixはプロンプトと応答の全文を受け取ります。

---

## 関連項目

- [エージェントの基本設定]
- [高度なモデル設定]
- [出力ガードレール]
- [サーキットブレーカー]
- [ガバナンスダッシュボード]
