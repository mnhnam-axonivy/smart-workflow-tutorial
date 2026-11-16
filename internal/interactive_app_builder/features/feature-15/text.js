/**
 * Feature 15 — texts of the walkthrough, in English and Japanese. Keys used by the runtime:
 * tour.intro.*, tour.chapter.<id> (the tutorial's section headings, word for word),
 * tour.<note>.title/.text, about.rules, ref.* (names of the tutorials a setting belongs to).
 * The agent is the one of Basic Agent Setup: the explanations of its answers come from there.
 */
import { strings as basic, describeInsight } from '../feature-01/text.js';

/** The texts that explain an answer of the Invoice Summary Agent. */
const answers = lang => {
  const out = {};
  Object.keys(basic[lang]).filter(key => key.startsWith('insight.') || key.startsWith('language.')).forEach(key => { out[key] = basic[lang][key]; });
  return out;
};

export { describeInsight };

export const strings = {
  en: {
    'lang': 'en',
    'tour.intro.title': 'How the circuit breaker stops every agent',
    'tour.intro.text': 'Watch the Feature15 process with the switch off, on, and off again: a stopped call raises an error, and the process takes a manual path. Afterwards you can click any element to look at its configuration again.',
    'tour.intro.duration': 'about 2 min',
    'tour.chapter.how': 'How it works',
    'tour.chapter.flip': 'Step 1 — Switch the circuit breaker',
    'tour.chapter.boundary': 'Step 2 — Add an Error Boundary Event',
    'tour.chapter.fallback': 'Step 3 — Model the fallback',
    'tour.chapter.cancelled': 'A stopped agent run is cancelled, not paused',
    'tour.chapter.mistakes': 'Common mistakes',

    'tour.variable.title': 'One variable for the whole application',
    'tour.variable.text': '`AI.CircuitBreaker.Enabled` is the switch. With "false", or with nothing, agents run as usual.',
    'tour.normal.title': 'Switch off: business as usual',
    'tour.normal.text': 'The Invoice Summary Agent from Basic Agent Setup calls the model and gets its summary.',

    'tour.stopAll.title': 'A script flips the switch',
    'tour.stopAll.text': '`CircuitBreakerSignal.stopAll()` sets the variable to "true". An operator can do the same in the Engine Cockpit.',
    'tour.on.title': 'The switch is on',
    'tour.on.text': 'The variable now reads "true". Nothing was redeployed, and no agent was edited.',
    'tour.everywhere.title': 'Every agent, at once',
    'tour.everywhere.text': 'From the next agent call on, every call in the application is stopped, also in processes that start later.',

    'tour.stopped.title': 'Stopped before the model',
    'tour.stopped.text': '`CircuitBreakerGuardrail` is built in and always active. No agent selects it, and while the switch is on it lets nothing through.',
    'tour.stopCode.title': 'An error code of its own',
    'tour.stopCode.text': 'A stop is not a guardrail violation. The agent element throws a BPM error with this code:',
    'tour.catches.title': 'An event for the stop',
    'tour.catches.text': 'This Error Boundary Event catches `smartworkflow:stop`, so a stopped agent leads to a path of its own.',

    'tour.script.title': 'Fallback: manual review',
    'tour.script.text': 'An ordinary part of the process: it sets `in.isStopped`, writes a message instead of the summary, and logs why.',
    'tour.log.title': 'What the log says',
    'tour.log.text': 'One line says why the agent stopped, the next what happens with the invoice instead.',
    'tour.flag.title': 'A flag to branch on',
    'tour.flag.text': '`in.isStopped` is true. Branch on the error code, or on a flag like this one, never on the text of the message.',

    'tour.ended.title': 'This run took the manual path',
    'tour.ended.text': 'The agent call was stopped and gave no result. Nothing was queued for later.',
    'tour.off.title': 'The switch is off again',
    'tour.off.text': '`CircuitBreakerSignal.resumeAll()` set the variable back to "false".',
    'tour.notResumed.title': 'Nothing comes back',
    'tour.notResumed.text': 'The stopped call is neither continued nor run again. The invoice of that run stays in manual review.',
    'tour.newRun.title': 'A new run calls the model',
    'tour.newRun.text': 'Only agent calls that start after the switch was turned off go through.',

    'tour.wrongCode.title': 'Catching the guardrail codes instead',
    'tour.wrongCode.text': 'The event now waits for an input violation. A circuit breaker stop has the code `smartworkflow:stop`.',
    'tour.unhandled.title': 'Switching AI off breaks the process',
    'tour.unhandled.text': 'Nobody catches the stop, so the process fails at the agent. Give every agent call a `smartworkflow:stop` fallback.',

    'about.rules': 'The switch is AI.CircuitBreaker.Enabled. A real application keeps it in the engine; here the scripts of the process rewrite variables.yaml, where you can also change it by hand.|CircuitBreakerSignal.stopAll() and resumeAll() are the only Java calls the simulated scripts know besides logging.|The agent is the Invoice Summary Agent of Basic Agent Setup, with the same stand-in model.|The process has three starts. Run begins at the start you have selected, otherwise at the first.|The text of the error is how langchain4j words a failed guardrail, with the reason of the circuit breaker. It has not been compared with a running Axon Ivy engine.',

    'ref.tools': 'Callable Process Tools',
    'ref.structuredOutput': 'Structured Output',
    'ref.temperature': 'Model Settings',
    ...answers('en')
  },

  ja: {
    'lang': 'ja',
    'tour.intro.title': 'サーキットブレーカーがすべてのエージェントを止める仕組み',
    'tour.intro.text': 'スイッチがオフ、オン、再びオフの状態で Feature15 プロセスを実行します。停止された呼び出しはエラーをスローし、プロセスは手動のパスに進みます。終わったら、要素をクリックして設定をもう一度確認できます。',
    'tour.intro.duration': '約2分',
    'tour.chapter.how': '仕組み',
    'tour.chapter.flip': 'Step 1 — サーキットブレーカーを切り替える',
    'tour.chapter.boundary': 'Step 2 — Error Boundary Eventを追加する',
    'tour.chapter.fallback': 'Step 3 — フォールバックをモデリングする',
    'tour.chapter.cancelled': '停止されたエージェントの実行はキャンセルされる（一時停止ではない）',
    'tour.chapter.mistakes': 'よくあるミス',

    'tour.variable.title': 'アプリケーション全体で1つの変数',
    'tour.variable.text': '`AI.CircuitBreaker.Enabled` がスイッチです。"false" または空の場合、エージェントは通常どおり動作します。',
    'tour.normal.title': 'スイッチがオフ: 通常どおり',
    'tour.normal.text': '「エージェントの基本設定」の Invoice Summary Agent がモデルを呼び出し、要約を受け取ります。',

    'tour.stopAll.title': 'スクリプトがスイッチを切り替える',
    'tour.stopAll.text': '`CircuitBreakerSignal.stopAll()` は変数を "true" にします。運用担当者は Engine Cockpit から同じ操作ができます。',
    'tour.on.title': 'スイッチがオンになった',
    'tour.on.text': '変数は "true" になりました。再デプロイもエージェントの編集も行っていません。',
    'tour.everywhere.title': 'すべてのエージェントが一斉に',
    'tour.everywhere.text': '次のエージェント呼び出しから、アプリケーション内のすべての呼び出しが停止されます。後から開始されるプロセスでも同じです。',

    'tour.stopped.title': 'モデルに届く前に停止',
    'tour.stopped.text': '`CircuitBreakerGuardrail` は組み込みで、常に有効です。エージェント側で選択するものではなく、スイッチがオンの間は何も通しません。',
    'tour.stopCode.title': '専用のエラーコード',
    'tour.stopCode.text': '停止はガードレール違反ではありません。エージェント要素は次のコードの BPM エラーをスローします:',
    'tour.catches.title': '停止用のイベント',
    'tour.catches.text': 'この Error Boundary Event は `smartworkflow:stop` をキャッチします。停止されたエージェントは専用のパスに進みます。',

    'tour.script.title': 'Fallback: manual review',
    'tour.script.text': 'プロセスの通常の一部です。`in.isStopped` を設定し、要約の代わりにメッセージを書き込み、理由をログに出力します。',
    'tour.log.title': 'ログの内容',
    'tour.log.text': '1行目がエージェントが停止した理由、次の行が請求書をどう扱うかを示します。',
    'tour.flag.title': '分岐に使うフラグ',
    'tour.flag.text': '`in.isStopped` は true です。分岐にはエラーコードやこのようなフラグを使い、メッセージの文言は使わないでください。',

    'tour.ended.title': 'この実行は手動のパスに進んだ',
    'tour.ended.text': 'エージェント呼び出しは停止され、結果はありません。後で実行するために保留されることもありません。',
    'tour.off.title': 'スイッチが再びオフになった',
    'tour.off.text': '`CircuitBreakerSignal.resumeAll()` が変数を "false" に戻しました。',
    'tour.notResumed.title': '何も戻ってこない',
    'tour.notResumed.text': '停止された呼び出しは、再開も再実行もされません。その実行の請求書は手動レビューのままです。',
    'tour.newRun.title': '新しい実行はモデルを呼び出す',
    'tour.newRun.text': '通るのは、スイッチをオフにした後に開始されたエージェント呼び出しだけです。',

    'tour.wrongCode.title': 'ガードレールのコードをキャッチしてしまう',
    'tour.wrongCode.text': 'イベントが入力違反を待つようになりました。サーキットブレーカーによる停止のコードは `smartworkflow:stop` です。',
    'tour.unhandled.title': 'AI を止めるとプロセスが壊れる',
    'tour.unhandled.text': '誰も停止をキャッチしないため、プロセスはエージェントで失敗します。すべてのエージェント呼び出しに `smartworkflow:stop` のフォールバックを用意しましょう。',

    'about.rules': 'スイッチは AI.CircuitBreaker.Enabled です。実際のアプリケーションではエンジンが保持しますが、ここではプロセスのスクリプトが variables.yaml を書き換えます。手で変更することもできます。|シミュレーション上のスクリプトが扱える Java 呼び出しは、ログ出力のほかは CircuitBreakerSignal.stopAll() と resumeAll() だけです。|エージェントは「エージェントの基本設定」の Invoice Summary Agent で、モデルの代役も同じです。|このプロセスには開始が3つあります。「実行」は、選択中の開始から、選択がなければ最初の開始から始まります。|エラーの文言は、langchain4j がガードレールの失敗を表す形式に、サーキットブレーカーの理由を組み合わせたものです。実際の Axon Ivy エンジンとは照合していません。',

    'ref.tools': '呼び出し可能プロセスツール',
    'ref.structuredOutput': '構造化出力',
    'ref.temperature': 'モデル設定',
    ...answers('ja')
  }
};
