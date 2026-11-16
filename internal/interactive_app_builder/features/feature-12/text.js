/**
 * Feature 12 — texts of the walkthrough, in English and Japanese. Keys used by the runtime:
 * tour.intro.*, tour.chapter.<id> (the tutorial's section headings, word for word),
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
    'tour.intro.title': 'How an agent keeps its conversation',
    'tour.intro.text': 'Follow one field, aiMemoryId, through the Feature13 process: it is empty, gets an id while the agent waits for a person, and is empty again when the agent has finished. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.field': 'Step 1 — Add aiMemoryId to the data class',
    'tour.chapter.run': 'Step 2 — Run the agent',
    'tour.chapter.trace': 'Step 3 — Verify: trace the memory ID',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.named.title': 'A field with a fixed name',
    'tour.named.text': 'The process data has a String field named exactly `aiMemoryId`. Smart Workflow recognises it by this name; a field spelled differently is not used.',
    'tour.nothingToSet.title': 'Nothing to set on the agent',
    'tour.nothingToSet.text': 'The Configuration of the agent has no setting for memory. The field in the data class is all it takes.',
    'tour.written.title': 'An id appears',
    'tour.written.text': 'The agent could not finish: it waits for a person. Smart Workflow stored its conversation and wrote the id of that conversation into the field.',

    'tour.traceStart.title': '1 — The process starts',
    'tour.traceStart.text': '`in.aiMemoryId` is empty. No conversation is being kept.',
    'tour.traceSuspended.title': '2 — The agent is suspended',
    'tour.traceSuspended.text': 'It asked a person through `askUserFeedback`. Its conversation is stored under `{id}`, and that id is now in the process data.',
    'tour.traceWaiting.title': '3 — A person answers',
    'tour.traceWaiting.text': 'While the task waits, the id stays in the process data. It is the only link to the conversation.',
    'tour.traceResolved.title': 'The answer joins the conversation',
    'tour.traceResolved.text': '`new DecisionMaker(in.aiMemoryId)` finds the stored conversation by the id and adds the answer to it.',
    'tour.traceResumed.title': '4 — The agent goes on',
    'tour.traceResumed.text': 'Back at the same element, the agent reads `in.aiMemoryId`, loads the conversation stored under `{id}` and continues it.',
    'tour.traceAnswer.title': 'It still knows the invoice',
    'tour.traceAnswer.text': 'Invoice number, amount and its own question all come from the stored conversation.',
    'tour.traceCleared.title': '5 — The conversation is over',
    'tour.traceCleared.text': 'The agent has finished, so the stored conversation is deleted and `in.aiMemoryId` is empty again.',

    'tour.reset.title': 'Resetting the memory ID between turns',
    'tour.reset.text': 'This line clears the id after the person has answered, before the flow returns to the agent.',
    'tour.forgotten.title': 'The agent starts from nothing',
    'tour.forgotten.text': 'Without the id it cannot find its conversation. It reads the invoice as if for the first time and asks the same question again.',

    'about.rules': 'This lesson runs the process of Human in the Loop, the example the tutorial points to.|As in Smart Workflow 14.0.0, a conversation is kept while an agent is suspended for a person: its id is written to in.aiMemoryId at that moment and cleared when the agent has finished. The simulation shows this case and no other use of the field.|The user dialog is simulated. In the walkthrough the answer is typed for you; afterwards you type it yourself and press Submit.|The process has two starts. Run begins at the start you have selected, otherwise at the first.',

    'ref.guardrails': 'Output Guardrail',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',
    ...answers('en')
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'エージェントが会話を保持する仕組み',
    'tour.intro.text': 'aiMemoryId という1つのフィールドを、Feature13 プロセスの中で追いかけます。最初は空で、エージェントが人を待つ間は ID が入り、エージェントが処理を終えると再び空になります。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.field': 'ステップ1 — データクラスにaiMemoryIdを追加する',
    'tour.chapter.run': 'ステップ2 — エージェントを実行する',
    'tour.chapter.trace': 'ステップ3 — 確認：メモリIDをトレースする',
    'tour.chapter.mistakes': 'よくある間違い',

    'tour.named.title': '名前の決まったフィールド',
    'tour.named.text': 'プロセスデータには、`aiMemoryId` という名前そのままの String フィールドがあります。Smart Workflow はこの名前で認識するため、綴りが違うフィールドは使われません。',
    'tour.nothingToSet.title': 'エージェント側の設定は不要',
    'tour.nothingToSet.text': 'エージェントの Configuration にメモリの設定はありません。データクラスにフィールドがあれば十分です。',
    'tour.written.title': 'ID が現れる',
    'tour.written.text': 'エージェントは処理を終えられず、人を待っています。Smart Workflow は会話を保存し、その会話の ID をこのフィールドに書き込みました。',

    'tour.traceStart.title': '1 — プロセス開始',
    'tour.traceStart.text': '`in.aiMemoryId` は空です。保持されている会話はありません。',
    'tour.traceSuspended.title': '2 — エージェントが中断される',
    'tour.traceSuspended.text': '`askUserFeedback` で人に尋ねました。会話は `{id}` で保存され、その ID がプロセスデータに入りました。',
    'tour.traceWaiting.title': '3 — 人が回答する',
    'tour.traceWaiting.text': 'タスクが待機している間、ID はプロセスデータに残ります。会話につながる唯一の手がかりです。',
    'tour.traceResolved.title': '回答が会話に加わる',
    'tour.traceResolved.text': '`new DecisionMaker(in.aiMemoryId)` が、ID から保存された会話を見つけ、回答を追加します。',
    'tour.traceResumed.title': '4 — エージェントが続行する',
    'tour.traceResumed.text': '同じ要素に戻ると、エージェントは `in.aiMemoryId` を読み、`{id}` で保存された会話を読み込んで続行します。',
    'tour.traceAnswer.title': '請求書のことを覚えている',
    'tour.traceAnswer.text': '請求書番号、金額、自分がした質問は、すべて保存された会話から得ています。',
    'tour.traceCleared.title': '5 — 会話の終了',
    'tour.traceCleared.text': 'エージェントが処理を終えたため、保存されていた会話は削除され、`in.aiMemoryId` は再び空になります。',

    'tour.reset.title': 'ターン間でメモリ ID をリセットする',
    'tour.reset.text': 'この行は、人が回答した後、フローがエージェントに戻る前に ID を消してしまいます。',
    'tour.forgotten.title': 'エージェントはゼロからやり直す',
    'tour.forgotten.text': 'ID がなければ会話を見つけられません。請求書を初めて見るかのように読み、同じ質問をもう一度します。',

    'about.rules': 'このレッスンでは、チュートリアルが例として挙げている「Human in the Loop」のプロセスを実行します。|Smart Workflow 14.0.0 と同じく、会話が保持されるのは、エージェントが人を待って中断されている間です。その時点で ID が in.aiMemoryId に書き込まれ、エージェントが処理を終えると消去されます。このシミュレーションが示すのはこのケースだけで、このフィールドのほかの使い方は扱いません。|ユーザーダイアログはシミュレーションです。ウォークスルーでは回答が自動で入力されます。その後は自分で入力して Submit を押します。|このプロセスには開始が2つあります。「実行」は、選択中の開始から、選択がなければ最初の開始から始まります。',

    'ref.guardrails': '出力ガードレール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',
    ...answers('ja')
  }
};
