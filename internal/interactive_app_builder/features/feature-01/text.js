/**
 * Feature 01 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word),
 * tour.<note>.title/.text, about.rules, ref.* (names of the tutorials a setting belongs to).
 */

const FIELD_NAMES = {
  en: { number: 'invoice number', supplier: 'supplier', total: 'total amount', due: 'due date', date: 'invoice date', billTo: 'recipient', terms: 'payment terms', subtotal: 'subtotal', tax: 'tax', bank: 'bank', items: 'line items' },
  ja: { number: '請求書番号', supplier: 'サプライヤー', total: '合計金額', due: '支払期限', date: '発行日', billTo: '請求先', terms: '支払条件', subtotal: '小計', tax: '税額', bank: '銀行', items: '品目' }
};

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How the agent step works',
    'tour.intro.text': 'Watch the Feature01 process run, with every setting explained at the moment it matters. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 3 min',
    'tour.chapter.run': 'Element configuration',
    'tour.chapter.system': 'System message',
    'tour.chapter.data': 'User message',
    'tour.chapter.mapping': 'Map result to',
    'tour.chapter.variables': 'Global configuration — variables.yaml',

    'tour.mock.title': 'Mock data',
    'tour.mock.text': 'This script stands in for the employee who pastes the invoice. It fills `in.invoiceText` with the invoice text.',
    'tour.query.title': 'User message',
    'tour.query.text': '`<%=in.invoiceText%>` is resolved when the process runs. This is the data the model works on.',
    'tour.system.title': 'System message',
    'tour.system.text': 'The job description of the agent: who it is, what it must return, and in which format. The model knows nothing else about your business.',
    'tour.mapping.title': 'Map result to',
    'tour.mapping.text': 'The answer comes back as a plain String and is written to `in.summary`.',
    'tour.call.title': 'The call to the model',
    'tour.call.text': 'Smart Workflow sends both messages to {provider}, the provider set in variables.yaml. You write no code for the call.',
    'tour.answer.title': 'The answer',
    'tour.answer.text': 'One sentence with the four facts, exactly as the system message asked. It is now stored in `in.summary`.',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': 'This script logs the summary. In the Designer you find the line in the Axon Ivy Runtime Log.',

    'tour.systemEdit.title': 'A new instruction',
    'tour.systemEdit.text': '“a single sentence summary” becomes “a bullet list”. Nothing else changes.',
    'tour.systemList.title': 'Same invoice, different answer',
    'tour.systemList.text': 'The model follows the new instruction: the same four facts now come back as a list.',
    'tour.systemEmpty.title': 'No job description',
    'tour.systemEmpty.text': 'Now the system message is removed altogether.',
    'tour.systemGuess.title': 'The model has to guess',
    'tour.systemGuess.text': 'Without a system message the model does not know what you want. Here it reports every field it can find, not only the four the summary needs. A precise system message is what makes an agent reliable.',

    'tour.dataEdit.title': 'Another invoice',
    'tour.dataEdit.text': 'The total in the mock data changes to JPY 99,000.00. The agent is not touched.',
    'tour.dataResult.title': 'The summary follows the data',
    'tour.dataResult.text': 'The user message is built from the process data at run time, so the same agent handles every invoice.',

    'tour.mappingEdit.title': 'No target',
    'tour.mappingEdit.text': '“Map result to” is now empty.',
    'tour.mappingLost.title': 'The answer is discarded',
    'tour.mappingLost.text': 'The model still answers, but nothing says where the answer belongs, so it is not stored.',
    'tour.mappingLog.title': 'Nothing to show',
    'tour.mappingLog.text': '`in.summary` was never filled, so the next step logs an empty value.',

    'tour.varsProvider.title': 'One place for the AI connection',
    'tour.varsProvider.text': '`DefaultProvider` names the provider every AgenticProcessCall in the project uses, unless an element chooses its own.',
    'tour.varsKey.title': 'The API key',
    'tour.varsKey.text': 'The block of the provider holds the key Smart Workflow authenticates with. Keep real keys out of source control.',
    'tour.varsRemove.title': 'Without the key',
    'tour.varsRemove.text': 'The key is deleted to show what happens.',
    'tour.varsFailed.title': 'No API key, no call',
    'tour.varsFailed.text': '{provider} rejects the request, the agent step fails and the process stops here. No agent can run before this file is set up.',

    'about.rules': 'It reports the facts your system message asks for: invoice number, supplier, total amount, due date and a few more.|It follows “single sentence”, “bullet list”, “JSON”, “no other commentary” and “answer in Japanese / English”.|With an empty system message it guesses, and guesses differently on every run.|Anything else in your prompt is ignored. A real model would act on it.',

    'ref.tools': 'Callable Process Tools',
    'ref.guardrails': 'Output Guardrail',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',

    'insight.fields': 'Facts asked for: {list}.',
    'insight.default-fields': 'No particular facts were asked for, so it reports the usual four: {list}.',
    'insight.single-sentence': '“Single sentence” → one sentence.',
    'insight.several-sentences': 'No sentence limit → one short sentence per fact.',
    'insight.bullets': 'A list was asked for → bullet points.',
    'insight.json': 'JSON was asked for → a JSON object, returned as text.',
    'insight.no-commentary': '“No other commentary” → only the summary.',
    'insight.chatty': 'Nothing rules out extra commentary → it adds a greeting and a closing line.',
    'insight.language': 'Answer language: {language}.',
    'insight.missing': 'Not found in the invoice text: {list}.',
    'insight.no-invoice': 'The user message contains no invoice facts.',
    'insight.no-system': 'No system message: the model has to guess what you want. This is answer style {variant} of 3 — run again and it changes.',
    'language.en': 'English',
    'language.ja': 'Japanese'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'エージェントステップの仕組み',
    'tour.intro.text': 'Feature01 プロセスの実行を見ながら、それぞれの設定が効く場面で解説します。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約3分',
    'tour.chapter.run': '要素の設定',
    'tour.chapter.system': 'システムメッセージ',
    'tour.chapter.data': 'ユーザーメッセージ',
    'tour.chapter.mapping': '結果のマッピング先',
    'tour.chapter.variables': 'グローバル設定 — variables.yaml',

    'tour.mock.title': 'Mock data',
    'tour.mock.text': 'このスクリプトは、請求書を貼り付ける担当者の代わりです。`in.invoiceText` に請求書のテキストを設定します。',
    'tour.query.title': 'User message（ユーザーメッセージ）',
    'tour.query.text': '`<%=in.invoiceText%>` はプロセスの実行時に解決されます。これがモデルの処理するデータです。',
    'tour.system.title': 'System message（システムメッセージ）',
    'tour.system.text': 'エージェントの職務記述です。何者で、何を、どの形式で返すのかを伝えます。モデルは、あなたの業務についてこれ以外のことを知りません。',
    'tour.mapping.title': 'Map result to',
    'tour.mapping.text': '回答はプレーンな String で返り、`in.summary` に書き込まれます。',
    'tour.call.title': 'モデルの呼び出し',
    'tour.call.text': 'Smart Workflow が2つのメッセージを、variables.yaml で設定したプロバイダー {provider} に送信します。呼び出しのコードを書く必要はありません。',
    'tour.answer.title': '回答',
    'tour.answer.text': 'システムメッセージの指示どおり、4つの項目を含む1文です。`in.summary` に保存されました。',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': 'このスクリプトが要約をログに出力します。Designer では Axon Ivy Runtime Log で確認できます。',

    'tour.systemEdit.title': '指示を変える',
    'tour.systemEdit.text': '「a single sentence summary」を「a bullet list」に変えます。ほかは何も変えません。',
    'tour.systemList.title': '同じ請求書、違う回答',
    'tour.systemList.text': 'モデルは新しい指示に従い、同じ4つの項目を箇条書きで返します。',
    'tour.systemEmpty.title': '職務記述をなくす',
    'tour.systemEmpty.text': '今度はシステムメッセージをすべて削除します。',
    'tour.systemGuess.title': 'モデルは推測するしかない',
    'tour.systemGuess.text': 'システムメッセージがないと、モデルは何を求められているのか分かりません。ここでは、要約に必要な4項目だけでなく、見つけた項目をすべて報告しています。エージェントを安定させるのは、的確なシステムメッセージです。',

    'tour.dataEdit.title': '別の請求書',
    'tour.dataEdit.text': 'モックデータの合計金額を JPY 99,000.00 に変えます。エージェントには手を加えません。',
    'tour.dataResult.title': '要約はデータに従う',
    'tour.dataResult.text': 'ユーザーメッセージは実行時にプロセスデータから組み立てられるため、同じエージェントがどの請求書も処理できます。',

    'tour.mappingEdit.title': 'マッピング先なし',
    'tour.mappingEdit.text': '「Map result to」を空にしました。',
    'tour.mappingLost.title': '回答は破棄される',
    'tour.mappingLost.text': 'モデルは回答しますが、書き込み先の指定がないため、回答は保存されません。',
    'tour.mappingLog.title': '表示するものがない',
    'tour.mappingLog.text': '`in.summary` が設定されなかったため、次のステップは空の値をログに出力します。',

    'tour.varsProvider.title': 'AI 接続の設定は1か所',
    'tour.varsProvider.text': '`DefaultProvider` は、要素が個別に指定しない限り、プロジェクト内のすべての AgenticProcessCall が使うプロバイダーです。',
    'tour.varsKey.title': 'APIキー',
    'tour.varsKey.text': 'プロバイダーのブロックに、Smart Workflow が認証に使うキーを設定します。本物のキーはソース管理に含めないでください。',
    'tour.varsRemove.title': 'キーがない場合',
    'tour.varsRemove.text': '何が起きるかを見るために、キーを削除します。',
    'tour.varsFailed.title': 'APIキーがなければ呼び出せない',
    'tour.varsFailed.text': '{provider} がリクエストを拒否し、エージェントのステップは失敗して、プロセスはここで止まります。このファイルを設定するまで、どのエージェントも実行できません。',

    'about.rules': 'システムメッセージで求められた項目（請求書番号、サプライヤー、合計金額、支払期限など）を報告します。|「single sentence」「bullet list」「JSON」「no other commentary」「answer in Japanese / English」（日本語での同様の指示も可）に従います。|システムメッセージが空の場合は推測で回答し、実行するたびに回答の形が変わります。|プロンプトのそれ以外の内容は無視されます。実際のモデルであれば、それらにも従います。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.guardrails': '出力ガードレール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',

    'insight.fields': '求められた項目: {list}。',
    'insight.default-fields': '項目の指定がないため、基本の4項目を報告します: {list}。',
    'insight.single-sentence': '「single sentence（一文）」→ 1文で回答。',
    'insight.several-sentences': '文数の指定なし → 項目ごとに短い文で回答。',
    'insight.bullets': 'リスト形式の指定 → 箇条書きで回答。',
    'insight.json': 'JSON の指定 → JSON オブジェクトをテキストで回答。',
    'insight.no-commentary': '「no other commentary（余計なコメント不要）」→ 要約のみ。',
    'insight.chatty': '余計なコメントを禁止する指示なし → 挨拶と結びの一文が付きます。',
    'insight.language': '回答言語: {language}。',
    'insight.missing': '請求書テキストに見つからない項目: {list}。',
    'insight.no-invoice': 'ユーザーメッセージに請求書の情報がありません。',
    'insight.no-system': 'システムメッセージなし: モデルは何をすべきか推測するしかありません。これは3種類の回答スタイルのうち {variant} 番目です。もう一度実行すると変わります。',
    'language.en': '英語',
    'language.ja': '日本語'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  const names = FIELD_NAMES[t('lang') === 'ja' ? 'ja' : 'en'];
  const list = fields => fields.map(f => names[f] || f).join(t('lang') === 'ja' ? '、' : ', ');
  switch (insight.id) {
    case 'fields':
    case 'default-fields':
    case 'missing':
      return t('insight.' + insight.id, { list: list(insight.fields) });
    case 'language':
      return t('insight.language', { language: t('language.' + insight.language) });
    case 'no-system':
      return t('insight.no-system', { variant: insight.variant });
    default:
      return t('insight.' + insight.id);
  }
}
