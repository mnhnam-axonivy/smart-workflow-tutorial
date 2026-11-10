# サーキットブレーカー

**サーキットブレーカー** は、AIをアプリケーション全体で一括停止するキルスイッチです。オンにすると、Smart Workflowはアプリケーション内の **すべての** エージェント呼び出しを停止します — 個々のエージェントがどのガードレールを設定しているかに関係なく、スイッチを切り替えた後に開始されたプロセスも対象です。停止された呼び出しはそれぞれBPMエラーを発生させるため、プロセスは失敗する代わりにAIを使わないルートに進むことができます。

---

> **[出力ガードレール] をベースにしています。** エージェントの設定は [エージェントの基本設定] と同じです — 新しい要素は、AgenticProcessCallに付ける `smartworkflow:stop` 用の **Error Boundary Event** だけです。
>
> **このガイドで使用する例: 手動フォールバック付きの Acme Corp 請求書要約**
>
> [エージェントの基本設定] の Invoice Summary Agent は通常、請求書を要約します。運用担当者がサーキットブレーカーをオンにすると、同じプロセスはモデルを呼び出さなくなり、Error Boundary Event が停止を捕捉して請求書を手動レビューに回します。
>
> 完成したプロセスは `tutorial/processes/tutorial/features/Feature15.p.json` にあります — Designerで開いて読み進めてください。

---

## どんなときに必要か？

ガードレールは、1回の呼び出しを続行してよいかをメッセージごとに判断します。しかし、AIを **すべて、即座に** オフラインにしなければならない場面があります。

- **プロバイダー障害** — モデルがエラーや無意味な内容を返す
- **コストの暴走** — エージェントがループする、またはトラフィックが急増する
- **プロンプトやデータの漏洩** — 調査中はすべての呼び出しを止める必要がある
- **コンプライアンス上の保留** — 法務部門やデータ保護責任者からAI処理の一時停止を求められる

サーキットブレーカーは、プロジェクトの再デプロイやエージェントの編集なしに、1つのスイッチでこれらのケースに対応します。

---

## 仕組み

サーキットブレーカーは1つのIvy変数で制御します。

```yaml
Variables:
  AI:
    # Emergency circuit breaker.
    CircuitBreaker:
      # "true" stops ALL AI agent calls in this application. "false" (or blank) allows them again.
      Enabled: "false"
```

| 値 | 効果 |
| --- | --- |
| `true` | アプリケーション内のすべてのエージェント呼び出しを停止 |
| `false` または空 | エージェントは通常どおり動作 |

内部的には組み込みガードレール `CircuitBreakerGuardrail` として動作し、Smart Workflowがすべてのエージェントに自動的に適用します — **入力時**（ユーザーメッセージがモデルに届く前）と **出力時**（応答がプロセスに届く前）の両方です。ブロックすると、Smart Workflowは次のエラーコードを発生させます。

```text
smartworkflow:stop
```

これはガードレール違反のコード（`smartworkflow:guardrail:input:violation` / `smartworkflow:guardrail:output:violation`）とは別のコードなので、AI停止時専用のフォールバックを用意できます。

---

## 停止されたエージェントの実行はキャンセルされる（一時停止ではない）

サーキットブレーカーが呼び出しをブロックすると、そのエージェントの実行は **完全に終了します**。

- `AgenticProcessCall` は `smartworkflow:stop` をスローし、結果はマッピングされません — プロセスは Error Boundary のルートに進みます。
- 何もキューに入らず、保持もされません。後でサーキットブレーカーをオフにしても、停止された呼び出しが続行・リトライ・再実行されることは **ありません** — その結果は失われます。
- サーキットブレーカーをオフにした効果は、その **後に開始される** エージェント呼び出しにのみ及びます。

つまり「AIを再びオンにする」ことで、停止された実行が戻ってくることはありません。インシデント後もAIの結果が業務上必要な場合は、それを明示的にモデリングしてください — 例えば、フォールバックで *Retry AI summary* タスクを作成してエージェントに戻すか、プロセスをもう一度開始します。

> これは [ヒューマンインザループ] とは正反対です。ヒューマンインザループではエージェントが *中断* され、後で同じ会話を続行します。サーキットブレーカーによる停止には、戻るべき会話がありません。

---

## Step 1 — サーキットブレーカーを切り替える

**Engine Cockpitから（運用担当者）:** アプリケーションを開き、**Variables** で `AI.CircuitBreaker.Enabled` を `true` に設定します。新しいエージェント呼び出しを再び許可するには `false` に戻します。

**プロセスコードから（管理用プロセス、定期チェック、コスト監視など）:**

```java
import com.axonivy.utils.smart.workflow.guardrails.circuitbreaker.CircuitBreakerSignal;

CircuitBreakerSignal.stopAll();    // AI.CircuitBreaker.Enabled = true を設定
CircuitBreakerSignal.resumeAll();  // AI.CircuitBreaker.Enabled = false を設定
```

どちらも同じ変数に書き込むため、変更は次のエージェント呼び出しからアプリケーション全体に反映されます。

> **注意:** 名前に反して、`resumeAll()` は停止されたものを再開しません — **新しい** エージェント呼び出しを再び通すだけです。上記の *停止されたエージェントの実行はキャンセルされる（一時停止ではない）* を参照してください。

---

## Step 2 — Error Boundary Eventを追加する

AgenticProcessCall要素に **Error Boundary Event** を付けます。

- **エラーコード:** `smartworkflow:stop`
- **出力マッピング:** `out → in` と `out.error → error`

---

## Step 3 — フォールバックをモデリングする

フォールバックはプロセスの通常の一部です — Designerでモデリングできることなら何でも可能です: 作業を人に引き渡す、ルールベースのルートを通る、AIが一時的に利用できないことをユーザーに伝える、インシデント終了後にAIステップを再実行するためのタスクを作成する、などです。

チュートリアルでは、境界イベントの後のスクリプトで請求書を手動レビュー対象にします。

```java
in.isStopped = true;
in.summary = "AI is currently unavailable - invoice routed to manual review.";
ivy.log.warn("Agent stopped by circuit breaker: {0}", in.error.getMessage());
in.error = null;
```

> **重要:** 分岐は **エラーコード** で行い、メッセージテキストでは絶対に行わないでください。メッセージ（`All AI agent activities are currently stopped.`）は人が読むための詳細情報であり、仕様として保証されたものではありません。

### 呼び出し可能サブプロセス内のエージェント

エージェントが再利用可能な呼び出し可能サブプロセス内にある場合、通常は *呼び出し側* が対応を決めます。エラーを外に漏らさず、結果パラメータとして返します。

1. サブプロセス内で、エージェント要素に `smartworkflow:stop` 用の Error Boundary Event を追加します。
2. 境界イベントから、フラグを設定するスクリプトを実行します。例: `in.isStopped = true`
3. エージェントの結果と並べて、`isStopped` をサブプロセスの結果パラメータに追加します。
4. 呼び出し側のプロセスで **Alternative** を使ってそのフラグで分岐し、`true` の場合はAIを使わないルートに進みます。

これは [プラクティス 02 — エージェントパターン: サブプロセス設計とツールの同一配置] と同じパターンです — サブプロセスは自己完結したまま、ビジネスフローの制御は呼び出し側に残ります。

---

## 例 — 手動フォールバック付きの請求書要約

サンプルプロセスには3つの開始イベントがあります。

| 開始イベント | 処理内容 |
| --- | --- |
| **Circuit breaker demo** | Invoice Summary Agentを実行します。通常はAIの要約をログに出力し、サーキットブレーカーがオンの場合は境界イベントから **Fallback: manual review** のルートに進みます |
| **Stop all agents** | `CircuitBreakerSignal.stopAll()` を呼び出します |
| **Re-enable agents** | `CircuitBreakerSignal.resumeAll()` を呼び出します — 新しいエージェント呼び出しが再び許可されます |

試してみましょう。

1. **Circuit breaker demo** を開始します — **Axon Ivy Runtime Log** にAIの要約が表示されます。
2. **Stop all agents** を開始します。
3. もう一度 **Circuit breaker demo** を開始します — ログには次のように表示されます。

   ```text
   Agent stopped by circuit breaker: ...All AI agent activities are currently stopped.
   AI is currently unavailable - invoice routed to manual review.
   ```

4. **Re-enable agents** を開始します。手順3の実行は手動レビューのルートのままで、続行されることはありません。
5. もう一度 **Circuit breaker demo** を開始します — これは新しい実行なので、ログに再びAIの要約が表示されます。

> **手順4を忘れないでください。** スイッチはアプリケーションの変数に保存され、オフにするまでオンのままです — 他のすべてのチュートリアルプロセスにも影響します。

---

## 適用範囲と制限

- **実行中の呼び出しはキャンセルされません。** ブレーカーはモデル呼び出しの前後のガードレール境界で作動します。すでにプロバイダーに届いたリクエストは、長いツールループを含めて最後まで実行され、出力の評価時に停止されます — 応答は破棄されますが、その呼び出しのトークンは消費されます。
- **アプリケーション全体に適用されます。** スイッチがオンの間はすべてのエージェントが影響を受けます。エージェント単位やプロセス単位のサーキットブレーカーはありません。
- **選択するガードレールではありません。** **Input guardrails** や **Output guardrails** に追加する必要はありません — 常に有効で、変数が `true` の間だけブロックします。

---

## 観測可能性

停止された呼び出しは、他のガードレール評価と同様に、ガードレール名 `CircuitBreakerGuardrail`、停止理由を失敗メッセージとして記録されます — Ivyの会話履歴と、Arize Phoenixの `GUARDRAIL` スパンの両方に記録されます。どの呼び出しがいつ停止されたかを後から確認するのに使えます。[観測可能性] を参照してください。

---

## 設定リファレンス

| 変数 | 説明 | デフォルト |
| --- | --- | --- |
| `AI.CircuitBreaker.Enabled` | `"true"` にするとアプリケーション内のすべてのエージェント呼び出しを停止します。`"false"` または空で再び許可します。 | `"false"` |

詳細なリファレンスは [Smart Workflow サーキットブレーカーガイド](https://github.com/axonivy-market/smart-workflow/blob/master/doc/user/circuit-breaker.md) を参照してください。

---

## よくあるミス

- **Error Boundary Eventがない** — ないと、停止されたエージェントは未処理のプロセスエラーになります。すべてのエージェント呼び出しに `smartworkflow:stop` のフォールバックを用意してください。そうしないと、AIをオフにしたときにプロセスが縮退運転するのではなく失敗します。
- **ガードレールのコードで捕捉している** — `smartworkflow:guardrail:input:violation` や `…:output:violation` ではサーキットブレーカーの停止を捕捉 **できません**。`smartworkflow:stop` を使用してください。
- **オフに戻し忘れる** — 変数は誰かが戻すまで `true` のままです。AIを再び有効にする手順をインシデント対応手順書に含めてください。
- **停止された実行が続行されると期待する** — サーキットブレーカーをオフにしても、停止された呼び出しは再実行されません。そのAIの結果がまだ必要な場合は、AIステップを再実行する手段をフォールバックに用意する必要があります。
- **実行中の呼び出しが即座に止まると期待する** — 上記の *適用範囲と制限* を参照してください: 実行中のリクエストは最後まで実行され、課金されます。

---

## サンプルプロセス

動作する実装はチュートリアルプロジェクトで利用できます。

- `tutorial/processes/tutorial/features/Feature15.p.json` — 停止・再有効化の開始イベントを含むエージェントプロセス
- `tutorial/dataclasses/tutorial/Feature15Data.d.json` — データクラス

Designerでプロセスを開き、`Invoice Summary Agent` 要素を確認してください — エラーコード `smartworkflow:stop` の `Agent stopped` Error Boundary Event と、`CircuitBreakerSignal` を呼び出す2つのスクリプト要素があります。

---

## 関連項目

- [出力ガードレール]
- [入力ガードレール]
- [観測可能性]
- [プラクティス 02 — エージェントパターン: サブプロセス設計とツールの同一配置]
