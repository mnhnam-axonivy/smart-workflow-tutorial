import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { respond } from '../features/feature-05/agent.js';
import { exportRun, otelSettings, openinference, parseFilter, nestAttributes } from '../features/feature-08/trace.js';
import { VM_ARGS, withOpeninference } from '../features/feature-08/tour.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));

const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
    Observability:
      Ivy:
        # Record every agent conversation so the Governance Dashboard (Feature 16) has data to show.
        Enabled: "true"
`;
const JVM = VM_ARGS; // the Designer's Engine: Vm Args
// a standalone engine: configuration/jvm.options, one option per line
const JVM_OPTIONS = '# OpenTelemetry -> Arize Phoenix\n' + VM_ARGS.split(' ').join('\n') + '\n';

function setup() {
  const model = loadProcess(json('process/tutorial/features/Feature05.p.json'), json('dataclass/tutorial/Feature05Data.d.json'), {
    project: 'tutorial', file: 'Feature05.p.json', classes: [json('dataclass/tutorial/InvoiceDecision.d.json')],
    toolProcess: { file: 'Feature05Tools.p.json', process: json('process/tutorial/tools/Feature05Tools.p.json'), dataClass: json('dataclass/tutorial/Feature05ToolsData.d.json') }
  });
  const runner = new ProcessRunner({ model, brain: { respond }, io: {}, simulates: { tools: true, guardrails: true, structuredOutput: true, temperature: true } });
  return { model, runner, agent: elementById(model, 'f5') };
}

async function traced({ variables = withOpeninference(VARIABLES), jvm = JVM, change } = {}) {
  const { runner, agent } = setup();
  if (change) change(agentConfig(agent));
  const result = await runner.run({ variablesText: variables });
  return { result, out: exportRun(result, { variablesText: variables, jvmText: jvm, seq: 1, now: 0 }) };
}

const byKind = (spans, kind) => spans.filter(s => s.kind === kind);
const childrenOf = (spans, span) => spans.filter(s => s.parentId === span.id);

test('the JVM options decide whether anything is exported, and under which project', () => {
  assert.equal(otelSettings(JVM).exported, true);
  assert.equal(otelSettings(JVM).project, 'smart-workflow');
  assert.equal(otelSettings('').exported, false);
  assert.equal(otelSettings(JVM.replace('6006', '4317')).exported, false);
  assert.equal(otelSettings(JVM.replace(/ -Dotel\.resource\S*/, '')).project, 'default');
  // the same options in jvm.options of a standalone engine
  assert.equal(otelSettings(JVM_OPTIONS).exported, true);
  assert.equal(otelSettings(JVM_OPTIONS).project, 'smart-workflow');
  assert.equal(otelSettings(JVM_OPTIONS.replace('-Dotel.traces.exporter', '# -Dotel.traces.exporter')).exported, false, 'a commented option does not count');
});

test('the Openinference variables: only "true" switches on', () => {
  assert.deepEqual(openinference(VARIABLES), { enabled: false, hideInput: false, hideOutput: false });
  assert.deepEqual(openinference(withOpeninference(VARIABLES, true)), { enabled: true, hideInput: true, hideOutput: true });
});

test('a traced run of Feature05: the spans Smart Workflow writes, nested as in a real trace', async () => {
  const { result, out } = await traced();
  assert.equal(result.agentCalls.length, 1);
  assert.equal(out.exported, true);
  const spans = out.spans;
  const http = spans.find(s => s.name === 'HTTP/1.1 GET');
  assert.equal(http.parentId, null);
  const request = childrenOf(spans, http).find(s => s.name === 'HttpProcessRequest');
  const [agent] = byKind(spans, 'agent');
  assert.equal(agent.name, 'AI Agent');
  assert.equal(agent.parentId, request.id);
  assert.deepEqual(agent.attributes, { 'openinference.span.kind': 'AGENT' });

  // one round trip per tool (the stand-in asks for one at a time), and one for the answer
  const llm = byKind(spans, 'llm');
  const steps = result.agentCalls[0].steps;
  assert.equal(steps.length, 3);
  assert.equal(llm.length, steps.length + 1);
  const last = llm[llm.length - 1];
  llm.forEach(s => {
    assert.equal(s.name, 'AI Assistant');
    assert.equal(s.parentId, agent.id);
    assert.equal(s.attributes['llm.system'], 'langchain4j');
    assert.equal(s.attributes['llm.provider'], 'openai');
    assert.equal(s.attributes['llm.model_name'], 'gpt-4.1-mini');
    assert.match(s.attributes['ivy.case'], /^[0-9a-f-]{36}$/);
    // an empty Temperature field: Smart Workflow sends its default, 0.0
    assert.equal(s.attributes['llm.invocation_parameters'], '{"temperature":0.0}');
    assert.equal(s.attributes['llm.token_count.total'], s.attributes['llm.token_count.prompt'] + s.attributes['llm.token_count.completion']);
    assert.ok(childrenOf(spans, s).some(c => c.name === 'Rest Client langChain'));
  });
  assert.equal(llm[0].attributes['llm.response.finish_reasons'], '[TOOL_EXECUTION]');
  assert.match(llm[0].attributes['llm.output_messages.0.message.content'], /^\[tool calls: /);
  assert.equal(llm[0].attributes['llm.input_messages.0.message.role'], 'system');
  assert.match(llm[0].attributes['llm.input_messages.1.message.content'], /^UserMessage \{ name = null, contents = \[TextContent \{ text = "/);
  assert.equal(last.attributes['llm.response.finish_reasons'], '[STOP]');
  // a later call carries the tool requests and their results
  const roles = Object.keys(llm[1].attributes).filter(k => /^llm\.input_messages\.\d+\.message\.role$/.test(k)).map(k => llm[1].attributes[k]);
  assert.deepEqual(roles.slice(0, 3), ['system', 'user', 'assistant']);
  assert.ok(roles.includes('tool'));
  assert.equal(last.attributes['output.value'], result.agentCalls[0].answer);
  assert.equal(Object.keys(last.attributes).filter(k => /^llm\.input_messages\.\d+\.message\.role$/.test(k)).length, 2 + 2 * steps.length);
  assert.ok(llm[0].attributes['llm.tools.0.tool.json_schema'].includes('"type":"function"'));

  const tools = byKind(spans, 'tool');
  assert.equal(tools.length, result.agentCalls[0].steps.length);
  tools.forEach((s, i) => {
    assert.equal(s.name, 'Tool');
    assert.equal(s.parentId, agent.id);
    assert.equal(s.attributes['tool.name'], result.agentCalls[0].steps[i].name);
    assert.equal(s.attributes['output.value'], result.agentCalls[0].steps[i].result);
    assert.equal(s.attributes['tool.parameters'], s.attributes['input.value']);
  });

  // the circuit breaker runs before the call and after it, though no agent selects it
  const guards = byKind(spans, 'guardrail');
  assert.deepEqual(guards.map(g => g.name + ':' + g.attributes['guardrail.type'] + ':' + g.attributes['guardrail.result']),
    ['CircuitBreakerGuardrail:INPUT:SUCCESS', 'CircuitBreakerGuardrail:OUTPUT:SUCCESS']);

  // in the order a trace shows them
  const order = spans.filter(s => s.parentId === agent.id).sort((a, b) => a.start - b.start).map(s => s.name);
  assert.deepEqual(order, ['CircuitBreakerGuardrail', 'AI Assistant', 'Tool', 'AI Assistant', 'Tool', 'AI Assistant', 'Tool', 'AI Assistant', 'CircuitBreakerGuardrail']);
  // the engine's background jobs are traces of their own
  assert.ok(spans.filter(s => !s.parentId && s.name.startsWith('Background Job')).length >= 1);
});

test('a temperature on the agent shows up in llm.invocation_parameters', async () => {
  const { out } = await traced({ change: cfg => { cfg.temperature = '0.2'; } });
  byKind(out.spans, 'llm').forEach(s => assert.equal(s.attributes['llm.invocation_parameters'], '{"temperature":0.2}'));
});

test('HideInputMessages / HideOutputMessages leave the content out, not the numbers', async () => {
  const { out } = await traced({ variables: withOpeninference(VARIABLES, true) });
  const keys = out.spans.flatMap(s => Object.keys(s.attributes));
  assert.ok(!keys.some(k => k.startsWith('llm.input_messages') || k.startsWith('llm.output_messages')));
  assert.ok(!byKind(out.spans, 'llm').some(s => s.attributes['input.value'] !== undefined || s.attributes['output.value'] !== undefined));
  assert.ok(!byKind(out.spans, 'tool').some(s => s.attributes['input.value'] !== undefined || s.attributes['output.value'] !== undefined));
  byKind(out.spans, 'llm').forEach(s => {
    assert.ok(s.attributes['llm.token_count.total'] > 0);
    assert.ok(s.attributes['ivy.case']);
    assert.equal(s.attributes['llm.model_name'], 'gpt-4.1-mini');
  });
  assert.ok(!byKind(out.spans, 'guardrail').some(s => s.attributes['input.value'] !== undefined));
});

test('a selected output guardrail gets its own span after the internal one', async () => {
  const { out } = await traced({ change: cfg => { cfg.outputGuardrails = '["SensitiveDataOutputGuardrail"]'; } });
  const guards = byKind(out.spans, 'guardrail');
  assert.deepEqual(guards.map(g => g.name), ['CircuitBreakerGuardrail', 'CircuitBreakerGuardrail', 'SensitiveDataOutputGuardrail']);
  const sensitive = guards[2];
  assert.equal(sensitive.attributes.validator_name, 'SensitiveDataOutputGuardrail');
  assert.equal(sensitive.attributes.validator_on_fail, 'exception');
  assert.equal(sensitive.attributes['guardrail.type'], 'OUTPUT');
  assert.equal(sensitive.attributes['output.value'], 'pass');
});

test('without the variable only the engine spans arrive; without the JVM options nothing', async () => {
  const off = await traced({ variables: VARIABLES });
  assert.equal(off.out.exported, true);
  assert.ok(off.out.spans.some(s => s.name === 'HTTP/1.1 GET'));
  assert.ok(!off.out.spans.some(s => s.kind !== 'unknown'));
  const none = await traced({ jvm: '' });
  assert.equal(none.out.exported, false);
  assert.deepEqual(none.out.spans, []);
});

test('filter conditions', () => {
  const llm = { kind: 'llm', name: 'AI Assistant', status: 'OK', attributes: { 'ivy.case': 'abc' } };
  const tool = { kind: 'tool', name: 'Tool', status: 'OK', attributes: {} };
  assert.equal(parseFilter("span_kind == 'LLM'").test(llm), true);
  assert.equal(parseFilter("span_kind == 'LLM'").test(tool), false);
  assert.equal(parseFilter("span_kind == 'llm' and ivy.case == 'abc'").test(llm), true);
  assert.equal(parseFilter("span_kind == 'LLM' and ivy.case == 'xyz'").test(llm), false);
  assert.equal(parseFilter("name != 'Tool'").test(tool), false);
  assert.equal(parseFilter('').test(tool), true);
  assert.ok(parseFilter('span_kind = LLM').error);
});

test('attributes are shown nested, numbered parts as arrays', () => {
  const nested = nestAttributes({ 'llm.token_count.total': 3, 'llm.input_messages.0.message.role': 'user', 'openinference.span.kind': 'LLM' });
  assert.deepEqual(nested, { llm: { token_count: { total: 3 }, input_messages: [{ message: { role: 'user' } }] }, openinference: { span: { kind: 'LLM' } } });
});
