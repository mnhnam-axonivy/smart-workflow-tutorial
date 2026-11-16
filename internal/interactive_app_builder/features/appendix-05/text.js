/**
 * Appendix 05 — texts of the walkthrough, in English and Japanese. Keys used by the runtime:
 * tour.intro.*, tour.chapter.<id> (the page's section headings, word for word),
 * tour.<note>.title/.text, about.rules, ref.* (names of the tutorials a setting belongs to).
 * The agent is the one of Human in the Loop: the explanations of its answers come from there.
 */
import { strings as human, describeInsight } from '../feature-13/text.js';

const answers = lang => {
  const out = {};
  Object.keys(human[lang]).filter(key => key.startsWith('insight.')).forEach(key => { out[key] = human[lang][key]; });
  return out;
};

export { describeInsight };

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'Start from the symptom',
    'tour.intro.text': 'Watch the Human in the Loop process break in the ways this page lists, one at a time. Each time you see the symptom, and the line in the Runtime Log that names its cause. Afterwards you can break it yourself.',
    'tour.intro.duration': 'about 7 min',
    'tour.chapter.noAnswer': 'The agent did not answer',
    'tour.chapter.unexpected': 'The agent answered, but not as expected',
    'tour.chapter.messages': 'Messages and expressions',
    'tour.chapter.configuration': 'Configuration',
    'tour.chapter.humanInTheLoop': 'Human in the loop',
    'tour.chapter.catchable': 'Errors you can catch',
    'tour.chapter.observe': 'Finding out what really happened',

    // 1 — The agent did not answer
    'tour.logFirst.title': 'Check the log first',
    'tour.logFirst.text': 'Every problem in this walkthrough leaves a line in the Runtime Log, and that line usually names the cause. Not every problem is an error: some leave nothing but that line.',
    'tour.breakerOn.title': 'The circuit breaker is on',
    'tour.breakerOn.text': '`AI.CircuitBreaker.Enabled` is now "true". It stops every AI call in the application, this agent included.',
    'tour.breakerLog.title': 'The log names it',
    'tour.breakerLog.text': 'The agent threw `smartworkflow:stop`. Its only boundary event catches `human:decision`, so the process ends here with an unhandled error.',
    'tour.blankQuery.title': 'A blank User message',
    'tour.blankQuery.text': 'The User message is now empty. Smart Workflow allows that on purpose, so that an element you are still setting up does not fail.',
    'tour.skippedLog.title': 'Skipped, not failed',
    'tour.skippedLog.text': 'Nothing was sent to the model. The only trace is this info line: “Agent call was skipped, since there was no user query”.',
    'tour.carriesOn.title': 'The process carries on',
    'tour.carriesOn.text': 'Log result runs as if the agent had answered, and `in.result` is empty.',
    'tour.wrongTarget.title': 'A target of another type',
    'tour.wrongTarget.text': '“Map result to” now names `in.decision`, a `HumanFeedback`. The agent answers with text.',
    'tour.mapLog.title': 'Logged, not thrown',
    'tour.mapLog.text': 'The answer does not fit, so it is dropped: “Failed to map result to in.decision”. The process carries on with the field empty. Compare the type of the result with the type of the target field.',

    // 2 — The agent answered, but not as expected
    'tour.noTools.title': 'No tools selected',
    'tour.noTools.text': 'An empty Available tools field means that the agent has no tools at all.',
    'tour.explains.title': 'It explains instead of doing it',
    'tour.explains.text': 'The invoice needs a person, but the agent has no way to ask one, so it describes what is missing. No error, no dialog: the answer is all you get.',
    'tour.noTag.title': 'A start without the tool tag',
    'tour.noTag.text': 'askUserFeedback is selected on the agent again, but its start in Feature13Tools.p.json has lost the `tool` tag.',
    'tour.dropped.title': 'Dropped without a message',
    'tour.dropped.text': 'No callable start tagged `tool` has that name, so the selected tool does not go with the request. Nothing in the log says so.',
    'tour.neverCalls.title': 'It never calls the tool you expected',
    'tour.neverCalls.text': 'It could not: the tool was never offered. Check the selection, the tag and the description before you blame the prompt.',

    // 3 — Messages and expressions
    'tour.queryTypo.title': 'A typo in an expression',
    'tour.queryTypo.text': '`in.qeury` is no field of the process data. The editor marks it, but the process still runs.',
    'tour.queryFailed.title': 'The whole call is skipped',
    'tour.queryFailed.text': 'Expanding the User message failed, so the call was skipped, with the same line as for a blank message. Read the error just before it: that is the cause.',
    'tour.systemTypo.title': 'A typo in the System message',
    'tour.systemTypo.text': '`in.limit` does not exist either. This time it is in the System message.',
    'tour.noSystem.title': 'Sent without a System message',
    'tour.noSystem.text': 'The Agent conversation shows what really went to the model: the User message, and no System message at all. The call goes ahead anyway.',
    'tour.withoutRules.title': 'It answers, without rules',
    'tour.withoutRules.text': 'The limit and the instruction to ask a person are gone with the System message. When an agent suddenly stops behaving, check for this first.',

    // 4 — Configuration
    'tour.providerTypo.title': 'A provider that is not installed',
    'tour.providerTypo.text': '`AI.DefaultProvider` now says "Open AI", with a space. No installed provider has that name.',
    'tour.unknownProvider.title': 'Unknown model provider',
    'tour.unknownProvider.text': 'The step fails before anything is sent, and the log names the provider it could not find.',
    'tour.noKey.title': 'No API key',
    'tour.noKey.text': 'The key is now empty: never set, as on a server where nobody entered it in the Engine Cockpit.',
    'tour.unauthorized.title': 'An authentication error',
    'tour.unauthorized.text': 'The provider rejects the call with 401 Unauthorized. The log names the variable that holds the key.',
    'tour.unquoted.title': 'A model name without quotes',
    'tour.unquoted.text': '“Model” is a script field. Written like this, `gpt-4o` is read as an expression, and it does not compile.',
    'tour.modelLog.title': 'The config cannot be read',
    'tour.modelLog.text': 'The step fails: “Failed to extract config \'model\'”. Write `"gpt-4o"`, with quotes.',
    'tour.readEachCall.title': 'No restart needed',
    'tour.readEachCall.text': 'Variables are read on each call. If a change has no effect, check that you set it on the right application in the Engine Cockpit.',

    // 5 — Human in the loop
    'tour.wrongId.title': 'The wrong id',
    'tour.wrongId.text': 'The user task now resolves the invoice id instead of `in.aiMemoryId`.',
    'tour.noMemory.title': 'Found no pending ChatMemory',
    'tour.noMemory.text': 'No suspended conversation is stored under that id. You get the same message when the data class has no `aiMemoryId` field, so that the id was never stored.',
    'tour.twice.title': 'resolve() twice',
    'tour.twice.text': 'The code now calls `resolve()` a second time.',
    'tour.noRequest.title': 'Found no pending ToolExecutionRequest',
    'tour.noRequest.text': 'The first call answered the tool call. For the second there is nothing left to answer.',
    'tour.notBpm.title': 'Not a BPM error',
    'tour.notBpm.text': 'Both are IllegalStateExceptions. The Error Boundary Event cannot catch them: the message tells you which part of the chain is missing.',

    // 6 — Errors you can catch
    'tour.boundaryCode.title': 'One code, one event',
    'tour.boundaryCode.text': 'This Error Boundary Event catches `human:decision`, the error the tool throws to ask a person.',
    'tour.breakerAgain.title': 'The circuit breaker, once more',
    'tour.breakerAgain.text': 'With the breaker on, the agent throws a BPM error with another code.',
    'tour.stopCode.title': 'smartworkflow:stop',
    'tour.stopCode.text': 'This error could be caught, but not by this event: its code is different.',
    'tour.unhandled.title': 'Unhandled',
    'tour.unhandled.text': 'Nothing caught it, so the process fails. A second Error Boundary Event with `smartworkflow:stop` would send it to a fallback instead, as in Circuit Breaker.',
    'tour.codes.title': 'Where the codes are',
    'tour.codes.text': 'Guardrail violations, the circuit breaker and the errors of your own tools are all BPM errors. Quick Reference lists every code.',

    // 7 — Finding out what really happened
    'tour.conversation.title': 'What the model received',
    'tour.conversation.text': 'The Agent conversation shows the exact System message, User message and tool calls of this run. When the log is not enough, this is where to look.',
    'tour.inTheEngine.title': 'On a real engine',
    'tour.inTheEngine.text': 'Switch on `AI.Observability.Ivy.Enabled` and open the Governance Dashboard to read the same for a case, or follow every call as a trace in Arize Phoenix (Observability).',

    'about.rules': 'The process is the one of Human in the Loop. Each case changes one thing in it, runs it, and puts it back. The log lines are those of Smart Workflow 14.0.0.|The stand-in model reads invoice number, supplier and total from the user message and takes the limit from its system message. Above the limit it asks through askUserFeedback when that tool came with the request and the system message names it; otherwise it says why it cannot.|Guardrails are simulated so that the circuit breaker acts. The user dialog is simulated: in the walkthrough the answer is typed for you.',

    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',
    ...answers('en')
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': '症状から調べる',
    'tour.intro.text': 'ヒューマンインザループのプロセスを、このページに挙げた方法で1つずつ壊していきます。そのたびに症状と、その原因を示すランタイムログの行を確認します。終わったら、自分で壊して試せます。',
    'tour.intro.duration': '約7分',
    'tour.chapter.noAnswer': 'エージェントが回答しなかった',
    'tour.chapter.unexpected': 'エージェントは回答したが、期待どおりではない',
    'tour.chapter.messages': 'メッセージと式',
    'tour.chapter.configuration': '設定',
    'tour.chapter.humanInTheLoop': 'ヒューマンインザループ',
    'tour.chapter.catchable': 'キャッチできるエラー',
    'tour.chapter.observe': '実際に何が起きたかを調べる',

    // 1 — エージェントが回答しなかった
    'tour.logFirst.title': 'まずログを確認する',
    'tour.logFirst.text': 'このウォークスルーの問題はどれも、ランタイムログに1行を残します。多くの場合、その行で原因が分かります。すべてがエラーになるわけではなく、その1行しか残らない問題もあります。',
    'tour.breakerOn.title': 'サーキットブレーカーがオン',
    'tour.breakerOn.text': '`AI.CircuitBreaker.Enabled` を "true" にしました。アプリケーション内のすべてのAI呼び出しが停止します。このエージェントも例外ではありません。',
    'tour.breakerLog.title': 'ログが原因を示す',
    'tour.breakerLog.text': 'エージェントが `smartworkflow:stop` をスローしました。境界イベントは `human:decision` しかキャッチしないため、プロセスは未処理のエラーでここで終了します。',
    'tour.blankQuery.title': '空のユーザーメッセージ',
    'tour.blankQuery.text': 'ユーザーメッセージを空にしました。Smart Workflow はこれを意図的に許可しています。設定途中の要素が失敗しないようにするためです。',
    'tour.skippedLog.title': '失敗ではなくスキップ',
    'tour.skippedLog.text': 'モデルには何も送信されていません。残るのは「Agent call was skipped, since there was no user query」という info の行だけです。',
    'tour.carriesOn.title': 'プロセスは続行する',
    'tour.carriesOn.text': 'エージェントが回答したかのように Log result が実行され、`in.result` は空のままです。',
    'tour.wrongTarget.title': '型の異なる代入先',
    'tour.wrongTarget.text': '「Map result to」を `HumanFeedback` 型の `in.decision` にしました。エージェントはテキストで回答します。',
    'tour.mapLog.title': 'スローされず、ログに記録される',
    'tour.mapLog.text': '回答が代入先に合わないため破棄されます:「Failed to map result to in.decision」。プロセスはフィールドが空のまま続行します。結果の型と代入先フィールドの型を比べてください。',

    // 2 — エージェントは回答したが、期待どおりではない
    'tour.noTools.title': 'ツールが選択されていない',
    'tour.noTools.text': 'Available tools が空の場合、エージェントはツールを一切持ちません。',
    'tour.explains.title': '実行する代わりに説明する',
    'tour.explains.text': 'この請求書には人の判断が必要ですが、エージェントには人に尋ねる手段がないため、何が足りないかを説明します。エラーもダイアログもなく、得られるのはこの回答だけです。',
    'tour.noTag.title': 'tool タグのない開始',
    'tour.noTag.text': 'askUserFeedback はエージェントで再び選択されていますが、Feature13Tools.p.json の開始から `tool` タグが外れています。',
    'tour.dropped.title': '何も言わずに除外される',
    'tour.dropped.text': '`tool` タグの付いた呼び出し可能な開始にその名前がないため、選択したツールはリクエストに含まれません。ログにも何も出ません。',
    'tour.neverCalls.title': '期待したツールを呼び出さない',
    'tour.neverCalls.text': '呼び出せなかったのです。ツールが提供されていませんでした。プロンプトを疑う前に、選択、タグ、説明を確認してください。',

    // 3 — メッセージと式
    'tour.queryTypo.title': '式の入力ミス',
    'tour.queryTypo.text': '`in.qeury` はプロセスデータのフィールドではありません。エディタはこれを示しますが、プロセスは実行できます。',
    'tour.queryFailed.title': '呼び出し全体がスキップされる',
    'tour.queryFailed.text': 'ユーザーメッセージの展開に失敗したため、空のメッセージと同じ行を出して呼び出しがスキップされました。その直前のエラーが原因です。',
    'tour.systemTypo.title': 'システムメッセージの入力ミス',
    'tour.systemTypo.text': '`in.limit` も存在しません。今回はシステムメッセージの中です。',
    'tour.noSystem.title': 'システムメッセージなしで送信',
    'tour.noSystem.text': '「エージェントの会話」には、実際にモデルへ送られた内容が表示されます。ユーザーメッセージだけで、システムメッセージはありません。それでも呼び出しは行われます。',
    'tour.withoutRules.title': 'ルールなしで回答する',
    'tour.withoutRules.text': '上限と、人に尋ねるという指示は、システムメッセージとともに消えました。エージェントが突然指示に従わなくなったら、まずここを確認してください。',

    // 4 — 設定
    'tour.providerTypo.title': 'インストールされていないプロバイダー',
    'tour.providerTypo.text': '`AI.DefaultProvider` をスペース入りの "Open AI" にしました。この名前のプロバイダーはインストールされていません。',
    'tour.unknownProvider.title': 'Unknown model provider',
    'tour.unknownProvider.text': '何も送信される前にステップが失敗し、見つからなかったプロバイダーの名前がログに出ます。',
    'tour.noKey.title': 'APIキーがない',
    'tour.noKey.text': 'キーを空にしました。サーバーで誰も Engine Cockpit に入力していない状態と同じです。',
    'tour.unauthorized.title': '認証エラー',
    'tour.unauthorized.text': 'プロバイダーは 401 Unauthorized で呼び出しを拒否します。ログには、キーを保持する変数の名前が出ます。',
    'tour.unquoted.title': '引用符のないモデル名',
    'tour.unquoted.text': '「Model」はスクリプトフィールドです。このように書くと `gpt-4o` は式として読まれ、コンパイルできません。',
    'tour.modelLog.title': '設定を読み取れない',
    'tour.modelLog.text': 'ステップは失敗します:「Failed to extract config \'model\'」。引用符を付けて `"gpt-4o"` と書いてください。',
    'tour.readEachCall.title': '再起動は不要',
    'tour.readEachCall.text': '変数は呼び出しのたびに読み取られます。変更が反映されない場合は、Engine Cockpit で正しいアプリケーションに設定したかを確認してください。',

    // 5 — ヒューマンインザループ
    'tour.wrongId.title': '誤ったID',
    'tour.wrongId.text': 'ユーザータスクが `in.aiMemoryId` ではなく請求書IDで resolve するようにしました。',
    'tour.noMemory.title': 'Found no pending ChatMemory',
    'tour.noMemory.text': 'そのIDで保存されたサスペンド中の会話はありません。データクラスに `aiMemoryId` フィールドがなく、IDが保存されなかった場合にも同じメッセージになります。',
    'tour.twice.title': 'resolve() を2回',
    'tour.twice.text': 'コードが `resolve()` をもう一度呼び出すようにしました。',
    'tour.noRequest.title': 'Found no pending ToolExecutionRequest',
    'tour.noRequest.text': '1回目の呼び出しでツール呼び出しに回答済みです。2回目には回答するものが残っていません。',
    'tour.notBpm.title': 'BPMエラーではない',
    'tour.notBpm.text': 'どちらも IllegalStateException です。エラー境界イベントではキャッチできません。メッセージが、処理の流れのどこが欠けているかを示します。',

    // 6 — キャッチできるエラー
    'tour.boundaryCode.title': '1つのコードに1つのイベント',
    'tour.boundaryCode.text': 'このエラー境界イベントがキャッチするのは `human:decision` です。ツールが人に尋ねるためにスローするエラーです。',
    'tour.breakerAgain.title': 'もう一度サーキットブレーカー',
    'tour.breakerAgain.text': 'ブレーカーがオンだと、エージェントは別のコードのBPMエラーをスローします。',
    'tour.stopCode.title': 'smartworkflow:stop',
    'tour.stopCode.text': 'このエラーはキャッチできますが、このイベントではキャッチされません。コードが違うからです。',
    'tour.unhandled.title': '未処理',
    'tour.unhandled.text': 'どこでもキャッチされなかったため、プロセスは失敗します。`smartworkflow:stop` の2つ目のエラー境界イベントがあれば、「サーキットブレーカー」のようにフォールバックへ送れます。',
    'tour.codes.title': 'コードの一覧',
    'tour.codes.text': 'ガードレール違反、サーキットブレーカー、自作ツールのエラーは、どれもBPMエラーです。すべてのコードは「クイックリファレンス」にあります。',

    // 7 — 実際に何が起きたかを調べる
    'tour.conversation.title': 'モデルが受け取った内容',
    'tour.conversation.text': '「エージェントの会話」には、この実行の正確なシステムメッセージ、ユーザーメッセージ、ツール呼び出しが表示されます。ログだけでは分からないときは、ここを確認します。',
    'tour.inTheEngine.title': '実際のエンジンでは',
    'tour.inTheEngine.text': '`AI.Observability.Ivy.Enabled` をオンにしてガバナンスダッシュボードを開くと、ケースごとに同じ内容を確認できます。Arize Phoenix では、すべての呼び出しをトレースとして追跡できます（「観測可能性」）。',

    'about.rules': 'プロセスはヒューマンインザループのものです。各ケースで1か所だけ変更して実行し、元に戻します。ログの行は Smart Workflow 14.0.0 のものです。|モデルの代役は、ユーザーメッセージから請求書番号・仕入先・合計金額を読み取り、上限はシステムメッセージから取得します。上限を超える場合、askUserFeedback がリクエストに含まれ、システムメッセージがその名前を挙げていれば、それを使って尋ねます。そうでなければ、尋ねられない理由を答えます。|サーキットブレーカーが動作するよう、ガードレールをシミュレーションしています。ユーザーダイアログはシミュレーションで、ウォークスルーでは回答が自動で入力されます。',

    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',
    ...answers('ja')
  }
};
