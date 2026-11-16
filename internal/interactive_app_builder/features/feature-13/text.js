/**
 * Feature 13 — texts of the walkthrough and of the explanations shown next to an answer,
 * in English and Japanese. Keys used by the runtime: tour.intro.*, tour.chapter.<id> (the
 * tutorial's section headings, word for word), tour.<note>.title/.text, about.rules, ref.*
 * (names of the tutorials a setting belongs to).
 */

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How an agent asks a person',
    'tour.intro.text': 'Watch the Feature13 process run: the agent stops in the middle of its work, a person answers its question in a task, and the agent goes on with the answer. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 3 min',
    'tour.chapter.memory': 'Step 1 — Add aiMemoryId to the data class',
    'tour.chapter.tool': 'Step 2 — Create the askUserFeedback tool',
    'tour.chapter.agent': 'Step 3 — Configure the AgenticProcessCall',
    'tour.chapter.userTask': 'Step 4 — Create the UserTask and dialog',
    'tour.chapter.resolve': 'Step 5 — Resolve the decision',
    'tour.chapter.lowValue': 'How the flow runs (low-value path)',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.memoryField.title': 'aiMemoryId',
    'tour.memoryField.text': 'A String field with exactly this name. When an agent is suspended, Smart Workflow writes the id of its conversation here and finds the conversation again by it.',

    'tour.toolStart.title': 'The askUserFeedback tool',
    'tour.toolStart.text': 'A callable sub-process tagged `tool`, as in Callable Process Tools. Its description tells the model to use it when a human has to decide.',
    'tour.toolParam.title': 'One parameter: the question',
    'tour.toolParam.text': '`feedback` is a `HumanFeedback` object. The model fills in its `question`; the `answer` stays empty for now.',
    'tour.throws.title': 'It ends in an error, on purpose',
    'tour.throws.text': 'The tool has no normal end. It throws `human:decision`, which stops the agent in the middle of its work.',
    'tour.attribute.title': 'The question travels with the error',
    'tour.attribute.text': 'This line attaches the `HumanFeedback` to the error, so whoever catches it can show the question.',

    'tour.toolSelected.title': 'Available tools',
    'tour.toolSelected.text': '`askUserFeedback` is the only tool of this agent.',
    'tour.instructed.title': 'When to ask',
    'tour.instructed.text': 'The system message sets the rule: above $2,000 the agent must ask a human for the reason, with one direct question and no suggestions.',
    'tour.boundaryCode.title': 'An event for human:decision',
    'tour.boundaryCode.text': 'The Error Boundary Event on the agent catches the error the tool throws.',
    'tour.boundaryMap.title': 'The question goes into the process data',
    'tour.boundaryMap.text': '`out.decision` receives the `HumanFeedback` from the error. The user task will show its question.',

    'tour.asks.title': 'The agent asks',
    'tour.asks.text': 'The invoice is above the limit, so the model calls the tool with its question:',
    'tour.suspended.title': 'The agent is suspended',
    'tour.suspended.text': 'The tool threw `human:decision`. The agent stops here, and its conversation so far is kept.',
    'tour.idWritten.title': 'The memory id',
    'tour.idWritten.text': 'Smart Workflow wrote the id of the kept conversation into `in.aiMemoryId`.',
    'tour.dialogOpen.title': 'A task for a person',
    'tour.dialogOpen.text': 'The user task shows the question of the agent in a dialog. The process waits here, for minutes or for days, until someone answers.',

    'tour.resolved.title': 'Resolve the decision',
    'tour.resolved.text': '`DecisionMaker` finds the kept conversation by its id and adds the answer of the person as the result of the tool call that was waiting.',
    'tour.resumes.title': 'The same agent, again',
    'tour.resumes.text': 'The connector leads back to the agent. It takes up the conversation: the model now sees the question it asked and the answer it got.',
    'tour.confirmed.title': 'The agent finishes its work',
    'tour.confirmed.text': 'It confirms the approval and repeats the reason, as its system message asks.',
    'tour.approvalTask.title': 'The approval task',
    'tour.approvalTask.text': 'The process creates the task “{name}”. Its description carries the reason, taken from the answer of the agent.',

    'tour.auto.title': 'Below the limit',
    'tour.auto.text': '$85 does not exceed $2,000. The model answers at once and never calls the tool.',
    'tour.sameProcess.title': 'No error, no user task',
    'tour.sameProcess.text': 'The same process and the same agent, and this element is never reached. Whether a person is asked is decided by the model, following its system message.',

    'tour.noTag.title': 'Forgetting the tool tag',
    'tour.noTag.text': 'The start of `askUserFeedback` has lost its tag `tool`.',
    'tour.cannotAsk.title': 'The agent cannot ask',
    'tour.cannotAsk.text': 'Without the tag the sub-process is no tool, so the model has nothing to call. Nobody is asked, and the invoice is not approved.',

    'about.rules': 'The stand-in model reads invoice number, supplier and total from the user message and takes the limit from its system message. Above the limit it asks through askUserFeedback, if that tool came with the request; otherwise it says that it cannot ask.|The user dialog is simulated: it shows the question and takes a free-text answer. In the walkthrough the answer is typed for you; afterwards you type it yourself and press Submit.|As in Smart Workflow, a suspended conversation is kept under an id that is written to in.aiMemoryId, DecisionMaker.resolve() adds the answer, and the next call of the agent continues it with the user message “continue with my selection from the tool”.|The process has two starts. Run begins at the start you have selected, otherwise at the first. The approval task waits until you press Continue.',

    'ref.guardrails': 'Output Guardrail',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',

    'insight.asked': 'The total {total} is above the limit of {limit}, so it asks a human through {tool}.',
    'insight.answered': 'The human has answered; the approval is confirmed with that reason.',
    'insight.below': 'The total {total} does not exceed {limit}: approved without asking.',
    'insight.no-tool': 'The total {total} is above {limit}, but no tool to ask a human came with the request.',
    'insight.not-told': 'The total {total} is above {limit}. {tool} came with the request, but the system message does not say to use it.',
    'insight.no-invoice': 'The user message contains no invoice total.'
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'エージェントが人に尋ねる仕組み',
    'tour.intro.text': 'Feature13 プロセスの実行を見ていきます。エージェントは処理の途中で停止し、人がタスクでその質問に答え、エージェントはその回答をもとに処理を続けます。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約3分',
    'tour.chapter.memory': 'ステップ1 — データクラスにaiMemoryIdを追加する',
    'tour.chapter.tool': 'ステップ2 — askUserFeedbackツールを作成する',
    'tour.chapter.agent': 'ステップ3 — AgenticProcessCallを設定する',
    'tour.chapter.userTask': 'ステップ4 — UserTaskとダイアログを作成する',
    'tour.chapter.resolve': 'ステップ5 — 決定を解決する',
    'tour.chapter.lowValue': 'フローの流れ（低額請求書パス）',
    'tour.chapter.mistakes': 'よくある間違い',

    'tour.memoryField.title': 'aiMemoryId',
    'tour.memoryField.text': 'この名前そのままの String フィールドです。エージェントが中断されると、Smart Workflow は会話の ID をここに書き込み、後でその ID から会話を探します。',

    'tour.toolStart.title': 'askUserFeedback ツール',
    'tour.toolStart.text': '「呼び出し可能プロセスツール」と同じく、`tool` タグの付いた呼び出し可能サブプロセスです。説明文が、人の判断が必要なときに使うようモデルに伝えます。',
    'tour.toolParam.title': 'パラメータは質問1つ',
    'tour.toolParam.text': '`feedback` は `HumanFeedback` オブジェクトです。モデルが `question` を埋め、`answer` はまだ空のままです。',
    'tour.throws.title': '意図的にエラーで終わる',
    'tour.throws.text': 'このツールには通常の終了がありません。`human:decision` をスローし、エージェントを処理の途中で止めます。',
    'tour.attribute.title': '質問はエラーと一緒に運ばれる',
    'tour.attribute.text': 'この行が `HumanFeedback` をエラーに添付します。エラーをキャッチした側が質問を表示できます。',

    'tour.toolSelected.title': 'Available tools（利用可能なツール）',
    'tour.toolSelected.text': 'このエージェントのツールは `askUserFeedback` だけです。',
    'tour.instructed.title': 'いつ尋ねるか',
    'tour.instructed.text': 'システムメッセージがルールを定めています。$2,000 を超える場合、エージェントは選択肢を示さず、1つの直接的な質問で人に理由を尋ねなければなりません。',
    'tour.boundaryCode.title': 'human:decision 用のイベント',
    'tour.boundaryCode.text': 'エージェントに付いた Error Boundary Event が、ツールのスローしたエラーをキャッチします。',
    'tour.boundaryMap.title': '質問がプロセスデータに入る',
    'tour.boundaryMap.text': '`out.decision` が、エラーから `HumanFeedback` を受け取ります。ユーザータスクがその質問を表示します。',

    'tour.asks.title': 'エージェントが尋ねる',
    'tour.asks.text': '請求書が上限を超えているため、モデルは質問を添えてツールを呼び出します:',
    'tour.suspended.title': 'エージェントが中断される',
    'tour.suspended.text': 'ツールが `human:decision` をスローしました。エージェントはここで止まり、それまでの会話は保持されます。',
    'tour.idWritten.title': 'メモリ ID',
    'tour.idWritten.text': 'Smart Workflow が、保持した会話の ID を `in.aiMemoryId` に書き込みました。',
    'tour.dialogOpen.title': '人のためのタスク',
    'tour.dialogOpen.text': 'ユーザータスクが、エージェントの質問をダイアログに表示します。誰かが回答するまで、プロセスは数分でも数日でもここで待機します。',

    'tour.resolved.title': '決定を解決する',
    'tour.resolved.text': '`DecisionMaker` は、ID から保持された会話を見つけ、待機中だったツール呼び出しの結果として人の回答を追加します。',
    'tour.resumes.title': '同じエージェントに戻る',
    'tour.resumes.text': 'コネクタはエージェントに戻ります。エージェントは会話を再開し、モデルは自分の質問とそれに対する回答を目にします。',
    'tour.confirmed.title': 'エージェントが処理を終える',
    'tour.confirmed.text': 'システムメッセージの指示どおり、承認を確認し、理由を繰り返します。',
    'tour.approvalTask.title': '承認タスク',
    'tour.approvalTask.text': 'プロセスはタスク「{name}」を作成します。説明には、エージェントの回答から取った理由が入ります。',

    'tour.auto.title': '上限以下',
    'tour.auto.text': '$85 は $2,000 を超えません。モデルはすぐに回答し、ツールを呼び出しません。',
    'tour.sameProcess.title': 'エラーもユーザータスクもない',
    'tour.sameProcess.text': '同じプロセス、同じエージェントですが、この要素には到達しません。人に尋ねるかどうかは、モデルがシステムメッセージに従って判断します。',

    'tour.noTag.title': 'tool タグを忘れる',
    'tour.noTag.text': '`askUserFeedback` の開始要素から `tool` タグが外れました。',
    'tour.cannotAsk.title': 'エージェントは尋ねられない',
    'tour.cannotAsk.text': 'タグがなければサブプロセスはツールにならず、モデルには呼び出せるものがありません。誰にも尋ねられず、請求書は承認されません。',

    'about.rules': 'モデルの代役は、ユーザーメッセージから請求書番号・仕入先・合計金額を読み取り、上限はシステムメッセージから取得します。上限を超える場合、askUserFeedback がリクエストに含まれていればそれを使って尋ね、なければ尋ねられないと回答します。|ユーザーダイアログはシミュレーションです。質問を表示し、自由記述の回答を受け取ります。ウォークスルーでは回答が自動で入力されます。その後は自分で入力して Submit を押します。|Smart Workflow と同じく、中断された会話は ID で保持され、その ID が in.aiMemoryId に書き込まれます。DecisionMaker.resolve() が回答を追加し、次のエージェント呼び出しは「continue with my selection from the tool」というユーザーメッセージで会話を続けます。|このプロセスには開始が2つあります。「実行」は、選択中の開始から、選択がなければ最初の開始から始まります。承認タスクは「続行」を押すまで待機します。',

    'ref.guardrails': '出力ガードレール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',

    'insight.asked': '合計 {total} が上限 {limit} を超えているため、{tool} で人に尋ねます。',
    'insight.answered': '人が回答しました。その理由を添えて承認を確認します。',
    'insight.below': '合計 {total} は {limit} を超えていません。尋ねずに承認します。',
    'insight.no-tool': '合計 {total} は {limit} を超えていますが、人に尋ねるためのツールがリクエストに含まれていません。',
    'insight.not-told': '合計 {total} は {limit} を超えています。{tool} はリクエストに含まれていますが、システムメッセージにそれを使う指示がありません。',
    'insight.no-invoice': 'ユーザーメッセージに請求書の合計金額がありません。'
  }
};

/** Turns one insight from agent.js into a sentence, or null when there is nothing to say. */
export function describeInsight(insight, t) {
  return t('insight.' + insight.id, { total: insight.total, limit: insight.limit, tool: insight.tool });
}
