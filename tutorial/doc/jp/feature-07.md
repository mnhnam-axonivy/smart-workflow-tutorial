# Web Search ツール

**Web Search ツール** （`webSearch`）は、エージェントにライブのインターネットデータへのアクセスを与える組み込みツールです。呼び出し可能プロセスツールやJavaツールとは異なり、実装は一切不要です — エージェントのToolsリストに `"webSearch"` を追加するだけで使用できます。

---

> **[Javaツール] をベースにしています。** エージェント設定は同じです — 違いは `webSearch` がフレームワークによってすでに登録されているため、実装ステップが不要な点だけです。
>
> **このガイドで使用する例: Axon Ivy ドキュメント検索**
>
> エージェントが検索クエリを受け取り、`webSearch` を呼び出してインターネットから最新の結果を取得し、ソースURLを引用しながら結果を簡潔な段落にまとめて返します。
>
> ![Example process](cms:/Files/Images/feature07-00)
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature07.p.json` にあります。Designerで開いて読み進めてください。

---

## はじめる前に

[呼び出し可能プロセスツール] と [Javaツール] では、エージェントを自社のビジネスロジック — データベースクエリ・計算・ワークフローアクション — に接続する方法を見ました。

**Web Search ツールはそれとは異なり、エージェントをライブのインターネットに接続します。** LLMはトレーニング時点で凍結されています。現在のイベント・最新のソフトウェアリリース・ライブドキュメント・最近のニュースに関する質問は、トレーニングデータだけでは信頼できる回答が得られません。`webSearch` はエージェントがリアルタイムでウェブを検索し、最終回答を生成する前に取得した結果で推論できるようにすることで、この問題を解決します。

使用すべき場面:

- 頻繁に変化する情報（リリースノート・価格・ニュース）が必要な場合
- サポートエージェントが最新ドキュメントや既知の問題を検索する必要がある場合
- リサーチエージェントが引用ソースで回答を裏付ける必要がある場合
- ユーザーの質問がLLMのトレーニングカットオフ以降のものである場合

---

## webSearch ツールとは？

`webSearch` はSmart Workflowに組み込まれた `SmartWorkflowTool` です。単一の `query` パラメータを受け取り、設定された検索エンジンで実行し、オプションのドメインホワイトリストフィルターを適用して、タイトル・URL・コンテンツスニペットを含む構造化された結果を返します。

| プロパティ | 値 |
|---|---|
| **ツール名** | `webSearch` |
| **パラメータ** | `query`（String）— 検索クエリ |
| **デフォルトエンジン** | DuckDuckGo — APIキー不要 |
| **設定** | `AI.Tool.WebSearch.*` 配下の `variables.yaml` |

このツールはフレームワークによって起動時にグローバルに登録されます — プロジェクトにSPI登録やJavaクラスは不要です。

---

## なぜ使うのか？

- **最新データ** — LLMにはトレーニングカットオフがあります。ウェブ検索でエージェントにライブ情報へのアクセスを与えます
- **セットアップ不要** — DuckDuckGoはすぐに使えます。外部サービスやAPIキーは不要です
- **ソース引用** — エージェントがURLを参照できるため、回答が検証可能になります
- **ドメインホワイトリスト** — 信頼できるドメインのみに結果を制限できます（例: `developer.axonivy.com`）
- **カスタムエンジン** — `SmartWebSearchEngineProvider` SPIで任意の検索バックエンドを接続できます

---

## Step 1 — Toolsリストに webSearch を追加する

`AgenticProcessCall` の設定で、**Tools** フィールドに `"webSearch"` を追加します。

```json
["webSearch"]
```

必要な変更はこれだけです。ツールはフレームワークによってすでに実装・登録されています。

---

## Step 2 — いつ検索するかをエージェントに指示する

システムプロンプトで指示しなければ、エージェントはツールを使用しません。明確なガイダンスを追加してください。

```text
You are a research assistant.
Use the webSearch tool to look up current information on the internet.
Always cite the source URL for each fact you use.
Summarise the results in a clear, concise paragraph.
```

具体的に記述してください: ツール名を明示し、いつ呼び出すかを伝え、どの形式で返すかを説明してください。この指示がなければ、LLMはトレーニングデータから回答してツールを完全に無視する可能性があります。

---

## Step 3 — 検索動作を設定する（オプション）

プロジェクトの `variables.yaml` に以下の変数を追加して検索動作を制御します。

```yaml
Variables:
  AI:
    Tool:
      WebSearch:
        # Search engine: "duckduckgo" (default) or name of a custom SmartWebSearchEngine
        Engine: "duckduckgo"
        # Maximum results returned per query
        MaxResults: "5"
        # Restrict results to these domains (empty = all domains allowed)
        WhitelistDomains: ""
```

これらの変数が設定されていない場合、デフォルトが適用されます: DuckDuckGo・5件の結果・ドメインフィルターなし。

---

## 例 — Axon Ivy ドキュメント検索

### Mock data

プロセスは **Mock data** Script要素を使って検索クエリをあらかじめ設定します。

```javascript
in.query = "What are the latest features in Axon Ivy 14?";
```

### システムプロンプト

```text
You are a research assistant.
Use the webSearch tool to look up current information on the internet.
Always cite the source URL for each fact you use.
Summarise the results in a clear, concise paragraph.
```

**クエリ:** `<%=in.query%>`

**Tools:** `["webSearch"]`

**結果のマッピング先:** `in.searchResult`

### 結果

エージェント要素の後、`in.searchResult` はエージェントが合成した回答を含むプレーンなStringになります。**Show result** Script要素がAxon Ivy Runtime Logに記録します。

```javascript
ivy.log.error(in.searchResult);
```

出力例:

```text
Axon Ivy 14 introduces Smart Workflow — an AI agent framework built directly into the
process engine. Key features include AgenticProcessCall for embedding LLM agents in
processes, support for six AI providers (OpenAI, Anthropic, Ollama, Mistral, Gemini,
Azure OpenAI), callable process tools, Java tools, web search, guardrails, and
observability via Arize Phoenix. Source: https://developer.axonivy.com/release-notes/14.0
```

---

## 設定リファレンス

| 変数 | 説明 | デフォルト |
|---|---|---|
| `AI.Tool.WebSearch.Engine` | 検索エンジン名。空 = 最初に利用可能なもの。 | `duckduckgo` |
| `AI.Tool.WebSearch.MaxResults` | クエリごとの最大結果数。 | `5` |
| `AI.Tool.WebSearch.WhitelistDomains` | カンマ区切りの許可ドメイン。空 = すべて許可。 | *空* |

---

## よくあるミス

- **エージェントがツールを無視する** — システムプロンプトで `webSearch` を呼び出すよう明示的に指示しない場合、LLMはトレーニングデータから回答してツールをスキップします。明確な指示を追加してください: `"Use the webSearch tool to look up current information."`
- **デプロイ環境でインターネットアクセスがない** — DuckDuckGoにはアウトバウンドHTTPアクセスが必要です。エアギャップやファイアウォールで制限された環境では、プロキシを設定するか、内部検索サービスを指すカスタム `SmartWebSearchEngine` を実装してください。
- **ホワイトリストが厳しすぎる** — ホワイトリストが設定されているが許可ドメインからの結果が少ない場合、エージェントは結果ゼロを受け取り推測に頼る可能性があります。代表的なクエリでホワイトリストをテストしてください。
- **エージェントが検索に頼りすぎる** — いつ検索すべきか・いつ直接回答すべきかのガイダンスがなければ、トレーニングデータで十分に回答できる質問でも `webSearch` を呼び出す可能性があります。検索が必要な場合を明確にする指示を追加してください。

---

## サンプルプロセス

動作実装はチュートリアルプロジェクトで利用できます。

- `tutorial/processes/tutorial/features/Feature07.p.json` — エージェントプロセス

DesignerでプロセスをOpenし、`Web Search Agent` 要素を確認してください — `["webSearch"]` が含まれた `Tools` フィールドと、常にソースを引用するよう指示するシステムプロンプトがあります。

---

## 関連項目

- [Javaツール]
- [呼び出し可能プロセスツール]
- [エージェントの基本設定]
- [モデルプロバイダーの選択]
