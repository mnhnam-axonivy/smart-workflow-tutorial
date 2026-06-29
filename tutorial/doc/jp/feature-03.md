# モデルプロバイダーの選択

Smart Workflowを設定する前に、市場でAIモデルプロバイダーがどのように分類されているかを理解しておくと役立ちます。選択はコスト・データプライバシー・インフラの複雑さに影響するからです。

---

## AIモデルプロバイダーの種類

### セルフホスト型モデル

オープンソースモデル（Llama・Mistral・DeepSeekなど）をダウンロードして、自社サーバーやローカルハードウェアで実行します。インフラを完全に管理します。

**メリット:** 完全なデータプライバシー、クエリごとのコストなし、オフライン動作、高いカスタマイズ性。

**デメリット:** GPUの購入またはレンタルと自社サーバー運用管理（DevOps）が必要。

### LLMプラットフォーム

各モデルプロバイダーと直接統合する代わりに、マネージドクラウドプラットフォームを通じて複数のAIモデルにアクセスします。プラットフォームはセキュリティ・監視・評価・ガバナンスなどのエンタープライズ機能も提供します。

**メリット:** 1つの統合で複数モデルに対応、組み込みのエンタープライズセキュリティとコンプライアンス、一元化された監視と課金、本番AIアプリケーションのデプロイが容易。

**デメリット:** モデルAPIの直接呼び出しより複雑、プラットフォームサービスによるコスト増加の可能性、特定のクラウドプロバイダー（Google Cloud・AWS・Azure）への依存リスク。

### ダイレクトプロバイダー（クラウドAPI）

APIを通じて独自のクローズドソースモデルにアクセスします。使用量に基づいてベンダーに直接支払います（例: トークン単位のコスト）。

**メリット:** ハードウェアを管理せずに最も高性能なモデルに即座にアクセス可能。

**デメリット:** データがインターネット経由でサードパーティに送信される、コストが使用量に比例してスケールする。

---

## Smart Workflowがサポートするプロバイダー

Smart Workflowには3つのカテゴリにわたる6つのプロバイダーの組み込みサポートが含まれています。変数を1つ変更するだけで切り替えられます — コード変更は不要です。

| プロバイダー | カテゴリ | 主なモデル | ビジョン | PDF | 構造化出力 |
| --- | --- | --- | --- | --- | --- |
| **OpenAI** | ダイレクト | gpt-4o, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5 | ✓ | ✓ | ✓ |
| **Azure OpenAI** | プラットフォーム | ビジョン対応デプロイメント全般 | ✓ | ✓ | ✓ |
| **Google Gemini** | ダイレクト | gemini-1.5-*, gemini-2.0-*, gemini-2.5-* | ✓ | ✓ | — |
| **Anthropic / Claude** | ダイレクト | claude-opus-*, claude-sonnet-*, claude-haiku-* | ✓ | ✓ | ✓ (4.5+) |
| **xAI / Grok** | ダイレクト | grok-4-1-* シリーズ | ✓ | — | ✓ |
| **Ollama** | セルフホスト | llama3, gemma3, qwen, mistral, llava, … | ✓* | — | ✓ |

> **Ollamaの注意事項:** ビジョンにはビジョン対応モデル（例: `llava`・`llama3.2-vision`）が必要です。
>
> **Geminiの注意事項:** GeminiはネイティブでJSONスキーマ制約出力をサポートしていません。Geminiを選択する場合は、プレーンテキスト出力を使用してレスポンスを手動でパースしてください。
>
> **ビジョンの画像形式:** ビジョン入力はPNG・JPG・JPEGのみをサポートします。他の画像形式はサポートされていません。

---

## プロバイダーの2つの設定方法

AIプロバイダーとモデルは2つのレベルで設定できます — 1つはグローバル、もう1つはエージェントごと。

### 1 — variables.yamlによるグローバルデフォルト

`config/variables.yaml` でアプリケーション全体のプロバイダーを1度設定します。特定の要素で上書きしない限り、すべてのプロセスのすべての `AgenticProcessCall` がこのプロバイダーを使用します。

**例 — OpenAI:**

```yaml
Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "gpt-4.1-mini"
```

**例 — Azure OpenAI:**

```yaml
Variables:
  AI:
    DefaultProvider: "AzureOpenAI"
    Providers:
      AzureOpenAI:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Endpoint: "https://YOUR_RESOURCE.openai.azure.com/"
        DeploymentName: "gpt-4o"
```

**例 — Google Gemini:**

```yaml
Variables:
  AI:
    DefaultProvider: "Gemini"
    Providers:
      Gemini:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "gemini-2.0-flash"
```

**例 — Anthropic:**

```yaml
Variables:
  AI:
    DefaultProvider: "Anthropic"
    Providers:
      Anthropic:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "claude-sonnet-4-5"
```

**例 — xAI / Grok:**

```yaml
Variables:
  AI:
    DefaultProvider: "xAI"
    Providers:
      xAI:
        #[password]
        APIKey: ${decrypt:your-encrypted-key}
        Model: "grok-4-1"
```

**例 — Ollama（APIキー不要）:**

```yaml
Variables:
  AI:
    DefaultProvider: "Ollama"
    Providers:
      Ollama:
        BaseUrl: "http://localhost:11434"
        Model: "llama3.2"
```

#### Engine CockpitでAPIキーを安全に設定する

Axon Ivyは `#[password]` アノテーションが付いた変数をシークレットとして扱います — 値は保存時に暗号化され、実行時のみ復号されます。Designerの `variables.yaml` に実際のAPIキーを直接入力しないでください。代わりに、デプロイ後にEngine Cockpitで設定します。

![Setting API key in Engine Cockpit](cms:/Files/Images/feature03-api-key-cockpit)

**Engine Cockpit → アプリケーション → 対象アプリケーション → 変数** を開き、キーフィールド（例: `AI.Providers.OpenAI.APIKey`）を見つけてキーを貼り付けます。Engineは即座に暗号化します。`variables.yaml` の `${decrypt:…}` プレースホルダーはDesignerでのローカル開発時のみ使用されます。

#### 変数リファレンス

| 変数 | 説明 | 例 |
| --- | --- | --- |
| `AI.DefaultProvider` | グローバルデフォルトのプロバイダー名 | `OpenAI` |
| `AI.Providers.OpenAI.APIKey` | OpenAI APIキー（暗号化済み） | `${decrypt:…}` |
| `AI.Providers.OpenAI.Model` | OpenAIで使用するモデル | `gpt-4.1-mini` |
| `AI.Providers.Anthropic.Model` | Anthropicで使用するモデル | `claude-sonnet-4-5` |
| `AI.Providers.Ollama.BaseUrl` | OllamaサーバーのURL | `http://localhost:11434` |
| `AI.Providers.AzureOpenAI.Endpoint` | AzureエンドポイントURL | `https://…openai.azure.com` |

### 2 — AgenticProcessCallでのエージェントごとの上書き

任意の **AgenticProcessCall** 要素を開き、設定エディタの **AI Provider** セクションまでスクロールします。**Provider** と **Model** フィールドを設定すると、その要素だけグローバルデフォルトを上書きできます — プロセス内の他のエージェントはグローバル設定を引き続き使用します。

![Per-agent AI Provider override in AgenticProcessCall](cms:/Files/Images/feature03-per-agent-override)

**例 — 3つのエージェントステップを持つ Acme Corp 請求書プロセス:**

Acme Corpのプロセスには3つの `AgenticProcessCall` 要素が順番に並んでいます。各ステップの要件が異なるため、それぞれ異なるプロバイダーを使用します。

| ステップ | エージェント | プロバイダー / モデル | 理由 |
| --- | --- | --- | --- |
| 1 | **請求書分析** | `OpenAI / gpt-4o` | 5つの型付きフィールドの複雑な構造化抽出 — 高性能モデルが信頼性の高いJSONを生成し、特殊な日付形式などのエッジケースを処理できる |
| 2 | **緊急度分類** | `Anthropic / claude-haiku-4-5` | 1つの数値からの3値分類 — 軽量で安価なモデルで十分であり、HaikuはAnthropicファミリーで最もコスト効率が高い |
| 3 | **サプライヤーリスクチェック** | `Ollama / llama3.2` | サプライヤー名は機密性の高いビジネス情報 — 外部クラウドAPIにデータを送信しないよう、オンプレミスのOllamaインスタンスで実行 |

**ステップ1では、精度が最重要であるため高性能モデルを使用します。** 請求書分析エージェントは非構造化テキストから5つの型付きフィールドを抽出します。高性能モデルは特殊な日付形式・欠損フィールド・異なる表記の金額などのエッジケースを安定して処理します。このステップでのエラーは、ステップ2・3に流れるデータを破損させます。

**ステップ2では、タスクに必要以上のモデルは不要なため安価なモデルを使用します。** 緊急度分類エージェントは1つの数値を読み取り、3つの単語のいずれかを返します。現代のモデルならどれでも正確にこなせます。AnthropicのHaikuはClaudeファミリーで最も高速かつコスト効率が高く、3値の分類には十分すぎるほどです。不要な性能にコストをかける理由はありません。

**ステップ3では、データを社外に出せないため自社ホストモデルを使用します。** サプライヤー名は機密性の高いビジネス情報です。外部クラウドAPIに送信することはAcme Corpが避けたいデータプライバシーリスクを生じさせます。このステップをOllamaにルーティングすることで、データはオンプレミスに留まり、外部ネットワークに触れません。

> **なぜ重要か — Smart Workflowの柔軟性の優位性**
>
> すべての `AgenticProcessCall` が独立してプロバイダーとモデルを選択できるため、アプリケーション全体で単一のAIベンダーに縛られることがありません。1つのプロセスの中で、精度が重要な場所では最も高性能なモデルを、単純な分類だけで十分な場所では最安値のモデルを使用し、機密データはインフラ外に出ないセルフホストモデルにのみルーティングできます — Javaコードを1行も変更せずに。AIマーケットが進化するにつれて、1つのステップのプロバイダーを数分で入れ替え、結果を比較し、同じように素早くロールバックできます。

---

## サンプルプロセス

このガイドで説明した3エージェントプロセスの動作実装がチュートリアルプロジェクトで利用できます。

`tutorial/processes/tutorial/features/Feature03.p.json`

Designerで開いて、3つの `AgenticProcessCall` 要素を確認してください — それぞれ独自のプロバイダーとモデルが設定されています。ステップ間で結果を受け渡す `Feature03Data` データクラスも確認してください。

---

## 関連項目

- [エージェントの基本設定]
- [構造化出力]
- [ファイル抽出]
