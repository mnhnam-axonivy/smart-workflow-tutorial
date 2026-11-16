/**
 * Feature 08 — what the engine exports to Arize Phoenix after a run, built from what the
 * simulated run recorded. It follows Smart Workflow's OpenInference recorders
 * (observability/openinference/…): the span names "AI Agent", "AI Assistant" and "Tool", one
 * span per guardrail named after it, their kinds and attribute keys, and the effect of
 * HideInputMessages / HideOutputMessages. The engine's own spans around them are cut down to
 * the few a real trace of a process start shows at the top, plus some background jobs.
 *
 * Nothing is exported unless both parts are in place: the -Dotel… options of the JVM (they
 * export the engine's spans) and AI.Observability.Openinference.Enabled (it adds the AI spans).
 * The Designer takes the options in its setting Engine: Vm Args, on one line; a standalone engine
 * in configuration/jvm.options, one per line. Both are read the same way here.
 */
import { parseYaml, readVariable } from '../../runtime/model/yaml.js';
import { formatTemperature } from '../../runtime/model/providers.js';

export const VAR = {
  ENABLED: 'AI.Observability.Openinference.Enabled',
  HIDE_INPUT: 'AI.Observability.Openinference.HideInputMessages',
  HIDE_OUTPUT: 'AI.Observability.Openinference.HideOutputMessages'
};
const CIRCUIT_BREAKER = 'CircuitBreakerGuardrail';

/** What the JVM options say: are traces exported, where to, under which project. */
export function otelSettings(text) {
  const options = {};
  String(text || '').split('\n')
    .filter(line => !line.trim().startsWith('#')) // a commented line does not count
    .join(' ').split(/\s+/).forEach(token => {
      const m = /^-D(otel\.[\w.]+)=(.*)$/.exec(token);
      if (m) options[m[1]] = m[2];
    });
  const exporter = options['otel.traces.exporter'] || '';
  const endpoint = options['otel.exporter.otlp.endpoint'] || '';
  const project = (/(?:^|,)openinference\.project\.name=([^,]+)/.exec(options['otel.resource.attributes'] || '') || [])[1] || 'default';
  const reachesPhoenix = /^https?:\/\/(localhost|127\.0\.0\.1):6006\/?$/.test(endpoint);
  return { exporter, endpoint, project, exported: exporter === 'otlp' && reachesPhoenix };
}

/** The Openinference variables as the engine reads them ("true" only switches on). */
export function openinference(variablesText) {
  const yaml = parseYaml(variablesText || '');
  const vars = yaml.errors.length ? {} : yaml.value;
  const on = path => readVariable(vars, path).trim().toLowerCase() === 'true';
  return { enabled: on(VAR.ENABLED), hideInput: on(VAR.HIDE_INPUT), hideOutput: on(VAR.HIDE_OUTPUT) };
}

// ── ids, numbers ─────────────────────────────────────────────────────────────

function random(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const hex = (rnd, n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('');
const uuid = rnd => [hex(rnd, 8), hex(rnd, 4), '4' + hex(rnd, 3), (8 + Math.floor(rnd() * 4)).toString(16) + hex(rnd, 3), hex(rnd, 12)].join('-');

/** Roughly what a tokenizer counts: four characters a token. */
export const tokens = text => Math.max(1, Math.ceil(String(text || '').length / 4));

/** USD per million tokens, input / output, of the models the lessons use. */
const PRICES = {
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1': [2, 8],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10]
};
export function cost(model, prompt, completion) {
  const p = PRICES[String(model || '').toLowerCase()];
  return p ? (prompt * p[0] + completion * p[1]) / 1e6 : null;
}

// ── how langchain4j prints its messages (llm.input_messages.N.message.content) ──

const q = text => '"' + String(text) + '"';
const userString = text => 'UserMessage { name = null, contents = [TextContent { text = ' + q(text) + ' }], attributes = {} }';
const systemString = text => 'SystemMessage { text = ' + q(text) + ' }';
const aiString = calls => 'AiMessage { text = null, thinking = null, toolExecutionRequests = [' +
  calls.map(c => 'ToolExecutionRequest { id = ' + q(c.id) + ', name = ' + q(c.name) + ', arguments = ' + q(c.arguments) + ' }').join(', ') + '], attributes = {} }';
const toolString = (call, result) => 'ToolExecutionResultMessage { id = ' + q(call.id) + ' toolName = ' + q(call.name) + ' text = ' + q(result) + ' }';

/** "openai", "azure", … as OpenInferenceCollector names the provider. */
function providerValue(name) {
  const lower = String(name || '').toLowerCase();
  return lower.startsWith('azure') ? 'azure' : lower;
}

function toolSchema(tool) {
  const properties = {};
  (tool.params || []).forEach(p => { properties[p.name] = { type: /int|long|number|decimal|double/i.test(p.type) ? 'number' : 'string', description: p.description || undefined }; });
  return JSON.stringify({ type: 'function', function: { name: tool.name, description: tool.description || undefined, parameters: { type: 'object', properties, required: (tool.params || []).map(p => p.name) } } });
}

// ── the trace of one run ─────────────────────────────────────────────────────

/**
 * @param {Object} result   what ProcessRunner.run returned
 * @param {{ variablesText: string, jvmText: string, seq: number, now: number }} context
 * @returns {{ exported: boolean, project: string, traces: Object[], spans: Object[], reason?: string }}
 *   spans: { id, parentId, traceId, name, kind, status, statusMessage, start, latencyMs, attributes }
 *   with flat, dotted attribute keys as the engine sets them
 */
export function exportRun(result, { variablesText, jvmText, seq = 1, now = Date.now() }) {
  const otel = otelSettings(jvmText);
  if (!otel.exported) return { exported: false, reason: otel.exporter !== 'otlp' ? 'no-exporter' : 'endpoint', project: otel.project, spans: [], traces: [] };
  const oi = openinference(variablesText);
  const rnd = random(seq * 7919 + 17);
  const spans = [];
  let clock = now;
  const span = (traceId, parentId, name, kind, attributes = {}, { status = 'OK', latencyMs = 1, statusMessage = '' } = {}) => {
    const s = { id: hex(rnd, 16), parentId, traceId, name, kind, status, statusMessage, start: clock, latencyMs, attributes };
    spans.push(s);
    clock += Math.max(1, Math.round(latencyMs / 8));
    return s;
  };

  // the engine works in the background all the time: each job is a trace of its own
  ['Workflow Background Activity', 'High Priority Jobs', 'System Database Cleanup'].forEach(job => {
    const traceId = hex(rnd, 32);
    const root = span(traceId, null, 'Background Job ' + job, 'unknown', { 'ivy.job.name': job }, { status: 'UNSET', latencyMs: 2 });
    span(traceId, root.id, 'System Database', 'unknown', { 'sql.statement': 'SELECT * FROM IWA_Task WHERE ("STATE" IN (10, 11, 2) …)' }, { status: 'UNSET', latencyMs: 0 });
  });

  // the process start is an HTTP request; the agents run inside it
  const traceId = hex(rnd, 32);
  const calls = (result && result.agentCalls) || [];
  const total = calls.reduce((sum, c) => sum + 1000 * (c.seconds || 1) * Math.max(1, (c.rounds || []).length) + 300, 0) + 400;
  const http = span(traceId, null, 'HTTP/1.1 GET', 'unknown', { 'http.request.method': 'GET', 'url.path': '/designer/pro/tutorial/…/start.ivp' }, { latencyMs: total + 120 });
  const request = span(traceId, http.id, 'HttpProcessRequest', 'unknown', {}, { status: 'UNSET', latencyMs: total });
  span(traceId, request.id, 'System Database', 'unknown', { 'sql.statement': 'INSERT INTO IWA_Case …' }, { status: 'UNSET', latencyMs: 0 });
  const caseId = uuid(rnd);
  const taskId = uuid(rnd);
  if (oi.enabled) calls.forEach(call => agentSpans(call));

  function agentSpans(call) {
    const failed = call.status === 'failed' || call.status === 'blocked';
    const agentLatency = 1000 * (call.seconds || 1) * Math.max(1, (call.rounds || []).length) + 250;
    const agent = span(traceId, request.id, 'AI Agent', 'agent', { 'openinference.span.kind': 'AGENT' },
      { status: failed ? 'ERROR' : 'OK', latencyMs: agentLatency, statusMessage: failed ? call.error || '' : '' });
    const guards = side => {
      const recorded = (call.guardrails || []).filter(g => g.side === side);
      // the internal circuit breaker runs before every guardrail the agent selected
      return recorded.some(g => g.name === CIRCUIT_BREAKER) ? recorded : [{ side, name: CIRCUIT_BREAKER, allowed: true }].concat(recorded);
    };
    const guardSpan = (g, message) => {
      const attributes = {
        'openinference.span.kind': 'GUARDRAIL',
        validator_name: g.name,
        validator_on_fail: 'exception',
        'guardrail.type': g.side === 'input' ? 'INPUT' : 'OUTPUT',
        // the input adapter fails with failure(), the output adapter with fatal()
        'guardrail.result': g.allowed ? 'SUCCESS' : g.side === 'input' ? 'FAILURE' : 'FATAL'
      };
      const hidden = g.side === 'input' ? oi.hideInput : oi.hideOutput;
      if (!hidden && message != null) Object.assign(attributes, { 'input.value': message, 'input.mime_type': 'text/plain' });
      attributes['output.value'] = g.allowed ? 'pass' : 'fail';
      if (!g.allowed && g.reason) attributes['guardrail.failure_message'] = g.reason;
      attributes['output.mime_type'] = 'text/plain';
      span(traceId, agent.id, g.name, 'guardrail', attributes, { latencyMs: g.classifier ? 900 : 0 });
    };
    const userText = call.user || '';
    const inputGuards = guards('input');
    let blockedBefore = false;
    for (const g of inputGuards) {
      guardSpan(g, call.userOriginal !== undefined ? call.userOriginal : userText);
      if (!g.allowed) { blockedBefore = true; break; }
    }
    if (blockedBefore || call.status === 'skipped') return;

    // every round trip to the model is one LLM span; the tools it asked for follow it
    const tools = call.tools || [];
    const rounds = call.rounds && call.rounds.length ? call.rounds : [{ stepsBefore: 0, toolCalls: [], text: call.answer, seconds: call.seconds }];
    const toolIds = (call.steps || []).map(() => 'call_' + hex(rnd, 24));
    rounds.forEach((round, r) => {
      const attributes = {
        'openinference.span.kind': 'LLM',
        'llm.model_name': call.model,
        'llm.system': 'langchain4j',
        'llm.provider': providerValue(call.provider),
        'ivy.case': caseId,
        'ivy.task': taskId,
        // Jackson writes the Double as Java prints it: 0.0, 0.2
        'llm.invocation_parameters': typeof call.temperature === 'number' ? '{"temperature":' + formatTemperature(call.temperature) + '}' : '{}'
      };
      tools.forEach((tool, i) => { attributes['llm.tools.' + i + '.tool.json_schema'] = toolSchema(tool); });
      // the conversation so far: system, user, then each earlier tool request and its results
      const messages = [];
      if (call.system) messages.push({ role: 'system', content: call.system, printed: systemString(call.system) });
      messages.push({ role: 'user', content: userText, printed: userString(userText) });
      rounds.slice(0, r).forEach(before => {
        const asked = before.toolCalls.map((c, k) => ({ id: toolIds[before.stepsBefore + k], name: c.name, arguments: JSON.stringify(c.arguments) }));
        messages.push({ role: 'assistant', tool_calls: asked, printed: aiString(asked) });
        asked.forEach((c, k) => {
          const result = (call.steps[before.stepsBefore + k] || {}).result || '';
          messages.push({ role: 'tool', content: result, tool_call_id: c.id, printed: toolString(c, result) });
        });
      });
      if (!oi.hideInput) {
        messages.forEach((m, i) => {
          const prefix = 'llm.input_messages.' + i + '.';
          attributes[prefix + 'message.role'] = m.role;
          attributes[prefix + 'message.content'] = m.printed;
          (m.tool_calls || []).forEach((c, k) => {
            attributes[prefix + 'message.tool_calls.' + k + '.tool_call.id'] = c.id;
            attributes[prefix + 'message.tool_calls.' + k + '.tool_call.function.arguments'] = c.arguments;
            attributes[prefix + 'message.tool_calls.' + k + '.tool_call.function.name'] = c.name;
          });
          if (m.tool_call_id) attributes[prefix + 'message.tool_call_id'] = m.tool_call_id;
        });
        attributes['input.value'] = JSON.stringify(messages.map(m => (m.tool_calls
          ? { role: 'assistant', content: { tool_calls: m.tool_calls.map(c => ({ id: c.id, function: { arguments: c.arguments, name: c.name } })) } }
          : m.tool_call_id ? { role: 'tool', content: m.content, tool_call_id: m.tool_call_id } : { role: m.role, content: m.content })));
        attributes['input.mime_type'] = 'application/json';
      }
      const isLast = r === rounds.length - 1;
      const failedHere = isLast && call.status === 'failed' && !call.answer;
      const asked = round.toolCalls.map((c, k) => ({ id: toolIds[round.stepsBefore + k], name: c.name, arguments: JSON.stringify(c.arguments) }));
      const content = asked.length ? '[tool calls: ' + asked.map(c => c.name).join(', ') + ']' : round.text != null ? round.text : call.answerFromModel || call.answer || '';
      const promptTokens = tokens(messages.map(m => m.content || JSON.stringify(m.tool_calls)).join('\n') + Object.keys(attributes).filter(k => k.startsWith('llm.tools.')).map(k => attributes[k]).join(''));
      const completionTokens = tokens(content);
      if (!failedHere) {
        attributes['llm.response.finish_reasons'] = JSON.stringify([asked.length ? 'TOOL_EXECUTION' : 'STOP']).replace(/"/g, '');
        if (!oi.hideOutput) {
          attributes['llm.output_messages.0.message.role'] = 'assistant';
          attributes['llm.output_messages.0.message.content'] = content;
          asked.forEach((c, k) => {
            const prefix = 'llm.output_messages.0.message.tool_calls.' + k + '.tool_call.';
            attributes[prefix + 'id'] = c.id;
            attributes[prefix + 'function.arguments'] = c.arguments;
            attributes[prefix + 'function.name'] = c.name;
          });
          attributes['output.value'] = content;
          attributes['output.mime_type'] = 'text/plain';
        }
        attributes['llm.token_count.prompt'] = promptTokens;
        attributes['llm.token_count.completion'] = completionTokens;
        attributes['llm.token_count.total'] = promptTokens + completionTokens;
      }
      const seconds = round.seconds || call.seconds || 1;
      const llm = span(traceId, agent.id, 'AI Assistant', 'llm', attributes, { status: failedHere ? 'ERROR' : 'OK', latencyMs: seconds * 1000 + 180, statusMessage: failedHere ? call.error || '' : '' });
      span(traceId, llm.id, 'Rest Client langChain', 'unknown', { 'http.request.method': 'POST', 'url.full': call.url || '' }, { status: failedHere ? 'ERROR' : 'OK', latencyMs: seconds * 1000 });
      asked.forEach((c, k) => {
        const step = call.steps[round.stepsBefore + k] || {};
        const toolAttributes = { 'openinference.span.kind': 'TOOL', 'tool.name': c.name, 'tool_call.id': c.id };
        if (!oi.hideInput) Object.assign(toolAttributes, { 'input.value': c.arguments, 'input.mime_type': 'application/json', 'tool.parameters': c.arguments });
        if (!oi.hideOutput) Object.assign(toolAttributes, { 'output.value': step.result || '', 'output.mime_type': 'text/plain' });
        span(traceId, agent.id, 'Tool', 'tool', toolAttributes, { status: step.failed ? 'ERROR' : 'OK', latencyMs: 40 + k * 7 });
      });
    });
    if (call.status === 'failed' && !call.answer) return;
    for (const g of guards('output')) {
      guardSpan(g, call.answerFromModel !== undefined ? call.answerFromModel : call.answer);
      if (!g.allowed) break;
    }
  }

  return { exported: true, project: otel.project, aiSpans: oi.enabled, caseId, taskId, traceId, spans };
}

// ── filter conditions (a small part of what Phoenix understands) ─────────────

/**
 * Parses "span_kind == 'LLM' and ivy.case == '…'". Supported: ==, != with a quoted value, joined
 * by "and"; span_kind, name, status_code and any attribute key. Returns a predicate, or
 * { error } for anything else.
 */
export function parseFilter(text) {
  const source = String(text || '').trim();
  if (!source) return { test: () => true };
  const parts = source.split(/\s+and\s+/i);
  const tests = [];
  for (const part of parts) {
    const m = /^([A-Za-z_][\w.]*)\s*(==|!=)\s*(['"])(.*)\3$/.exec(part.trim());
    if (!m) return { error: part.trim() };
    const [, key, op, , value] = m;
    const read = span => (key === 'span_kind' ? String(span.kind).toUpperCase()
      : key === 'name' ? span.name
        : key === 'status_code' ? span.status
          : span.attributes[key] === undefined ? undefined : String(span.attributes[key]));
    const wanted = key === 'span_kind' ? value.toUpperCase() : value;
    tests.push(span => (op === '==' ? read(span) === wanted : read(span) !== wanted));
  }
  return { test: span => tests.every(t => t(span)) };
}

/**
 * Turns flat dotted keys into the nested object Phoenix shows under Attributes; numbered
 * parts become arrays.
 */
export function nestAttributes(flat) {
  const root = {};
  Object.keys(flat).forEach(key => {
    const parts = key.split('.');
    let node = root;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      const index = /^\d+$/.test(part) ? Number(part) : part;
      if (last) node[index] = flat[key];
      else {
        if (node[index] === undefined || typeof node[index] !== 'object') node[index] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        node = node[index];
      }
    });
  });
  return root;
}
