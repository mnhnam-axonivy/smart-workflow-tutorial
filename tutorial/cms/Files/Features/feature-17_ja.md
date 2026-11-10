# 高度なモデル設定

[モデルプロバイダーの選択] では、エージェントに *どの* モデルが回答するかを決めます。**高度なモデル設定** では、そのモデルが *どのように* 回答するか — 例えば表現にどれだけ変化を持たせるか — を調整します。これらは任意設定です: ほとんどのエージェントはデフォルトのままで問題なく、エージェントに異なる挙動が必要な場合にだけ変更します。

---

> **[モデルプロバイダーの選択] をベースにしています。** プロバイダーとモデルはそのままです — 高度な設定は、同じ `AgenticProcessCall` 要素にある追加のフィールドです。
>
> **このガイドで使用する例: 支払い催促メールの件名**
>
> Acme Corp は期限切れの請求書に対して支払い催促を送ります。2つのエージェントが同じ請求書の件名を作成します — 一方は再現性のある出力向け、もう一方は多様な表現向けに調整されているため、設定によって何が変わるかを確認できます。
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature17.p.json` にあります — Designerで開いて読み進めてください。

---

## 設定の場所

`AgenticProcessCall` 要素を開き、設定エディタの **⚙️ Advanced** グループに移動します。Smart Workflow 14.0.0 では、同じフィールドが **🧠️ Model** グループの *Optional Settings* にも表示されます — どちらも同じ値を編集します。

**Provider** や **Model** と同様に、高度な設定はその要素にのみ適用されます。`variables.yaml` にグローバルなデフォルト値はありません。

---

## 利用可能な設定

| 設定 | 対応バージョン | デフォルト | 制御する内容 |
| --- | --- | --- | --- |
| **Temperature** | 14.0.0 | `0.0` | モデルの回答にどれだけランダム性を持たせるか |

Smart Workflow が新しい設定に対応するたびに、このページに追加していきます。

---

## Temperature（温度）

Temperature はモデルの回答にどれだけランダム性を持たせるかを制御します。

| 値 | 挙動 | 用途 |
| --- | --- | --- |
| `0.0` *(デフォルト)* | 最も決定的 — 同じ入力に対して（ほぼ）同じ出力を返す | 抽出、分類、構造化出力、プロセスの分岐条件に使う結果 |
| `0.7` – `1.0` | 実行ごとに表現が変わる | メールの下書き、人が読む要約、アイデア出し |

このフィールドは String に評価される IvyScript 式です。

```text
"0.7"
```

または、実行時に値を決められるよう、プロセスデータの String フィールドを指定します。

```text
in.temperature
```

**知っておくべきこと:**

- **空の場合は `0.0` です。** Smart Workflow はモデルに `0.0` を送信します — プロバイダー独自のデフォルト値は使われません。
- **不正な値はエラーなしで無視されます。** 負の値や数値でない値も `0.0` になります。出力が想定以上に決定的に見える場合は、記録された temperature を確認してください（後述）。
- **上限はプロバイダーによって異なります。** Smart Workflow は値の上限を制限しません — 例えば OpenAI は `0`〜`2`、Anthropic は `0`〜`1` を受け付けます。範囲外の値はプロバイダー側で拒否されます。
- **一部の OpenAI モデルは temperature を固定します。** OpenAI プロバイダーでは、`o` シリーズの推論モデルはこのフィールドを無視し、`gpt-5` モデルは常に `1` で実行されます。

**確認方法:** エージェントが実際に使用した temperature は組み込みの実行履歴に保存され、Arize Phoenix では LLM スパンの `llm.invocation_parameters` に記録されます — [観測可能性] を参照してください。

---

## 例 — 支払い催促メールの件名

### モックデータ

**Mock data** スクリプト要素で、期限切れの短い請求書と、クリエイティブ側エージェントの temperature をあらかじめ設定します。

```javascript
in.invoiceText = "Invoice Number: INV-2024-00123\n" +
"Supplier: Acme Supplies Ltd.\n" +
"Total Amount Due: JPY 10,560.00\n" +
"Due Date: 2024-06-30\n";
in.temperature = "1.0";
```

### エージェントの設定

2つのエージェントは同じシステムプロンプトとクエリを使用します。

```text
You write email subject lines for Acme Corp's accounts payable team.
Given an overdue invoice, write one friendly payment reminder subject line.
Return only the subject line. No quotes, no explanation.
```

**クエリ:** `<%=in.invoiceText%>`

| エージェント | Temperature | 結果のマッピング先 |
| --- | --- | --- |
| **Reminder Subject (deterministic)** | `"0.0"` | `in.deterministicSubject` |
| **Reminder Subject (creative)** | `in.temperature` | `in.creativeSubject` |

どちらのエージェントもグローバルデフォルトのプロバイダーを使用するため、`variables.yaml` で設定したプロバイダーでそのまま実行できます。

### 結果

**Show result from AI** スクリプト要素が、2つの件名を **Axon Ivy Runtime Log** に出力します。プロセスを数回実行して比較してください。

| エージェント | 数回実行したときの典型的な結果 |
| --- | --- |
| **Reminder Subject (deterministic)** | 毎回同じ件名 |
| **Reminder Subject (creative)** | 実行ごとに異なる表現の件名 |

---

## よくあるミス

- **構造化出力で temperature を上げる** — 抽出や分類には再現性のある回答が必要です。プロセスの分岐に使う結果や型付きフィールドにマッピングする結果では `0.0` のままにしてください。
- **値を引用符で囲まない** — Smart Workflow はこのフィールドを String として評価します。チュートリアルと同様に `"0.7"`（引用符付き）と書くか、String フィールドを指定してください。
- **不正な値でエラーになると期待する** — 負の値や数値でない値はエラーなしで `0.0` になります。出力が想定どおりに変化しない場合は、記録された temperature を確認してください。
- **すべてのプロバイダーで範囲が同じだと考える** — OpenAI で使える値（最大 `2`）が Anthropic（最大 `1`）では拒否されることがあります。

---

## サンプルプロセス

動作する実装はチュートリアルプロジェクトで利用できます。

- `tutorial/processes/tutorial/features/Feature17.p.json` — temperature の異なる2つのエージェント
- `tutorial/dataclasses/tutorial/Feature17Data.d.json` — データクラス

Designerでプロセスを開き、`Reminder Subject (deterministic)` 要素と `Reminder Subject (creative)` 要素の **⚙️ Advanced** グループを比較してください。

---

## 関連項目

- [モデルプロバイダーの選択]
- [エージェントの基本設定]
- [観測可能性]
