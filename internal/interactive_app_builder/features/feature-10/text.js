/**
 * Feature 10 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How an input guardrail stops an attack',
    'tour.intro.text': 'Watch the two flows of Feature10: a prompt injection is stopped by regular expressions, and a role-play attack by a classifier model. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 3 min, 4 with the voice',
    'tour.chapter.why': 'Why use it?',
    'tour.chapter.regex': 'Example A — PromptInjectionInputGuardrail (regex)',
    'tour.chapter.classifier': 'Example B — AiPromptInjectionInputGuardrail (LLM classifier)',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.unguarded.title': 'An agent without a guardrail',
    'tour.unguarded.text': 'The input guardrail is removed, to show what it is there for.',
    'tour.attack.title': 'A prompt injection',
    'tour.attack.text': 'The user message tries to replace the instructions of the agent and to get at its system prompt.',
    'tour.leak.title': 'The model gives in',
    'tour.leak.text': 'It takes the message for an instruction and reveals its system prompt. A real model may refuse; a guardrail does not leave that to chance.',

    'tour.inputGuardrail.title': 'Input guardrails',
    'tour.inputGuardrail.text': '`PromptInjectionInputGuardrail` checks the user message with regular expressions before anything is sent: fast, free, and the same every time.',
    'tour.matched.title': 'A known pattern',
    'tour.matched.text': 'This part of the message matches one of the patterns:',
    'tour.never.title': 'Blocked before the model',
    'tour.never.text': 'Nothing was sent, so no tokens were spent and nothing could leak. The agent element throws a BPM error with this code:',
    'tour.caught.title': 'The error is caught',
    'tour.caught.text': 'An Error Boundary Event for the input violation leads to the path that handles it.',
    'tour.log.title': 'Show violation',
    'tour.log.text': 'The script logs the reason, as in Output Guardrail.',

    'tour.subtle.title': 'An attack in disguise',
    'tour.subtle.text': 'A role-play: the message asks the model to answer as an AI without rules.',
    'tour.aiGuardrail.title': 'A guardrail that asks a model',
    'tour.aiGuardrail.text': '`AiPromptInjectionInputGuardrail` sends the message to a separate model call whose only job is to answer one question: is this an attack, YES or NO?',
    'tour.extraCall.title': 'An extra call to {provider}',
    'tour.extraCall.text': 'Before the agent calls the model, the guardrail sends the user message to {provider} ({model}) in a request of its own, with a classifier prompt. The answer is only YES or NO.',
    'tour.classified.title': 'The classifier says {verdict}',
    'tour.classified.text': 'One extra call to {provider} ({model}) judged what the message is after. That costs tokens and time on every request.',

    'tour.wrongCode.title': 'Wrong error code',
    'tour.wrongCode.text': 'The event now waits for an output violation. An input guardrail throws `…:input:violation`.',
    'tour.unhandled.title': 'Nobody catches the error',
    'tour.unhandled.text': 'The process stops at the agent with an unhandled error. Use the code that matches the kind of guardrail.',
    'tour.benignEdit.title': 'A harmless role',
    'tour.benignEdit.text': 'The message now asks the agent to act as a patient teacher.',
    'tour.benign.title': 'The classifier says {verdict}',
    'tour.benign.text': 'Not every role-play is an attack: this one removes no rule. The message goes on to the model.',
    'tour.served.title': 'The customer gets an answer',
    'tour.served.text': 'Test the guardrail with messages your users really write, so it stops attacks and nothing else.',

    'about.rules': 'PromptInjectionInputGuardrail uses the three patterns of the real class. One of them rejects control characters, and a line break is one: a message of several lines is always rejected, in the real class too.|The classifier of AiPromptInjectionInputGuardrail is not a model here. A handful of patterns stand in for it: overriding instructions, a role without rules, asking for the system prompt. A question about such attacks is answered NO.|Without a guardrail the stand-in model obeys an injection and reveals its system prompt. A real model may refuse.|The process has two starts. Run begins at the start you have selected, otherwise at the first.|The text of the error is how langchain4j words a failed guardrail. It has not been compared with a running Axon Ivy engine.',

    'ref.tools': 'Callable Process Tools',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',

    'insight.gave-in': 'The message reads like an instruction to the model, and the stand-in follows it.',
    'insight.support': 'An ordinary request: the stand-in answers as a support agent.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': '入力ガードレールが攻撃を止める仕組み',
    'tour.intro.text': 'Feature10 の2つのフローを見ていきます。プロンプトインジェクションは正規表現で、ロールプレイを装った攻撃は分類用モデルで止められます。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約3分（音声ありで約4分）',
    'tour.chapter.why': 'なぜ使うのか?',
    'tour.chapter.regex': '例A — PromptInjectionInputGuardrail（正規表現）',
    'tour.chapter.classifier': '例B — AiPromptInjectionInputGuardrail（LLM分類器）',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.unguarded.title': 'ガードレールのないエージェント',
    'tour.unguarded.text': '入力ガードレールを外して、その役割を確かめます。',
    'tour.attack.title': 'プロンプトインジェクション',
    'tour.attack.text': 'このユーザーメッセージは、エージェントへの指示を書き換え、システムプロンプトを引き出そうとしています。',
    'tour.leak.title': 'モデルが従ってしまう',
    'tour.leak.text': 'メッセージを指示として受け取り、システムプロンプトを明かしました。実際のモデルは拒否することもありますが、ガードレールがあれば運任せになりません。',

    'tour.inputGuardrail.title': 'Input guardrails（入力ガードレール）',
    'tour.inputGuardrail.text': '`PromptInjectionInputGuardrail` は、何かを送信する前に、ユーザーメッセージを正規表現で検査します。高速で、無料で、結果は常に同じです。',
    'tour.matched.title': '既知のパターン',
    'tour.matched.text': 'メッセージの次の部分が、パターンの1つに一致します:',
    'tour.never.title': 'モデルに届く前にブロック',
    'tour.never.text': '何も送信されていないため、トークンは消費されず、情報が漏れることもありません。エージェント要素は次のコードの BPM エラーをスローします:',
    'tour.caught.title': 'エラーがキャッチされる',
    'tour.caught.text': '入力違反用のエラー境界イベントが、違反を処理するパスへ進めます。',
    'tour.log.title': 'Show violation',
    'tour.log.text': '「出力ガードレール」と同じように、スクリプトが理由をログに出力します。',

    'tour.subtle.title': '装われた攻撃',
    'tour.subtle.text': 'ロールプレイです。ルールのない AI として答えるよう、モデルに求めています。',
    'tour.aiGuardrail.title': 'モデルに判定させるガードレール',
    'tour.aiGuardrail.text': '`AiPromptInjectionInputGuardrail` は、メッセージを別のモデル呼び出しに渡します。その役割は「これは攻撃か」に YES か NO で答えることだけです。',
    'tour.extraCall.title': '{provider} への追加の呼び出し',
    'tour.extraCall.text': 'エージェントがモデルを呼び出す前に、ガードレールはユーザーメッセージを分類用のプロンプトと共に、独立したリクエストで {provider}（{model}）に送信します。回答は YES か NO だけです。',
    'tour.classified.title': '分類器の判定: {verdict}',
    'tour.classified.text': '{provider}（{model}）への追加の呼び出しが、メッセージの意図を判定しました。リクエストのたびにトークンと時間がかかります。',

    'tour.wrongCode.title': 'エラーコードの誤り',
    'tour.wrongCode.text': 'イベントが出力違反を待つようになりました。入力ガードレールがスローするのは `…:input:violation` です。',
    'tour.unhandled.title': '誰もエラーをキャッチしない',
    'tour.unhandled.text': 'プロセスは未処理のエラーでエージェントに止まります。ガードレールの種類に合ったコードを使いましょう。',
    'tour.benignEdit.title': '害のない役割',
    'tour.benignEdit.text': 'メッセージを、根気強い先生として振る舞うよう頼む内容に変えました。',
    'tour.benign.title': '分類器の判定: {verdict}',
    'tour.benign.text': 'ロールプレイがすべて攻撃というわけではありません。これはルールを外そうとしていないため、メッセージはモデルに渡されます。',
    'tour.served.title': '顧客は回答を受け取る',
    'tour.served.text': '実際にユーザーが書くメッセージでガードレールを試し、攻撃だけを止めることを確認しましょう。',

    'about.rules': 'PromptInjectionInputGuardrail は実際のクラスと同じ3つのパターンを使います。そのうち1つは制御文字を拒否し、改行も制御文字に含まれるため、複数行のメッセージは実際のクラスでも必ず拒否されます。|AiPromptInjectionInputGuardrail の分類器は、ここではモデルではありません。指示の上書き、ルールのない役割、システムプロンプトの要求など、いくつかのパターンで代用しています。こうした攻撃についての質問には NO と答えます。|ガードレールがない場合、モデルの代役はインジェクションに従い、システムプロンプトを明かします。実際のモデルは拒否することもあります。|このプロセスには開始が2つあります。「実行」は、選択中の開始から、選択がなければ最初の開始から始まります。|エラーの文言は、langchain4j がガードレールの失敗を表す形式です。実際の Axon Ivy エンジンとは照合していません。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',

    'insight.gave-in': 'メッセージがモデルへの指示のように読めるため、代役はそれに従いました。',
    'insight.support': '通常の問い合わせです。代役はサポート担当として回答しました。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  return t('insight.' + insight.id);
}
