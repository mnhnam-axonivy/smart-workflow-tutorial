/**
 * Feature 17 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'What temperature changes',
    'tour.intro.text': 'Watch the Feature17 process run several times: two agents write a subject line for the same invoice, one at temperature 0.0 and one at 1.0. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.where': 'Where to find them',
    'tour.chapter.temperature': 'Temperature',
    'tour.chapter.result': 'Result',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.model.title': 'The Model group',
    'tour.model.text': 'The model settings are in the same group as provider and model. Like them, they apply to this element only: there is no global default in variables.yaml.',
    'tour.optional.title': 'Optional Settings',
    'tour.optional.text': 'Below Provider and Model, under Optional Settings, is the Temperature field. Most agents leave it empty and run at the default, 0.0.',

    'tour.zero.title': 'Temperature 0.0',
    'tour.zero.text': 'The most deterministic setting: the same input gives almost the same output. The field is an IvyScript expression that yields a String, so the value is written in quotes.',
    'tour.plain.title': 'The deterministic subject',
    'tour.plain.text': 'At 0.0 the model takes its most likely wording.',
    'tour.fromData.title': 'A value from the process data',
    'tour.fromData.text': '`in.temperature` is a String field. Mock data set it to "1.0", so the temperature of this agent is decided at runtime.',
    'tour.lively.title': 'The creative subject',
    'tour.lively.text': 'At 1.0 the model allows itself less likely wordings. This line differs from the first.',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': 'Both subject lines are logged, each with its temperature.',

    'tour.first.title': 'Run 1',
    'tour.first.text': 'One run tells you little. Temperature shows when the same process runs again.',
    'tour.second.title': 'Run 2',
    'tour.second.text': 'The line at 0.0 is the same as before. The line at 1.0 is a new one.',
    'tour.third.title': 'Run 3',
    'tour.third.text': 'Repeatable where the process depends on the answer, varied where a person reads it: that is what the setting is for.',

    'tour.badValue.title': 'A value that is no number',
    'tour.badValue.text': 'Mock data now sets `in.temperature` to "high".',
    'tour.silent.title': 'No error',
    'tour.silent.text': 'Smart Workflow cannot read a temperature from that value and sends {sent} instead. Nothing is logged.',
    'tour.noVariety.title': 'It only shows in the output',
    'tour.noVariety.text': 'Both agents ran at 0.0, so both wrote the same line. When output varies less than you expect, check the temperature that was recorded.',

    'about.rules': 'The stand-in model writes one subject line for the invoice. At temperature 0.0 it is always the same line. The higher the temperature, the more wordings it chooses from, and every run takes another one. A real model varies at random.|The temperature that is sent follows Smart Workflow: empty, not a number or negative all become 0.0, without an error. It is shown next to the model in the Agent conversation.|OpenAI is simulated to reject a temperature above 2 and Anthropic one above 1, the ranges this tutorial gives. The wording of that error is this simulation’s own.',

    'ref.tools': 'Callable Process Tools',
    'ref.guardrails': 'Output Guardrail',
    'ref.structuredOutput': 'Structured Output',

    'insight.fixed': 'Temperature 0.0: the same wording on every run.',
    'insight.varied': 'Temperature {temperature}: one of {count} wordings, and another one on the next run.',
    'insight.no-invoice': 'The user message contains no invoice number.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'temperature で何が変わるか',
    'tour.intro.text': 'Feature17 プロセスを何度か実行します。2つのエージェントが同じ請求書の件名を、一方は temperature 0.0、もう一方は 1.0 で書きます。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.where': '設定の場所',
    'tour.chapter.temperature': 'Temperature（温度）',
    'tour.chapter.result': '結果',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.model.title': 'Model グループ',
    'tour.model.text': 'モデル設定は、プロバイダーやモデルと同じグループにあります。それらと同じく、この要素だけに適用されます。variables.yaml にグローバルなデフォルトはありません。',
    'tour.optional.title': 'Optional Settings',
    'tour.optional.text': 'Provider と Model の下、Optional Settings に Temperature フィールドがあります。ほとんどのエージェントは空のままにして、デフォルトの 0.0 で実行します。',

    'tour.zero.title': 'Temperature 0.0',
    'tour.zero.text': '最も決定的な設定です。同じ入力に対して、ほぼ同じ出力が返ります。このフィールドは String を返す IvyScript 式なので、値は引用符で囲みます。',
    'tour.plain.title': '決定的な件名',
    'tour.plain.text': '0.0 では、モデルは最も確率の高い言い回しを選びます。',
    'tour.fromData.title': 'プロセスデータから取る値',
    'tour.fromData.text': '`in.temperature` は String フィールドです。Mock data が "1.0" を設定しているため、このエージェントの temperature は実行時に決まります。',
    'tour.lively.title': '創造的な件名',
    'tour.lively.text': '1.0 では、モデルは確率の低い言い回しも選びます。1つ目とは違う件名になりました。',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': '2つの件名が、それぞれの temperature とともにログに出力されます。',

    'tour.first.title': '1回目の実行',
    'tour.first.text': '1回の実行だけでは違いが分かりません。temperature の効果は、同じプロセスをもう一度実行したときに現れます。',
    'tour.second.title': '2回目の実行',
    'tour.second.text': '0.0 の件名は前回と同じです。1.0 の件名は新しいものになりました。',
    'tour.third.title': '3回目の実行',
    'tour.third.text': 'プロセスが回答に依存する箇所では再現性を、人が読む文章では変化を。この設定はそのためにあります。',

    'tour.badValue.title': '数値ではない値',
    'tour.badValue.text': 'Mock data が `in.temperature` に "high" を設定するようにしました。',
    'tour.silent.title': 'エラーにはならない',
    'tour.silent.text': 'Smart Workflow はこの値から temperature を読み取れないため、代わりに {sent} を送信します。ログには何も出ません。',
    'tour.noVariety.title': '出力にしか現れない',
    'tour.noVariety.text': 'どちらのエージェントも 0.0 で実行されたため、同じ件名を書きました。出力の変化が期待より少ないときは、記録された temperature を確認しましょう。',

    'about.rules': 'モデルの代役は、請求書の件名を1つ書きます。temperature 0.0 では常に同じ件名です。temperature が高いほど選べる言い回しが増え、実行のたびに別のものを選びます。実際のモデルはランダムに変化します。|送信される temperature は Smart Workflow と同じ規則に従います。空、数値でない値、負の値は、エラーなしですべて 0.0 になります。値は「Agent conversation」のモデル名の横に表示されます。|このチュートリアルが示す範囲に合わせ、OpenAI は 2 を超える temperature を、Anthropic は 1 を超える temperature を拒否するようにシミュレーションしています。そのエラーの文言は、このシミュレーション独自のものです。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.guardrails': '出力ガードレール',
    'ref.structuredOutput': '構造化出力',

    'insight.fixed': 'temperature 0.0: 実行のたびに同じ言い回しです。',
    'insight.varied': 'temperature {temperature}: {count} 通りの言い回しのうちの1つです。次の実行では別のものになります。',
    'insight.no-invoice': 'ユーザーメッセージに請求書番号がありません。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  return t('insight.' + insight.id, { count: insight.count, temperature: insight.temperature });
}
