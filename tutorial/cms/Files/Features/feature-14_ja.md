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

エージェントでopenSearchSearchを有効にする

```java
// AgenticProcessCall要素の"Tools"フィールド：
["openSearchSearch"]
```

RAGエージェントのシステムプロンプト

```text
You are a knowledge base assistant.
Use the openSearchSearch tool to search the documentation before answering.
Base your answers strictly on the retrieved documents.
Always cite the source document when providing information.
If no relevant documents are found, say so — do not invent answers.
```

> **ライブデモを試す：** チュートリアルから**Feature 14**を起動してください。ウィザードは4つのフェーズを順に案内します：OpenSearch接続の設定 → `.txt`/`.md`ファイルのアップロード → 埋め込み済みチャンクの確認 → エージェントとのチャット。

## どこで見つけられるか

- `rag/  （RAGモジュール、OpenSearch統合）`
- `smart-workflow/src/com/axonivy/utils/smart/workflow/rag/  （RAG検索パイプライン）`
- `tutorial/processes/tutorial/features/Feature14.p.json`
- `tutorial/src_hd/tutorial/RagDemo/  （RAGデモウィザード — 4ステップUI）`

## インジェスト用サンプルドキュメント

RAGインジェストをテストするための既成ドキュメントが必要な場合は、付属のサンプルを使用してください：

- `external-resources/demo-documents/company-benefits.md` — 14トピック（健康保険、休暇、リモートワーク、学習予算など）を網羅した架空の会社のHR福利厚生ガイドです。各福利厚生に明確な見出しがあり、*「年次休暇は何日もらえますか？」*や*「育児休暇の制度はどうなっていますか？」*といった具体的なHR質問に対するチャンク検索のデモに最適です。

## 主要設定

| 変数 | 説明 | デフォルト |
| --- | --- | --- |
| `AI.RAG.MaxResults` | セマンティック検索ごとに返す最大チャンク数。 | `5` |
| `AI.RAG.MinScore` | 最小類似度スコア（0.0〜1.0）。低いほど結果が多く、関連性が低くなる。 | `0.6` |
| `AI.RAG.ChunkSize` | インジェスト時のドキュメントチャンクあたりの文字数。 | `300` |
| `AI.RAG.ChunkOverlap` | 連続チャンク間の重複文字数。 | `20` |
| `AI.RAG.EmbeddingModel.Provider` | 埋め込みモデルのプロバイダー（チャットモデルと異なる場合がある）。 | *空* |
| `AI.RAG.EmbeddingModel.Name` | 埋め込みモデル名。 | *空* |
| `AI.RAG.EmbeddingModel.ApiKey` | 埋め込みプロバイダーのAPIキー。 | *空* |

## よくある間違い

- **MinScoreが高すぎる** — MinScoreが0.9以上だと結果がほとんど返ってこない。0.6から始め、ドキュメントの質と多様性に基づいて調整する。
- **埋め込みモデルの不一致** — インジェストとクエリに同じ埋め込みモデルを使用しなければならない。別のモデルで再埋め込みすると、以前に保存したベクターはすべて互換性がなくなる。ドキュメントセット全体を再インジェストすること。
- **検索せずに回答するエージェント** — 明示的なシステムプロンプトの指示がないと、エージェントは検索する代わりに学習データから回答する可能性がある。明示的に指示すること：「ドメイン質問に回答する前に必ずopenSearchSearchを使用すること」。

RAGとは何か、インジェスションとリトリーバルのパイプラインがどのように機能するか、なぜこのように設計されているかについては、[RAGとは（付録A）] をご覧ください。

## 関連項目

- [ウェブ検索ツール]
- [Javaツール]
- [ヒューマンインザループ]
