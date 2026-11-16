# Interactive app builder

Builds the interactive simulations that the **Smart Workflow Feature Guide** embeds in its tutorials: a simulated Axon Ivy Process Designer, rendered with [three.js](https://threejs.org), that opens full screen from a **Walkthrough** button next to a tutorial's title. It plays a walkthrough of the lesson, then lets the learner select elements, edit their inscription and run the process.

The build output is committed to the tutorial project, so nobody needs Node.js to *use* the tutorials. You only need this folder to change a simulation or add one.

## What is generated

| Source | Output | Loaded by |
|---|---|---|
| `runtime/` | `tutorial/webContent/resources/js/interactive-runtime.min.js` | `TutorialPages.xhtml` |
| `features/feature-NN/` | `tutorial/webContent/resources/js/feature-NN.js` | `TutorialPages.xhtml` |

There is a lesson for the feature tutorials 01 to 13, 15 and 17. The others have none: RAG as a Tool (14) and Governance Dashboard (16) have no agent process in the tutorial project that could be simulated, and neither have the practice pages. Observability (08) has no process of its own either; its lesson runs `Feature05.p.json` with tracing switched on (the `-Dotel…` options in the Designer's setting Engine: Vm Args, `features/feature-08/settings.js`) and shows the result in a tab that stands in for Arize Phoenix (`features/feature-08/phoenix.js`). Its spans follow Smart Workflow's OpenInference recorders and were compared with traces of a real engine in a local Phoenix.

Key Concepts (appendix 04) has a lesson that shows each section of the page on `Feature05.p.json` (`features/appendix-04/`, with the stand-in model of Feature 05): one chapter per heading, from the agent and its messages to the context that grows with every tool call, the fallbacks of provider and model, the two defaults that point in opposite directions (an inherited `DefaultInput` guardrail that blocks, an empty tool list), memory, a process step that enforces approval, and a variable that counts from the next call. Only RAG has no process to run; its chapter shows where retrieved passages would arrive in the context.

Troubleshooting (appendix 05) has a lesson too, although the page has no process: it starts from a symptom. `features/appendix-05/` takes the Human in the Loop process (`Feature13.p.json`, with the stand-in model of Feature 13) and breaks it in the ways the page lists, one at a time — circuit breaker, blank user message, a result that does not map, no tools, a tool start without its tag, expressions that fail in either message, an unknown provider, a missing key, an unquoted model name, the two `DecisionMaker` exceptions and an uncaught BPM error. Each case shows the symptom and the Runtime Log line that names the cause; `test/appendix-05.test.mjs` checks every one in the runner.

`interactive-runtime.min.js` is the simulator every tutorial shares (three.js, the Designer UI, the process runner). Each `features/<name>/` folder becomes one small `<name>.js` holding that tutorial's lesson. Everything is bundled into these files, so the guide makes no network requests — `npm run smoke` fails if it does.

## Commands

```bash
npm install        # once
npm run build      # write the scripts into the tutorial project
npm run watch      # rebuild on every change
npm run preview    # the Feature Guide without an engine: http://127.0.0.1:4310/
npm test           # unit tests (process runner, IvyScript subset, simulated model, layout)
npm run smoke      # plays every walkthrough in headless Chrome/Edge inside the previewed guide, then uses the simulator
node build.mjs --check   # fail if the committed scripts are stale (for CI)
```

`npm run preview` serves the tutorial project's real `TutorialPages.xhtml`, scripts, styles, markdown and images, resolving only the JSF parts an engine would render. Add `?lang=jp` for the Japanese session language or `?renderer=canvas` to force the 2D fallback. `npm run smoke` needs Chrome or Edge; set `CHROME_PATH` if it is not found.

## How a simulation gets into a tutorial

1. `TutorialPages.xhtml` includes the runtime and the feature script with `h:outputScript`.
2. When the guide renders a page, `tutorial-pages.js` checks whether a script has registered a simulation for it (`feature-01` for page `01`, `practice-01` for `p01`, `appendix-01` for `a01`). If so, it puts a **Walkthrough** button next to the page title.
3. The button opens a full-screen dialog and mounts the simulation with `autoplay`, so the walkthrough starts at once. Escape or the close button disposes it again, which frees its WebGL context.

The tutorial markdown does not change, and exports (the ZIP, a Markdown viewer) are unaffected.

## Adding a simulation for another tutorial

1. Copy `features/feature-01/` to `features/feature-NN/` and adapt it (see the next section). The folder name is the script name and the id the page looks up.
2. `npm run build`, then add one line to `TutorialPages.xhtml`:

   ```xml
   <h:outputScript library="js" name="feature-NN.js" />
   ```

3. Name the chapters after the headings of the tutorial's markdown, and add the page to `tools/smoke.mjs`.

## A feature definition

`features/<name>/index.js` default-exports a plain object:

| Field | Purpose |
|---|---|
| `id` | Same as the folder name, e.g. `feature-01`. |
| `process`, `dataClass` | The tutorial's real `*.p.json` and `*.d.json`, imported from the tutorial project. The simulation shows whatever is in them at build time. |
| `classes` | Further `*.d.json` data classes the process refers to, for example the class named in "Expect result of type". |
| `toolProcess` | `{ file, process, dataClass }`: the callable sub-process with the agent's tools. It gets its own editor tab, and a tool call runs its elements. Its element ids carry the prefix `tools-`. |
| `sources` | Source files shown in editor tabs: `{ id, file, path, language: 'java' \| 'text', text, readOnly }`. Java and files without an extension are imported as text (see `loader` in `build.mjs`). |
| `views` | Further editor tabs the lesson draws itself: `{ id, file, icon, create(app, container) }`. `create` returns a controller (`app.views[id]`) with `render()`, `shown()`, `rect(part)` and `reveal(part)` (for notes that target `view:<id>@<part>`) and `dispose()`. It can follow runs through `app.events` (`run`, `reset`). |
| `javaTools(sources, { variablesText })` | The Java tools that are registered right now, judged from the current text of the sources and of variables.yaml: `[{ name, description, params, execute(args) }]`. Java is not compiled; `execute` is a JavaScript twin of the tool. |
| `cms` | CMS objects the process refers to with `ivy.cms.co("path")`, by path: `{ name, extension, reads }` for a file, where `reads` is the text a model would read in it, or `{ name, text }` for a text object. |
| `file`, `project` | Shown as the editor tab title and in log lines. |
| `variables` | Initial content of the simulated `variables.yaml`. |
| `brain.respond(request)` | Stand-in for the LLM. Receives `{ system, user, files, provider, model, resultClass, tools, toolResults, element, … }` and returns `{ text, insights }`, plus `value` (an object of `resultClass`) when it answers a result type. To use a tool it returns `{ toolCalls: [{ name, arguments }] }` instead; it is called again with the results in `toolResults` until it answers. `guessed` names the fields of an answer it made up. |
| `describeInsight(insight, t)` | Turns an insight into the sentence shown under "What the simulated model picked up". |
| `tour` | The walkthrough: `{ chapters: [{ id, play: async d => … }] }`. See the next section. |
| `strings` | `{ en, ja }` texts: `tour.intro.*`, `tour.chapter.<id>`, `tour.<note>.title` / `.text`, `about.rules`, `ref.*`, insight texts. |
| `tools` | Further options of the "Available tools" field, besides the tool starts of `toolProcess`. They exist in name only. |
| `simulates`, `seeAlso` | Which settings the lesson acts on, and which tutorial covers the rest. Settings that are not simulated stay visible and say so. |

The model stand-in is deliberately rule-based and local. Keep it honest: return `insights` for whatever a rule recognised, so the learner can see why the answer changed, and let unsupported instructions have no effect rather than a made-up one.

## The walkthrough

A simulation opens on a card with one button. **Play walkthrough** makes the simulator drive itself like an explainer video: it runs the process, opens the inscription view, types changes and switches tabs, while one note at a time points at the thing it explains. When it ends, or when the learner skips it, the editable simulator is left with the process as the tutorial ships it. A feature without `tour` opens directly in that state.

Each chapter is an async function that receives a director `d` (`runtime/ui/tour.js` documents all of it):

```js
async function mapResult(d) {
  await d.open('f5', 'configuration');                       // inscription view of the agent
  d.focus('field:f5.resultMapping');                         // spotlight, no note
  await d.edit('f5.resultMapping', '');                      // typed, not just set
  await d.note('mappingEdit', { target: 'field:f5.resultMapping', wait: 2200 });
  await d.close();
  await d.run({
    fast: true,
    on: { 'agent:unmapped': ({ call }) => d.note('mappingLost', { quote: call.answer }) }
  });
}
```

- **Notes** take their texts from `tour.<key>.title` / `.text`. A note stays for a reading time derived from its length (pass `wait` for a fixed time, or `extra` for more time when its target has to be read too), and `quote` shows a value such as the model's answer. Pass `quote` as lines `[{ text, wrong }]` to show the wrong ones in red, flagged "(wrong)".
- **Targets** say what a note points at: `el:<id>` on the canvas, `field:<id>.<key>` in the inscription view, `field:<id>.code@text` or `vars@text` for one line of code, `field:<id>.<key>@text` for exactly that text in any other field, `log:last`, `data:<field>`, `chat` or `chat:<part>` in the Agent Conversation (`system`, `user`, `schema`, `tools`, `toolcall`, `tool`, `assistant`, `head`, `guards`; `@last` or `@<n>` for another than the first), `side`, `view:<id>@<part>` in a tab from `views`. Without a target the note docks in the bottom left corner of the canvas.
- **Edits are typed.** `d.edit` first puts the spotlight on the characters that are about to change, then removes and writes them step by step, slowly enough to follow. A choice such as the provider changes at once.
- **Hooks** of `d.run` step into the run: `enter:<id>` before an element runs, `after:<id>` once it has, `pause:<id>` when a task waits for its user, and `agent:<phase>` during the agent call (`request`, `tool-call`, `tool-done`, `tool-result`, `response`, …). The run waits until the hook's notes have been read. `d.stop()` ends the run from inside a hook, `d.reset()` puts the process back in the middle of a chapter.
- **User dialogs**: in a `dialog:<id>` hook, `d.answer(text)` types an answer into the open dialog and submits it; `'dialog'` is a note target.
- **Tabs**: `d.tab('process' | 'tools' | 'src:<id>' | 'variables' | 'view:<id>')`. Switching to the tools file while a tool runs shows the token travelling through the tool; a tool that runs behind another tab runs at once.
- **Every chapter opens with a black title screen** that shows only its name, `tour.chapter.<id>`. Use the heading of the tutorial section the chapter belongs to, word for word, so learners can find it in the text.
- **Chapters with parts**: a chapter can be split, for example into the causes of a problem: `{ id, label: 'cause', play: intro, parts: [{ id, play }] }`. `play` runs first, then each part: the process is put back as the tutorial ships it, a black screen shows the chapter's name, `tour.screen.<label>` ("Cause {n} of {total}") and `tour.<part id>.title`, and the part plays. The player lists the parts of the current chapter as 1.1, 1.2, … (the current one with its name), each can be started on its own, and Back at the start of a part goes to the one before. The intro card counts them with `tour.count.<label>` ("6 causes"). Troubleshooting (appendix 05) splits its chapters this way.
- **A screen without parts**: `d.screen(key, { label, n, total })` shows the same screen anywhere in a chapter.
- **Every chapter starts from the original process**, so chapters can be replayed on their own and need not undo their changes.

Pause freezes notes and animations alike. With `prefers-reduced-motion`, notes wait for **Next** instead of advancing by themselves. `tourPace` in `window.swInteractiveOptions` plays everything faster; the smoke test uses it.

## What the runtime simulates

`runtime/model/runner.js` follows Smart Workflow's `AgentCallExecutor` (14.0.0), so configuration behaves as in the real element:

- no user message → the call is skipped with `Agent call was skipped, since there was no user query`, and the process continues
- provider: the element's own, else `AI.DefaultProvider`, else `OpenAI`; an unknown name fails the step
- a missing API key fails the step; a failing "Map result to" is logged and the process continues
- `<%=ivy.cms.co("path")%>` in the user message is loaded from the lesson's `cms` the way `QueryExpander` and `ContentLoader` do: PNG, JPG, JPEG and PDF files are attached, TXT and MD files and text objects become text, a path that does not exist adds nothing, any other file type skips the call
- a PDF sent to Ollama or xAI fails the step, because the Model Provider Selection guide lists them without PDF input
- the system message is sent only when it is not blank
- with "Expect result of type" (in a lesson whose `simulates.structuredOutput` is true) the class must exist and end in `.class`, otherwise the step fails; the model's JSON answer becomes an object of that class, which only fits a field of the same type
- "Available tools" (in a lesson whose `simulates.tools` is true), as in `IvySubProcessToolsProvider` and `IvySubProcessToolExecutor`: every callable sub-process start tagged `tool` whose signature is selected goes to the model with its name, description and parameters; a selected name that matches no such start is dropped without a message. When the model asks for a tool, its sub-process runs on data of its own, fed through the start's input mapping, and the result mapping goes back to the model as JSON. An error inside a tool fails the agent step

- guardrails (in a lesson whose `simulates.guardrails` is true), in `runtime/model/guardrails.js` with the rules of the real classes: `PromptInjectionInputGuardrail`, `AiPromptInjectionInputGuardrail` (its classifier call is a stand-in), `PiiMaskingGuardrail`, `SensitiveDataOutputGuardrail`, and the circuit breaker (`AI.CircuitBreaker.Enabled`). The element's own lists apply, else `AI.Guardrails.DefaultInput` / `DefaultOutput`. A guardrail that blocks makes the agent throw a BPM error: `smartworkflow:guardrail:input:violation`, `…:output:violation` or `smartworkflow:stop`
- temperature (in a lesson whose `simulates.temperature` is true): what is sent is `ModelOptionUtils.toTemperature` of the field — empty, not a number or negative all become `0.0`
- human in the loop: a tool that ends in an Error End suspends the agent. The conversation is kept under an id written to the process data field `aiMemoryId`, `new DecisionMaker(in.aiMemoryId).resolve(answer)` adds the answer, and the next call of the agent continues with the user message `continue with my selection from the tool`, as `HumanInTheLoop` does

Outside the agent, the runner knows Error Boundary Events (a BPM error goes to the event on the element whose error code is equal, empty, or a pattern with `*` that fits; its output mapping runs with `error`), user tasks (the dialog is simulated as a question with a free-text answer; the output mapping and code run with `result`), Error Ends, several starts in one file (`run({ start })`; in the simulator, Run begins at the selected start), and scripts that switch the circuit breaker (`CircuitBreakerSignal.stopAll()` / `resumeAll()` rewrite variables.yaml).

The runner also knows the Alternative gateway (the conditions are tried in their stored order, the first that is true decides, a path without a condition is taken otherwise) and tasks: with "Skip Tasklist" a task continues at once, otherwise the run waits for **Continue**, and a responsible of the kind "User from Attr." is evaluated and shown.

Scripts run in a small IvyScript interpreter (`runtime/model/ivyscript.js`): assignments to `in.`/`out.` fields, local variables, `if`/`else`, `try`/`catch`, comparisons and arithmetic, text joined with `+`, `ivy.log.*`, reading the fields of a data class object, a few String methods, `Double.parseDouble` / `Integer.parseInt`, `dev.langchain4j.internal.Json.toJson(...)`, `import` lines, casts with `as`, `error.getMessage()` / `getAttribute()` / `setAttribute()` of a BPM error, and the two classes the tutorials use from Smart Workflow: `CircuitBreakerSignal` and `DecisionMaker`. Anything else (loops, `new`, other Java classes) is reported as unsupported instead of being guessed at. Group titles and field labels of the agent's Configuration tab are copied from Smart Workflow's `AgentEditor`. When a new Smart Workflow version changes either class, update the runtime to match.

## Layout

```text
runtime/
  index.js            window.swInteractive: register / has / mount
  app.js              one mounted simulation: state, run control, wiring
  model/              process model, runner, IvyScript subset, macros, variables.yaml, providers
  stage/              the canvas: shared 2D painters, three.js stage, 2D fallback, effects, input
  ui/                 inscription view, bottom panel, walkthrough player, styles
  i18n.js             texts of the tutorial layer (en, ja)
features/<name>/      one lesson each
features/shared/      code several lessons use (reading an invoice, the stand-in that extracts its fields)
preview/server.mjs    the Feature Guide without an engine
tools/smoke.mjs       browser check and preview images
test/                 unit tests
```

The diagram is painted with Canvas 2D (`stage/draw.js`) into textures, which three.js shows on a plane; that keeps text sharp and lets the fallback renderer reuse the same painters. three.js adds the camera that tilts the process while the agent calls the model, the message cards travelling between the two levels, and the shader-drawn grid, token and ripples. Where WebGL 2 is unavailable, `stage/canvas-stage.js` takes over automatically.

The simulation renders into a shadow root. The guide's stylesheet is full of global `!important` rules; the shadow root keeps both sides out of each other's way.

## Debugging

In the browser console of the guide:

```js
swInteractive.instances()[0].app      // the mounted DesignerApp
window.swInteractiveOptions = { renderer: 'canvas' }   // before opening a tutorial: force the fallback
```
