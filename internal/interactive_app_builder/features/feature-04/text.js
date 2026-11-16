/**
 * Feature 04 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How an agent reads a file',
    'tour.intro.text': 'Watch the Feature04 process run: the agent receives the sample invoice as a file and returns an InvoiceData object. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min, 3 with the voice',
    'tour.chapter.query': 'User message — passing a file',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.query.title': 'User message',
    'tour.query.text': '`ivy.cms.co("/Files/Documents/InvoiceSample")` names a content object in the CMS: the sample invoice, a PDF. The sentence before it is sent as text.',
    'tour.attached.title': 'The file travels with the message',
    'tour.attached.text': 'Smart Workflow loads `{name}` from the CMS and attaches it to the call. PNG, JPG, JPEG and PDF files are passed on as files; you convert nothing.',
    'tour.json.title': 'The model reads the document',
    'tour.json.text': 'It finds the five fields in the invoice and writes the date as yyyy-MM-dd, as the system message asks.',
    'tour.result.title': 'Output as in Structured Output',
    'tour.result.text': '“Expect result of type” and “Map result to” work as before: `in.invoiceResult` now holds an `InvoiceData` object.',

    'tour.pathEdit.title': 'A path that does not exist',
    'tour.pathEdit.text': 'One letter is wrong: `InvoiceSampel`.',
    'tour.nothing.title': 'Nothing to read',
    'tour.nothing.text': 'There is no object at that path, so no file is attached. The model gets only the sentence and returns null for every field. Nothing fails, so check the path first when results are empty.',
    'tour.providerEdit.title': 'Another provider',
    'tour.providerEdit.text': 'The path is correct again, and the agent now calls Ollama.',
    'tour.pdfRefused.title': 'This provider takes no PDF',
    'tour.pdfRefused.text': 'Ollama and xAI do not accept PDF files, so the agent step fails. Use OpenAI, Azure OpenAI, Anthropic or Gemini for PDF documents.',

    'about.rules': 'The model does not open the PDF. The simulation knows what the sample invoice says and lets the stand-in model read that text.|With “Expect result of type” set, it fills every field of that class from the document, going by the field names. A field it cannot find is null.|A CMS path that does not exist attaches nothing. Any other path is unknown here, because the sample invoice is the only file in this simulation.|Ollama and xAI reject a PDF, as the Model Provider Selection guide states.',

    'ref.tools': 'Callable Process Tools',
    'ref.guardrails': 'Output Guardrail',
    'ref.temperature': 'Model Settings',

    'insight.document': 'Read from the attached file: {name}.',
    'insight.schema': 'Result type {name} → one value for each of its fields: {list}.',
    'insight.null': 'Not stated in the document, so null: {list}.',
    'insight.schema-decides': 'With a result type, the schema decides the shape of the answer; the wording of the system message does not change it in this simulation.',
    'insight.plain': 'No result type → the answer is plain text.',
    'insight.listed': 'Fields named in the system message: {list}.',
    'insight.usual': 'The system message names no fields, so it reports the usual five: {list}.',
    'insight.no-system': 'No system message either: the model has to guess what you want.',
    'insight.no-invoice': 'No file is attached and the message contains no invoice facts, so there is nothing to extract.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'エージェントがファイルを読み取る仕組み',
    'tour.intro.text': 'Feature04 プロセスの実行を見ていきます。エージェントはサンプル請求書をファイルとして受け取り、InvoiceData オブジェクトを返します。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分（音声ありで約3分）',
    'tour.chapter.query': 'ユーザーメッセージ — ファイルの渡し方',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.query.title': 'User message（ユーザーメッセージ）',
    'tour.query.text': '`ivy.cms.co("/Files/Documents/InvoiceSample")` は CMS のコンテンツオブジェクトを指します。ここではサンプル請求書の PDF です。その前の一文はテキストとして送信されます。',
    'tour.attached.title': 'ファイルはメッセージと一緒に送られる',
    'tour.attached.text': 'Smart Workflow が CMS から `{name}` を読み込み、呼び出しに添付します。PNG・JPG・JPEG・PDF はファイルのまま渡されるので、変換は不要です。',
    'tour.json.title': 'モデルがドキュメントを読み取る',
    'tour.json.text': '請求書から5つの項目を見つけ、システムメッセージの指示どおり日付を yyyy-MM-dd 形式で返します。',
    'tour.result.title': '出力は「構造化出力」と同じ',
    'tour.result.text': '「Expect result of type」と「Map result to」はこれまでと同じです。`in.invoiceResult` に `InvoiceData` オブジェクトが入ります。',

    'tour.pathEdit.title': '存在しないパス',
    'tour.pathEdit.text': '1文字だけ間違えています: `InvoiceSampel`。',
    'tour.nothing.title': '読み取るものがない',
    'tour.nothing.text': 'そのパスにオブジェクトがないため、ファイルは添付されません。モデルには一文しか届かず、すべてのフィールドが null になります。エラーにはならないので、結果が空のときはまずパスを確認しましょう。',
    'tour.providerEdit.title': '別のプロバイダー',
    'tour.providerEdit.text': 'パスを元に戻し、エージェントが Ollama を呼び出すようにしました。',
    'tour.pdfRefused.title': 'このプロバイダーは PDF を受け付けない',
    'tour.pdfRefused.text': 'Ollama と xAI は PDF ファイルを受け付けないため、エージェントのステップは失敗します。PDF ドキュメントには OpenAI、Azure OpenAI、Anthropic、Gemini を使ってください。',

    'about.rules': 'モデルは PDF を開きません。シミュレーションがサンプル請求書の内容を知っており、モデルの代役はそのテキストを読み取ります。|「Expect result of type」を設定すると、フィールド名を手がかりに、ドキュメントからそのクラスの各フィールドを設定します。見つからないフィールドは null になります。|存在しない CMS パスでは何も添付されません。このシミュレーションにあるファイルはサンプル請求書だけなので、ほかのパスはすべて存在しない扱いになります。|「モデルプロバイダーの選択」にあるとおり、Ollama と xAI は PDF を拒否します。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.guardrails': '出力ガードレール',
    'ref.temperature': 'モデル設定',

    'insight.document': '添付ファイルから読み取りました: {name}。',
    'insight.schema': '結果の型 {name} → 各フィールドに値を1つずつ: {list}。',
    'insight.null': 'ドキュメントに記載がないため null: {list}。',
    'insight.schema-decides': '結果の型がある場合、回答の形はスキーマで決まります。このシミュレーションでは、システムメッセージの文言を変えても回答は変わりません。',
    'insight.plain': '結果の型なし → プレーンテキストで回答。',
    'insight.listed': 'システムメッセージに書かれたフィールド: {list}。',
    'insight.usual': 'システムメッセージにフィールドの指定がないため、基本の5項目を報告します: {list}。',
    'insight.no-system': 'システムメッセージもありません。モデルは何をすべきか推測するしかありません。',
    'insight.no-invoice': 'ファイルが添付されておらず、メッセージにも請求書の情報がないため、抽出できるものがありません。'
  }
};

/** Turns one insight from the extractor into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  const list = (insight.fields || []).join(t('lang') === 'ja' ? '、' : ', ');
  return t('insight.' + insight.id, { name: insight.name, list });
}
