/**
 * Feature 02 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How structured output works',
    'tour.intro.text': 'Watch the Feature02 process run: the agent returns an InvoiceData object instead of text. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min, 3 with the voice',
    'tour.chapter.type': 'Expect result of type',
    'tour.chapter.mapping': 'Map result to',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.type.title': 'Expect result of type',
    'tour.type.text': '`tutorial.InvoiceData.class` is the Java class the agent has to return. The `.class` suffix is required.',
    'tour.dataClass.title': 'The data class',
    'tour.dataClass.text': '`InvoiceData` has one field for each value to extract. The field names and types are what the model is told, so name them clearly.',
    'tour.schema.title': 'A schema goes with the request',
    'tour.schema.text': 'Smart Workflow derives a JSON schema from the class and sends it along with the two messages. The model may only answer with JSON that matches it.',
    'tour.json.title': 'JSON comes back',
    'tour.json.text': 'One value per field, in the type the class declares. Smart Workflow turns this JSON into an `InvoiceData` object, so your process never parses text.',
    'tour.typeEmpty.title': 'Without a result type',
    'tour.typeEmpty.text': 'The field is now empty, as in Basic Agent Setup.',
    'tour.plain.title': 'Plain text again',
    'tour.plain.text': 'The answer is a String. It cannot be written to `in.result`, which is an `InvoiceData`, so that field stays empty.',

    'tour.mapping.title': 'Map result to',
    'tour.mapping.text': '`in.result` is the process data field that receives the object. Its type is `InvoiceData`, the class named above.',
    'tour.typed.title': 'Typed fields, ready to use',
    'tour.typed.text': 'The next step can read `in.result.totalAmount` as a BigDecimal and `in.result.invoiceDate` as a LocalDate. No casting, no parsing.',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': 'This script logs the object as JSON, one line per field.',

    'tour.suffix.title': 'The .class suffix',
    'tour.suffix.text': 'The type has to end in `.class`. It is easy to leave out, so it is removed here to show what happens.',
    'tour.suffixEdit.title': 'The suffix is missing',
    'tour.suffixEdit.text': 'The type now reads `tutorial.InvoiceData`, without `.class`.',
    'tour.suffixFailed.title': 'The type cannot be resolved',
    'tour.suffixFailed.text': 'Without `.class` the value is not a class. The agent step fails before the model is called, and the process stops here.',
    'tour.suffixLog.title': 'What the log says',
    'tour.suffixLog.text': 'The Runtime Log names the setting and the value that could not be read.',

    'about.rules': 'With “Expect result of type” set, it fills every field of that class from the invoice text, going by the field names: invoiceNumber, supplierName, totalAmount, currency, invoiceDate. A field it cannot find is null.|Without a result type it answers in plain text and lists the fields named in the system message.|With a result type, the wording of the system message does not change the answer here. A real model would still be guided by it.',

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
    'insight.no-invoice': 'The user message contains no invoice facts.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': '構造化出力の仕組み',
    'tour.intro.text': 'Feature02 プロセスの実行を見ていきます。エージェントはテキストではなく InvoiceData オブジェクトを返します。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分（音声ありで約3分）',
    'tour.chapter.type': '期待する結果の型',
    'tour.chapter.mapping': '結果のマッピング先',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.type.title': 'Expect result of type（期待する結果の型）',
    'tour.type.text': '`tutorial.InvoiceData.class` は、エージェントが返すべき Java クラスです。末尾の `.class` は必須です。',
    'tour.dataClass.title': 'データクラス',
    'tour.dataClass.text': '`InvoiceData` には、抽出したい値ごとにフィールドが1つあります。フィールドの名前と型がそのままモデルに伝わるので、分かりやすい名前を付けましょう。',
    'tour.schema.title': 'リクエストにスキーマが付く',
    'tour.schema.text': 'Smart Workflow はクラスから JSON スキーマを生成し、2つのメッセージと一緒に送信します。モデルは、このスキーマに合う JSON でしか回答できません。',
    'tour.json.title': 'JSON が返ってくる',
    'tour.json.text': 'フィールドごとに1つの値が、クラスで宣言した型で返ります。Smart Workflow がこの JSON を `InvoiceData` オブジェクトに変換するので、プロセス側でテキストを解析する必要はありません。',
    'tour.typeEmpty.title': '結果の型を指定しない場合',
    'tour.typeEmpty.text': 'フィールドを空にしました。「エージェントの基本設定」と同じ状態です。',
    'tour.plain.title': 'プレーンテキストに戻る',
    'tour.plain.text': '回答は String です。`in.result` は `InvoiceData` 型なので書き込めず、このフィールドは空のままになります。',

    'tour.mapping.title': 'Map result to（結果のマッピング先）',
    'tour.mapping.text': '`in.result` は、オブジェクトを受け取るプロセスデータのフィールドです。型は、上で指定したクラス `InvoiceData` です。',
    'tour.typed.title': '型付きフィールドをそのまま使える',
    'tour.typed.text': '次のステップでは、`in.result.totalAmount` を BigDecimal として、`in.result.invoiceDate` を LocalDate として読み取れます。キャストも解析も不要です。',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': 'このスクリプトは、オブジェクトを JSON としてログに出力します。1行に1フィールドです。',

    'tour.suffix.title': '末尾の .class',
    'tour.suffix.text': '型の末尾には `.class` が必要です。忘れやすい部分なので、ここで削除して何が起きるかを見てみます。',
    'tour.suffixEdit.title': 'サフィックスがない',
    'tour.suffixEdit.text': '型は `tutorial.InvoiceData` になり、`.class` がありません。',
    'tour.suffixFailed.title': '型を解決できない',
    'tour.suffixFailed.text': '`.class` がないと、この値はクラスとして扱われません。モデルを呼び出す前にエージェントのステップが失敗し、プロセスはここで止まります。',
    'tour.suffixLog.title': 'ログの内容',
    'tour.suffixLog.text': 'ランタイムログには、読み取れなかった設定名とその値が記録されます。',

    'about.rules': '「Expect result of type」を設定すると、そのクラスの各フィールドに、フィールド名（invoiceNumber、supplierName、totalAmount、currency、invoiceDate）を手がかりに請求書テキストの値を設定します。見つからないフィールドは null になります。|結果の型がない場合はプレーンテキストで回答し、システムメッセージに書かれたフィールドを列挙します。|結果の型がある場合、このシミュレーションではシステムメッセージの文言を変えても回答は変わりません。実際のモデルであれば、文言にも影響されます。',

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
    'insight.no-invoice': 'ユーザーメッセージに請求書の情報がありません。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  const list = fields => (fields || []).join(t('lang') === 'ja' ? '、' : ', ');
  return t('insight.' + insight.id, { name: insight.name, list: list(insight.fields) });
}
