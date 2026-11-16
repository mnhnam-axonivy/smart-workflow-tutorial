# ツールとしてのRAG

OpenSearchベクターストアを接続し、エージェントがクエリ時にビジネス文書・ナレッジベース・社内データをセマンティック検索できるようにします。

## これは何か？

**Retrieval-Augmented Generation（RAG）** は、エージェントがクエリ時にドキュメントストアから関連コンテンツを検索し、そのコンテンツをコンテキストに追加して根拠のある回答を生成するパターンです。Smart WorkflowはRAGのベクターストアとして**OpenSearch**と統合しています。RAGの仕組みについての概念的な概要は [RAGとは（付録A）] をご覧ください。

主要な組み込みツールは `openSearchSearch` です — エージェントが実行時にインデックス済みナレッジベースに対してセマンティック検索を行うために呼び出します。

## なぜ使うのか？

- ドキュメント全体をプロンプトに含めることなく、社内ドキュメントに関する質問に回答できる
- 幻覚を低減 — 回答が取得したドキュメントに基づいている
- ナレッジベースチャットボット、社内Q&A、ポリシーアシスタントに活用できる
- すべてのドキュメントをコンテキストウィンドウに追加するよりもコスト効率が高い
- ドキュメントはエージェントの設定とは独立して更新できる

## 仕組み

**インジェスト（一回または定期的）：**

ドキュメントをアップロード → チャンクに分割 → 埋め込みモデルがチャンクをベクターに変換 → OpenSearchインデックスに保存。

> **チャンキング戦略：** Smart Workflowは現在、`RagDocumentSplitter` による固定サイズの再帰的チャンキングのみをサポートしています。チャンクサイズとオーバーラップは `AI.RAG.ChunkSize` と `AI.RAG.ChunkOverlap` で設定します。見出し認識型やコンテキスト付きチャンクヘッダーなどの追加戦略は、需要が高ければ将来のリリースで導入される可能性があります。

**リトリーバル（クエリごと）：**

ユーザーのクエリ → エージェントが`openSearchSearch`ツールを呼び出す → クエリをベクターに埋め込む → OpenSearchから最も近いチャンクを取得 → チャンクをLLMコンテキストに追加 → 根拠のある回答を生成。

## openSearchSearchツール

`openSearchSearch` は `smart-workflow-opensearch-rag` プロジェクトが提供します。ツールを呼び出すとき、エージェントが自分でパラメータを設定します：

| パラメータ | 型 | 説明 |
| --- | --- | --- |
| `collection` | String | 検索対象のインデックス名。**必須 — デフォルトはありません。** |
| `query` | String | 関連コンテンツを見つけるための検索クエリ。 |
| `maxResults` | Integer | 返すセグメントの最大数。空の場合は `AI.RAG.MaxResults` が使用されます。 |
| `minScore` | Double | 最小類似度スコア（0.0〜1.0）。空の場合は `AI.RAG.MinScore` が使用されます。 |

ツールは、一致したコンテンツセグメントとその類似度スコアを返します。

## 例

variables.yaml — RAG設定

```yaml
Variables:
  AI:
    RAG:
      MaxResults: "5"         # 検索ごとに返す最大チャンク数
      MinScore: "0.6"         # 類似度閾値（0〜1）
      ChunkSize: "300"        # ドキュメントチャンクあたりの文字数
      ChunkOverlap: "20"      # 連続チャンク間の重複文字数
      EmbeddingModel:
        Provider: "OpenAI"
        Name: "text-embedding-3-small"
        #[password]
        ApiKey: ${decrypt:}
```

埋め込みモデルは質問をベクターに変換するため、**ドキュメントのインデックス作成に使用したものと同じモデル**でなければなりません。`EmbeddingModel.Provider` に指定できるのは、埋め込みをサポートするプロバイダーだけです（現在は **OpenAI** と **Ollama**）。`Provider` が空の場合は `AI.DefaultProvider` が使用されます。

OpenSearchへの接続は別途設定します。ローカル環境のセットアップは [ローカルベクターストアの起動] を参照してください：

```yaml
Variables:
  AI:
    RAG:
      OpenSearch:
        Url: "http://localhost:19600"
        # Leave the credentials blank when security is disabled.
        # Otherwise use ApiKey, or UserName and Password.
        #[password]
        ApiKey: ${decrypt:}
        UserName: ""
        #[password]
        Password: ${decrypt:}
        # Dev and test only. Never "true" in production.
        TrustSelfSignedCertificates: "false"
```

エージェントでopenSearchSearchを有効にする

```java
// AgenticProcessCall要素の"Tools"フィールド：
["openSearchSearch"]
```

RAGエージェントのシステムメッセージ

```text
You are a knowledge base assistant.
You MUST always call the openSearchSearch tool before answering any question.
Use the collection <%=in.indexName%>.
Base your answers strictly on the retrieved documents.
Always cite the source document when providing information.
If no relevant documents are found, say so — do not answer from your own knowledge.
```

このプロンプトのうち、3つの行が重要な役割を果たしています：

- **コレクション名** — `collection` はデフォルトのない必須のツールパラメータです。インデックス名を知らされていないエージェントは検索できません。RAGエージェントがドキュメントではなく学習データから回答してしまう、最も多い原因です。ここでは名前をプロセスデータ（`in.indexName`）から取得しています。
- **「MUST always call」** — これがないと、モデルは知っていると判断した時点で直接回答してしまいます。
- **「Do not answer from your own knowledge」** — 根拠のない回答を、もっともらしい回答ではなく、明示的に分かるものにします。

> **ライブデモを試す：** チュートリアルから**Feature 14**を起動してください。ウィザードは4つのフェーズを順に案内します：OpenSearch接続の設定 → `.txt`/`.md`ファイルのアップロード → 埋め込み済みチャンクの確認 → エージェントとのチャット。

## どこで見つけられるか

- `tutorial/process/tutorial/features/Feature14.p.json` — RAGウィザードを起動するプロセス
- `tutorial/dialog/tutorial/RagDemo/` — RAGデモウィザード（4ステップUI）
- `smart-workflow-opensearch-rag` — `openSearchSearch` ツールとOpenSearch接続用の変数を提供するSmart Workflowプロジェクト

## インジェスト用サンプルドキュメント

RAGインジェストをテストするための既成ドキュメントが必要な場合は、付属のサンプルを使用してください：

- `doc/company-benefits.md`（リポジトリのルート） — 14トピック（健康保険、休暇、リモートワーク、学習予算など）を網羅した架空の会社のHR福利厚生ガイドです。各福利厚生に明確な見出しがあり、*「年次休暇は何日もらえますか？」*や*「育児休暇の制度はどうなっていますか？」*といった具体的なHR質問に対するチャンク検索のデモに最適です。

## 主要設定

| 変数 | 説明 | デフォルト |
| --- | --- | --- |
| `AI.RAG.MaxResults` | セマンティック検索ごとに返す最大チャンク数。 | `5` |
| `AI.RAG.MinScore` | 最小類似度スコア（0.0〜1.0）。低いほど結果が多く、関連性が低くなる。 | `0.6` |
| `AI.RAG.ChunkSize` | インジェスト時のドキュメントチャンクあたりの文字数。 | `300` |
| `AI.RAG.ChunkOverlap` | 連続チャンク間の重複文字数。 | `20` |
| `AI.RAG.EmbeddingModel.Provider` | 埋め込みモデルのプロバイダー（チャットモデルと異なる場合がある）。埋め込みをサポートしている必要があります（OpenAIまたはOllama）。空の場合は `AI.DefaultProvider` が使用されます。 | *空* |
| `AI.RAG.EmbeddingModel.Name` | 埋め込みモデル名。空の場合はプロバイダーの `DefaultEmbeddingModel` が使用されます。 | *空* |
| `AI.RAG.EmbeddingModel.ApiKey` | 埋め込み呼び出し用の別のAPIキー（任意）。 | *空* |
| `AI.RAG.OpenSearch.Url` | OpenSearchサーバーのベースURL。 | *空* |
| `AI.RAG.OpenSearch.ApiKey` | OpenSearchのAPIキー。Basic認証を使用する場合やセキュリティが無効の場合は空のままにします。 | *空* |
| `AI.RAG.OpenSearch.UserName` / `Password` | Basic認証。 | *空* |
| `AI.RAG.OpenSearch.TrustSelfSignedCertificates` | 自己署名証明書を受け入れます。開発・テスト専用。 | `false` |

## よくある間違い

- **MinScoreが高すぎる** — MinScoreが0.9以上だと結果がほとんど返ってこない。0.6から始め、ドキュメントの質と多様性に基づいて調整する。
- **埋め込みモデルの不一致** — インジェストとクエリに同じ埋め込みモデルを使用しなければならない。別のモデルで再埋め込みすると、以前に保存したベクターはすべて互換性がなくなる。ドキュメントセット全体を再インジェストすること。
- **検索せずに回答するエージェント** — 明示的なシステムメッセージの指示がないと、エージェントは検索する代わりに学習データから回答する可能性がある。明示的に指示すること：「ドメイン質問に回答する前に必ずopenSearchSearchを使用すること」。
- **エージェントにコレクション名を伝えていない** — `collection` は必須で、デフォルトはありません。インデックス名を知らないエージェントは検索できず、代わりに学習データから回答します。
- **埋め込みができない埋め込みプロバイダー** — `AI.RAG.EmbeddingModel.Provider` に指定できるのはOpenAIまたはOllamaだけです。

RAGとは何か、インジェスションとリトリーバルのパイプラインがどのように機能するか、なぜこのように設計されているかについては、[RAGとは（付録A）] をご覧ください。

## 関連項目

- [ウェブ検索ツール]
- [Javaツール]
- [ヒューマンインザループ]
