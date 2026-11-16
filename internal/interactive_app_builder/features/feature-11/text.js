/**
 * Feature 11 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How personal data stays out of the model',
    'tour.intro.text': 'Watch the Feature11 process run: seven personal values are replaced by placeholders before the model sees them, and put back in its answer. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.both': 'Step 1 — Add PiiMaskingGuardrail to both lists',
    'tour.chapter.system': 'Step 2 — Set a system message',
    'tour.chapter.receives': 'What the LLM receives',
    'tour.chapter.result': 'Result',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.pii.title': 'A message full of personal data',
    'tour.pii.text': 'MAC address, email, phone, card number, SSN, date of birth and IP address: seven values that should not go to a cloud provider.',
    'tour.input.title': 'Input guardrails',
    'tour.input.text': 'As an input guardrail, `PiiMaskingGuardrail` replaces every personal value in the user message with a placeholder.',
    'tour.output.title': 'Output guardrails',
    'tour.output.text': 'As an output guardrail, the same guardrail puts the original values back into the answer. It has to be in both lists.',
    'tour.hint.title': 'Tell the model about the placeholders',
    'tour.hint.text': 'A value can only be put back where the model repeats its placeholder exactly. This system message asks it to treat each one as a fixed token.',

    'tour.masked.title': 'Placeholders instead of values',
    'tour.masked.text': 'Each value became `<TYPE_hash>`. The hash is derived from the value, so the same value always gets the same placeholder.',
    'tour.sent.title': 'This is all that leaves',
    'tour.sent.text': 'The provider receives the system message and the masked text. None of the seven values is in the request.',
    'tour.echo.title': 'The model answers with placeholders',
    'tour.echo.text': 'It never saw the real values, so it can only repeat the tokens.',

    'tour.restored.title': 'The originals are back',
    'tour.restored.text': 'The output guardrail finds each placeholder in the answer and replaces it with the value it stands for.',
    'tour.log.title': 'Log result',
    'tour.log.text': 'The process gets the answer with the real values, as if nothing had been masked.',

    'tour.inputOnly.title': 'Registering in input only',
    'tour.inputOnly.text': '`PiiMaskingGuardrail` is removed from the output guardrails.',
    'tour.placeholders.title': 'Nothing puts the values back',
    'tour.placeholders.text': 'The answer goes to the process as the model wrote it, placeholders and all.',
    'tour.noHint.title': 'LLM altering placeholders',
    'tour.noHint.text': 'Both lists are set again, but the system message is empty.',
    'tour.paraphrased.title': 'A reworded placeholder cannot be restored',
    'tour.paraphrased.text': 'The model described the tokens instead of repeating them. No error is raised: the values are simply missing.',

    'about.rules': 'PiiMaskingGuardrail uses the seven rules of the real class, in the same order, with the same Luhn check for card numbers. A placeholder ends in the first 12 hex digits of the SHA-256 of its value.|It is one object for both lists: the first message of a call that it sees is masked, the second restored. In the output list alone it therefore masks the answer.|The stand-in model repeats the listed fields, one per line. When its system message does not mention placeholders it describes each token instead of repeating it, to show what a model may do.',

    'ref.tools': 'Callable Process Tools',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',

    'insight.echoed': 'Repeated the {count} fields of the message, one per line.',
    'insight.kept': 'The system message explains the placeholders, so each one is repeated exactly.',
    'insight.paraphrased': 'Nothing told the model what the tokens are, so it described them instead of repeating them.',
    'insight.plain': 'The message lists no fields, so it is repeated as it is.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': '個人データをモデルに渡さない仕組み',
    'tour.intro.text': 'Feature11 プロセスの実行を見ていきます。7つの個人データは、モデルに届く前にプレースホルダーに置き換えられ、回答の中で元に戻されます。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.both': 'ステップ1 — 両方のリストにPiiMaskingGuardrailを追加する',
    'tour.chapter.system': 'ステップ2 — システムメッセージを設定する',
    'tour.chapter.receives': 'LLMが受け取る内容',
    'tour.chapter.result': '結果',
    'tour.chapter.mistakes': 'よくある間違い',

    'tour.pii.title': '個人データを多く含むメッセージ',
    'tour.pii.text': 'MAC アドレス、メール、電話番号、カード番号、SSN、生年月日、IP アドレス。クラウドのプロバイダーに送るべきではない7つの値です。',
    'tour.input.title': 'Input guardrails（入力ガードレール）',
    'tour.input.text': '入力ガードレールとしての `PiiMaskingGuardrail` は、ユーザーメッセージ内の個人データをすべてプレースホルダーに置き換えます。',
    'tour.output.title': 'Output guardrails（出力ガードレール）',
    'tour.output.text': '出力ガードレールとしては、同じガードレールが回答の中の値を元に戻します。必ず両方のリストに登録します。',
    'tour.hint.title': 'モデルにプレースホルダーのことを伝える',
    'tour.hint.text': '値を元に戻せるのは、モデルがプレースホルダーをそのまま繰り返した箇所だけです。このシステムメッセージは、各プレースホルダーを固定のトークンとして扱うよう指示しています。',

    'tour.masked.title': '値の代わりにプレースホルダー',
    'tour.masked.text': 'それぞれの値が `<TYPE_hash>` になりました。ハッシュは値から計算されるため、同じ値には常に同じプレースホルダーが付きます。',
    'tour.sent.title': '外に出るのはこれだけ',
    'tour.sent.text': 'プロバイダーが受け取るのは、システムメッセージとマスク済みのテキストです。7つの値はどれもリクエストに含まれていません。',
    'tour.echo.title': 'モデルはプレースホルダーで回答する',
    'tour.echo.text': '実際の値を見ていないため、トークンを繰り返すことしかできません。',

    'tour.restored.title': '元の値が戻る',
    'tour.restored.text': '出力ガードレールは、回答の中のプレースホルダーを見つけ、対応する元の値に置き換えます。',
    'tour.log.title': 'Log result',
    'tour.log.text': 'プロセスには、マスクなどなかったかのように、実際の値を含む回答が届きます。',

    'tour.inputOnly.title': '入力のみに登録する',
    'tour.inputOnly.text': '出力ガードレールから `PiiMaskingGuardrail` を外しました。',
    'tour.placeholders.title': '値を戻すものがない',
    'tour.placeholders.text': '回答は、モデルが書いたとおり、プレースホルダーのままプロセスに渡されます。',
    'tour.noHint.title': 'LLM がプレースホルダーを書き換える',
    'tour.noHint.text': '両方のリストに登録し直しましたが、システムメッセージは空です。',
    'tour.paraphrased.title': '言い換えられたプレースホルダーは復元できない',
    'tour.paraphrased.text': 'モデルはトークンを繰り返さず、言葉で説明してしまいました。エラーは発生せず、値がないままになります。',

    'about.rules': 'PiiMaskingGuardrail は実際のクラスと同じ7つのルールを同じ順序で適用し、カード番号には同じ Luhn チェックを行います。プレースホルダーの末尾は、値の SHA-256 の先頭12桁（16進）です。|このガードレールは両方のリストで共有される1つのオブジェクトです。1回の呼び出しで最初に受け取ったメッセージをマスクし、2番目を復元します。そのため、出力リストだけに登録すると回答をマスクします。|モデルの代役は、列挙されたフィールドを1行ずつ繰り返します。システムメッセージにプレースホルダーの説明がない場合は、モデルが起こし得る動作を示すために、トークンを繰り返さず言葉で説明します。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',

    'insight.echoed': 'メッセージの {count} 個のフィールドを、1行ずつ繰り返しました。',
    'insight.kept': 'システムメッセージにプレースホルダーの説明があるため、それぞれをそのまま繰り返しました。',
    'insight.paraphrased': 'トークンが何であるかを伝えられていないため、繰り返さずに言葉で説明しました。',
    'insight.plain': 'メッセージにフィールドの列挙がないため、そのまま繰り返しました。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  return t('insight.' + insight.id, { count: insight.count });
}
