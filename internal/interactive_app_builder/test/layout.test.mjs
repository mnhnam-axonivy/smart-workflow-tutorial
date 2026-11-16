import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, connectors } from '../runtime/model/process.js';
import { setMeasurer, wrapText, layoutElement, elementBounds, modelBounds, boundaryPoint, connectorPath, pathLength, pointAt, hitTest } from '../runtime/stage/layout.js';

// No canvas in Node: pretend every character is 6 px wide.
setMeasurer(text => text.length * 6);

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const model = () => loadProcess(json('process/tutorial/features/Feature01.p.json'), json('dataclass/tutorial/Feature01Data.d.json'));

test('layout: labels wrap on spaces and long words break', () => {
  assert.deepEqual(wrapText('Invoice Summary Agent', 60, ''), ['Invoice', 'Summary', 'Agent']);
  assert.deepEqual(wrapText('Show result from AI', 70, ''), ['Show result', 'from AI']);
  assert.deepEqual(wrapText('AgenticProcessCall', 60, ''), ['AgenticPro', 'cessCall']);
  assert.deepEqual(wrapText('two\nlines', 100, ''), ['two', 'lines']);
});

test('layout: activities keep their label inside, events put it underneath', () => {
  const m = model();
  const agent = layoutElement(elementById(m, 'f5'));
  assert.deepEqual(agent.body, { x: -56, y: -30, w: 112, h: 60 });
  assert.equal(agent.label, null);
  assert.equal(agent.lines.length, 3);
  const start = layoutElement(elementById(m, 'f0'));
  assert.ok(start.label.y > 15, 'the label sits below the circle');
  const bounds = elementBounds(elementById(m, 'f0'));
  assert.ok(bounds.w > 30 && bounds.x < 96 - 15, 'bounds include the label');
  const all = modelBounds(m);
  assert.ok(all.x < 96 && all.x + all.w >= 815 && all.y <= 34 && all.y + all.h > 94);
});

test('layout: connectors start and end on the outlines', () => {
  const m = model();
  const byId = Object.fromEntries(connectors(m).map(c => [c.id, c]));
  assert.deepEqual(connectorPath(byId.f2), [{ x: 111, y: 64 }, { x: 208, y: 64 }]); // circle → activity
  assert.deepEqual(connectorPath(byId.f4), [{ x: 407, y: 64 }, { x: 464, y: 64 }]); // task event → agent
  assert.deepEqual(connectorPath(byId.f10), [{ x: 736, y: 64 }, { x: 785, y: 64 }]); // activity → end
  const moved = { ...elementById(m, 'f9'), y: 164 };
  const p = boundaryPoint(moved, 520, 64);
  assert.ok(Math.abs(p.y - 134) < 1e-9 && p.x < 680, 'a diagonal leaves through the top edge');
  const bent = connectorPath({ from: elementById(m, 'f5'), to: moved, via: [{ x: 680, y: 64 }] });
  assert.deepEqual(bent, [{ x: 576, y: 64 }, { x: 680, y: 64 }, { x: 680, y: 134 }]);
});

test('layout: positions along a path', () => {
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.equal(pathLength(path), 20);
  assert.deepEqual(pointAt(path, 0), { x: 0, y: 0 });
  assert.deepEqual(pointAt(path, 0.25), { x: 5, y: 0 });
  assert.deepEqual(pointAt(path, 0.75), { x: 10, y: 5 });
  assert.deepEqual(pointAt(path, 2), { x: 10, y: 10 });
});

test('layout: hit testing finds bodies and event labels', () => {
  const m = model();
  assert.equal(hitTest(m, 520, 64).id, 'f5');
  assert.equal(hitTest(m, 575, 92).id, 'f5', 'inside the corner of the body');
  assert.equal(hitTest(m, 96, 64).id, 'f0');
  assert.equal(hitTest(m, 96, 94).id, 'f0', 'the label below the start event');
  assert.equal(hitTest(m, 392, 64).id, 'f3');
  assert.equal(hitTest(m, 330, 64), null, 'a connector is not an element');
  assert.equal(hitTest(m, 520, 150), null);
});
