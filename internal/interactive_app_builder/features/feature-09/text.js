/**
 * Feature 09 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How an output guardrail stops an answer',
    'tour.intro.text': 'Watch the Feature09 process run: the model answers with API key examples, the guardrail blocks the answer, and an Error Boundary Event catches the error. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.add': 'Step 1 — Add the output guardrail to the agent',
    'tour.chapter.boundary': 'Step 2 — Add an Error Boundary Event',
    'tour.chapter.handle': 'Step 3 — Handle the violation',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.guardrail.title': 'Output guardrails',
    'tour.guardrail.text': '`SensitiveDataOutputGuardrail` is built in. It checks every answer of this agent for API keys and private keys.',
    'tour.answer.title': 'The model answers',
    'tour.answer.text': 'The question asks for examples of API keys, and the model gives two. The answer has arrived at the agent, not yet at the process.',
    'tour.inspects.title': 'The guardrail finds a key',
    'tour.inspects.text': 'It reads the answer before it is mapped. This part looks like an API key:',
    'tour.blocked.title': 'Blocked',
    'tour.blocked.text': 'The answer is thrown away. Instead of a result, the agent element throws a BPM error with this code:',

    'tour.code.title': 'Error Code',
    'tour.code.text': 'The event sits on the agent and catches errors with exactly this code. Output guardrails always throw this one.',
    'tour.mapping.title': 'Output mapping',
    'tour.mapping.text': '`out.error ← error` stores the caught error in the process data, so the next step can read its message.',
    'tour.caught.title': 'The error is caught',
    'tour.caught.text': 'The process does not crash. It leaves the agent through the boundary event and follows that path.',

    'tour.script.title': 'Show violation',
    'tour.script.text': '`in.error.getMessage()` is the reason for the block. This script writes it to `in.result` and to the log.',
    'tour.log.title': 'What the log says',
    'tour.log.text': 'The message names the guardrail and its reason. The answer of the model appears nowhere.',
    'tour.discarded.title': 'No answer in the process data',
    'tour.discarded.text': '`in.result` holds the violation message. The answer with the keys never reached the process.',

    'tour.wrongCode.title': 'Wrong error code',
    'tour.wrongCode.text': 'The event now waits for an input violation. An output guardrail throws `…:output:violation`.',
    'tour.unhandled.title': 'Nobody catches the error',
    'tour.unhandled.text': 'The codes do not match, so the error is unhandled and the process stops at the agent. The same happens without a boundary event.',
    'tour.unhandledLog.title': 'An unhandled error',
    'tour.unhandledLog.text': 'The Runtime Log reports the error with its code.',

    'about.rules': 'The stand-in model has one prepared answer: asked for the format of an API key, it gives two made-up example keys.|SensitiveDataOutputGuardrail uses the patterns of the real class: keys that start with sk-, AWS, GitHub, Google and xAI keys, private key headers, and any API key configured in variables.yaml.|The text of the error is how langchain4j words a failed guardrail, with the reason the guardrail class gives. It has not been compared with a running Axon Ivy engine.|An Error Boundary Event catches a code that equals its own, or that fits its pattern with *.',

    'ref.tools': 'Callable Process Tools',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',

    'insight.key-examples': 'The question asks about API keys, so the answer contains two made-up example keys.',
    'insight.generic': 'There is no prepared answer for this question.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': '出力ガードレールが回答を止める仕組み',
    'tour.intro.text': 'Feature09 プロセスの実行を見ていきます。モデルが API キーの例を含む回答を返し、ガードレールがそれをブロックし、エラー境界イベントがエラーをキャッチします。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.add': 'Step 1 — エージェントに出力ガードレールを追加する',
    'tour.chapter.boundary': 'Step 2 — エラー境界イベントを追加する',
    'tour.chapter.handle': 'Step 3 — 違反を処理する',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.guardrail.title': 'Output guardrails（出力ガードレール）',
    'tour.guardrail.text': '`SensitiveDataOutputGuardrail` は組み込みのガードレールです。このエージェントの回答すべてについて、API キーや秘密鍵が含まれていないかを検査します。',
    'tour.answer.title': 'モデルが回答する',
    'tour.answer.text': '質問は API キーの例を求めており、モデルは2つの例を返しました。回答はエージェントに届いた段階で、まだプロセスには渡っていません。',
    'tour.inspects.title': 'ガードレールがキーを検出する',
    'tour.inspects.text': 'マッピングされる前に回答を読み取ります。次の部分が API キーに見えます:',
    'tour.blocked.title': 'ブロック',
    'tour.blocked.text': '回答は破棄されます。結果の代わりに、エージェント要素は次のコードの BPM エラーをスローします:',

    'tour.code.title': 'Error Code（エラーコード）',
    'tour.code.text': 'このイベントはエージェントに付いており、このコードと一致するエラーをキャッチします。出力ガードレールは常にこのコードをスローします。',
    'tour.mapping.title': '出力マッピング',
    'tour.mapping.text': '`out.error ← error` でキャッチしたエラーをプロセスデータに保存し、次のステップでメッセージを読めるようにします。',
    'tour.caught.title': 'エラーがキャッチされる',
    'tour.caught.text': 'プロセスは異常終了しません。境界イベントからエージェントを抜け、そのパスを進みます。',

    'tour.script.title': 'Show violation',
    'tour.script.text': '`in.error.getMessage()` はブロックの理由です。このスクリプトは、それを `in.result` とログに書き込みます。',
    'tour.log.title': 'ログの内容',
    'tour.log.text': 'メッセージにはガードレールとその理由が含まれています。モデルの回答はどこにも出てきません。',
    'tour.discarded.title': 'プロセスデータに回答はない',
    'tour.discarded.text': '`in.result` に入っているのは違反メッセージです。キーを含む回答はプロセスに届いていません。',

    'tour.wrongCode.title': 'エラーコードの誤り',
    'tour.wrongCode.text': 'イベントが入力違反を待つようになりました。出力ガードレールがスローするのは `…:output:violation` です。',
    'tour.unhandled.title': '誰もエラーをキャッチしない',
    'tour.unhandled.text': 'コードが一致しないため、エラーは未処理となり、プロセスはエージェントで停止します。境界イベントがない場合も同じです。',
    'tour.unhandledLog.title': '未処理のエラー',
    'tour.unhandledLog.text': 'ランタイムログには、エラーとそのコードが記録されます。',

    'about.rules': 'モデルの代役が用意している回答は1つだけです。API キーの形式を尋ねられると、架空のキーの例を2つ返します。|SensitiveDataOutputGuardrail は実際のクラスと同じパターンを使います。sk- で始まるキー、AWS・GitHub・Google・xAI のキー、秘密鍵のヘッダー、そして variables.yaml に設定された API キーです。|エラーの文言は、langchain4j がガードレールの失敗を表す形式に、ガードレールクラスの理由を組み合わせたものです。実際の Axon Ivy エンジンとは照合していません。|エラー境界イベントは、自分のコードと一致するコード、または * を含むパターンに合うコードをキャッチします。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',

    'insight.key-examples': '質問が API キーについてのものなので、回答には架空のキーの例が2つ含まれています。',
    'insight.generic': 'この質問には用意された回答がありません。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  return t('insight.' + insight.id);
}
