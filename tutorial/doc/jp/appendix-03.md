# ローカルベクターストアの起動

> **このセットアップの目的：** これは、Smart WorkflowがOpenSearchをベクターストアとして使用してRAGを実行できることを確認するための概念実証（PoC）環境です。本番環境への導入を想定した構成ではありません。実際のプロジェクトでは、OpenSearchのセキュリティ設定・スケーリング・運用管理をインフラチームが適切に行う必要があります。

この付録では、開発・チュートリアル演習用にローカルのOpenSearchインスタンスをベクターストアとして起動する方法を説明します。このセットアップはDockerベースで、クラウドアカウントや外部サービスは不要です。

> **開発・デモ用途のみ。** このインスタンスはセキュリティが無効化されており、認証なしのプレーンHTTPで動作します。本番環境での使用や公開ネットワークへの公開は絶対に行わないでください。

---

## 前提条件

- **Rancher Desktop** がインストールされ、起動していること — 無料かつオープンソースで、ほとんどの開発環境に推奨されます。[rancherdesktop.io](https://rancherdesktop.io) からダウンロードできます。セットアップ時にコンテナランタイムとして **dockerd (moby)** を選択し、`docker` および `docker compose` コマンドがPATHで使用できるようにしてください。
- あるいは、会社がライセンスを購入している場合は **Docker Desktop** も同様に使用できます（Docker Desktopは商用利用に有料サブスクリプションが必要です）。
- このリポジトリの `external-resources/vector-store/opensearch/` フォルダ。

---

## 含まれるファイル

| ファイル | 用途 |
| --- | --- |
| `docker-compose.yml` | OpenSearchコンテナを定義（`opensearchproject/opensearch:3.5.0`） |
| `start.ps1` | Windows用の対話式起動スクリプト（PowerShell） |
| `start.sh` | Linux / macOS用の対話式起動スクリプト（Bash） |
| `.env` | パスワードとポート番号を保存 — 初回起動時に作成、gitで管理されない |

---

## ベクターストアの起動

### Windows（PowerShell）

PowerShellターミナルを開き、`opensearch/` フォルダに移動してから以下を実行します：

```
.\start.ps1
```

スクリプトの実行が拒否された場合（実行ポリシーエラー）、IT部門に実行ポリシーの変更を依頼するか、以下のコマンドで現在のセッションのみ一時的に許可してから実行してください：

```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

### Linux / macOS（Bash）

ターミナルを開き、`opensearch/` フォルダに移動してから以下を実行します：

```
chmod +x start.sh
./start.sh
```

---

## スクリプト実行時の流れ

スクリプトは4つのステップを自動的に処理します：

**1. 免責事項**

これが開発専用のセットアップであることを確認するために `ok` と入力するよう求められます。

**2. 管理者パスワード（初回のみ）**

OpenSearch 2.12以降では、コンテナ起動時に管理者パスワードが必要です。このパスワードについて：
- 12文字以上で、大文字・小文字・数字・特殊文字を含む必要があります。
- 次回以降の起動で再入力不要なよう `.env` に保存されます。
- Ivyからの接続には**使用されません** — IvyのパスワードはIvy変数側を空白にしてください。

**3. ポートの確認**

デフォルトポートは `19600` です。そのポートが使用中の場合、スクリプトは自動的に次の空きポートを見つけて `.env` に保存します。

**4. コンテナの起動とヘルスチェック**

スクリプトは `docker compose up -d` を実行し、OpenSearchが応答するまで最大60秒間待機します。準備が整うと接続情報が表示されます。

---

## 接続情報

スクリプトが完了すると、必要な値が出力されます：

```
===========================================================
  OpenSearch Vector Store
-----------------------------------------------------------
  URL      : http://localhost:19600
-----------------------------------------------------------
  Set these Ivy variables:
    AI.RAG.OpenSearch.Url               = http://localhost:19600
    AI.RAG.OpenSearch.ApiKey             = (leave blank)
    AI.RAG.OpenSearch.UserName           = (leave blank)
    AI.RAG.OpenSearch.Password           = (leave blank)
===========================================================
```

---

## Ivyの設定

`variables.yaml` を開き（またはIvyエンジン設定から）、以下を追加します：

```yaml
Variables:
  AI:
    RAG:
      OpenSearch:
        Url: "http://localhost:19600"
        ApiKey: ""
        UserName: ""
        Password: ""
```

`ApiKey`・`UserName`・`Password` は空白のままにしてください — このローカルインスタンスはセキュリティが無効化されているため、接続に認証情報は不要です。

---

## ベクターストアの確認

インスタンスが起動したら、ブラウザまたはHTTPクライアントで状態を直接確認できます。

### OpenSearchが起動しているか確認する

```
http://localhost:19600/
```

クラスター名とバージョンを含むJSONレスポンスが返されます。レスポンスが返ってくれば、インスタンスは正常に動作しています。

### インデックスが作成されているか確認する

```
http://localhost:19600/your-vector-index-name
```

`your-vector-index-name` をインジェスト時に使用したコレクション名（例：`company-benefits`）に置き換えてください。インデックスが存在する場合はその設定とマッピングが返され、まだ作成されていない場合は404が返されます。

### インデックスに保存されたレコードを確認する

```
http://localhost:19600/your-vector-index-name/_search?pretty=true
```

インデックスに保存されているすべてのドキュメントをフォーマットされたJSONで返します。インジェスト実行後にチャンクが正しく埋め込まれて保存されているかを確認するのに役立ちます。

---

## 停止・再起動・リセット

`opensearch/` フォルダから実行：

| 操作 | コマンド |
| --- | --- |
| コンテナを停止（データを保持） | `docker compose stop` |
| 停止後に再起動 | `docker compose start` |
| ライブログを表示 | `docker compose logs -f` |
| 完全リセット — インデックスデータも削除 | `docker compose down -v` |

> `docker compose down -v` 実行後は、インデックス済みのチャンクがすべて削除されます。エージェントが検索できるようになるまで、インジェスションを再実行する必要があります。

---

## トラブルシューティング

**OpenSearchの準備待ちでタイムアウトする**

コンテナログで起動エラーを確認してください：

```
docker logs smart-workflow-opensearch
```

よくある原因：Docker Desktopに割り当てられているメモリが不足している（OpenSearchは最低2GBを推奨）、またはコンテキストエラーによりコンテナがすぐに終了した場合。

**毎回ポートの競合が発生する**

ポート19600が常に他のプロセスに占有されている場合は、`.env` を直接編集して `OPENSEARCH_PORT` に空きポート番号を設定してください。スクリプトは次回起動時にこの値を読み込みます。

**`docker compose` が見つからない**

スクリプトはDocker Compose V2プラグイン（`docker compose`）とスタンドアロンバイナリ（`docker-compose`）の両方に対応しています。Docker Desktopを最新バージョンにアップデートするか、スタンドアロンバイナリを別途インストールしてください。

---

## デモドキュメント

`external-resources/demo-documents/` フォルダには、インジェスト用のサンプルファイルが含まれています：

| ファイル | 説明 |
| --- | --- |
| `company-benefits.md` | 架空の会社のHR福利厚生ガイド — 休暇・健康保険・リモートワークなど14トピックを収録。HR Q&Aクエリのテストに最適。 |
| `purchasing invoices/` | PDF形式のサンプル購買請求書。構造化された財務書類のドキュメント検索テストに有用。 |

Feature 14のRAGデモウィザードでこれらのファイルをインジェストし、自社データがなくてもセマンティック検索をテストできます。

---

## 関連項目

- [ツールとしてのRAG]
- [RAGとは（付録A）]
