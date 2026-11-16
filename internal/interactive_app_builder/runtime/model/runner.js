/**
 * Executes a process model step by step.
 *
 * The agent step follows Smart Workflow's AgentCallExecutor (14.0.0) so that the simulation
 * reacts to configuration the way the real element does:
 *   - no user message            → the call is skipped with an info log, the process continues
 *   - a file in the user message → attached to the call (QueryExpander / ContentLoader); a
 *                                  provider without PDF input rejects a PDF
 *   - provider / model           → element setting, else AI.DefaultProvider, else "OpenAI"
 *   - system message             → sent only when it is not blank
 *   - "Expect result of type"    → the class's fields go to the model as a schema; its JSON
 *                                  answer becomes an object of that class
 *   - guardrails                 → input guardrails see the user message before anything is
 *                                  sent, output guardrails the answer before it is mapped;
 *                                  one that blocks throws a BPM error, which an Error
 *                                  Boundary Event on the element can catch
 *   - human in the loop          → a tool that ends in an Error End suspends the agent: its
 *                                  conversation is kept under an id written to the process
 *                                  data field aiMemoryId, DecisionMaker.resolve() adds the
 *                                  human's answer, and the next call of the agent goes on
 *   - "Available tools"          → the selected callable sub-processes tagged "tool" go to the
 *                                  model as functions; when it asks for one, the sub-process
 *                                  runs and its result goes back, until the model answers
 *   - "Map result to"            → `<target> = result`; a failing mapping is logged, not fatal
 *
 * Besides the agent it knows the Alternative gateway (the first condition that holds decides)
 * and tasks that wait for a user.
 *
 * The runner has no DOM or animation knowledge: everything visible goes through `io`, whose
 * async methods let the UI pace the run (token travel, LLM round trip, step mode).
 */
import { runScript, evalExpression, assignTo, mapJson, prettyJson, IvyScriptError, positionOf } from './ivyscript.js';
import { expandMacro } from './macro.js';
import { parseYaml } from './yaml.js';
import { resolveProvider, toTemperature, formatTemperature, MAX_TEMPERATURE } from './providers.js';
import { startElement, nextOf, agentConfig, configList, toolStarts, docOf, elementById, boundaryFor } from './process.js';
import { guardrailNames, evaluateGuardrail, classifyInjection, violationMessage, VIOLATION, CLASSIFIER, STOP, CIRCUIT_BREAKER, circuitBreakerOn, circuitBreakerStatics } from './guardrails.js';
import { readVariable, setVariable } from './yaml.js';

const BPM_ERROR = 'ch.ivyteam.ivy.bpm.error.BpmError';
const MEMORY_FIELD = 'aiMemoryId'; // the name convention of Smart Workflow (ProcessDataField)
const CONTINUE = 'continue with my selection from the tool'; // HumanInTheLoop.userMessage
const lines = value => (Array.isArray(value) ? value.join('\n') : value == null ? '' : String(value));
/** An id as langchain4j gives every invocation: a UUID. */
const invocationId = n => 'a7c3e5f1-2b4d-4f6a-8c9e-' + n.toString(16).padStart(12, '0');

const MAX_TOOL_ROUNDS = 12; // a model that keeps asking for tools is cut off

class Cancelled extends Error {}

class ProcessFailure extends Error {
  constructor(element, info) {
    super(info.message);
    this.element = element;
    this.info = info;
  }
}

const noop = () => {};
const IO_METHODS = ['travel', 'enter', 'leave', 'pause', 'agent', 'log', 'note', 'data', 'variable', 'dialog'];

export class ProcessRunner {
  /**
   * @param {Object} options
   * @param {Object} options.model   process model (see process.js)
   * @param {{ respond: Function }} options.brain  the feature's simulated LLM
   * @param {Object} [options.simulates]  what the lesson acts on, e.g. { structuredOutput: true }
   * @param {() => Object[]} [options.javaTools]  the Java tools that are registered right now:
   *   { name, description, params: [{ name, type, description }], execute(args) }
   * @param {Object} options.io      presentation callbacks, all optional
   * @param {() => Date} [options.now]
   */
  constructor({ model, brain, io = {}, simulates = {}, javaTools = () => [], now = () => new Date() }) {
    this.model = model;
    this.brain = brain;
    this.simulates = simulates || {};
    this.javaTools = javaTools;
    this.now = now;
    this.io = {};
    IO_METHODS.forEach(m => { this.io[m] = typeof io[m] === 'function' ? io[m].bind(io) : noop; });
    this.runCount = 0;
    this.active = null;
  }

  get running() { return this.active !== null; }

  cancel() {
    if (this.active) this.active.cancelled = true;
  }

  /** Switches step mode for the run in progress (Continue vs. Step while paused). */
  setStepMode(stepMode) {
    if (this.active) this.active.stepMode = stepMode;
  }

  /**
   * @param {Object} options
   * @param {string} options.variablesText   contents of variables.yaml
   * @param {boolean} [options.stepMode]     pause after every element
   * @param {Set<string>} [options.breakpoints]
   * @param {number} [options.runIndex]      what the model sees as the run's number (default: a counter)
   * @param {string} [options.start]         id of the start element to begin at (default: the first)
   * @returns {Promise<Object>} summary of what happened (status, agent calls, …)
   */
  async run({ variablesText = '', stepMode = false, breakpoints = new Set(), runIndex = null, start = null } = {}) {
    if (this.active) throw new Error('A run is already in progress');
    const run = {
      cancelled: false,
      index: runIndex == null ? this.runCount++ : runIndex,
      stepMode,
      breakpoints,
      data: {},
      variables: null,
      frame: null, // data of the tool sub-process that is running, if any
      memory: {}, // conversations of suspended agents, by memory id
      invocations: 0,
      route: null, // where a gateway sends the token
      result: { status: 'completed', visited: [], agentCalls: [], routes: [], tasks: [], caught: [], logs: [], data: null }
    };
    this.active = run;
    try {
      run.variablesText = variablesText;
      const yaml = parseYaml(variablesText);
      if (yaml.errors.length) {
        run.variables = {};
        run.variablesError = yaml.errors[0];
      } else run.variables = yaml.value;

      let element = (start && elementById(this.model, start)) || startElement(this.model);
      let connector = null;
      let stepped = false;
      while (element) {
        if (element.removed) {
          run.result.status = 'incomplete';
          run.result.missing = element.id;
          this.io.note('incomplete', { element });
          break;
        }
        if (connector) await this.#wait(run, this.io.travel(connector));
        // A breakpoint halts before its element runs, unless a step already stopped right here.
        if (run.breakpoints.has(element.id) && !stepped) await this.#wait(run, this.io.pause(element, 'breakpoint'));
        stepped = false;
        await this.#wait(run, this.io.enter(element));
        run.result.visited.push(element.id);
        try {
          await this.#execute(run, element);
        } catch (e) {
          if (!(e instanceof ProcessFailure)) throw e;
          // a BPM error goes to the Error Boundary Event that catches its code, if there is one
          const boundary = e.info.errorCode ? boundaryFor(this.model, element, e.info.errorCode) : null;
          if (boundary) {
            this.io.leave(element, 'caught');
            run.result.caught.push({ elementId: element.id, boundaryId: boundary.id, errorCode: e.info.errorCode, message: e.info.message });
            await this.#wait(run, this.io.enter(boundary));
            this.#catch(run, boundary, e.info);
            this.io.note('error-caught', { element: boundary, code: e.info.errorCode });
            this.io.leave(boundary, 'done');
            run.result.visited.push(boundary.id);
            const onward = nextOf(this.model, boundary);
            if (!onward || !onward.element) break;
            connector = { id: onward.connectorId, from: boundary, to: onward.element };
            element = onward.element;
            continue;
          }
          if (e.info.errorCode) this.#log(run, 'error', element, 'Unhandled error ' + e.info.errorCode + ': ' + e.info.message, { category: 'PROCESS' });
          run.result.status = 'failed';
          run.result.failedAt = element.id;
          run.result.error = e.info;
          this.io.leave(element, 'error');
          break;
        }
        this.io.leave(element, 'done');
        if (element.kind === 'end') break;
        const next = run.route || nextOf(this.model, element);
        run.route = null;
        if (!next || !next.element) break;
        // Step mode: this element has run; wait before the token moves on to the next one.
        if (run.stepMode && !next.element.removed) {
          await this.#wait(run, this.io.pause(next.element, 'step'));
          stepped = true;
        }
        connector = { id: next.connectorId, from: element, to: next.element };
        element = next.element;
      }
    } catch (e) {
      if (e instanceof Cancelled) run.result.status = 'cancelled';
      else {
        this.active = null;
        throw e;
      }
    }
    run.result.data = { ...run.data };
    this.active = null;
    return run.result;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  async #wait(run, value) {
    const v = await value;
    if (run.cancelled) throw new Cancelled();
    return v;
  }

  #log(run, level, element, message, { category = 'USER', detail = '' } = {}) {
    const entry = {
      time: this.now(),
      level,
      project: this.model.project,
      category,
      context: docOf(this.model, element).processId + '-' + element.rawId,
      message,
      detail
    };
    run.result.logs.push(entry);
    this.io.log(entry);
  }

  /** Elements of the tools file work on the data of the tool call in progress, not on the process data. */
  #scriptContext(run, element, vars) {
    const frame = element.doc !== 'process' ? run.frame : null;
    const dataClass = docOf(this.model, element).dataClass;
    return {
      data: frame ? frame.data : run.data,
      fields: dataClass.fields,
      dataClassName: dataClass.name,
      classes: this.model.classes,
      cms: this.model.cms,
      vars,
      // new DecisionMaker(memoryId).resolve(answer), with or without its package
      constructors: { DecisionMaker: memoryId => ({ __native: true, resolve: answer => this.#resolve(run, memoryId, answer) }) },
      // a script can switch the circuit breaker: that writes the variable for the whole application
      statics: circuitBreakerStatics(enabled => this.#setVariable(run, CIRCUIT_BREAKER.VARIABLE, enabled ? 'true' : 'false')),
      log: (level, message) => this.#log(run, level, element, message),
      onAssign: frame ? undefined : (field, value) => this.io.data(field, value, element)
    };
  }

  /** Changes an Ivy variable for this run and for everything that runs afterwards. */
  #setVariable(run, path, value) {
    run.variablesText = setVariable(run.variablesText, path, value);
    const yaml = parseYaml(run.variablesText);
    if (!yaml.errors.length) run.variables = yaml.value;
    this.io.variable(path, value, run.variablesText);
  }

  /**
   * The circuit breaker is a guardrail no agent selects: it is asked before the user message
   * goes out and again before the answer comes in, and stops the call while the switch is on.
   */
  async #breaker(run, element, call, side) {
    if (!(this.simulates.guardrails || this.simulates.circuitBreaker) || !circuitBreakerOn(run.variables)) return;
    const verdict = { allowed: false, reason: CIRCUIT_BREAKER.REASON };
    call.guardrails.push({ side, name: CIRCUIT_BREAKER.NAME, ...verdict });
    await this.#wait(run, this.io.agent('guard', { call, element, side, name: CIRCUIT_BREAKER.NAME, verdict }));
    await this.#violation(run, element, call, side, CIRCUIT_BREAKER.NAME, verdict.reason, STOP);
  }

  async #execute(run, element) {
    switch (element.kind) {
      case 'start':
        this.io.note(element.type === 'CallSubStart' ? 'tool-start' : 'start', { element });
        return;
      case 'script':
        this.io.note('script', { element });
        this.#script(run, element);
        return;
      case 'task':
        if (element.config.task && element.config.task.skipTasklist) this.io.note('task-skip', { element });
        else {
          // without "Skip Tasklist" the task waits in the task list until a user starts it
          const user = this.#responsible(run, element);
          // name and description of the task may be macros over the process data (in1.…)
          const task = element.config.task || {};
          const ctx = this.#scriptContext(run, element);
          const expand = text => {
            const out = expandMacro(String(text).replace(/\bin\d+\./g, 'in.'), ctx);
            return out.error ? String(text) : out.text;
          };
          const name = task.name ? expand(task.name).trim() : element.name;
          const description = task.description ? expand(task.description) : '';
          run.result.tasks.push({ elementId: element.id, name, description, user });
          this.io.note(user ? 'task-user' : 'task', { element, user });
          await this.#wait(run, this.io.pause(element, 'task', { user, name, description }));
        }
        return;
      case 'usertask':
        await this.#userTask(run, element);
        return;
      case 'gateway':
        run.route = this.#route(run, element);
        return;
      case 'agent':
        await this.#agent(run, element);
        return;
      case 'end':
        if (element.type === 'ErrorEnd') this.#errorEnd(run, element);
        this.io.note(element.type === 'CallSubEnd' ? 'tool-end' : 'end', { element });
        return;
      default:
        this.io.note('passthrough', { element });
    }
  }

  /** An Error End throws a BPM error; its code can attach attributes to the error first. */
  #errorEnd(run, element) {
    const errorCode = (element.config.throws && element.config.throws.error) || 'ivy:error';
    const error = { __type: BPM_ERROR, __bpmError: true, errorCode, message: errorCode, attributes: {} };
    const code = lines(element.config.code);
    if (code.trim()) this.#runCode(run, element, code, { error });
    this.io.note('error-end', { element, code: errorCode });
    throw new ProcessFailure(element, { kind: 'bpm', errorCode, message: errorCode, attributes: error.attributes });
  }

  /** Runs code of an element; a script error stops the process there. */
  #runCode(run, element, code, vars) {
    try {
      runScript(code, this.#scriptContext(run, element, vars));
    } catch (e) {
      if (!(e instanceof IvyScriptError)) throw e;
      const at = positionOf(code, e.pos);
      const message = 'IvyScript error in line ' + at.line + ': ' + e.message;
      this.#log(run, 'error', element, message, { category: 'PROCESS' });
      throw new ProcessFailure(element, { kind: 'script', message, line: at.line });
    }
  }

  /**
   * A user task: the task waits in the task list, a user opens its dialog and submits it, and
   * the output mapping and code run with `result`, the data the dialog returns.
   */
  async #userTask(run, element) {
    const cfg = element.config;
    const ctx = this.#scriptContext(run, element);
    const input = {};
    Object.entries((cfg.call && cfg.call.map) || {}).forEach(([target, source]) => {
      try {
        input[target.replace(/^param\./, '')] = evalExpression(source, ctx);
      } catch (e) {
        if (!(e instanceof IvyScriptError)) throw e;
      }
    });
    const name = (cfg.task && cfg.task.name) || element.name;
    // the one dialog the simulation knows: a question, and a free-text answer
    const asked = Object.keys(input).map(key => input[key]).find(value => value && typeof value === 'object' && value.question != null);
    const question = asked ? String(asked.question) : '';
    run.result.tasks.push({ elementId: element.id, name, description: '', user: '', dialog: cfg.dialog || '' });
    this.io.note('usertask', { element });
    const submitted = await this.#wait(run, this.io.dialog(element, { name, dialog: cfg.dialog || '', question, input }));
    const result = { answer: submitted && submitted.answer != null ? String(submitted.answer) : '' };
    const output = cfg.output || {};
    const mapping = Object.keys(output.map || {}).filter(target => target !== 'out').map(target => target + ' = ' + output.map[target] + ';').join('\n');
    this.#runCode(run, element, [mapping, lines(output.code)].filter(part => part.trim()).join('\n'), { result });
  }

  /** DecisionMaker.resolve: the human's answer becomes the result of the tool call that is waiting. */
  #resolve(run, memoryId, answer) {
    const memory = run.memory[memoryId];
    if (!memory) throw new IvyScriptError('IllegalStateException: Found no pending ChatMemory for id: ' + memoryId, { kind: 'runtime' });
    const pending = memory.steps.find(step => step.result === undefined);
    if (!pending) throw new IvyScriptError('IllegalStateException: Found no pending ToolExecutionRequest for id: ' + memoryId, { kind: 'runtime' });
    pending.result = answer == null ? '' : String(answer);
    pending.human = true;
  }

  /**
   * HumanInTheLoop: a BPM error left the agent, so the conversation so far is stored under
   * the id of this invocation, and the id goes into the process data field aiMemoryId — if
   * the data class has one.
   */
  #remember(run, element, call) {
    const id = invocationId(++run.invocations);
    run.memory[id] = { system: call.system, systemParts: call.systemParts, user: call.user, userParts: call.userParts, steps: call.steps };
    if (this.model.dataClass.fields.some(f => f.name === MEMORY_FIELD)) {
      run.data[MEMORY_FIELD] = id;
      this.io.data(MEMORY_FIELD, id, element);
    }
    return id;
  }

  /**
   * Alternative gateway: the conditions are tried in the order they are stored, the first
   * that holds decides, and a connector without a condition always holds.
   */
  #route(run, element) {
    const conditions = element.config.conditions || {};
    const order = Object.keys(conditions);
    element.outgoing.forEach(c => { if (!order.includes(c.rawId)) order.push(c.rawId); });
    const ctx = this.#scriptContext(run, element);
    for (const key of order) {
      const out = element.outgoing.find(c => c.rawId === key);
      if (!out) continue;
      const condition = String(conditions[key] == null ? '' : conditions[key]).trim();
      let holds = true;
      if (condition !== '') {
        try {
          holds = evalExpression(condition, ctx) === true;
        } catch (e) {
          if (!(e instanceof IvyScriptError)) throw e;
          const message = 'The condition "' + condition + '" could not be evaluated: ' + e.message;
          this.#log(run, 'error', element, message, { category: 'PROCESS' });
          throw new ProcessFailure(element, { kind: 'gateway', message });
        }
      }
      if (!holds) continue;
      const target = elementById(this.model, out.to);
      run.result.routes.push({ gateway: element.id, connectorId: out.id, condition, to: out.to });
      this.io.note(condition ? 'gateway' : 'gateway-default', { element, condition, target });
      return { connectorId: out.id, element: target };
    }
    const message = 'No condition of the gateway "' + (element.name || element.rawId) + '" is true';
    this.#log(run, 'error', element, message, { category: 'PROCESS' });
    throw new ProcessFailure(element, { kind: 'gateway', message });
  }

  /**
   * What an Error Boundary Event does with the error it caught: its output mapping, where
   * `error` is the BPM error (e.g. out.error ← error).
   */
  #catch(run, boundary, info) {
    const error = { __type: BPM_ERROR, __bpmError: true, errorCode: info.errorCode, message: info.message, attributes: info.attributes || {} };
    const map = (boundary.config.output && boundary.config.output.map) || {};
    const ctx = this.#scriptContext(run, boundary, { error });
    Object.keys(map).forEach(target => {
      if (target === 'out' || target === 'in') return; // out ← in: the data goes on as it is
      try {
        assignTo(target, evalExpression(map[target], ctx), ctx);
      } catch (e) {
        if (!(e instanceof IvyScriptError)) throw e;
        this.#log(run, 'error', boundary, 'Failed to map ' + target + ': ' + e.message, { category: 'PROCESS' });
      }
    });
  }

  /** The user a task goes to when its responsible is "User from Attr.": a script over the process data. */
  #responsible(run, element) {
    const responsible = (element.config.task || {}).responsible;
    if (!responsible || responsible.type !== 'USER_FROM_ATTRIBUTE' || !responsible.script) return '';
    try {
      // in a task element the data of the incoming path is called in1
      const value = evalExpression(String(responsible.script).replace(/\bin\d+\./g, 'in.'), this.#scriptContext(run, element));
      return value == null ? '' : String(value);
    } catch (e) {
      if (!(e instanceof IvyScriptError)) throw e;
      return '';
    }
  }

  #script(run, element) {
    const code = (element.config.output && element.config.output.code) || '';
    try {
      runScript(code, this.#scriptContext(run, element));
    } catch (e) {
      if (!(e instanceof IvyScriptError)) throw e;
      const at = positionOf(code, e.pos);
      const message = 'IvyScript error in line ' + at.line + ': ' + e.message;
      this.#log(run, 'error', element, message, { category: 'PROCESS' });
      throw new ProcessFailure(element, { kind: 'script', message, line: at.line });
    }
  }

  async #agent(run, element) {
    const cfg = agentConfig(element);
    const ctx = this.#scriptContext(run, element);
    const call = { elementId: element.id, name: element.name, status: 'started' };
    run.result.agentCalls.push(call);
    const tell = (phase, payload = {}) => this.#wait(run, this.io.agent(phase, { call, element, ...payload }));

    // 1 — user message (QueryExpander.expandMacroWithFileExtraction)
    const query = cfg.query == null ? '' : String(cfg.query);
    let user = null;
    let reason = 'query-missing';
    if (query !== '') {
      const expanded = expandMacro(query, ctx);
      if (expanded.error) {
        reason = 'query-error';
        call.queryError = expanded.error.message;
        this.#log(run, 'error', element, expanded.error.message);
      } else if (expanded.text.trim() === '' && !expanded.files.length) reason = 'query-empty';
      else user = expanded;
    }
    if (!user) {
      this.#log(run, 'info', element, 'Agent call was skipped, since there was no user query');
      call.status = 'skipped';
      call.reason = reason;
      await tell('skipped', { reason });
      return;
    }

    // 2 — expected result type
    const resultType = this.#configExpression(element, cfg, 'resultType', ctx);
    if (resultType !== null && !(resultType && resultType.__class)) {
      this.#fail(run, element, 'config', "Failed to extract config 'resultType' for value '" + cfg.resultType + "'");
    }
    // the class must exist in the project; its fields are what the model is told to return
    const resultClass = resultType ? (this.model.classes || {})[resultType.__class] || null : null;
    if (resultType && !resultClass && this.simulates.structuredOutput) {
      this.#fail(run, element, 'config', "Failed to extract config 'resultType' for value '" + cfg.resultType + "'",
        { detail: 'The class ' + resultType.__class + ' does not exist in this project' });
    }

    // 3 — provider and model (ChatModelFactory.getProviderOrDefault)
    if (run.variablesError) {
      this.#fail(run, element, 'variables', 'variables.yaml could not be read (line ' + run.variablesError.line + ': ' + run.variablesError.message + ')');
    }
    const providers = configList(cfg.provider);
    if (providers.length > 1) {
      this.#log(run, 'warn', element, 'Only one provider is allowed. Will use ' + providers[0] + ', and ignore other from: [' + providers.join(', ') + ']');
    }
    const modelName = this.#configExpression(element, cfg, 'model', ctx);
    const temperature = this.#configExpression(element, cfg, 'temperature', ctx);
    const provider = resolveProvider(run.variables, providers[0], modelName == null ? '' : String(modelName));
    if (!provider.ok) this.#fail(run, element, 'provider', provider.message, { provider: provider.name });

    // 4 — system message (sent only when not blank); a file in it is not read, only its toString()
    let system = '';
    let systemParts = null;
    if (cfg.system != null && String(cfg.system) !== '') {
      const expanded = expandMacro(String(cfg.system), ctx, { attachFiles: false });
      if (expanded.error) this.#log(run, 'error', element, expanded.error.message);
      else if (expanded.text.trim() !== '') {
        system = expanded.text;
        if (expanded.parts.some(p => p.type === 'binary')) systemParts = expanded.parts;
      }
    }

    // 4a — a conversation that was suspended (HumanInTheLoop): the id in aiMemoryId leads to it
    const memoryId = this.model.dataClass.fields.some(f => f.name === MEMORY_FIELD) ? String(run.data[MEMORY_FIELD] || '') : '';
    const memory = memoryId ? run.memory[memoryId] : null;

    // 4b — tools (IvySubProcessToolsProvider): the selected names that are a callable sub-process
    // start tagged "tool". A name that matches none is dropped without a word.
    // Java tools registered through SPI are filtered the same way (SmartWorkflowToolsProvider).
    const selected = configList(cfg.tools);
    const offered = this.simulates.tools ? toolStarts(this.model).filter(t => selected.includes(t.name)) : [];
    const java = this.simulates.tools ? this.javaTools().filter(t => selected.includes(t.name) && !offered.some(o => o.name === t.name)) : [];
    const tools = offered.map(t => ({ name: t.name, description: t.description, params: t.params, result: t.result }))
      .concat(java.map(t => ({ name: t.name, description: t.description, params: t.params || [], result: [], java: true })));

    Object.assign(call, {
      tools,
      toolsNotFound: this.simulates.tools ? selected.filter(name => !tools.some(t => t.name === name)) : [],
      steps: [], // the tool calls between the request and the final answer
      // what goes to the model as temperature (lessons that simulate it): 0.0 unless the field yields a number ≥ 0
      temperature: this.simulates.temperature ? toTemperature(temperature) : undefined,
      provider: provider.name,
      model: provider.model,
      url: provider.url,
      system,
      systemParts, // only when a file in it was turned into text: the panel marks that part
      user: user.text,
      userParts: user.parts,
      files: user.files.map(f => ({ name: f.name, kind: f.kind, mime: f.mime, path: f.path })),
      schema: resultClass ? { name: resultClass.name, fields: resultClass.fields.map(f => ({ name: f.name, type: f.type })) } : null,
      options: {
        tools: selected,
        guardrails: [...configList(cfg.inputGuardrails), ...configList(cfg.outputGuardrails)],
        structuredOutput: resultType ? resultType.__class : null,
        temperature: temperature == null ? null : temperature
      }
    });
    if (memory) {
      // the stored messages come first, the system message stays the one of the first call,
      // and the user message of this call is a fixed sentence
      Object.assign(call, { restored: true, memoryId, system: memory.system, systemParts: memory.systemParts || null, user: memory.user, userParts: memory.userParts, steps: memory.steps, continuation: CONTINUE });
      if (call.steps.some(step => step.result === undefined)) {
        this.#fail(run, element, 'memory', 'The conversation ' + memoryId + ' still waits for the result of a tool call: DecisionMaker.resolve() has not been called');
      }
    }

    // 4c — input guardrails see the user message before anything is sent; one of them may
    // rewrite it (PII masking), and the next one gets the rewritten text
    const guard = { state: {}, variables: run.variables, classify: message => this.#classify(run, element, call, message) };
    call.guardrails = []; // what each guardrail decided: { side, name, allowed, reason, rewritten, … }
    const guarded = this.simulates.guardrails;
    await this.#breaker(run, element, call, 'input');
    if (guarded && !call.restored) {
      let message = [user.text].concat(user.files.map(f => '<file: ' + String(f.kind).toUpperCase() + '>')).filter(Boolean).join('\n');
      for (const name of guardrailNames('input', configList(cfg.inputGuardrails), run.variables)) {
        const verdict = evaluateGuardrail('input', name, message, guard);
        if (!verdict) continue; // no guardrail of that name is registered
        call.guardrails.push({ side: 'input', name, ...verdict });
        // an AI guardrail made a model call of its own, before the agent's call: show that round trip
        if (verdict.classifier && verdict.classifier.verdict !== undefined) await tell('classify', { side: 'input', name, message, classifier: verdict.classifier });
        await tell('guard', { side: 'input', name, verdict });
        if (!verdict.allowed) await this.#violation(run, element, call, 'input', name, verdict.reason);
        if (verdict.rewritten != null) message = verdict.rewritten;
      }
      if (message !== user.text && !user.files.length) {
        call.userOriginal = user.text;
        call.user = message;
        call.userParts = [{ type: 'text', value: message }];
      }
    }
    await tell('request', {});

    // 5 — the round trip to the model
    if (provider.missingKey) {
      await tell('thinking', { failing: true });
      call.status = 'failed';
      const message = 'The call to ' + provider.name + ' was rejected with 401 Unauthorized: no API key is configured (' + provider.missingKey + ')';
      call.error = message;
      this.#log(run, 'error', element, message, { category: 'REST_CLIENT' });
      await tell('failed', { kind: 'auth', variable: provider.missingKey });
      throw new ProcessFailure(element, { kind: 'auth', message, variable: provider.missingKey, provider: provider.name });
    }
    const hottest = MAX_TEMPERATURE[provider.name];
    if (call.temperature !== undefined && hottest !== undefined && call.temperature > hottest) {
      await tell('thinking', { failing: true });
      call.status = 'failed';
      const message = provider.name + ' rejected the call with 400 Bad Request: temperature ' + formatTemperature(call.temperature) + ' is above its maximum of ' + hottest;
      call.error = message;
      this.#log(run, 'error', element, message, { category: 'REST_CLIENT' });
      await tell('failed', { kind: 'input' });
      throw new ProcessFailure(element, { kind: 'input', message, provider: provider.name });
    }
    const refused = user.files.find(f => f.kind === 'pdf' && !provider.pdf);
    if (refused) {
      await tell('thinking', { failing: true });
      call.status = 'failed';
      const message = provider.name + ' does not accept PDF files, so the call with ' + refused.name + ' failed';
      call.error = message;
      this.#log(run, 'error', element, message, { category: 'REST_CLIENT' });
      await tell('failed', { kind: 'input', file: refused.name });
      throw new ProcessFailure(element, { kind: 'input', message, provider: provider.name });
    }
    await tell('thinking', {});
    // The model answers with text, or asks for tools: then each one runs, its result is added
    // to the conversation, and the model is called again. Every round is one HTTP call.
    let reply;
    let text;
    let seconds;
    for (let round = 0; ; round++) {
      reply = this.brain.respond({
        system: call.system,
        continued: Boolean(call.restored), // a suspended conversation that goes on
        user: call.user, // after the input guardrails
        files: user.files, // each with `reads`: what a model reads in it
        provider: provider.name,
        model: provider.model,
        temperature: call.temperature !== undefined ? call.temperature : temperature == null ? null : temperature,
        resultType: resultType ? resultType.__class : null,
        resultClass,
        tools: call.tools, // what the model may ask for: name, description, params
        toolNames: selected,
        toolResults: call.steps.map(s => ({ name: s.name, arguments: s.arguments, result: s.result, values: s.values, data: s.data, failed: Boolean(s.failed) })),
        inputGuardrails: configList(cfg.inputGuardrails),
        outputGuardrails: configList(cfg.outputGuardrails),
        runIndex: run.index,
        element
      }) || { text: '' };
      text = reply.text == null ? '' : String(reply.text);
      seconds = 1 + (text.length % 3);
      this.#log(run, 'info', element, 'REST service langChain (langChain) call to POST ' + provider.url + ' successful executed in ' + seconds + ' [s]. Response status was 200 OK', { category: 'REST_CLIENT' });
      const wanted = round < MAX_TOOL_ROUNDS ? (reply.toolCalls || []) : [];
      // one HTTP call each: what the model was sent (`steps` before it) and what it answered
      (call.rounds || (call.rounds = [])).push({ stepsBefore: call.steps.length, toolCalls: wanted.map(w => ({ name: String(w.name), arguments: w.arguments || {} })), text: wanted.length ? null : text, seconds });
      if (!wanted.length) break;
      for (const want of wanted) {
        const step = { name: String(want.name), arguments: want.arguments || {} };
        call.steps.push(step);
        await tell('tool-call', { step });
        await this.#tool(run, element, call, step);
        await tell('tool-result', { step });
      }
      await tell('thinking', { again: true });
    }
    if (memoryId) {
      // the conversation has ended: what was stored for it is deleted, and the id is cleared
      delete run.memory[memoryId];
      run.data[MEMORY_FIELD] = '';
      this.io.data(MEMORY_FIELD, '', element);
    }
    // with a result type the JSON answer is deserialised: `value` is the object, `answer` its JSON text
    const structured = Boolean(resultClass) && reply.value !== undefined && reply.value !== null;
    // `guessed`: fields of the answer the stand-in made up instead of reading or looking them up
    Object.assign(call, { status: 'answered', answer: text, value: structured ? reply.value : undefined, insights: reply.insights || [], guessed: reply.guessed || [], seconds });
    await tell('response', {});

    // 5b — output guardrails see the answer before the process gets it
    await this.#breaker(run, element, call, 'output');
    if (guarded) {
      let message = text;
      for (const name of guardrailNames('output', configList(cfg.outputGuardrails), run.variables)) {
        const verdict = evaluateGuardrail('output', name, message, guard);
        if (!verdict) continue;
        call.guardrails.push({ side: 'output', name, ...verdict });
        await tell('guard', { side: 'output', name, verdict });
        if (!verdict.allowed) await this.#violation(run, element, call, 'output', name, verdict.reason);
        if (verdict.rewritten != null) message = verdict.rewritten;
      }
      if (message !== text) {
        call.answerFromModel = text;
        call.answer = message;
      }
    }
    const result = structured ? reply.value : call.answer;

    // 6 — map the result (a failing mapping is logged; the process continues)
    const mapTo = cfg.resultMapping == null ? '' : String(cfg.resultMapping).trim();
    if (mapTo === '') {
      call.mapping = 'none';
      await tell('unmapped', {});
    } else {
      call.mapTarget = mapTo;
      try {
        assignTo(mapTo, result, this.#scriptContext(run, element, { result }));
        call.mapping = 'mapped';
        await tell('mapped', { target: mapTo });
      } catch (e) {
        if (!(e instanceof IvyScriptError)) throw e;
        call.mapping = 'failed';
        call.mappingError = e.message;
        this.#log(run, 'error', element, 'Failed to map result to ' + mapTo, { detail: e.message });
        await tell('map-failed', { target: mapTo, message: e.message });
      }
    }
    await tell('end', {});
  }

  /**
   * Runs a tool the model asked for (IvySubProcessToolExecutor). The callable sub-process
   * works on data of its own: the arguments arrive through the input mapping of its start,
   * its elements run, and what the result mapping yields goes back to the model as JSON.
   */
  async #tool(run, agent, call, step) {
    const spec = (call.tools || []).find(t => t.name === step.name);
    if (spec && spec.java) {
      // JavaToolAdapter: a String goes back as it is, anything else as JSON; an exception
      // becomes the text the model gets instead of a result (IvyToolErrorHandler)
      const javaTool = this.javaTools().find(t => t.name === step.name);
      step.java = true;
      this.io.note('java-tool', { element: agent, tool: step.name });
      try {
        const out = javaTool.execute(step.arguments);
        step.data = out; // what the tool returned, before it became text
        step.result = typeof out === 'string' ? out : prettyJson(out);
      } catch (e) {
        step.failed = true;
        step.error = String((e && e.message) || e);
        step.result = "Error executing tool '" + step.name + "'";
      }
      return;
    }
    const tool = spec ? toolStarts(this.model).find(t => t.name === step.name) : null;
    if (!tool) {
      step.failed = true;
      step.result = 'failed to execute tool; unknown ivy-process function';
      return;
    }
    step.elementId = tool.element.id;
    run.frame = { data: {} };
    let element = tool.element;
    try {
      // an argument for a parameter of a data class type becomes an object of that class
      const args = {};
      Object.keys(step.arguments || {}).forEach(key => { args[key] = step.arguments[key]; });
      tool.params.forEach(param => {
        const cls = (this.model.classes || {})[param.type];
        const value = args[param.name];
        if (!cls || !value || typeof value !== 'object' || value.__type) return;
        const typed = { __type: cls.name };
        cls.fields.forEach(f => { typed[f.name] = value[f.name] === undefined ? null : value[f.name]; });
        args[param.name] = typed;
      });
      const input = this.#scriptContext(run, element, { param: args });
      Object.entries(tool.inputMap).forEach(([target, source]) => assignTo(target, evalExpression(source, input), input));
      let connector = null;
      for (;;) {
        if (connector) await this.#wait(run, this.io.travel(connector));
        await this.#wait(run, this.io.enter(element));
        await this.#execute(run, element);
        this.io.leave(element, 'done');
        if (element.kind === 'end') break;
        const next = nextOf(this.model, element);
        if (!next || !next.element) break;
        connector = { id: next.connectorId, from: element, to: next.element };
        element = next.element;
      }
      const output = this.#scriptContext(run, tool.element);
      const values = {};
      Object.entries(tool.resultMap).forEach(([target, source]) => { values[target.replace(/^result\./, '')] = evalExpression(source, output); });
      step.values = values;
      step.result = mapJson(values);
    } catch (e) {
      if (e instanceof ProcessFailure && e.info.kind === 'bpm') {
        // The tool ended in an Error End. The BPM error leaves the tool and the agent
        // (IvyToolErrorHandler), and the agent's conversation is kept for later.
        this.io.leave(element, 'done');
        const id = this.#remember(run, agent, call);
        step.suspended = true;
        Object.assign(call, { status: 'suspended', memoryId: id });
        await this.#wait(run, this.io.agent('suspended', { call, element: agent, step, errorCode: e.info.errorCode }));
        throw new ProcessFailure(agent, {
          kind: 'bpm', errorCode: e.info.errorCode, message: e.info.message,
          attributes: { ...e.info.attributes, 'tool.name': step.name, 'ai.invocationId': id }
        });
      }
      if (!(e instanceof ProcessFailure) && !(e instanceof IvyScriptError)) throw e;
      // an error inside a tool is an error of the process: the agent step fails (IvyToolErrorHandler)
      if (e instanceof IvyScriptError) this.#log(run, 'error', element, e.message, { category: 'PROCESS' });
      const message = 'The tool ' + step.name + ' failed: ' + (e instanceof ProcessFailure ? e.info.message : e.message);
      this.io.leave(element, 'error');
      step.failed = true;
      call.status = 'failed';
      call.error = message;
      await this.#wait(run, this.io.agent('failed', { call, element: agent, kind: 'tool', message }));
      throw new ProcessFailure(agent, { kind: 'tool', message, tool: step.name });
    } finally {
      run.frame = null;
    }
  }

  /** A guardrail blocked: the agent element throws a BPM error with the code of its side. */
  async #violation(run, element, call, side, name, reason, errorCode = VIOLATION[side]) {
    const message = violationMessage(side, reason);
    Object.assign(call, { status: 'blocked', blockedBy: { side, name, reason }, error: message });
    await this.#wait(run, this.io.agent('blocked', { call, element, side, name, reason, message }));
    throw new ProcessFailure(element, { kind: 'guardrail', errorCode, message, guardrail: name, side });
  }

  /**
   * The model call of AiPromptInjectionInputGuardrail: its own provider and model when the
   * classifier variables name them, otherwise the defaults. A call that cannot be made blocks
   * the message as a precaution.
   */
  #classify(run, element, call, message) {
    const provider = resolveProvider(run.variables, readVariable(run.variables, CLASSIFIER.PROVIDER).trim(), readVariable(run.variables, CLASSIFIER.MODEL).trim());
    const cause = !provider.ok ? provider.message : provider.missingKey ? 'no API key is configured (' + provider.missingKey + ')' : '';
    if (cause) {
      this.#log(run, 'error', element, 'AI guardrail classifier failed. Blocking as precaution. Cause: ' + cause);
      return { error: cause };
    }
    const verdict = this.brain.classify ? this.brain.classify({ message, provider: provider.name, model: provider.model }) : classifyInjection(message);
    this.#log(run, 'info', element, 'REST service langChain (langChain) call to POST ' + provider.url + ' successful executed in 1 [s]. Response status was 200 OK', { category: 'REST_CLIENT' });
    call.classifier = { provider: provider.name, model: provider.model, url: provider.url, verdict };
    return { verdict, provider: provider.name, model: provider.model };
  }

  /** Evaluates an optional script field of the agent config; null when it is empty. */
  #configExpression(element, cfg, key, ctx) {
    const raw = cfg[key] == null ? '' : String(cfg[key]).trim();
    if (raw === '') return null;
    try {
      return evalExpression(raw, ctx);
    } catch (e) {
      if (!(e instanceof IvyScriptError)) throw e;
      const run = this.active;
      this.#fail(run, element, 'config', "Failed to extract config '" + key + "' for value '" + raw + "'", { detail: e.message });
      return null;
    }
  }

  #fail(run, element, kind, message, extra = {}) {
    this.#log(run, 'error', element, message, { category: 'PROCESS', detail: extra.detail || '' });
    const call = run.result.agentCalls[run.result.agentCalls.length - 1];
    if (call && call.elementId === element.id) {
      call.status = 'failed';
      call.error = message;
    }
    this.io.agent('failed', { call, element, kind, message });
    throw new ProcessFailure(element, { kind, message, ...extra });
  }
}
