/**
 * Feature 06 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How a Java class becomes a tool',
    'tour.intro.text': 'See the three files that make a Java tool known to Smart Workflow, then watch the Feature06 agent call it. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.implement': 'Step 1 — Implement SmartWorkflowTool',
    'tour.chapter.provider': 'Step 2 — Create a SmartWorkflowToolsProvider',
    'tour.chapter.spi': 'Step 3 — Register via SPI',
    'tour.chapter.agent': 'Step 4 — Add to agent Tools list',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.name.title': 'name()',
    'tour.name.text': 'The name the agent uses. “Available tools” on an agent has to contain exactly this text.',
    'tour.description.title': 'description()',
    'tour.description.text': 'Sent to the model as it is. It says what the tool does, what to pass and what comes back.',
    'tour.parameters.title': 'parameters()',
    'tour.parameters.text': 'Each input with its name, a description for the model and its Java type. The model’s JSON is converted to that type before `execute()` runs.',
    'tour.execute.title': 'execute()',
    'tour.execute.text': 'Plain Java: it looks up the rate for the currency and returns one line of text. That text goes back to the model.',
    'tour.provider.title': 'The provider lists the tools',
    'tour.provider.text': '`getTools()` returns every tool this project offers. One provider can list several.',
    'tour.spi.title': 'The registration file',
    'tour.spi.text': 'One line: the full class name of the provider. Smart Workflow loads providers through Java SPI, so without this file the tool does not exist for any agent.',

    'tour.selected.title': 'Available tools',
    'tour.selected.text': 'The registered Java tool appears in the list as `convertToUSD`. Only the tools selected here are given to this agent.',
    'tour.asks.title': 'The model asks for the tool',
    'tour.asks.text': 'As with a callable process tool, the model replies with the tool name and the two values it read in the invoice.',
    'tour.computed.title': 'Java does the arithmetic',
    'tour.computed.text': '`execute()` runs inside Axon Ivy and returns this line. The model never multiplies anything itself.',
    'tour.summary.title': 'The answer uses the result',
    'tour.summary.text': 'One sentence, as the system message asks, with the USD amount and the rate the tool returned.',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': 'The summary is in `in.summary`, and this script writes it to the Runtime Log.',

    'tour.unregistered.title': 'Forgetting the SPI registration file',
    'tour.unregistered.text': 'The file is empty now. The classes still compile, but Smart Workflow never loads the provider.',
    'tour.unknown.title': 'Still selected, no longer there',
    'tour.unknown.text': 'The agent keeps the name `convertToUSD`. No tool answers to it any more, and nothing warns you.',
    'tour.cannot.title': 'No tool, no conversion',
    'tour.cannot.text': 'The request went out without a tool. The model can only report what the invoice says.',
    'tour.notListed.title': 'Not adding the tool to the agent',
    'tour.notListed.text': 'The registration is back, but “Available tools” is empty. Registering makes a tool available; each agent still has to list it.',
    'tour.same.title': 'The same result',
    'tour.same.text': 'A registered tool that the agent does not list is as good as none.',

    'about.rules': 'Java is not compiled here. The name, description, parameters and exchange rates of the tool are read from FxRateConverterTool.java, and the conversion is the same calculation done in JavaScript.|The tool is registered as long as the SPI file names tutorial.tool.TutorialToolProvider. Change that line and the tool is gone.|The stand-in model asks for a tool only when it came with the request and the system message names it. Without one it says that it cannot convert; a real model might invent a rate instead.|The other entries of “Available tools” belong to other lessons and exist here in name only.',

    'ref.guardrails': 'Output Guardrail',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',

    'insight.tool-called': 'Called {tool} with the amount and the currency of the invoice.',
    'insight.from-tool': 'The USD amount and the rate in the answer are what {tool} returned.',
    'insight.no-tool': 'No tool came with the request, so nothing could be converted.',
    'insight.tool-unused': 'Came with the request but is not named in the system message, so never called: {list}.',
    'insight.tool-failed': '{tool} did not return a conversion.',
    'insight.no-invoice': 'The user message contains no invoice total.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'Java クラスがツールになるまで',
    'tour.intro.text': 'Java ツールを Smart Workflow に認識させる3つのファイルを確認し、Feature06 のエージェントがそのツールを呼び出す様子を見ていきます。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.implement': 'Step 1 — SmartWorkflowToolを実装する',
    'tour.chapter.provider': 'Step 2 — SmartWorkflowToolsProviderを作成する',
    'tour.chapter.spi': 'Step 3 — SPIで登録する',
    'tour.chapter.agent': 'Step 4 — エージェントのToolsリストに追加する',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.name.title': 'name()',
    'tour.name.text': 'エージェントが使う名前です。エージェントの「Available tools」には、この文字列と完全に同じ名前が必要です。',
    'tour.description.title': 'description()',
    'tour.description.text': 'そのままモデルに送信されます。ツールの役割、渡す値、返ってくる内容を説明します。',
    'tour.parameters.title': 'parameters()',
    'tour.parameters.text': '入力ごとに、名前、モデル向けの説明、Java の型を定義します。モデルの JSON は、`execute()` の実行前にその型へ変換されます。',
    'tour.execute.title': 'execute()',
    'tour.execute.text': '通常の Java です。通貨のレートを調べ、1行のテキストを返します。そのテキストがモデルに戻ります。',
    'tour.provider.title': 'プロバイダーがツールを列挙する',
    'tour.provider.text': '`getTools()` は、このプロジェクトが提供するすべてのツールを返します。1つのプロバイダーで複数のツールを登録できます。',
    'tour.spi.title': '登録ファイル',
    'tour.spi.text': '1行だけ、プロバイダーの完全修飾クラス名を書きます。Smart Workflow は Java SPI でプロバイダーを読み込むため、このファイルがなければ、どのエージェントからもツールは見えません。',

    'tour.selected.title': 'Available tools（利用可能なツール）',
    'tour.selected.text': '登録された Java ツールは、リストに `convertToUSD` として表示されます。ここで選択したツールだけが、このエージェントに渡されます。',
    'tour.asks.title': 'モデルがツールを要求する',
    'tour.asks.text': '呼び出し可能プロセスツールと同じです。モデルは、ツール名と請求書から読み取った2つの値を返します。',
    'tour.computed.title': '計算は Java が行う',
    'tour.computed.text': '`execute()` は Axon Ivy の中で実行され、この1行を返します。モデル自身は掛け算をしません。',
    'tour.summary.title': '回答に結果が使われる',
    'tour.summary.text': 'システムメッセージの指示どおり1文で、ツールが返した USD 金額とレートが含まれています。',
    'tour.log.title': 'Show result from AI',
    'tour.log.text': '要約は `in.summary` に入り、このスクリプトがランタイムログに出力します。',

    'tour.unregistered.title': 'SPI 登録ファイルを忘れる',
    'tour.unregistered.text': 'ファイルを空にしました。クラスはコンパイルできますが、Smart Workflow はプロバイダーを読み込みません。',
    'tour.unknown.title': '選択は残るが、ツールはない',
    'tour.unknown.text': 'エージェントには `convertToUSD` という名前が残っています。しかし、その名前のツールはもう存在せず、警告も出ません。',
    'tour.cannot.title': 'ツールがなければ換算できない',
    'tour.cannot.text': 'リクエストはツールなしで送信されました。モデルは請求書に書かれた内容を伝えることしかできません。',
    'tour.notListed.title': 'エージェントにツールを追加していない',
    'tour.notListed.text': '登録は元に戻しましたが、「Available tools」が空です。登録するとツールは利用可能になりますが、使うにはエージェントごとに選択する必要があります。',
    'tour.same.title': '結果は同じ',
    'tour.same.text': '登録されていても、エージェントが選択していないツールは、ないのと同じです。',

    'about.rules': 'ここでは Java はコンパイルされません。ツールの名前、説明、パラメータ、為替レートは FxRateConverterTool.java から読み取り、同じ計算を JavaScript で行います。|SPI ファイルに tutorial.tool.TutorialToolProvider が書かれている間、ツールは登録されています。その行を変えるとツールはなくなります。|モデルの代役がツールを要求するのは、そのツールがリクエストに含まれ、かつシステムメッセージに名前がある場合だけです。ツールがなければ換算できないと答えます。実際のモデルはレートを作り上げることもあります。|「Available tools」のほかの項目は別のレッスンのもので、ここでは名前だけです。',

    'ref.guardrails': '出力ガードレール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',

    'insight.tool-called': '請求書の金額と通貨を渡して {tool} を呼び出しました。',
    'insight.from-tool': '回答の USD 金額とレートは、{tool} が返した値です。',
    'insight.no-tool': 'リクエストにツールが含まれていなかったため、換算できませんでした。',
    'insight.tool-unused': 'リクエストには含まれていましたが、システムメッセージに名前がないため呼び出されませんでした: {list}。',
    'insight.tool-failed': '{tool} は換算結果を返しませんでした。',
    'insight.no-invoice': 'ユーザーメッセージに請求書の合計金額がありません。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  const list = (insight.names || []).join(t('lang') === 'ja' ? '、' : ', ');
  return t('insight.' + insight.id, { list, tool: insight.tool });
}
