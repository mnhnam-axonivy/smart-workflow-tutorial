# Interactive app builder

This folder builds the walkthroughs of the **Smart Workflow Feature Guide**. It is an internal tool: learners never see it, and nobody needs it to *use* the tutorials. You only need it to change a walkthrough or add one.

This article explains, in order:

1. [What we want to build](#1-what-we-want-to-build)
2. [What we use to build it](#2-what-we-use-to-build-it)
3. [How we build it, step by step](#3-how-we-build-it-step-by-step)

The [reference](#reference) at the end has the details you look up while working: commands, the fields of a lesson, the walkthrough's director, and what the simulator imitates.

---

## 1. What we want to build

### The idea

Reading about an AI agent is not the same as watching one run. Every tutorial page of the Feature Guide gets a **Walkthrough** button next to its title. It opens, full screen, a **simulated Axon Ivy Process Designer** that shows the tutorial's process and plays the lesson like an explainer video:

- it runs the process, and the token moves from element to element;
- it opens the agent's configuration and types changes into it, character by character;
- a note points at the thing being explained, one at a time, and a voice reads it aloud;
- when something goes wrong on purpose (no API key, no system message, a broken mapping), the learner sees the same error, log line or answer they would see in the real Designer.

When the walkthrough ends, the learner keeps a working simulator: they can click any element, change its configuration and run the process again.

### What it must do

| Need | Why |
| --- | --- |
| Run inside the tutorial project, with no engine, no AI provider, no API key and no internet | Anyone can open the guide and learn, at no cost, even offline. |
| Use the tutorial's real processes | The walkthrough never drifts from what the learner opens in the Designer. |
| Behave like Smart Workflow 14.0.0 | The errors, log lines and defaults the learner sees are the real ones. |
| Speak English and Japanese | The guide has both languages. |
| Leave the tutorials alone | The markdown does not change, and exports (the ZIP, a Markdown viewer) are unaffected. |

### Which pages have one

- **Feature tutorials 01 to 13, 15 and 17**, each with the tutorial's own process.
- **Observability (08)** has no process of its own. Its lesson runs `Feature05.p.json` with tracing switched on (the `-Dotel…` options of the Designer's Engine: Vm Args, `features/feature-08/settings.js`) and shows the traces in a tab that stands in for Arize Phoenix (`features/feature-08/phoenix.js`). Its spans follow Smart Workflow's OpenInference recorders and were compared with traces of a real engine in a local Phoenix.
- **Key Concepts (appendix 04)** shows each section of the page on `Feature05.p.json`, one chapter per heading: the agent and its messages, the context that grows with every tool call, the fallbacks of provider and model, two defaults that point in opposite directions (an inherited `DefaultInput` guardrail that blocks, an empty tool list), memory, a process step that enforces approval, and a variable that counts from the next call. Only RAG has no process to run; its chapter shows where retrieved passages would arrive in the context.
- **Troubleshooting (appendix 05)** starts from a symptom. It takes the Human in the Loop process (`Feature13.p.json`) and breaks it in the ways the page lists, one cause at a time: circuit breaker, blank user message, a result that does not map, no tools, a tool start without its tag, expressions that fail, an unknown provider, a missing key, an unquoted model name, the `DecisionMaker` exceptions, an uncaught BPM error, and more. Each cause shows the symptom and the Runtime Log line that names it.
- **No walkthrough:** RAG as a Tool (14), Governance Dashboard (16) and the practice pages, because the tutorial project has no agent process for them that could be simulated.

---

## 2. What we use to build it

| Tool | What it does here |
| --- | --- |
| **Plain JavaScript** (ES modules), no UI framework | The whole simulator. Small, fast, and nothing to keep up to date. |
| **[esbuild](https://esbuild.github.io)** | Bundles everything into one shared script plus one small script per lesson. |
| **[three.js](https://threejs.org)** (WebGL) | The process canvas: the camera that tilts while the agent calls the model, the message cards travelling between the two levels, the grid, token and ripples. |
| **Canvas 2D** | Paints the diagram itself, sharp at any zoom. The same painters also drive a 2D fallback for browsers without WebGL 2. |
| **Shadow DOM** | Keeps the simulator's styles and the guide's styles (full of global `!important` rules) out of each other's way. |
| **Web Speech API** | The voice: the browser's own speech synthesis. No audio files. |
| **The tutorial's own files** | Processes (`*.p.json`), data classes (`*.d.json`) and Java sources, imported at build time. |
| **A rule-based stand-in model** | Plays the role of the LLM, locally and the same way every time. |
| **Node.js test runner** | Unit tests of the process runner, the script interpreter, the stand-in models and the layout. |
| **[Puppeteer](https://pptr.dev) with Chrome or Edge** | The smoke test: plays every walkthrough in a real browser and takes screenshots. |
| **A small preview server** (`preview/server.mjs`) | Serves the real Feature Guide without an Axon Ivy engine. |
| **GitHub Actions** (`.github/workflows/walkthroughs.yml`) | Runs the unit tests, the build check and the smoke test on every change. |

Node.js is needed only here, to build and test. The output is plain JavaScript committed to the tutorial project.

---

## 3. How we build it, step by step

### Step 1: Load the real process

A lesson imports the tutorial's files directly from the tutorial project:

```js
import process from '../../../../tutorial/process/tutorial/features/Feature01.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature01Data.d.json';
```

`runtime/model/process.js` turns them into a model of elements, connectors and data fields. Because the files are read at build time, the simulator always shows the process as the tutorial ships it. Change the process in the Designer, rebuild, and the walkthrough follows.

### Step 2: Draw the Designer

The runtime (`runtime/`) draws what a learner knows from the Designer:

- **the canvas** (`runtime/stage/`): the diagram is painted with Canvas 2D (`stage/draw.js`) into textures, which three.js shows on a plane. Where WebGL 2 is missing, `stage/canvas-stage.js` takes over with the same painters;
- **the inscription view** (`runtime/ui/inscription.js`): the agent's Configuration tab, with the group titles and field labels copied from Smart Workflow's `AgentEditor`;
- **the bottom panel** (`runtime/ui/panel.js`): Runtime Log, Process data, and the Agent Conversation (what was sent to the model and what came back);
- **editor tabs** for `variables.yaml`, the tools file and source files.

Everything renders into a shadow root, so the guide and the simulator cannot break each other's styles.

### Step 3: Run the process the way Smart Workflow does

`runtime/model/runner.js` moves the token through the process and follows Smart Workflow's `AgentCallExecutor` (14.0.0): which provider and model are used, when a call is skipped, which settings fail the step, how files from the CMS are attached, how tools, guardrails and human-in-the-loop work. Scripts run in a small IvyScript interpreter (`runtime/model/ivyscript.js`).

The rule is: **imitate, never invent.** What the runner does not know (loops, `new`, other Java classes) is reported as unsupported, not guessed at. The full list is in [What the runtime simulates](#what-the-runtime-simulates).

### Step 4: Stand in for the model

There is no real LLM. Each lesson has a stand-in, `brain.respond(request)`, a set of rules that reads the system message, user message, files and tools and builds an answer. For example, Feature 01's stand-in follows "single sentence", "bullet list" or "JSON", and guesses when the system message is empty.

Keep it honest: return `insights` for whatever a rule recognised, so the learner can see why the answer changed, and let instructions the rules don't understand have no effect rather than a made-up one.

### Step 5: Write the lesson

Each lesson is a folder, `features/<name>/`:

| File | What goes in it |
| --- | --- |
| `index.js` | The lesson's definition: the process, variables.yaml, the stand-in model, and which settings it simulates. See [A lesson's definition](#a-lessons-definition). |
| `agent.js` | The stand-in model. |
| `tour.js` | The walkthrough, as chapters. |
| `text.js` | Every text, in English and Japanese. |

A chapter is a small script that drives the simulator through a **director** `d`:

```js
async function mapResult(d) {
  await d.open('f5', 'configuration');                       // open the agent's configuration
  d.focus('field:f5.resultMapping');                         // spotlight, no note
  await d.edit('f5.resultMapping', '');                      // typed, not just set
  await d.note('mappingEdit', { target: 'field:f5.resultMapping', wait: 2200 });
  await d.close();
  await d.run({                                              // run the process...
    fast: true,
    on: { 'agent:unmapped': ({ call }) => d.note('mappingLost', { quote: call.answer }) }  // ...and explain this moment
  });
}
```

A few rules keep walkthroughs easy to follow:

- **Name each chapter after a heading of the tutorial**, word for word. A black title screen shows it, so learners can find the section in the text.
- **Every chapter starts from the original process**, so any chapter can be replayed on its own.
- **A long chapter can be split into parts** (Troubleshooting's causes, numbered 1.1, 1.2, …), each with its own screen.
- **The notes are read aloud.** The voice reads each chapter title, each screen, and each note's title and text, sentence by sentence, and lights the sentence being read like a subtitle. A note stays until the voice has finished. The learner turns it off with the speaker button.

All the director can do is in [The walkthrough director](#the-walkthrough-director).

### Step 6: Build into the tutorial project

```bash
npm run build
```

esbuild writes the scripts into the tutorial project:

| Source | Output |
| --- | --- |
| `runtime/` | `tutorial/webContent/resources/js/interactive-runtime.min.js`: the simulator every lesson shares (three.js included) |
| `features/<name>/` | `tutorial/webContent/resources/js/<name>.js`: one small script per lesson |

Everything a browser needs is inside these files, so the guide makes no network requests. Commit them together with your source changes; `node build.mjs --check` fails when they are out of date.

### Step 7: Show it in the guide

1. `TutorialPages.xhtml` loads the runtime and each lesson script with `h:outputScript`.
2. When the guide shows a page, `tutorial-pages.js` asks whether a lesson is registered for it (`feature-01` for page `01`, `appendix-05` for `a05`). If so, it puts a **Walkthrough** button next to the title.
3. The button opens a full-screen dialog and starts the walkthrough at once. Escape or the close button closes it again and frees its WebGL context.

### Step 8: Check it

| Check | Command | What it proves |
| --- | --- | --- |
| Look at it | `npm run preview`, then open <http://127.0.0.1:4310/> | The real guide, served without an engine. Add `?lang=jp` for Japanese, `?renderer=canvas` for the 2D fallback. |
| Unit tests | `npm test` | The runner, the script interpreter, the stand-in models and the voice behave as intended. |
| Smoke test | `npm run smoke` | Every walkthrough plays to the end in Chrome or Edge inside the previewed guide, with no console errors and no network requests. Screenshots land in `.preview/`. Set `CHROME_PATH` if no browser is found. |
| Build check | `node build.mjs --check` | The committed scripts match their sources. |

GitHub Actions runs the last three on every change (`.github/workflows/walkthroughs.yml`).

---

## Adding a walkthrough for another tutorial

1. Copy `features/feature-01/` to `features/feature-NN/`. The folder name becomes the script name and the id the page looks up.
2. Import the tutorial's process and data class in `index.js`, write the stand-in model in `agent.js`, the chapters in `tour.js` and the texts in `text.js`.
3. `npm run build`, then add one line to `TutorialPages.xhtml`:

   ```xml
   <h:outputScript library="js" name="feature-NN.js" />
   ```

4. Add the page to `tools/smoke.mjs`, and run `npm test` and `npm run smoke`.

---

## Reference

### Commands

```bash
npm install              # once
npm run build            # write the scripts into the tutorial project
npm run watch            # rebuild on every change
npm run preview          # the Feature Guide without an engine: http://127.0.0.1:4310/
npm test                 # unit tests
npm run smoke            # plays every walkthrough in headless Chrome/Edge, then uses the simulator
node build.mjs --check   # fail if the committed scripts are stale (CI)
```

### A lesson's definition

`features/<name>/index.js` default-exports a plain object:

| Field | Purpose |
| --- | --- |
| `id` | Same as the folder name, e.g. `feature-01`. |
| `process`, `dataClass` | The tutorial's real `*.p.json` and `*.d.json`, imported from the tutorial project. |
| `classes` | Further `*.d.json` data classes the process refers to, for example the class named in "Expect result of type". |
| `toolProcess` | `{ file, process, dataClass }`: the callable sub-process with the agent's tools. It gets its own editor tab, and a tool call runs its elements. Its element ids carry the prefix `tools-`. |
| `sources` | Source files shown in editor tabs: `{ id, file, path, language: 'java' \| 'text', text, readOnly }`. Java and files without an extension are imported as text (see `loader` in `build.mjs`). |
| `views` | Further editor tabs the lesson draws itself: `{ id, file, icon, create(app, container) }`. `create` returns a controller (`app.views[id]`) with `render()`, `shown()`, `rect(part)` and `reveal(part)` (for notes that target `view:<id>@<part>`) and `dispose()`. It can follow runs through `app.events` (`run`, `reset`). |
| `javaTools(sources, { variablesText })` | The Java tools that are registered right now, judged from the current text of the sources and of variables.yaml: `[{ name, description, params, execute(args) }]`. Java is not compiled; `execute` is a JavaScript twin of the tool. |
| `cms` | CMS objects the process refers to with `ivy.cms.co("path")`, by path: `{ name, extension, reads }` for a file, where `reads` is the text a model would read in it, or `{ name, text }` for a text object. |
| `file`, `project` | Shown as the editor tab title and in log lines. |
| `variables` | Initial content of the simulated `variables.yaml`. |
| `brain.respond(request)` | The stand-in model. Receives `{ system, user, files, provider, model, resultClass, tools, toolResults, element, … }` and returns `{ text, insights }`, plus `value` (an object of `resultClass`) when it answers a result type. To use a tool it returns `{ toolCalls: [{ name, arguments }] }` instead; it is called again with the results in `toolResults` until it answers. `guessed` names the fields of an answer it made up. |
| `describeInsight(insight, t)` | Turns an insight into the sentence shown under "What the simulated model picked up". |
| `tour` | The walkthrough: `{ chapters: [{ id, play: async d => … }] }`. `voice: false` leaves the voice out of this lesson. |
| `strings` | `{ en, ja }` texts: `tour.intro.*`, `tour.chapter.<id>`, `tour.<note>.title` / `.text`, `about.rules`, `ref.*`, insight texts. |
| `tools` | Further options of the "Available tools" field, besides the tool starts of `toolProcess`. They exist in name only. |
| `simulates`, `seeAlso` | Which settings the lesson acts on, and which tutorial covers the rest. Settings that are not simulated stay visible and say so. |

### The walkthrough director

`runtime/ui/tour.js` documents every call at the top of the file. In short:

- **Notes**: `d.note(key, { target, params, quote, wait, extra })` shows `tour.<key>.title` / `.text`. A note stays for a reading time based on its length (`wait` for a fixed time, `extra` for more time when its target has to be read too). `quote` shows a value such as the model's answer; as lines `[{ text, wrong }]` the wrong ones are shown in red, flagged "(wrong)".
- **Targets** say what a note points at: `el:<id>` on the canvas, `field:<id>.<key>` in the inscription view, `field:<id>.code@text` or `vars@text` for one line of code, `field:<id>.<key>@text` for exactly that text in any other field, `log:last`, `data:<field>`, `chat` or `chat:<part>` in the Agent Conversation (`system`, `user`, `schema`, `tools`, `toolcall`, `tool`, `assistant`, `head`, `guards`; `@last` or `@<n>` for another than the first), `side`, `dialog`, `view:<id>@<part>` in a tab from `views`. Without a target the note docks in the bottom left corner of the canvas.
- **Edits are typed**: `d.edit` first puts the spotlight on the characters that are about to change, then removes and writes them step by step. A choice such as the provider changes at once.
- **Runs**: `d.run({ fast, on, start })` runs the process. Hooks in `on` step into it: `enter:<id>` before an element runs, `after:<id>` once it has, `pause:<id>` when a task waits for its user, `dialog:<id>` when a user dialog is open, and `agent:<phase>` during the agent call (`request`, `tool-call`, `tool-done`, `tool-result`, `response`, …). The run waits until the hook's notes have been read. `d.stop()` ends the run from inside a hook; `d.reset()` puts the process back in the middle of a chapter.
- **User dialogs**: in a `dialog:<id>` hook, `d.answer(text)` types an answer into the open dialog and submits it.
- **Views**: `d.open(id, tab)` / `d.close()` for the inscription view, `d.panel('log' | 'chat' | 'data' | null)` for the bottom panel, `d.tab('process' | 'tools' | 'src:<id>' | 'variables' | 'view:<id>')` for the editor tabs. Switching to the tools file while a tool runs shows the token travelling through the tool.
- **Screens**: every chapter opens with a black title screen showing `tour.chapter.<id>`. A chapter with parts, `{ id, label: 'cause', play: intro, parts: [{ id, play }] }`, plays `play` first, then each part from the original process, after a screen with the chapter's name, `tour.screen.<label>` ("Cause {n} of {total}") and `tour.<part id>.title`. The player lists the parts as 1.1, 1.2, …; each can be started on its own, and the intro card counts them with `tour.count.<label>` ("6 causes"). `d.screen(key, { label, n, total })` shows the same screen anywhere in a chapter.
- **Voice** (`runtime/ui/voice.js`): the browser's own speech synthesis, with the best voice it has for the language (a natural one when there is one, as in Edge). Quotes are not read; code is read the way a developer says it (`in.summary` → "in dot summary"). A note stays until the voice has finished, so a walkthrough gets longer; each intro card gives both durations. The speaker button in the player turns the voice off and on, and the choice is remembered. When the browser has no voice for the language, the button is greyed out and says so.
- **Pause** freezes notes, voice and animations alike. With `prefers-reduced-motion`, notes wait for **Next** instead of advancing by themselves.
- **Test options** in `window.swInteractiveOptions`: `tourPace` plays everything faster, `speech: null` turns the voice off. The smoke test uses both, and brings its own silent voice for the voice checks.

### What the runtime simulates

`runtime/model/runner.js` follows Smart Workflow's `AgentCallExecutor` (14.0.0), so configuration behaves as in the real element:

- no user message → the call is skipped with `Agent call was skipped, since there was no user query`, and the process continues
- provider: the element's own, else `AI.DefaultProvider`, else `OpenAI`; an unknown name fails the step
- a missing API key fails the step; a failing "Map result to" is logged and the process continues
- `<%=ivy.cms.co("path")%>` in the user message is loaded from the lesson's `cms` the way `QueryExpander` and `ContentLoader` do: PNG, JPG, JPEG and PDF files are attached, TXT and MD files and text objects become text, a path that does not exist adds nothing, any other file type skips the call. In the system message a file is not read: it becomes its `toString()`
- a PDF sent to Ollama or xAI fails the step, because the Model Provider Selection guide lists them without PDF input
- the system message is sent only when it is not blank
- with "Expect result of type" (in a lesson whose `simulates.structuredOutput` is true) the class must exist and end in `.class`, otherwise the step fails; the model's JSON answer becomes an object of that class, which only fits a field of the same type
- "Available tools" (in a lesson whose `simulates.tools` is true), as in `IvySubProcessToolsProvider` and `IvySubProcessToolExecutor`: every callable sub-process start tagged `tool` whose signature is selected goes to the model with its name, description and parameters; a selected name that matches no such start is dropped without a message. When the model asks for a tool, its sub-process runs on data of its own, fed through the start's input mapping, and the result mapping goes back to the model as JSON. An error inside a tool fails the agent step
- guardrails (in a lesson whose `simulates.guardrails` is true), in `runtime/model/guardrails.js` with the rules of the real classes: `PromptInjectionInputGuardrail`, `AiPromptInjectionInputGuardrail` (its classifier call is a stand-in), `PiiMaskingGuardrail`, `SensitiveDataOutputGuardrail`, and the circuit breaker (`AI.CircuitBreaker.Enabled`). The element's own lists apply, else `AI.Guardrails.DefaultInput` / `DefaultOutput`. A guardrail that blocks makes the agent throw a BPM error: `smartworkflow:guardrail:input:violation`, `…:output:violation` or `smartworkflow:stop`
- temperature (in a lesson whose `simulates.temperature` is true): what is sent is `ModelOptionUtils.toTemperature` of the field — empty, not a number or negative all become `0.0`
- human in the loop: a tool that ends in an Error End suspends the agent. The conversation is kept under an id written to the process data field `aiMemoryId`, `new DecisionMaker(in.aiMemoryId).resolve(answer)` adds the answer, and the next call of the agent continues with the user message `continue with my selection from the tool`, as `HumanInTheLoop` does

Outside the agent, the runner knows Error Boundary Events (a BPM error goes to the event on the element whose error code is equal, empty, or a pattern with `*` that fits; its output mapping runs with `error`), user tasks (the dialog is simulated as a question with a free-text answer; the output mapping and code run with `result`), Error Ends, several starts in one file (`run({ start })`; in the simulator, Run begins at the selected start), and scripts that switch the circuit breaker (`CircuitBreakerSignal.stopAll()` / `resumeAll()` rewrite variables.yaml). It also knows the Alternative gateway (the conditions are tried in their stored order, the first that is true decides, a path without a condition is taken otherwise) and tasks: with "Skip Tasklist" a task continues at once, otherwise the run waits for **Continue**, and a responsible of the kind "User from Attr." is evaluated and shown.

Scripts run in a small IvyScript interpreter (`runtime/model/ivyscript.js`): assignments to `in.`/`out.` fields, local variables, `if`/`else`, `try`/`catch`, comparisons and arithmetic, text joined with `+`, `ivy.log.*`, reading the fields of a data class object, a few String methods, `Double.parseDouble` / `Integer.parseInt`, `dev.langchain4j.internal.Json.toJson(...)`, `import` lines, casts with `as`, `error.getMessage()` / `getAttribute()` / `setAttribute()` of a BPM error, and the two classes the tutorials use from Smart Workflow: `CircuitBreakerSignal` and `DecisionMaker`. Anything else (loops, `new`, other Java classes) is reported as unsupported instead of being guessed at.

When a new Smart Workflow version changes any of these classes, update the runtime to match.

### Folder layout

```text
runtime/
  index.js            window.swInteractive: register / has / mount
  app.js              one mounted simulation: state, run control, wiring
  model/              process model, runner, IvyScript subset, macros, variables.yaml, providers
  stage/              the canvas: shared 2D painters, three.js stage, 2D fallback, effects, input
  ui/                 inscription view, bottom panel, walkthrough player and its voice, styles
  i18n.js             texts of the simulator itself (en, ja)
features/<name>/      one lesson each
features/shared/      code several lessons use (reading an invoice, the stand-in that extracts its fields)
preview/server.mjs    the Feature Guide without an engine
tools/smoke.mjs       browser check and preview images
test/                 unit tests
build.mjs             the build (esbuild)
```

### Debugging

In the browser console of the guide:

```js
swInteractive.instances()[0].app      // the mounted simulation
window.swInteractiveOptions = { renderer: 'canvas' }   // before opening a walkthrough: force the 2D fallback
```
