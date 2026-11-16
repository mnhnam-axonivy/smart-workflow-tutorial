/**
 * Feature 07 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How an agent searches the web',
    'tour.intro.text': 'Watch the Feature07 process run: the agent passes the question to the built-in webSearch tool and answers with a source. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.add': 'Step 1 — Add webSearch to the Tools list',
    'tour.chapter.instruct': 'Step 2 — Instruct the agent when to search',
    'tour.chapter.configure': 'Step 3 — Configure search behaviour (optional)',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.selected.title': 'Available tools',
    'tour.selected.text': '`webSearch` is built into Smart Workflow: no Java class and no SPI file in your project. Selecting it here is the only required change.',
    'tour.prompt.title': 'Say when to search',
    'tour.prompt.text': 'The model uses a tool only when it is told to. This line names the tool and says what it is for.',
    'tour.searches.title': 'The model searches',
    'tour.searches.text': 'It passes the user’s question to the tool as the `query`.',
    'tour.results.title': 'Results come back',
    'tour.results.text': 'Each result has a title, a URL and a snippet of text. The model reads them like any other tool result.',
    'tour.answer.title': 'An answer with its source',
    'tour.answer.text': 'The summary comes from the first result, and its URL is cited, as the system message asks.',

    'tour.engine.title': 'Engine',
    'tour.engine.text': 'Which search engine to use. DuckDuckGo is the default and needs no API key.',
    'tour.max.title': 'MaxResults',
    'tour.max.text': 'How many results one search may return. Without the variable it is 5.',
    'tour.whitelist.title': 'WhitelistDomains',
    'tour.whitelist.text': 'Empty means every domain is allowed. A list keeps only results from those domains and their subdomains.',
    'tour.trusted.title': 'Only the official site',
    'tour.trusted.text': 'Now only results from `developer.axonivy.com` may reach the model.',
    'tour.filtered.title': 'Filtered before the model sees them',
    'tour.filtered.text': 'The search found three pages. Two were on other domains and have been removed.',

    'tour.silent.title': 'Agent ignores the tool',
    'tour.silent.text': 'The line that told the model to search is gone. `webSearch` is still selected.',
    'tour.ignored.title': 'No search, no current facts',
    'tour.ignored.text': 'The model answers from its training data and never calls the tool. Tell it explicitly to use `webSearch`.',
    'tour.narrow.title': 'Whitelist too restrictive',
    'tour.narrow.text': 'This whitelist names a domain that none of the results come from.',
    'tour.excluded.title': 'Nothing passes',
    'tour.excluded.text': 'The tool returns no results, with a note that says why.',
    'tour.empty.title': 'Nothing to cite',
    'tour.empty.text': 'Without results the model has no source. Test a whitelist with typical questions before you rely on it.',

    'about.rules': 'Nothing is searched on the internet: the guide works offline. The simulated web has three pages about Axon Ivy 14. The first is the release notes page, with the summary this tutorial uses as its example; the other two are placeholders on other domains.|A question that does not mention Ivy finds nothing.|Engine, MaxResults and WhitelistDomains in variables.yaml act as in Smart Workflow: an unknown engine fails the tool, MaxResults limits the list, and the whitelist keeps a domain and its subdomains.|The stand-in model searches only when webSearch came with the request and the system message names it. It answers with the first result and its URL. With no results it says so; a real model might guess.',

    'ref.guardrails': 'Output Guardrail',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',

    'insight.searched': 'Searched for the user’s question: “{query}”.',
    'insight.cited': 'Answered from the first of {count} result(s) and cited {url}.',
    'insight.no-results': 'The search returned nothing. {note}',
    'insight.search-failed': 'The tool returned an error instead of results.',
    'insight.no-tool': 'webSearch did not come with the request.',
    'insight.tool-unused': 'Came with the request but is not named in the system message, so never called: {list}.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'エージェントがウェブを検索する仕組み',
    'tour.intro.text': 'Feature07 プロセスの実行を見ていきます。エージェントは質問を組み込みの webSearch ツールに渡し、出典付きで回答します。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.add': 'Step 1 — Toolsリストに webSearch を追加する',
    'tour.chapter.instruct': 'Step 2 — いつ検索するかをエージェントに指示する',
    'tour.chapter.configure': 'Step 3 — 検索動作を設定する（オプション）',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.selected.title': 'Available tools（利用可能なツール）',
    'tour.selected.text': '`webSearch` は Smart Workflow に組み込まれています。プロジェクトに Java クラスも SPI ファイルも必要ありません。ここで選択するだけで使えます。',
    'tour.prompt.title': 'いつ検索するかを伝える',
    'tour.prompt.text': 'モデルは、指示されたときだけツールを使います。この行はツールの名前を挙げ、何のために使うかを伝えています。',
    'tour.searches.title': 'モデルが検索する',
    'tour.searches.text': 'ユーザーの質問を `query` としてツールに渡します。',
    'tour.results.title': '検索結果が返ってくる',
    'tour.results.text': '各結果にはタイトル、URL、本文の抜粋があります。モデルは、ほかのツールの結果と同じように読み取ります。',
    'tour.answer.title': '出典付きの回答',
    'tour.answer.text': '要約は最初の結果にもとづき、システムメッセージの指示どおり URL が引用されています。',

    'tour.engine.title': 'Engine',
    'tour.engine.text': '使用する検索エンジンです。デフォルトは DuckDuckGo で、APIキーは不要です。',
    'tour.max.title': 'MaxResults',
    'tour.max.text': '1回の検索で返す結果の最大数です。この変数がない場合は 5 件です。',
    'tour.whitelist.title': 'WhitelistDomains',
    'tour.whitelist.text': '空の場合はすべてのドメインが許可されます。指定すると、そのドメインとサブドメインの結果だけが残ります。',
    'tour.trusted.title': '公式サイトだけに絞る',
    'tour.trusted.text': 'これで、モデルに届くのは `developer.axonivy.com` の結果だけになります。',
    'tour.filtered.title': 'モデルに届く前に絞り込まれる',
    'tour.filtered.text': '検索では3ページ見つかりました。ほかのドメインの2件は取り除かれています。',

    'tour.silent.title': 'エージェントがツールを無視する',
    'tour.silent.text': '検索を指示する行がなくなりました。`webSearch` は選択されたままです。',
    'tour.ignored.title': '検索しなければ最新情報はない',
    'tour.ignored.text': 'モデルは学習データから回答し、ツールを一度も呼び出しません。`webSearch` を使うよう明示的に指示しましょう。',
    'tour.narrow.title': 'ホワイトリストが厳しすぎる',
    'tour.narrow.text': 'このホワイトリストには、どの検索結果にも含まれないドメインが指定されています。',
    'tour.excluded.title': '何も通過しない',
    'tour.excluded.text': 'ツールは結果を返さず、その理由を示す注記を付けます。',
    'tour.empty.title': '引用できるものがない',
    'tour.empty.text': '結果がなければ、モデルには出典がありません。ホワイトリストは、よくある質問で試してから運用しましょう。',

    'about.rules': 'インターネットでの検索は行いません。ガイドはオフラインで動作します。シミュレーション上のウェブには Axon Ivy 14 に関する3ページがあります。1つ目はリリースノートのページで、このチュートリアルが例として使っている要約が入っています。残りの2つは別ドメインのサンプルページです。|Ivy に触れていない質問では、何も見つかりません。|variables.yaml の Engine、MaxResults、WhitelistDomains は Smart Workflow と同じように働きます。未知のエンジンではツールが失敗し、MaxResults は件数を制限し、ホワイトリストは指定ドメインとそのサブドメインだけを残します。|モデルの代役が検索するのは、webSearch がリクエストに含まれ、かつシステムメッセージに名前がある場合だけです。回答には最初の結果とその URL を使います。結果がなければそう答えます。実際のモデルは推測で答えることもあります。',

    'ref.guardrails': '出力ガードレール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',

    'insight.searched': 'ユーザーの質問で検索しました: 「{query}」。',
    'insight.cited': '{count} 件の結果のうち最初の1件から回答し、{url} を引用しました。',
    'insight.no-results': '検索結果はありませんでした。{note}',
    'insight.search-failed': 'ツールは結果ではなくエラーを返しました。',
    'insight.no-tool': 'webSearch はリクエストに含まれていませんでした。',
    'insight.tool-unused': 'リクエストには含まれていましたが、システムメッセージに名前がないため呼び出されませんでした: {list}。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  const list = (insight.names || []).join(t('lang') === 'ja' ? '、' : ', ');
  return t('insight.' + insight.id, { list, query: insight.query, count: insight.count, url: insight.url, note: insight.note || '' });
}
