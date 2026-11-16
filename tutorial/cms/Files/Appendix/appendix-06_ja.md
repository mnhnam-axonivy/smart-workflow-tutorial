# クイックリファレンス

Smart Workflow 14.0.0 の早見表です。各プロバイダーがサポートする機能、すべての `AI.*` 変数、エージェントが発生させるすべてのBPMエラーをまとめています。各トピックの説明はフィーチャーガイドにあり、このページは名前やデフォルト値を確認するためのものです。

---

## プロバイダーの機能

| プロバイダー | カテゴリ | PNG / JPEG | PDF | 構造化出力 | 埋め込み |
| --- | --- | :---: | :---: | :---: | :---: |
| **OpenAI** | ダイレクトクラウドAPI | ✓ | ✓ | ✓ | ✓ |
| **Azure OpenAI** | マネージドプラットフォーム | ✓ | ✓ | ✓ | — |
| **Gemini** | ダイレクトクラウドAPI | ✓ | ✓ | — | — |
| **Anthropic** | ダイレクトクラウドAPI | ✓ | ✓ | ✓ | — |
| **xAI** | ダイレクトクラウドAPI | ✓ | — | ✓ | — |
| **Ollama** | セルフホスト | ✓ | — | ✓ *（ツール併用時は不可）* | ✓ |

> **重要:** この表は知識であり、強制される契約ではありません。Smart Workflowは画像やPDFのコンテンツを無条件に組み立て、リクエストの送信前には何もチェックしません。サポートされない組み合わせは**プロバイダー側で**、プロバイダー自身のエラーメッセージとともに失敗します。

**プロバイダーごとの注意点**

- **Azure OpenAI** — デプロイメントで何ができるかは、名前ではなく、その背後にあるモデルで決まります。ファイル抽出にはビジョン対応モデルを使用してください。
- **Gemini** — 構造化出力には対応していません。型付きの結果を要求しても失敗はせず、Smart Workflowはエラーをログに記録して、応答のベストエフォートなパースにフォールバックします。プレーンテキスト出力を推奨します。
- **xAI** — PDFには対応していません。先にPDFを画像に変換してください。
- **Ollama** — 画像にはビジョン対応モデルが必要です（`ollama pull llava`）。PDFには対応していません。スキーマとツールは同じリクエストに含められないため、エージェントがツールを持つ場合、スキーマは通知なしで外されます。
- **ファイルサイズ** — ファイルはbase64エンコードされます（約3分の1大きくなります）。Smart Workflow自体にサイズ制限はなく、プロバイダーのリクエスト上限が適用されます。

### モデル

各プロバイダーの `DefaultModel` の一覧に基づいています。一覧にない名前も拒否されませんが、動作は保証されません。

| プロバイダー | モデル |
| --- | --- |
| **OpenAI** | `gpt-4o`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-5` |
| **Azure OpenAI** | リソース内の任意のデプロイメント |
| **Gemini** | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-exp`, `gemini-1.5-pro`, `gemini-1.5-flash` |
| **Anthropic** | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-1`, `claude-opus-4-0`, `claude-sonnet-4-0` |
| **xAI** | `grok-4-1-fast`, `grok-4-1-mini`, `grok-4-1-large`, `grok-4-1-max` と、それぞれの `-code` バリアント |
| **Ollama** | インスタンスにpullした任意のモデル（`llama3.2`, `gemma3:27b`, `qwen3:30b`, `llava` など） |

埋め込みモデル: OpenAIは `text-embedding-3-small`・`text-embedding-3-large`・`text-embedding-ada-002` を提供しています。Ollamaでは、`nomic-embed-text` や `mxbai-embed-large` などの専用の埋め込みモデルをpullしてください。

[モデルプロバイダーの選択]、[ファイル抽出]、[構造化出力] を参照してください。

---

## 変数

すべての設定は `AI` 配下にあり、**Engine Cockpit** の **Variables** で設定します。変数はインストールしたプロジェクトによって宣言されており、設定するのはその値です。

> **注意:** 変数は**エージェント呼び出しのたびに**読み取られます。プロバイダー、キー、モデル、スイッチの変更は、再起動なしで次の呼び出しから有効になります。
>
> 🔒 の付いた変数はシークレットです。`variables.yaml` には `${decrypt:}` を残し、実際の値はEngine Cockpitで設定してください。Engine Cockpitが入力時に暗号化します。

### コア

| 変数 | デフォルト | 目的 |
| --- | --- | --- |
| `AI.DefaultProvider` | *(空)* | プロバイダーを指定していないエージェントが使用するプロバイダー: `OpenAI`・`AzureOpenAI`・`Gemini`・`xAI`・`Anthropic`・`Ollama`。 |
| `AI.CircuitBreaker.Enabled` | `"false"` | `"true"` にすると、アプリケーション内の**すべての**エージェント呼び出しが停止します。[サーキットブレーカー] を参照。 |

### プロバイダー

| 変数 | 🔒 | 目的 |
| --- | :---: | --- |
| `AI.Providers.OpenAI.APIKey` | 🔒 | OpenAIのAPIキー。 |
| `AI.Providers.OpenAI.BaseUrl` | | APIエンドポイントを上書きします。空の場合はベンダーのデフォルト。 |
| `AI.Providers.OpenAI.DefaultModel` | | エージェントがモデルを指定しない場合に使用するモデル。 |
| `AI.Providers.OpenAI.DefaultEmbeddingModel` | | RAGで使用する埋め込みモデル。 |
| `AI.Providers.AzureOpenAI.Endpoint` | | Azure OpenAIリソースのURL。 |
| `AI.Providers.AzureOpenAI.DefaultDeployment` | | エージェントがモデルを指定しない場合に使用するデプロイメント。 |
| `AI.Providers.AzureOpenAI.Deployments.<name>.Model` | | そのデプロイメントの背後にあるモデル。 |
| `AI.Providers.AzureOpenAI.Deployments.<name>.APIKey` | 🔒 | そのデプロイメントのキー。Azureにはプロバイダーレベルのキーはありません。 |
| `AI.Providers.Gemini.APIKey` | 🔒 | Google GeminiのAPIキー。 |
| `AI.Providers.Gemini.BaseUrl` / `DefaultModel` | | OpenAIと同様。 |
| `AI.Providers.Anthropic.APIKey` | 🔒 | AnthropicのAPIキー。 |
| `AI.Providers.Anthropic.BaseUrl` / `DefaultModel` | | OpenAIと同様。 |
| `AI.Providers.xAI.APIKey` | 🔒 | xAIのAPIキー。 |
| `AI.Providers.xAI.BaseUrl` / `DefaultModel` | | OpenAIと同様。 |
| `AI.Providers.Ollama.BaseUrl` | | Ollamaサーバー（例: `http://localhost:11434`）。APIキーは不要。 |
| `AI.Providers.Ollama.DefaultModel` | | インスタンスにpullした任意のモデル。 |
| `AI.Providers.Ollama.DefaultEmbeddingModel` | | 例: `nomic-embed-text`。 |
| `AI.Providers.Ollama.TimeoutSeconds` | | デフォルトは `"300"`。CPU上のローカルモデルは数分かかることがあります。 |

### ガードレール

| 変数 | デフォルト | 目的 |
| --- | --- | --- |
| `AI.Guardrails.DefaultInput` | *(空)* | ガードレールを選択していないすべてのエージェントに適用する入力ガードレール（カンマ区切り）。 |
| `AI.Guardrails.DefaultOutput` | *(空)* | ガードレールを選択していないすべてのエージェントに適用する出力ガードレール（カンマ区切り）。 |
| `AI.Guardrails.PromptInjection.Classifier.Provider` | *(空)* | `AiPromptInjectionInputGuardrail` 分類器のプロバイダー。空の場合は `AI.DefaultProvider`。 |
| `AI.Guardrails.PromptInjection.Classifier.Model` | *(空)* | 分類器用に安価なモデル（例: `gpt-4.1-nano`）を固定します。空の場合はプロバイダーのデフォルト。 |
| `AI.Guardrails.PromptInjection.Classifier.SystemPrompt` | *(空)* | 分類器のカスタムプロンプト。`YES` または `NO` だけで回答するよう指示する必要があります。 |
| `AI.Guardrails.PromptInjection.Classifier.MinLength` | `"0"` | この文字数より短いメッセージではLLM呼び出しをスキップします。 |

### ウェブ検索

| 変数 | デフォルト | 目的 |
| --- | --- | --- |
| `AI.Tool.WebSearch.Engine` | `duckduckgo` | 検索エンジンの名前。空の場合は最初に利用可能なエンジン。 |
| `AI.Tool.WebSearch.MaxResults` | *(空)* | クエリごとの結果数。空の場合は `5`。 |
| `AI.Tool.WebSearch.WhitelistDomains` | *(空)* | 許可するドメイン（カンマ区切り）。空の場合はすべて許可。 |

### RAG

| 変数 | デフォルト | 目的 |
| --- | --- | --- |
| `AI.RAG.MaxResults` | `"5"` | クエリごとに返すセグメント数。エージェントが呼び出しごとに上書きできます。 |
| `AI.RAG.MinScore` | `"0.6"` | 類似度のしきい値（0.0〜1.0）。エージェントが呼び出しごとに上書きできます。 |
| `AI.RAG.ChunkSize` | `"300"` | インジェスト時のチャンクサイズ（**文字数**）。新しいドキュメントにのみ適用されます。 |
| `AI.RAG.ChunkOverlap` | `"20"` | 連続するチャンク間の重複（文字数）。 |
| `AI.RAG.EmbeddingModel.Provider` | *(空)* | 埋め込みをサポートしている必要があります（OpenAIまたはOllama）。空の場合は `AI.DefaultProvider`。 |
| `AI.RAG.EmbeddingModel.Name` | *(空)* | 空の場合はプロバイダーの `DefaultEmbeddingModel`。 |
| `AI.RAG.EmbeddingModel.ApiKey` 🔒 | *(空)* | 埋め込み呼び出し用の別のキー（任意）。 |
| `AI.RAG.OpenSearch.Url` | *(空)* | OpenSearchサーバーのベースURL。 |
| `AI.RAG.OpenSearch.ApiKey` 🔒 | *(空)* | Basic認証を使用する場合やセキュリティが無効の場合は空のままにします。 |
| `AI.RAG.OpenSearch.UserName` | *(空)* | Basic認証のユーザー。 |
| `AI.RAG.OpenSearch.Password` 🔒 | *(空)* | Basic認証のパスワード。 |
| `AI.RAG.OpenSearch.TrustSelfSignedCertificates` | `"false"` | 開発・テスト専用。 |

### 観測可能性

| 変数 | デフォルト | 目的 |
| --- | --- | --- |
| `AI.Observability.CustomFields.Enabled` | `"true"` | ケースとタスクに `aiAssisted` カスタムフィールドを付けます。**デフォルトでオン。** |
| `AI.Observability.Ivy.Enabled` | オフ | すべての会話をIvyリポジトリに記録します。[ガバナンスダッシュボード] に必要です。 |
| `AI.Observability.Openinference.Enabled` | オフ | OpenInferenceトレースをArize Phoenixにエクスポートします。 |
| `AI.Observability.Openinference.HideInputMessages` | オフ | エクスポートするトレースからプロンプトを除外します。 |
| `AI.Observability.Openinference.HideOutputMessages` | オフ | エクスポートするトレースからレスポンスを除外します。 |

[観測可能性] を参照してください。

---

## エラーコード

Smart Workflowが `AgenticProcessCall` 要素で発生させるすべてのBPMエラーです。それぞれ原因の異なる別々のコードで、境界イベントがキャッチするのはそのうちの1つだけです。取り違えは「エラーハンドラーが実行されない」原因としてよくあります。

| エラーコード | 発生する条件 | ガイド |
| --- | --- | --- |
| `smartworkflow:guardrail:input:violation` | 入力ガードレールが、モデルに届く前のユーザーメッセージをブロックした。 | [入力ガードレール] |
| `smartworkflow:guardrail:output:violation` | 出力ガードレールが、モデルのレスポンスをブロックした。 | [出力ガードレール] |
| `smartworkflow:stop` | サーキットブレーカーがオンで、呼び出しが拒否された。 | [サーキットブレーカー] |
| *独自のコード* | ヒューマンインザループのツールが、エージェントをサスペンドするために `BpmError` をスローした。コードは自分で決めます。チュートリアルでは `human:decision` を使用しています。 | [ヒューマンインザループ] |

### キャッチする方法

1. `AgenticProcessCall` 要素に**エラー境界イベント**を追加します。
2. キャッチしたいエラーコードを設定します。
3. フォールバック（分かりやすいメッセージ、監査記録、AIを使わないルートなど）をモデリングします。

```java
in.result = in.error.getMessage();
```

> **重要:** メッセージのテキストではなく、必ず**エラーコード**で分岐してください。ガードレール違反の場合、メッセージはSmart Workflowによってラップされており（自分のガードレールではなく内部のアダプタークラス名が含まれます）、その形式は安定した契約ではありません。

### エラーコードのない問題

すべての問題がBPMエラーになるわけではありません。スキップされた呼び出し、マッピングできなかった結果、除外されたファイルは、ログの1行だけを残すか、何も残しません。これらのケースは [トラブルシューティング] にまとめています。

---

## エディターのフィールド

14.0.0の `AgenticProcessCall` 設定エディターのフィールドと、プロセスファイル内での名前です。

| グループ | フィールド | 保存名 | 空の場合 |
| --- | --- | --- | --- |
| Message | **System message** | `system` | エージェントは常時適用の指示なしで実行されます |
| Message | **User message** | `query` | エージェント呼び出しがスキップされます |
| 🛠️ Tools | **Available tools** | `tools` | ツールなし |
| 🛡️ Guardrails | **Input guardrails** | `inputGuardrails` | アプリケーションのデフォルトが適用されます |
| 🛡️ Guardrails | **Output guardrails** | `outputGuardrails` | アプリケーションのデフォルトが適用されます |
| 🧠️ Model | **Provider** | `provider` | `AI.DefaultProvider` |
| 🧠️ Model | **Model** | `model` | プロバイダーの `DefaultModel` |
| 🧠️ Model | **Temperature** | `temperature` | `0.0` |
| Output | **Expect result of type** | `resultType` | プレーンテキスト（`String`） |
| Output | **Map result to** | `resultMapping` | 結果は保存されません |

---

## 関連項目

- [主要コンセプト]
- [トラブルシューティング]
- 上流の完全なリファレンス: [Smart Workflow ドキュメント](https://github.com/axonivy-market/smart-workflow/blob/master/README.md)
