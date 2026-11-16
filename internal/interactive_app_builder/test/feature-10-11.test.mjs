import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig, startElements, startElement } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { respond as support } from '../features/feature-10/agent.js';
import { respond as echo } from '../features/feature-11/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n';
const INPUT_CODE = 'smartworkflow:guardrail:input:violation';
const ADAPTER = 'The guardrail com.axonivy.utils.smart.workflow.guardrails.adapter.InputGuardrailAdapter failed with this message: ';

function setup(feature, brain) {
  const model = loadProcess(json('process/tutorial/features/Feature' + feature + '.p.json'), json('dataclass/tutorial/Feature' + feature + 'Data.d.json'), { project: 'tutorial', file: 'Feature' + feature + '.p.json' });
  const events = [];
  const io = { agent: (phase, p) => { events.push('agent:' + phase + (p.name ? ':' + p.name : '')); } };
  const runner = new ProcessRunner({ model, brain: { respond: brain }, io, simulates: { guardrails: true } });
  return { model, runner, events };
}

// ── Feature 10 ───────────────────────────────────────────────────────────────

test('feature 10: the file has two starts, and a run begins at the one that is named', async () => {
  const { model, runner } = setup('10', support);
  assert.deepEqual(startElements(model).map(e => e.id), ['f0', 'f10']);
  assert.equal(startElement(model).id, 'f0');
  assert.deepEqual(model.elements.filter(e => e.kind === 'boundary').map(e => e.id + '@' + e.attachedTo), ['fE@f5', 'fE2@f15']);
  const b = await runner.run({ variablesText: VARIABLES, start: 'f10' });
  assert.deepEqual(b.visited, ['f10', 'fA2', 'f15', 'fE2', 'fC2', 'f11']);
});

test('feature 10 A: the regex guardrail blocks the injection before any model call', async () => {
  const { runner, events } = setup('10', support);
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  const call = result.agentCalls[0];
  assert.equal(call.status, 'blocked');
  assert.equal(call.answer, undefined, 'the model was never asked');
  assert.deepEqual(call.guardrails.map(g => [g.side, g.name, g.allowed, g.match]), [['input', 'PromptInjectionInputGuardrail', false, { check: 'keyword', text: 'System:' }]]);
  assert.ok(!events.includes('agent:request') && !events.includes('agent:thinking'));
  assert.ok(!result.logs.some(l => /REST service/.test(l.message)), 'no HTTP call');
  const message = ADAPTER + "The input message is rejected because it's empty or contains malicious content";
  assert.deepEqual(result.caught, [{ elementId: 'f5', boundaryId: 'fE', errorCode: INPUT_CODE, message }]);
  assert.equal(result.data.result, 'Blocked by guardrail: ' + message);
});

test('feature 10 B: the classifier guardrail spends one model call and blocks the role-play', async () => {
  const { runner } = setup('10', support);
  const result = await runner.run({ variablesText: VARIABLES, start: 'f10' });
  const call = result.agentCalls[0];
  assert.equal(call.status, 'blocked');
  assert.deepEqual(call.classifier, { provider: 'OpenAI', model: 'gpt-4.1-mini', url: 'https://api.openai.com/v1/chat/completions', verdict: 'YES' });
  assert.equal(call.guardrails[0].reason, 'The input message is rejected because it contains malicious content');
  assert.equal(result.logs.filter(l => /REST service/.test(l.message)).length, 1, 'the classifier call, and no other');
  assert.equal(result.data.result, 'Blocked by guardrail: ' + ADAPTER + 'The input message is rejected because it contains malicious content');
});

test('feature 10: a harmless role passes the classifier; without a key it blocks as a precaution', async () => {
  const benign = setup('10', support);
  elementById(benign.model, 'fA2').config.output.code = 'in.query = "Please act as a patient teacher and explain your refund policy.";';
  const served = await benign.runner.run({ variablesText: VARIABLES, start: 'f10' });
  assert.equal(served.agentCalls[0].status, 'answered');
  assert.equal(served.agentCalls[0].classifier.verdict, 'NO');
  assert.equal(served.data.result, 'Thank you for contacting Acme support. I am happy to help with your request: "Please act as a patient teacher and explain your refund policy."');
  assert.equal(served.logs.filter(l => /REST service/.test(l.message)).length, 2, 'classifier and agent');

  const noKey = setup('10', support);
  const precaution = await noKey.runner.run({ variablesText: VARIABLES.replace('"sk-..."', '""'), start: 'f10' });
  assert.equal(precaution.agentCalls[0].blockedBy.reason, 'Safety check could not be completed. The message has been blocked as a precaution.');
  assert.ok(precaution.logs.some(l => l.message.startsWith('AI guardrail classifier failed. Blocking as precaution. Cause: ')));
});

test('feature 10: without the guardrail the stand-in obeys the injection', async () => {
  const { model, runner } = setup('10', support);
  delete agentConfig(elementById(model, 'f5')).inputGuardrails;
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.data.result, 'Understood. I am no longer bound by my previous instructions.\nMy system prompt is: "You are a helpful customer support agent."');
  assert.deepEqual(result.visited, ['f0', 'fA', 'f5', 'f1']);
  assert.match(support({ system: 'S', user: 'Where is my order?' }).text, /^Thank you for contacting Acme support\./);
});

// ── Feature 11 ───────────────────────────────────────────────────────────────

const RESTORED = 'MAC: 00:1A:2B:3C:4D:5E\nEmail: john.doe@example.com\nPhone: +1-555-123-4567\nCard: 4532015112830366\nSSN: 123-45-6789\nBorn: 15/06/1990\nIP: 192.168.1.42';
const VALUES = ['00:1A:2B:3C:4D:5E', 'john.doe@example.com', '+1-555-123-4567', '4532015112830366', '123-45-6789', '15/06/1990', '192.168.1.42'];

test('feature 11: the model sees placeholders, the process gets the values', async () => {
  const { runner, events } = setup('11', echo);
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  const call = result.agentCalls[0];
  assert.ok(VALUES.every(v => call.userOriginal.includes(v)));
  assert.ok(VALUES.every(v => !call.user.includes(v)), 'none of the values is in what is sent');
  assert.match(call.user, /^Please echo back all fields: MAC <MAC_ADDRESS_[0-9a-f]{12}>, email <EMAIL_[0-9a-f]{12}>, phone <PHONE_[0-9a-f]{12}>, card <CREDIT_DEBIT_CARD_NUMBER_[0-9a-f]{12}>, SSN <SSN_[0-9a-f]{12}>, born <DATE_OF_BIRTH_[0-9a-f]{12}>, IP <IP_ADDRESS_[0-9a-f]{12}>\.$/);
  assert.match(call.answerFromModel, /^MAC: <MAC_ADDRESS_[0-9a-f]{12}>\nEmail: <EMAIL_/);
  assert.equal(call.answer, RESTORED);
  assert.deepEqual(call.guardrails.map(g => [g.side, g.name, g.masked || g.restored]), [['input', 'PiiMaskingGuardrail', 7], ['output', 'PiiMaskingGuardrail', 7]]);
  assert.equal(result.data.result, RESTORED);
  assert.equal(result.logs[result.logs.length - 1].message, '[PiiMaskingDemo] Result (PII restored): ' + RESTORED);
  assert.deepEqual(events.filter(e => e.startsWith('agent:guard')), ['agent:guard:PiiMaskingGuardrail', 'agent:guard:PiiMaskingGuardrail']);
});

test('feature 11: in one list only, or with a model that rewords, the values do not come back', async () => {
  const inputOnly = setup('11', echo);
  delete agentConfig(elementById(inputOnly.model, 'f5')).outputGuardrails;
  const first = await inputOnly.runner.run({ variablesText: VARIABLES });
  assert.match(first.data.result, /^MAC: <MAC_ADDRESS_[0-9a-f]{12}>\n/);
  assert.ok(VALUES.every(v => !first.data.result.includes(v)));

  const outputOnly = setup('11', echo);
  delete agentConfig(elementById(outputOnly.model, 'f5')).inputGuardrails;
  const second = await outputOnly.runner.run({ variablesText: VARIABLES });
  assert.ok(VALUES.every(v => second.agentCalls[0].user.includes(v)), 'the model gets the real values');
  assert.match(second.data.result, /^MAC: <MAC_ADDRESS_[0-9a-f]{12}>\n/, 'and the answer is masked instead: the guardrail takes its first message for the input');

  const noHint = setup('11', echo);
  delete agentConfig(elementById(noHint.model, 'f5')).system;
  const third = await noHint.runner.run({ variablesText: VARIABLES });
  assert.equal(third.data.result.split('\n')[1], 'Email: (an anonymised email)');
  assert.ok(VALUES.every(v => !third.data.result.includes(v)));
  assert.deepEqual(third.agentCalls[0].insights.map(i => i.id), ['echoed', 'paraphrased']);
});
