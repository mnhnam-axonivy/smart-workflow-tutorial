# エージェント整理：フォルダ構造と命名規則

ファイルの配置場所と名前によって、開発者がエージェントを見つけ・理解し・拡張できる速さが決まります。これを誤ると、エージェントファイルがプロジェクト全体に散在してナビゲートが困難になり、呼び出し可能プロセスを開かなければその目的を理解できなくなります。

---

> **ベストプラクティスの例:** `best-practices/processes/exercise/purchasing/agents/` の `agents/` フォルダには4つのプロセスファイルが含まれています。各ファイルは明確な役割を持ち — ファイル名・呼び出し可能プロセス名・データクラス名・`visual.description` のすべてが同じ規則に従っています。

## 使用する場面

ドメイン内に複数の呼び出し可能なサブプロセスがある場合、または複数の開発者が同じプロジェクトで作業しており、重複と混乱を防ぐために一貫したフォルダ配置と命名が必要な場合にこの整理方法を適用します。

1つの呼び出し可能プロセスだけの単一プロセスプロジェクトには `agents/` フォルダ構造は必要ありません。設計が安定する前に整理に投資しないでください — エージェント構造が固まったら整理します。

---

## 仕組み

### `agents/` フォルダ

すべてのエージェントサブプロセスを、それを所有するビジネスプロセスに対して専用の `agents/` サブフォルダにまとめます:

```text
processes/
  exercise/
    purchasing/
      Purchasing.p.json          ← business process
      agents/
        PurchasingAgent.p.json   ← orchestrating agent + specific tools
        DocumentReader.p.json    ← reusable: extract text
        TranslatorAgent.p.json   ← reusable: translate
        ObjectMapperAgent.p.json ← reusable: map to object
```

これにより、どのエージェントがどのビジネスドメインに属するかが一目でわかり、ルートのプロセスフォルダをすっきりと保てます。

---

## ベストプラクティス: 一貫した命名規則

一貫した命名により、IDE・エラーログ・観測可能性トレースで呼び出し可能プロセスを容易に識別できます:

| 規則 | 例 |
| --- | --- |
| ファイル名はエージェントの役割を説明する | `DocumentReader.p.json`、`TranslatorAgent.p.json` |
| 呼び出し可能プロセス名はアクションに対応する動詞句 | `extractDocument`、`translate`、`mapObject` |
| データクラス名はファイルに一致する | `DocumentReaderData`、`TranslatorAgentData` |
| パラメータは`Object`ではなく型付き | `java.io.InputStream`、`String`、`Class` |
| プロセス説明フィールドに呼び出し可能プロセスの目的を記述する | `CallSubStart` に `visual.description` を設定する |

`CallSubStart` の `visual.description` はIDEのツールチップとして表示され、AIがシステムプロンプトのステップに対してツールを照合する際に使用するテキストです — 1文の説明でツール選択の精度が大幅に向上します:

```json
{
  "id": "f0",
  "type": "CallSubStart",
  "visual": {
    "description": "Use this tool to map extracted document text into a structured PurchasingData object"
  }
}
```

---

## 関連項目

- [プラクティス 01 — エージェントパターン: AIタスク]
- [プラクティス 02 — エージェントパターン: サブプロセス設計とツールの同一配置]
- [プラクティス 05 — エージェントプロンプト: 明確さと動的コンテキスト]
