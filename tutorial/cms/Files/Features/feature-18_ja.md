# カスタムガードレール

組み込みのガードレールは、プロンプトインジェクション・認証情報の漏洩・個人データといった一般的なリスクをカバーします。**カスタムガードレール**は、*自社の*ルール（社内ポリシー、コンプライアンスチェック、秘匿化処理など）をカバーします。小さなJavaクラスとして実装し、登録すれば組み込みのガードレールとまったく同じように使えます。エージェントごとに選択することも、アプリケーション内のすべてのエージェントに適用することもできます。

---

> **[入力ガードレール] と [Javaツール] をベースにしています。** 違反の処理方法は [入力ガードレール] とまったく同じで、登録には [Javaツール] と同じSPIの仕組みを使用します。
>
> **このガイドで使用する例: Acme Corp の2つのポリシー**
>
> Acme Corpは従業員向けの社内アシスタントを運用しています。プロンプトの内容にかかわらず、すべてのメッセージで次の2つのルールを守る必要があります。
>
> - 機密プロジェクトのコードネームをAIモデルに送信してはならない → メッセージを**ブロック**するガードレール
> - 従業員IDを社外に出してはならない → メッセージを**書き換え**、IDをプレースホルダーに置き換えるガードレール
>
> 完成したプロセスは `tutorial/process/tutorial/features/Feature18.p.json` にあります — Designerで開いて読み進めてください。

---

## はじめる前に

この2つのルールを、すべてのエージェントのシステムメッセージに書くこともできます。しかし、それには問題が2つあります。プロンプトは依頼であって保証ではありません — モデルがルールを読む時点で、メッセージはすでにモデルに届いています。また、ルールが複数の場所に存在することになり、ポリシーを変更するたびにすべてのエージェントを編集しなければなりません。

ガードレールは、メッセージがモデルに届く**前**（入力）、またはレスポンスがプロセスに届く前（出力）に、Javaで実行されます。ルールは1か所で、決定論的に、トークンコストなしで適用されます。

---

## カスタムガードレールとは?

カスタムガードレールは、`com.axonivy.utils.smart.workflow.guardrails.entity` パッケージの2つのインターフェースのいずれか（両側で使う場合は両方）を実装します。

| インターフェース | 表示される場所 | 検査対象 |
| --- | --- | --- |
| `SmartWorkflowInputGuardrail` | **Input guardrails** | モデルに届く前のユーザーメッセージ |
| `SmartWorkflowOutputGuardrail` | **Output guardrails** | 使用される前のモデルのレスポンス |

どちらも実装するメソッドは `evaluate(String message)` の1つだけで、次の4つの結果のいずれかを返します。

| 結果 | 効果 |
| --- | --- |
| `GuardrailResult.allow()` | メッセージをそのまま通過させます。 |
| `GuardrailResult.allowWithRewrite(String)` | 通過させますが、メッセージを指定した内容に置き換えます。拒否ではなく、秘匿化や正規化に使用します。 |
| `GuardrailResult.block(String reason)` | メッセージを拒否します。理由はBPMエラーに含まれます。 |
| `GuardrailResult.block(String reason, Throwable cause)` | 拒否し、原因（cause）を添付します。呼び出し側は理由のテキストを読まずに、*どの*ガードレールがブロックしたかを判別できます。 |

`name()` は省略可能です。デフォルトは単純クラス名で、この名前がピッカーに表示され、変数でも使用されます。

---

## なぜ使うのか?

- **ポリシーを1か所に集約** — すべてのシステムメッセージにルールを繰り返し書く必要がありません
- **決定論的** — 判定するのはモデルではなく通常のJavaコードです。同じメッセージには常に同じ結果が返ります
- **トークンコストなし** — 入力ガードレールがブロックすれば、モデル呼び出し自体が発生しません
- **組み込みと同じように動作** — エージェントごとに選択でき、アプリケーションのデフォルトとしても使用でき、他のガードレールと同様に [観測可能性] に記録されます

---

## Step 1 — ブロックするガードレールを実装する

`ConfidentialProjectGuardrail` は、機密プロジェクトのコードネームを含むメッセージを拒否します。

```java
public class ConfidentialProjectGuardrail implements SmartWorkflowInputGuardrail {

  private static final List<String> CODENAMES = List.of("project falcon", "project aurora", "project titan");

  @Override
  public GuardrailResult evaluate(String message) {
    if (message == null) {
      return GuardrailResult.allow();
    }
    String lower = message.toLowerCase(Locale.ROOT);
    for (String codename : CODENAMES) {
      if (lower.contains(codename)) {
        return GuardrailResult.block("Message blocked: it mentions the confidential project '" + codename
            + "'. Confidential project names must not be sent to an AI model.");
      }
    }
    return GuardrailResult.allow();
  }
}
```

理由（reason）は、ログやエラーダイアログでそれを読む人に向けて書いてください。何が見つかったのか、ルールは何かを記述します。

---

## Step 2 — 書き換えるガードレールを実装する

すべてのルールが呼び出しを終了させる必要はありません。`EmployeeIdRedactionGuardrail` はメッセージを通過させますが、その前に `EMP-004211` のような従業員IDをすべて置き換えます。

```java
public class EmployeeIdRedactionGuardrail implements SmartWorkflowInputGuardrail {

  private static final Pattern EMPLOYEE_ID = Pattern.compile("\\bEMP-\\d{4,6}\\b");
  private static final String PLACEHOLDER = "[EMPLOYEE-ID]";

  @Override
  public GuardrailResult evaluate(String message) {
    if (message == null) {
      return GuardrailResult.allow();
    }
    Matcher matcher = EMPLOYEE_ID.matcher(message);
    if (!matcher.find()) {
      return GuardrailResult.allow();
    }
    return GuardrailResult.allowWithRewrite(matcher.replaceAll(Matcher.quoteReplacement(PLACEHOLDER)));
  }
}
```

モデルが目にするのは `[EMPLOYEE-ID]` だけです。[PIIマスキングガードレール] とは異なり、このガードレールは元の値をレスポンスに戻しません — 一方向の秘匿化です。

---

## Step 3 — GuardrailProviderを作成する

プロバイダーは、プロジェクトが提供するガードレールを列挙します。`getInputGuardrails()`、`getOutputGuardrails()`、またはその両方をオーバーライドします。

```java
public class TutorialGuardrailProvider implements GuardrailProvider {

  @Override
  public List<SmartWorkflowInputGuardrail> getInputGuardrails() {
    return List.of(new ConfidentialProjectGuardrail(), new EmployeeIdRedactionGuardrail());
  }
}
```

1つのプロバイダーで、いくつでもガードレールを公開できます。

---

## Step 4 — SPIで登録する

`src/META-INF/services/com.axonivy.utils.smart.workflow.guardrails.provider.GuardrailProvider` ファイルを作成し、プロバイダーの完全修飾クラス名を追加します。

```text
tutorial.guardrail.TutorialGuardrailProvider
```

> **重要:** このファイルがないと、Smart Workflowはガードレールを検出しません。クラスはコンパイルされますが、ガードレールは実行されず、警告も出ません。
>
> このファイルで読み取られるのは**1行目だけ**です。そのため、1つのAxon Ivyプロジェクトが登録できるガードレールプロバイダーは1つです。新しいガードレールは、2行目を追加するのではなく、そのプロバイダーに追加してください。

---

## Step 5 — エージェントでガードレールを選択する

`AgenticProcessCall` 要素を開きます。**🛡️ Guardrails** グループの **Input guardrails** ピッカーに、組み込みのガードレールと並んで自分のガードレールが表示されます。チュートリアルでは両方を選択しています。

```json
["ConfidentialProjectGuardrail", "EmployeeIdRedactionGuardrail"]
```

**すべての**エージェントにガードレールを適用するには、アプリケーションのデフォルトに名前を指定します（[出力ガードレール] を参照）。

```yaml
Variables:
  AI:
    Guardrails:
      DefaultInput: PromptInjectionInputGuardrail, ConfidentialProjectGuardrail
```

> **注意:** エージェントで選択したガードレールは、そのエージェントのアプリケーションデフォルトを**置き換えます**。デフォルトのガードレールも引き続き適用したい場合は、それも一緒に選択してください。

---

## Step 6 — 違反を処理する

ブロックするカスタムガードレールは、組み込みのガードレールと同じBPMエラーを発生させます。エージェント要素に**エラー境界イベント**をアタッチします。

- **エラーコード:** `smartworkflow:guardrail:input:violation`（出力ガードレールの場合は `smartworkflow:guardrail:output:violation`）
- **出力マッピング:** `out → in` および `out.error → error`

```java
in.result = "Blocked by guardrail: " + in.error.getMessage();
ivy.log.error(in.result);
in.error = null;
```

書き換えるだけのガードレールはエラーを発生させません。呼び出しは書き換えられたメッセージでそのまま続行します。

---

## 例 — Acme Corp 社内アシスタント

サンプルプロセスには3つのスタートがあり、すべて同じエージェントにつながります。

| スタート | メッセージ | 動作 |
| --- | --- | --- |
| **18a: Custom guardrail - blocked** | *Project Falcon* の予算について質問する | `ConfidentialProjectGuardrail` がブロック — モデルは呼び出されません |
| **18b: Custom guardrail - allowed** | 経費精算のリマインダーを依頼する | 両方のガードレールが許可 — エージェントは通常どおり回答します |
| **18c: Custom guardrail - rewritten** | 従業員 `EMP-004211` への確認文を依頼する | `EmployeeIdRedactionGuardrail` がIDを置き換え — モデルには `[EMPLOYEE-ID]` が渡されます |

### エージェントの設定

| フィールド | 値 |
| --- | --- |
| システムメッセージ | *下記参照* |
| ユーザーメッセージ | `<%=in.query%>` |
| Input guardrails | `["ConfidentialProjectGuardrail", "EmployeeIdRedactionGuardrail"]` |
| 結果のマッピング先 | `in.result` |

```text
You are an internal assistant for Acme Corp employees. Answer in one or two sentences.
Placeholders in square brackets, such as [EMPLOYEE-ID], stand for data that was removed before it reached you. Keep them exactly as they are.
```

### 結果

**18a** — ガードレールがコードネームを検出し、メッセージをブロックします。**Show violation** Scriptが次のように記録します。

```text
Blocked by guardrail: The guardrail com.axonivy.utils.smart.workflow.guardrails.adapter.InputGuardrailAdapter
failed with this message: Message blocked: it mentions the confidential project 'project falcon'.
Confidential project names must not be sent to an AI model.
```

**18b** — 一致するものがないため、エージェントが回答します。**Show result** Scriptが、例えば次のように記録します。

```text
Agent answer: Reminder: please submit your expense reports by the end of the day on Friday.
```

**18c** — エージェントは回答しますが、従業員IDを一度も見ていません。

```text
Agent answer: The leave request of employee [EMPLOYEE-ID] has been approved.
```

---

## 知っておくべきこと

- **ガードレールのインスタンスは共有されます。** 同じオブジェクトがすべてのエージェントと同時実行中のすべての呼び出しを処理するため、呼び出しごとの状態をフィールドに保持しないでください。同じエージェント呼び出しの入力と出力を関連付ける必要がある場合は、2引数の `evaluate(String message, String invocationId)` を実装し、呼び出しIDをキーにして状態を保持します。[PIIマスキングガードレール] はこの方法でマスキングと復元を対応付けています。
- **書き換えは出力側でも使えます。** 出力ガードレールは `allowWithRewrite` を返して、レスポンスを破棄する代わりに整形できます。
- **出力ガードレールはリトライしません。** ブロックされたレスポンスは失われます。正当な回答をブロックするガードレールは、その呼び出し全体を無駄にします。
- **カスタムガードレールは組み込みと同様に記録されます** — Ivyの会話履歴と、Arize Phoenixの `GUARDRAIL` スパンに、ガードレールの `name()` で記録されます。[観測可能性] を参照してください。

---

## よくあるミス

- **SPI登録を忘れる** — ガードレールはピッカーに表示されず、実行もされません。警告も出ません。
- **サービスファイルに2行目のプロバイダーを追加する** — 読み取られるのは1行目だけです。すべてのガードレールを1つのプロバイダーにまとめてください。
- **ガードレールに状態を保持する** — インスタンスはエージェント間および同時実行中の呼び出し間で共有されます。
- **アプリケーションのデフォルトが有効なままだと期待する** — エージェントでガードレールを1つでも選択すると、そのエージェントのデフォルトは置き換えられます。
- **誤ったエラーコードをキャッチする** — 入力ガードレールは `smartworkflow:guardrail:input:violation`、出力ガードレールは `smartworkflow:guardrail:output:violation` を発生させます。
- **エラーメッセージで判定する** — エラーコードで分岐してください。メッセージはSmart Workflowによってラップされており、自分のガードレールではなく内部のアダプタークラス名が含まれます。

---

## サンプルプロセス

動作実装はチュートリアルプロジェクトで利用できます。

- `tutorial/process/tutorial/features/Feature18.p.json` — 3つのスタートを持つエージェントプロセス
- `tutorial/dataclass/tutorial/Feature18Data.d.json` — データクラス
- `tutorial/src/tutorial/guardrail/ConfidentialProjectGuardrail.java` — ブロックするガードレール
- `tutorial/src/tutorial/guardrail/EmployeeIdRedactionGuardrail.java` — 書き換えるガードレール
- `tutorial/src/tutorial/guardrail/TutorialGuardrailProvider.java` — プロバイダー
- `tutorial/src/META-INF/services/com.axonivy.utils.smart.workflow.guardrails.provider.GuardrailProvider` — SPI登録ファイル

Designerでプロセスを開き、`Internal Assistant Agent` 要素を確認してください。**Input guardrails** フィールドに2つのカスタムガードレールが設定され、エラー境界イベントがアタッチされています。

---

## 関連項目

- [入力ガードレール]
- [出力ガードレール]
- [PIIマスキングガードレール]
- [Javaツール]
- [観測可能性]
