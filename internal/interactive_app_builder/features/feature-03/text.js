/**
 * Feature 03 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How an agent gets its model',
    'tour.intro.text': 'Watch the Feature03 process run: three agents, each calling a different provider. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.global': '1 — Global default via variables.yaml',
    'tour.chapter.override': '2 — Per-agent override in AgenticProcessCall',

    'tour.varsDefault.title': 'One default for the application',
    'tour.varsDefault.text': '`DefaultProvider` is the provider every AgenticProcessCall uses, in every process, unless an element names its own.',
    'tour.varsModel.title': 'Each provider has its block',
    'tour.varsModel.text': 'The block holds what that provider needs: its API key, and `DefaultModel`, the model to use when an element names none.',
    'tour.varsOthers.title': 'More than one provider',
    'tour.varsOthers.text': 'Any provider an agent may call needs its block. Ollama runs on your own server, so it has a URL and no API key.',

    'tour.analysis.title': 'Invoice Analysis Agent',
    'tour.analysis.text': '`OpenAI` with `gpt-4o`. Extracting five typed fields has to be right, because the next two steps build on it. This step gets the capable model.',
    'tour.urgency.title': 'Urgency Classifier',
    'tour.urgency.text': '`Anthropic` with `claude-haiku-4-5`. One of three words from a single number: a small, cheap model is more than enough.',
    'tour.risk.title': 'Supplier Risk Check',
    'tour.risk.text': '`Ollama` with `llama3.2`. Supplier names must not leave the company, so this step runs on a local model.',
    'tour.log.title': 'Three steps, three providers',
    'tour.log.text': 'One process, no Java code: each agent chose its own provider and model, and the log shows all three results.',
    'tour.cleared.title': 'Take the override away',
    'tour.cleared.text': 'Provider and Model are now empty on the Urgency Classifier.',
    'tour.fallback.title': 'Back to the global default',
    'tour.fallback.text': 'With nothing set on the element, the call goes to {provider} with {model}: the default from variables.yaml.',

    'about.rules': 'The provider and model of an agent decide where its call goes, shown above the agent while it runs. They do not change the simulated answer.|The Invoice Analysis Agent fills the fields of its result class from the invoice text.|The Urgency Classifier compares the amount with the limits in its system message.|The Supplier Risk Check answers LOW for a name with a company form such as Ltd. or GmbH, HIGH for a single word or something unreadable, and MEDIUM otherwise.',

    'ref.tools': 'Callable Process Tools',
    'ref.guardrails': 'Output Guardrail',
    'ref.temperature': 'Model Settings',

    'insight.schema': 'Result type {name} → one value for each of its fields: {list}.',
    'insight.null': 'Not stated in the invoice text, so null: {list}.',
    'insight.schema-decides': 'With a result type, the schema decides the shape of the answer; the wording of the system message does not change it in this simulation.',
    'insight.plain': 'No result type → the answer is plain text.',
    'insight.listed': 'Fields named in the system message: {list}.',
    'insight.usual': 'The system message names no fields, so it reports the usual five: {list}.',
    'insight.no-system': 'No system message either: the model has to guess what you want.',
    'insight.no-invoice': 'The user message contains no invoice facts.',
    'insight.urgency': 'Amount {amount}: URGENT from {urgent}, LOW below {low} → {result}.',
    'insight.urgency-missing': 'The user message contains no amount.',
    'insight.risk-low': '“{name}” carries a company form → LOW.',
    'insight.risk-medium': '“{name}” reads like a company but has no company form → MEDIUM.',
    'insight.risk-high': '“{name}” is a single word or cannot be read as a name → HIGH.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'エージェントが使うモデルの決まり方',
    'tour.intro.text': 'Feature03 プロセスの実行を見ていきます。3つのエージェントが、それぞれ別のプロバイダーを呼び出します。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.global': '1 — variables.yamlによるグローバルデフォルト',
    'tour.chapter.override': '2 — AgenticProcessCallでのエージェントごとの上書き',

    'tour.varsDefault.title': 'アプリケーション全体のデフォルト',
    'tour.varsDefault.text': '`DefaultProvider` は、要素が個別に指定しない限り、すべてのプロセスのすべての AgenticProcessCall が使うプロバイダーです。',
    'tour.varsModel.title': 'プロバイダーごとのブロック',
    'tour.varsModel.text': 'ブロックには、そのプロバイダーに必要な設定を書きます。APIキーと、要素がモデルを指定しないときに使う `DefaultModel` です。',
    'tour.varsOthers.title': '複数のプロバイダー',
    'tour.varsOthers.text': 'エージェントが呼び出す可能性のあるプロバイダーには、それぞれブロックが必要です。Ollama は自社サーバーで動かすため、URL だけで APIキーはありません。',

    'tour.analysis.title': 'Invoice Analysis Agent',
    'tour.analysis.text': '`OpenAI` の `gpt-4o`。型付きの5項目の抽出は、後続の2ステップの土台になるため正確さが欠かせません。このステップには高性能なモデルを使います。',
    'tour.urgency.title': 'Urgency Classifier',
    'tour.urgency.text': '`Anthropic` の `claude-haiku-4-5`。1つの数値から3つの語のどれかを返すだけなので、小さく安価なモデルで十分です。',
    'tour.risk.title': 'Supplier Risk Check',
    'tour.risk.text': '`Ollama` の `llama3.2`。サプライヤー名は社外に出せないため、このステップはローカルモデルで実行します。',
    'tour.log.title': '3つのステップ、3つのプロバイダー',
    'tour.log.text': '1つのプロセスで、Java コードは書いていません。各エージェントが自分のプロバイダーとモデルを選び、ログには3つの結果がすべて出力されます。',
    'tour.cleared.title': '上書きをやめる',
    'tour.cleared.text': 'Urgency Classifier の Provider と Model を空にしました。',
    'tour.fallback.title': 'グローバルデフォルトに戻る',
    'tour.fallback.text': '要素に何も設定がないため、呼び出しは {provider} の {model} に送られます。variables.yaml のデフォルトです。',

    'about.rules': 'エージェントのプロバイダーとモデルは、呼び出しの送り先を決めます。実行中、エージェントの上に表示されます。シミュレーションの回答は変わりません。|Invoice Analysis Agent は、請求書テキストから結果クラスの各フィールドを設定します。|Urgency Classifier は、金額をシステムメッセージの基準値と比較します。|Supplier Risk Check は、Ltd. や GmbH などの法人格を含む名前には LOW、1語だけの名前や読み取れない名前には HIGH、それ以外には MEDIUM と回答します。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.guardrails': '出力ガードレール',
    'ref.temperature': 'モデル設定',

    'insight.schema': '結果の型 {name} → 各フィールドに値を1つずつ: {list}。',
    'insight.null': '請求書テキストに記載がないため null: {list}。',
    'insight.schema-decides': '結果の型がある場合、回答の形はスキーマで決まります。このシミュレーションでは、システムメッセージの文言を変えても回答は変わりません。',
    'insight.plain': '結果の型なし → プレーンテキストで回答。',
    'insight.listed': 'システムメッセージに書かれたフィールド: {list}。',
    'insight.usual': 'システムメッセージにフィールドの指定がないため、基本の5項目を報告します: {list}。',
    'insight.no-system': 'システムメッセージもありません。モデルは何をすべきか推測するしかありません。',
    'insight.no-invoice': 'ユーザーメッセージに請求書の情報がありません。',
    'insight.urgency': '金額 {amount}: {urgent} 以上は URGENT、{low} 未満は LOW → {result}。',
    'insight.urgency-missing': 'ユーザーメッセージに金額がありません。',
    'insight.risk-low': '「{name}」には法人格が含まれています → LOW。',
    'insight.risk-medium': '「{name}」は会社名らしく読めますが、法人格がありません → MEDIUM。',
    'insight.risk-high': '「{name}」は1語だけ、または名前として読み取れません → HIGH。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  const list = (insight.fields || []).join(t('lang') === 'ja' ? '、' : ', ');
  return t('insight.' + insight.id, { ...insight, list });
}
