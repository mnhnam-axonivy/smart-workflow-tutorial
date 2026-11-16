/**
 * Browser check of the built simulations inside the (previewed) Feature Guide.
 *
 *   npm run smoke            opens the walkthroughs of the lessons from their buttons in headless
 *                            Chrome/Edge, plays them, then uses the simulator like a learner, and
 *                            reports pass/fail
 *
 * Each lesson has its own section, marked "// ── Feature NN".
 *
 * Every request that leaves the preview server is blocked and counted as a failure: the
 * simulations must work offline. Screenshots of each stage land in .preview/.
 * Set CHROME_PATH if the browser is not found automatically.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from '../preview/server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = resolve(here, '../.preview');

const PACE = 6; // the walkthrough plays this much faster than a learner sees it
const EXPECTED = 'The invoice INV-2024-00123 from Acme Supplies Ltd. has a total amount of JPY 10,560.00 and is due on 2024-06-30.';

const browserPath = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].find(existsSync);
if (!browserPath) {
  console.error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(2);
}

mkdirSync(shots, { recursive: true });
const failures = [];
let checks = 0;
const check = (ok, what) => {
  checks++;
  console.log((ok ? '  ok    ' : '  FAIL  ') + what);
  if (!ok) failures.push(what);
};

const server = await start(0);
const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-color-profile=srgb']
});

/** Opens the guide; collects console problems and blocks anything that is not the preview server. */
async function openGuide(query = '', viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  const problems = [];
  const external = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(server.url) || url.startsWith('data:') || url.startsWith('blob:')) request.continue();
    else { external.push(url); request.abort(); }
  });
  await page.goto(server.url + query, { waitUntil: 'load' });
  return { page, problems, external };
}

/** Runs `fn(app, ...args)` in the page against the mounted simulation. */
const withApp = (page, fn, ...args) => page.evaluate((source, params) => {
  const handle = window.swInteractive.instances()[0];
  return new Function('app', 'handle', 'args', 'return (' + source + ')(app, handle, ...args)')(handle.app, handle, params);
}, fn.toString(), args);

const waitForStatus = (page, statuses, timeout = 45000) => page.waitForFunction(
  wanted => { const h = window.swInteractive.instances()[0]; return h && wanted.includes(h.app.state.status); },
  { timeout, polling: 100 }, statuses);

const settle = (page, ms = 350) => new Promise(r => setTimeout(r, ms));

/** Screenshot of the walkthrough dialog, or of the visible page when it is closed. */
async function shot(page, name, file = join(shots, name + '.png')) {
  const clip = await page.evaluate(() => {
    const target = document.querySelector('.sw-walkthrough') || document.documentElement;
    const r = target === document.documentElement ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : target.getBoundingClientRect();
    return { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  });
  await page.screenshot({ path: file, clip, captureBeyondViewport: false });
}

/** Shows a feature page of the guide. */
async function showFeaturePage(page, id) {
  await page.evaluate((pace, pageId) => {
    // no voice unless a check brings its own speech engine: the browser's would really speak
    window.swInteractiveOptions = { speech: null, ...(window.swInteractiveOptions || {}), tourPace: pace };
    window.showFeature(pageId);
  }, PACE, id);
  await page.waitForSelector('#feature-article h1', { timeout: 10000 });
}

const showFeature01 = page => showFeaturePage(page, '01');

/** Opens the walkthrough dialog with the button next to the title. */
async function openWalkthrough(page) {
  await page.click('.sw-walkthrough-btn');
  await page.waitForSelector('.sw-walkthrough .sw-interactive-host', { timeout: 10000 });
  await page.waitForFunction(() => { const h = window.swInteractive.instances()[0]; return h && h.app.stage.width > 0; }, { timeout: 10000 });
  await settle(page, 300);
}

async function openFeature01(page) {
  await showFeature01(page);
  await openWalkthrough(page);
}

/** Waits until the walkthrough shows the given note, and pauses it there. */
async function atNote(page, key) {
  await page.waitForFunction(k => {
    const tour = window.swInteractive.instances()[0].app.tour;
    if (!tour.current || tour.current.key !== k) return false;
    tour.setPaused(true);
    return true;
  }, { timeout: 60000, polling: 20 }, key);
  await settle(page, 350);
}

/** Waits for the title screen of a chapter, and pauses on it. */
async function atTitle(page, id) {
  await page.waitForFunction(k => {
    const tour = window.swInteractive.instances()[0].app.tour;
    if (tour.title !== k) return false;
    tour.setPaused(true);
    return true;
  }, { timeout: 60000, polling: 20 }, id);
  await settle(page, 450);
}

/** Waits for a screen inside a chapter (d.screen), e.g. the one before a cause, and pauses on it. */
async function atScreen(page, key) {
  await page.waitForFunction(k => {
    const tour = window.swInteractive.instances()[0].app.tour;
    if (!tour.screen || tour.screen.key !== k) return false;
    tour.setPaused(true);
    return true;
  }, { timeout: 90000, polling: 20 }, key);
  await settle(page, 350);
}

const resume = page => page.evaluate(() => window.swInteractive.instances()[0].app.tour.setPaused(false));

/**
 * A speech engine that says nothing aloud: it logs each sentence (window.__voice.log) and takes
 * window.__voice.ms to "say" it. It has an English and a Japanese voice (window.__voice.voices).
 */
const installFakeVoice = page => page.evaluate(() => {
  const fake = window.__voice = { log: [], cancels: 0, ms: 700, current: null, changed: null, voices: [
    { name: 'Fake Aria Online (Natural)', lang: 'en-US' }, { name: 'Fake Nanami Online (Natural)', lang: 'ja-JP' }] };
  const synth = {
    paused: false,
    getVoices: () => fake.voices,
    addEventListener: (type, fn) => { if (type === 'voiceschanged') fake.changed = fn; },
    removeEventListener: () => {},
    speak(u) {
      fake.log.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name });
      fake.current = u;
      setTimeout(() => {
        if (fake.current !== u) return;
        u.onstart();
        u.timer = setTimeout(() => { if (fake.current === u) { fake.current = null; u.onend(); } }, fake.ms);
      }, 20);
    },
    cancel() {
      fake.cancels++;
      const u = fake.current;
      fake.current = null;
      if (u) { clearTimeout(u.timer); u.onerror({ error: 'interrupted' }); }
    },
    resume() {}
  };
  window.swInteractiveOptions = { ...(window.swInteractiveOptions || {}), speech: { synth, Utterance: class { constructor(text) { this.text = text; } } } };
  try { localStorage.removeItem('swWalkthroughVoice'); } catch (e) { /* fine */ }
});

const voiceLog = page => page.evaluate(() => window.__voice.log.map(l => l.text));
const voiceButton = page => withApp(page, (app, h) => {
  const b = h.host.shadowRoot.querySelector('.player .tour-voice');
  return b && { on: b.classList.contains('on'), pressed: b.getAttribute('aria-pressed'), title: b.title, disabled: b.disabled };
});

const clickInApp = (page, selector) => page.evaluate(sel => {
  const el = window.swInteractive.instances()[0].host.shadowRoot.querySelector(sel);
  if (!el) throw new Error('not found in simulation: ' + sel);
  el.click();
}, selector);

try {
  // ── 1. A button next to the title opens the walkthrough full screen ────────
  console.log('\nFeature Guide integration');
  const guide = await openGuide();
  let { page } = guide;
  check(await page.evaluate(() => Boolean(window.swInteractive && window.swInteractive.has('feature-01'))), 'runtime and feature-01.js are loaded and registered');
  await showFeature01(page);
  check(await page.evaluate(() => { const b = document.querySelector('.sw-title-row h1 + .sw-walkthrough-btn'); return Boolean(b) && b.lastChild.textContent === 'Walkthrough'; }), 'a "Walkthrough" button sits next to the page title');
  check(await page.evaluate(() => window.swInteractive.instances().length === 0 && !document.querySelector('#feature-article .sw-interactive-host')), 'nothing is embedded in the article');
  await shot(page, '00-page-with-button');
  await openWalkthrough(page);
  check(await page.evaluate(() => { const d = document.querySelector('.sw-walkthrough'); const r = d && d.getBoundingClientRect(); return Boolean(r) && r.width === window.innerWidth && r.height === window.innerHeight && getComputedStyle(d).position === 'fixed'; }), 'the button opens a full-screen dialog');
  check(await page.evaluate(() => document.querySelector('.sw-walkthrough-title').textContent) === 'Basic Agent Setup — Walkthrough', 'the dialog is titled after the page');
  check(await page.evaluate(() => document.documentElement.style.overflow === 'hidden'), 'the page behind it does not scroll');
  check(await withApp(page, app => app.stage.kind) === 'webgl', 'the canvas is rendered with Three.js (WebGL)');
  check(await withApp(page, app => app.model.elements.length) === 6, 'the real Feature01 process is loaded (6 elements)');

  // ── 2. The walkthrough plays by itself ─────────────────────────────────────
  console.log('\nWalkthrough');
  check(await withApp(page, app => app.mode) === 'tour', 'the walkthrough starts right away');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelectorAll('.tour-chapter').length === 5 && h.host.shadowRoot.querySelector('.runbar').offsetParent === null), 'the player shows five chapters; Run, Step and Reset are hidden');

  await withApp(page, app => { app.tour.start(0); }); // autoplay has moved on while the checks ran
  await atTitle(page, 'run');
  check(await withApp(page, (app, h) => { const el = h.host.shadowRoot.querySelector('.tour-title'); return !el.hidden && el.textContent === 'Element configuration' && !app.runner.running; }), 'a black screen shows the section name "Element configuration" before anything plays');
  await shot(page, '01b-chapter-title');
  await resume(page);
  await atNote(page, 'mock');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').hidden && !h.host.shadowRoot.querySelector('.tour-spot').hidden && app.visual.active === 'f7'), 'the first note points at Mock data while the token is on it');
  // pausing freezes the note
  const before = await withApp(page, app => app.tour.bar.style.width);
  await settle(page, 500);
  check(await withApp(page, app => app.tour.bar.style.width) === before && await withApp(page, app => app.tour.current.key) === 'mock', 'Pause holds the note');
  await shot(page, '02-note-on-canvas');
  await resume(page);

  await atNote(page, 'system');
  check(await withApp(page, app => app.state.selection === 'f5' && app.state.inscriptionOpen && app.runner.running), 'the run waits on the agent while its Configuration is explained');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const field = h.host.shadowRoot.querySelector('[data-tour="system"]').getBoundingClientRect();
    return Math.abs(spot.top - field.top) < 12 && Math.abs(spot.left - field.left) < 12;
  }), 'the spotlight is on the System message field');
  await shot(page, '03-note-on-field');
  await resume(page);

  await atNote(page, 'call');
  check(await withApp(page, app => app.stage.view.tilt) > 0.55, 'the canvas tilts while the agent calls the model');
  await shot(page, '04-calling-the-model');
  await resume(page);

  await atNote(page, 'answer');
  check(await withApp(page, app => app.tour.current.quote) === EXPECTED, 'the answer note quotes the summary from the tutorial');
  await resume(page);

  await atNote(page, 'log');
  check(await withApp(page, app => app.state.panelOpen && app.panel.logs.some(l => l.message.includes('INV-2024-00123'))), 'the Runtime Log opens on the summary line');
  await shot(page, '05-note-on-log');
  await resume(page);

  await atTitle(page, 'system');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').textContent === 'System message' && app.tour.index === 1), 'the next one shows "System message"');
  await shot(page, '05b-chapter-title');
  await resume(page);
  await atNote(page, 'systemEdit');
  check(await withApp(page, app => app.model.elements.find(e => e.id === 'f5').config.userConfig.system.includes('return a bullet list containing')), 'chapter 2 types a new instruction into the system message');
  await shot(page, '06-typed-change');
  await resume(page);
  await atNote(page, 'systemList');
  const listed = await withApp(page, app => app.tour.current.quote);
  check(listed === '- Invoice number: INV-2024-00123\n- Supplier: Acme Supplies Ltd.\n- Total amount: JPY 10,560.00\n- Due date: 2024-06-30', 'the answer becomes a list (' + JSON.stringify(listed) + ')');
  await shot(page, '07-different-answer');
  await resume(page);
  await atNote(page, 'systemGuess');
  check(await withApp(page, app => !app.model.elements.find(e => e.id === 'f5').config.userConfig.system && app.tour.current.quote.length > 8), 'without a system message the model lists every field it finds');
  const marked = await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('.tour-note-quote > div')].filter(n => n.classList.contains('wrong')).map(n => n.textContent.split(':')[0]).join('|'));
  check(marked === '- Invoice date|- Bill to|- Payment terms|- Subtotal|- Tax|- Bank|- Line items', 'only the fields nobody asked for are marked (' + marked + ')');
  check(await withApp(page, (app, h) => { const lines = [...h.host.shadowRoot.querySelectorAll('.tour-note-quote > div')]; const red = n => getComputedStyle(n).color === 'rgb(255, 138, 138)'; return lines.filter(n => n.classList.contains('wrong')).every(n => red(n) && n.textContent.endsWith('(wrong)')) && lines.filter(n => !n.classList.contains('wrong')).every(n => !red(n) && !n.textContent.includes('(wrong)')); }), 'they are red and end with (wrong); the four wanted fields are not');
  await shot(page, '07b-guessed-answer');
  await resume(page);

  await atNote(page, 'dataResult');
  check(await withApp(page, app => app.tour.current.quote.includes('JPY 99,000.00')), 'chapter 3: the summary follows the changed mock data');
  check(await withApp(page, app => app.model.elements.find(e => e.id === 'f5').config.userConfig.system.includes('single sentence')), 'each chapter starts from the original process');
  await resume(page);

  await atNote(page, 'mappingLost');
  check(await withApp(page, app => app.tour.current.quote === 'The invoice INV-2024-00123 from Acme Supplies Ltd. has a total amount of JPY 10,560.00 and is due on 2024-06-30.'), 'chapter 4: the model still answers');
  await resume(page);
  await atNote(page, 'mappingLog');
  check(await withApp(page, app => !app.data.summary), 'but in.summary stays empty');
  await shot(page, '08-nothing-stored');
  await resume(page);

  await atNote(page, 'varsKey');
  check(await withApp(page, app => app.state.tab) === 'variables', 'chapter 5 switches to variables.yaml');
  await shot(page, '09-variables');
  await resume(page);
  await atNote(page, 'varsFailed');
  check(await withApp(page, app => app.state.tab === 'process' && app.state.status === 'failed' && app.visual.error === 'f5'), 'without an API key the agent step fails');
  await shot(page, '10-missing-key');
  await resume(page);

  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 600);
  check(await withApp(page, (app, h) => Boolean(h.host.shadowRoot.querySelector('.tour-cover.end .tour-card'))), 'the walkthrough ends on the "End of the walkthrough" card');
  check(await withApp(page, app => app.state.status === 'idle' && app.panel.logs.length === 0 && app.variablesText.includes('sk-...') &&
    app.model.elements.find(e => e.id === 'f5').config.userConfig.resultMapping === 'in.summary'), 'process, variables and log are back to how the tutorial ships them');
  await shot(page, '11-your-turn');
  await clickInApp(page, '.tour-cover .tour-play');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-cover').hidden && h.host.shadowRoot.querySelector('.runbar').offsetParent !== null), 'closing the end card shows the simulator');

  // ── 3. Explore: run the unchanged process ──────────────────────────────────
  console.log('\nExplore: run');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 700);
  check(await withApp(page, app => app.state.status) === 'completed', 'the run completes');
  const logText = await withApp(page, app => app.panel.logs.map(l => l.message).join('\n'));
  check(logText.includes(EXPECTED), 'the Runtime Log shows the summary from the tutorial');
  check(/REST service langChain \(langChain\) call to POST https:\/\/api\.openai\.com/.test(logText), 'the Runtime Log shows the REST call to the provider');
  check(await withApp(page, app => app.stage.view.tilt) === 0, 'the camera returns to the flat view');
  await shot(page, '12-completed');

  // ── 4. Explore: selecting on the canvas and editing in the inscription view ─
  console.log('\nExplore: inscription view');
  const agentAt = await withApp(page, app => app.stage.worldToClient(520, 64));
  await page.mouse.click(agentAt.x, agentAt.y);
  await settle(page);
  check(await withApp(page, app => app.state.selection) === 'f5', 'clicking the agent on the canvas selects it');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.inscription-title').textContent) === 'Program - Invoice Summary Agent', 'the inscription view shows "Program - Invoice Summary Agent"');
  check(await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('.section-title')].map(n => n.textContent).join('|')) === '✉️ Message|🛠️ Tools|🛡️ Guardrails|🧠️ Model|➡️ Output', 'the Configuration tab has the groups of the real editor');
  check(await withApp(page, (app, h) => !h.host.shadowRoot.querySelector('.quickbar') && !h.host.shadowRoot.querySelector('.run-btn.speed') && !h.host.shadowRoot.querySelector('.palette')), 'quick-action bar, speed button and palette are gone');
  await shot(page, '13-agent-selected');

  // type into the system message like a user would
  await withApp(page, (app, h) => h.host.shadowRoot.querySelectorAll('.macro-view')[1].click());
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type('Return the supplier and the total amount as a bullet list. Answer in Japanese. Do not add commentary.');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 500);
  const answer = await withApp(page, app => app.data.summary);
  check(answer === '- サプライヤー: Acme Supplies Ltd.\n- 合計金額: JPY 10,560.00', 'a changed system message changes the answer (' + JSON.stringify(answer) + ')');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  await shot(page, '14-changed-prompt');

  // ── 5. Explore: variables.yaml and Reset ───────────────────────────────────
  console.log('\nExplore: variables.yaml');
  await clickInApp(page, '.tab[data-tab="variables"]');
  await withApp(page, app => app.setVariables('Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: ""\n'));
  await settle(page);
  await withApp(page, app => { app.run(); });
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 1200);
  check(await withApp(page, app => app.state.status) === 'failed', 'without an API key the run fails');
  check(await withApp(page, app => app.visual.error) === 'f5', 'the agent element is marked as failed');
  await clickInApp(page, '.run-btn:nth-of-type(3)');
  await settle(page, 700);
  check(await withApp(page, app => app.state.status === 'idle' && app.panel.logs.length === 0 && app.variablesText.includes('sk-...')), 'Reset restores process, variables and log');

  // ── 6. Replay one chapter, then leave it ───────────────────────────────────
  console.log('\nReplay');
  await clickInApp(page, '.badge.replay');
  await settle(page, 200);
  await withApp(page, (app, h) => h.host.shadowRoot.querySelectorAll('.popover .menu-item')[3].click());
  await atNote(page, 'dataEdit');
  check(await withApp(page, app => app.mode === 'tour' && app.tour.index === 2), 'the Walkthrough menu replays a single chapter');
  await resume(page);
  await clickInApp(page, '.tour-exit');
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 10000, polling: 50 });
  await settle(page, 500);
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-cover').hidden && !app.runner.running &&
    app.model.elements.find(e => e.id === 'f7').config.output.code.includes('JPY 10,560.00')), 'Skip walkthrough stops it and restores the process');

  // ── 7. Closing the dialog, and the Japanese guide ─────────────────────────
  console.log('\nClosing and language');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(await page.evaluate(() => !document.querySelector('.sw-walkthrough') && window.swInteractive.instances().length === 0), 'Escape closes the dialog and releases the simulation');
  check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('sw-walkthrough-btn') && document.documentElement.style.overflow !== 'hidden'), 'focus returns to the button and the page scrolls again');
  await page.evaluate(() => window.setLang('jp'));
  await settle(page, 400);
  check(await page.evaluate(() => document.querySelector('.sw-walkthrough-btn').lastChild.textContent) === 'ウォークスルー', 'the button is shown in Japanese');
  await openWalkthrough(page);
  check(await page.evaluate(() => document.querySelector('.sw-walkthrough-title').textContent) === 'エージェントの基本設定 — ウォークスルー', 'so is the dialog');
  await withApp(page, app => { app.tour.start(0); });
  await atTitle(page, 'run');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').textContent) === '要素の設定', 'the title screen shows the Japanese section name');
  await resume(page);
  await atNote(page, 'mock');
  check(await withApp(page, (app, h) => /請求書/.test(h.host.shadowRoot.querySelector('.tour-note-text').textContent)), 'the notes are in Japanese');
  await shot(page, '15-japanese');
  await page.click('.sw-walkthrough-close');
  await settle(page, 300);
  check(await page.evaluate(() => !document.querySelector('.sw-walkthrough') && window.swInteractive.instances().length === 0), 'the close button closes it too');
  await page.evaluate(() => window.setLang('en'));
  await page.evaluate(() => window.showFeature('a01'));
  await settle(page);
  check(await page.evaluate(() => !document.querySelector('.sw-walkthrough-btn')), 'pages without a simulation get no button');
  check(guide.problems.length === 0, 'no console errors or warnings' + (guide.problems.length ? ': ' + guide.problems.slice(0, 4).join(' | ') : ''));
  check(guide.external.length === 0, 'no request leaves the page (offline-ready)' + (guide.external.length ? ': ' + guide.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── 7b. Feature 01: the voice reads the notes ─────────────────────────────
  console.log('\nFeature 01: voice');
  const voiced = await openGuide();
  page = voiced.page;
  await installFakeVoice(page);
  await openFeature01(page);
  check(JSON.stringify(await voiceButton(page)) === JSON.stringify({ on: true, pressed: 'true', title: 'Turn the voice off', disabled: false }), 'the player has a voice button, on at first');
  await withApp(page, app => { window.__voice.log.length = 0; app.tour.start(0); });
  await page.waitForFunction(() => window.__voice.log.some(l => l.text === 'Element configuration'), { timeout: 10000, polling: 20 });
  check(await page.evaluate(() => window.__voice.log[0].text === 'Element configuration' && window.__voice.log[0].voice === 'Fake Aria Online (Natural)' && window.__voice.log[0].lang === 'en-US'), 'the chapter title is said, with the natural English voice');
  await page.waitForFunction(() => {
    const h = window.swInteractive.instances()[0];
    const tour = h.app.tour;
    if (!tour.current || tour.current.key !== 'mock' || !h.host.shadowRoot.querySelector('.tour-say.saying')) return false;
    tour.setPaused(true);
    return true;
  }, { timeout: 20000, polling: 20 });
  await settle(page, 350);
  check(await withApp(page, (app, h) => {
    const says = [...h.host.shadowRoot.querySelectorAll('.tour-note-text .tour-say')];
    return says.length === 2 && says[0].classList.contains('saying') && !says[1].classList.contains('saying') &&
      getComputedStyle(says[0]).backgroundColor !== 'rgba(0, 0, 0, 0)';
  }), 'the note shows its sentences; the one being said is lit like a subtitle');
  check((await voiceLog(page)).slice(-2).join('|') === 'Mock data|This script stands in for the employee who pastes the invoice.', 'the note is read: its title, then its first sentence');
  await shot(page, '18-voice-subtitle');
  check(await page.evaluate(() => window.__voice.cancels > 0 && !window.__voice.current) && await withApp(page, app => app.tour.speech.paused), 'Pause stops the voice');
  await resume(page);
  await settle(page, 800);
  check(await withApp(page, app => app.tour.current && app.tour.current.key === 'mock' && !app.tour.speech.done), 'the note waits for the voice, longer than its reading time');
  check((await voiceLog(page)).filter(t => t === 'This script stands in for the employee who pastes the invoice.').length === 2, 'Resume says the sentence it stopped in again');
  await page.waitForFunction(() => { const t = window.swInteractive.instances()[0].app.tour; return !t.current || t.current.key !== 'mock'; }, { timeout: 10000, polling: 20 });
  check((await voiceLog(page)).includes('It fills in dot invoice Text with the invoice text.'), 'it moves on once the note is said; code is read as words ("in dot invoice Text")');

  await atNote(page, 'query');
  await clickInApp(page, '.tour-voice');
  check(JSON.stringify(await voiceButton(page)) === JSON.stringify({ on: false, pressed: 'false', title: 'Turn the voice on', disabled: false }) &&
    await withApp(page, (app, h) => app.tour.speech === null && !h.host.shadowRoot.querySelector('.tour-say.saying')) &&
    await page.evaluate(() => localStorage.getItem('swWalkthroughVoice') === 'off'), 'the button turns the voice off, and the choice is stored');
  const quiet = (await voiceLog(page)).length;
  await resume(page);
  await atNote(page, 'system');
  check((await voiceLog(page)).length === quiet, 'without the voice the walkthrough goes on as before, silently');
  await clickInApp(page, '.tour-voice');
  check((await voiceLog(page)).slice(quiet).join('|') === 'System message' && (await voiceButton(page)).on, 'turning it on again says the current note from its beginning');
  await resume(page);
  await atNote(page, 'answer');
  await resume(page);
  await atNote(page, 'log');
  check(!(await voiceLog(page)).some(t => t.includes('INV-2024-00123')), 'quotes are left to read: the answer is not said');
  await clickInApp(page, '.tour-voice');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await openWalkthrough(page);
  check(!(await voiceButton(page)).on, 'turned off, it stays off when the walkthrough is opened again');
  await clickInApp(page, '.tour-voice');
  await page.keyboard.press('Escape');
  await settle(page, 300);

  await page.evaluate(() => window.setLang('jp'));
  await settle(page, 300);
  await openWalkthrough(page);
  await withApp(page, app => { window.__voice.log.length = 0; app.tour.start(0); });
  await page.waitForFunction(() => window.__voice.log.length > 0, { timeout: 10000, polling: 20 });
  check(await page.evaluate(() => window.__voice.log[0].text === '要素の設定' && window.__voice.log[0].voice === 'Fake Nanami Online (Natural)') && (await voiceButton(page)).title === '音声をオフにする', 'in Japanese the Japanese voice speaks');
  await page.evaluate(() => { window.__voice.voices = window.__voice.voices.slice(0, 1); window.__voice.changed(); });
  await atNote(page, 'mock');
  const none = await voiceButton(page);
  check(none.disabled && !none.on && none.title === 'このブラウザーには日本語の音声がありません' && await withApp(page, app => app.tour.speech === null), 'a browser without a Japanese voice: the button says so, and nothing is said');
  await resume(page);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.evaluate(() => window.setLang('en'));
  await showFeaturePage(page, '02');
  await openWalkthrough(page);
  check(await voiceButton(page) === null, 'lessons without a voice have no voice button');
  await page.keyboard.press('Escape');
  check(voiced.problems.length === 0, 'no console errors or warnings' + (voiced.problems.length ? ': ' + voiced.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

  // ── 8. Feature 02: structured output ───────────────────────────────────────
  console.log('\nFeature 02: Structured Output');
  const second = await openGuide();
  page = second.page;
  check(await page.evaluate(() => window.swInteractive.has('feature-02')), 'feature-02.js is loaded and registered');
  await showFeaturePage(page, '02');
  check(await page.evaluate(() => { const b = document.querySelector('.sw-title-row h1 + .sw-walkthrough-btn'); return Boolean(b) && document.querySelector('#feature-article h1').textContent === 'Structured Output'; }), 'the Structured Output page has the Walkthrough button');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-02' && app.model.dataClass.name === 'tutorial.Feature02Data' && Boolean(app.model.classes['tutorial.InvoiceData'])), 'the real Feature02 process and the InvoiceData class are loaded');
  await withApp(page, app => { app.tour.start(0); });
  await atTitle(page, 'type');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').textContent) === 'Expect result of type', 'the first title screen is the section "Expect result of type"');
  await resume(page);
  await atNote(page, 'type');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const field = h.host.shadowRoot.querySelector('[data-tour="resultType"]').getBoundingClientRect();
    const body = h.host.shadowRoot.querySelector('.inscription-body').getBoundingClientRect();
    return Math.abs(spot.top - field.top) < 12 && field.top >= body.top && field.bottom <= body.bottom;
  }), 'the spotlight is on "Expect result of type", scrolled into view');
  await shot(page, '20-f02-result-type');
  await resume(page);
  await atNote(page, 'dataClass');
  check(await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('.tour-note-quote > div')].map(n => n.textContent).join('|')) === 'invoiceNumber  String|supplierName   String|totalAmount    BigDecimal|currency       String|invoiceDate    LocalDate', 'the note lists the fields of InvoiceData with their types');
  await resume(page);
  await atNote(page, 'schema');
  await shot(page, '21-f02-schema');
  await resume(page);
  await atNote(page, 'json');
  check(await withApp(page, app => app.tour.current.quote) === '{\n  "invoiceNumber": "INV-2024-00123",\n  "supplierName": "Acme Supplies Ltd.",\n  "totalAmount": 10560.00,\n  "currency": "JPY",\n  "invoiceDate": "2024-06-01"\n}', 'the model answers with JSON for the five fields');
  check(await withApp(page, (app, h) => !h.host.shadowRoot.querySelector('.tour-note-quote').textContent.includes('…')), 'the JSON is shown in full');
  await shot(page, '22-f02-json');
  await resume(page);
  await atNote(page, 'plain');
  check(await withApp(page, app => !app.model.elements.find(e => e.id === 'f5').config.userConfig.resultType && app.tour.current.quote.startsWith('invoiceNumber: INV-2024-00123\n') && !app.data.result), 'without the type the answer is text and in.result stays empty');
  await resume(page);

  await atNote(page, 'typed');
  check(await withApp(page, (app, h) => app.tour.index === 1 && app.state.panelOpen && app.state.panelTab === 'data' && h.host.shadowRoot.querySelectorAll('[data-field="result"] .data-object tr').length === 5), 'chapter 2 shows the object in the Process data view, field by field');
  check(await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('[data-field="result"] .data-object tr')].map(r => r.textContent).join('|')) === 'invoiceNumberStringINV-2024-00123|supplierNameStringAcme Supplies Ltd.|totalAmountBigDecimal10560.00|currencyStringJPY|invoiceDateLocalDate2024-06-01', 'with name, type and value of each field');
  await shot(page, '23-f02-typed-fields');
  await resume(page);
  await atNote(page, 'log');
  check(await withApp(page, app => app.panel.logs[app.panel.logs.length - 1].message) === '{\n  "invoiceNumber" : "INV-2024-00123",\n  "supplierName" : "Acme Supplies Ltd.",\n  "totalAmount" : 10560.00,\n  "currency" : "JPY",\n  "invoiceDate" : "2024-06-01"\n}', 'Show result from AI logs the object as JSON');
  await shot(page, '24-f02-log');
  await resume(page);

  await atNote(page, 'suffix');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot');
    const s = spot.getBoundingClientRect();
    const input = h.host.shadowRoot.querySelector('[data-tour="resultType"] input').getBoundingClientRect();
    return app.tour.index === 2 && spot.classList.contains('text') && s.width > 30 && s.width < 70 && s.left > input.left + 100 && s.top >= input.top - 2 && s.bottom <= input.bottom + 2;
  }), 'chapter 3: the spotlight is on the characters ".class" alone, inside the field');
  await shot(page, '25a-f02-suffix-spot');
  await withApp(page, app => {
    app.memo.typed = [];
    app.memo.off = app.events.on(e => { if (e.type === 'config' && e.key === 'resultType') app.memo.typed.push(e.element.config.userConfig.resultType || ''); });
  });
  await resume(page);
  await atNote(page, 'suffixEdit');
  const typed = await withApp(page, app => { app.memo.off(); return app.memo.typed.slice(0, 6).join('|'); });
  check(typed === 'tutorial.InvoiceData.clas|tutorial.InvoiceData.cla|tutorial.InvoiceData.cl|tutorial.InvoiceData.c|tutorial.InvoiceData.|tutorial.InvoiceData', 'the suffix is deleted one character at a time (' + typed + ')');
  await shot(page, '25b-f02-suffix-removed');
  await resume(page);
  await atNote(page, 'suffixFailed');
  check(await withApp(page, app => app.tour.index === 2 && app.model.elements.find(e => e.id === 'f5').config.userConfig.resultType === 'tutorial.InvoiceData' && app.state.status === 'failed' && app.visual.error === 'f5'), 'without ".class" the agent step fails');
  await shot(page, '25-f02-missing-suffix');
  await resume(page);
  await atNote(page, 'suffixLog');
  check(await withApp(page, app => app.panel.logs[app.panel.logs.length - 1].message) === "Failed to extract config 'resultType' for value 'tutorial.InvoiceData'", 'and the Runtime Log says which setting could not be read');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  check(await withApp(page, app => app.model.elements.find(e => e.id === 'f5').config.userConfig.resultType === 'tutorial.InvoiceData.class'), 'afterwards the process is back to how the tutorial ships it');
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 600);
  check(await withApp(page, app => app.state.status === 'completed' && app.data.result && app.data.result.totalAmount === '10560.00'), 'a run in the simulator fills in.result');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => { const s = h.host.shadowRoot.querySelector('.msg.schema'); return Boolean(s) && s.textContent.includes('JSON schema of tutorial.InvoiceData') && s.textContent.includes('totalAmount: BigDecimal'); }), 'the Agent conversation shows the schema that went with the request');
  await shot(page, '26-f02-conversation');
  await withApp(page, app => { app.select('f5'); });
  await settle(page);
  await withApp(page, (app, h) => { const input = h.host.shadowRoot.querySelector('[data-tour="resultType"] input'); input.value = 'tutorial.Receipt.class'; input.dispatchEvent(new Event('input')); });
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('[data-tour="resultType"] .field-msg').textContent) === 'There is no class tutorial.Receipt in this project.', 'an unknown class is flagged in the field');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(second.problems.length === 0, 'no console errors or warnings' + (second.problems.length ? ': ' + second.problems.slice(0, 4).join(' | ') : ''));
  check(second.external.length === 0, 'no request leaves the page (offline-ready)' + (second.external.length ? ': ' + second.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── 9. Feature 03: model provider selection ────────────────────────────────
  console.log('\nFeature 03: Model Provider Selection');
  const third = await openGuide();
  page = third.page;
  check(await page.evaluate(() => window.swInteractive.has('feature-03') && window.swInteractive.has('feature-04')), 'feature-03.js and feature-04.js are loaded and registered');
  await showFeaturePage(page, '03');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-03' && app.model.elements.filter(e => e.isAgent).length === 3), 'the real Feature03 process with its three agents is loaded');
  await withApp(page, app => { app.tour.start(0); });
  await atTitle(page, 'global');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').textContent) === '1 — Global default via variables.yaml', 'the first title screen is the section "1 — Global default via variables.yaml"');
  await resume(page);
  await atNote(page, 'varsDefault');
  check(await withApp(page, app => app.state.tab === 'variables' && /DefaultModel: "gpt-4\.1-mini"/.test(app.variablesText) && /Anthropic:/.test(app.variablesText) && /Ollama:/.test(app.variablesText)), 'chapter 1 opens variables.yaml with the default and the three provider blocks');
  await shot(page, '30-f03-variables');
  await resume(page);
  await atNote(page, 'varsOthers');
  await resume(page);
  await atNote(page, 'analysis');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const group = h.host.shadowRoot.querySelector('[data-tour="modelGroup"]').getBoundingClientRect();
    return app.tour.index === 1 && app.state.selection === 'f5' && Math.abs(spot.top - group.top) < 12 && group.height > 100;
  }), 'chapter 2 points at the Model group of the first agent');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('[data-tour="provider"] .select-chips').textContent === 'OpenAI' && h.host.shadowRoot.querySelector('[data-tour="model"] input').value === '"gpt-4o"'), 'which shows OpenAI and "gpt-4o"');
  await shot(page, '31-f03-model-group');
  await resume(page);
  await atNote(page, 'urgency');
  check(await withApp(page, (app, h) => app.state.selection === 'f7' && h.host.shadowRoot.querySelector('[data-tour="provider"] .select-chips').textContent === 'Anthropic'), 'then the second agent with Anthropic');
  await resume(page);
  await atNote(page, 'risk');
  check(await withApp(page, (app, h) => app.state.selection === 'f9' && h.host.shadowRoot.querySelector('[data-tour="provider"] .select-chips').textContent === 'Ollama' && app.data.urgency === 'URGENT'), 'then the third with Ollama; the urgency is already classified');
  await shot(page, '32-f03-third-agent');
  await resume(page);
  await atNote(page, 'log');
  check(await withApp(page, app => /, urgency: URGENT, riskLevel: LOW$/.test(app.panel.logs[app.panel.logs.length - 1].message) && app.panel.logs[app.panel.logs.length - 1].message.startsWith('invoiceData: {')), 'the log line carries the results of all three agents');
  await resume(page);
  await atNote(page, 'cleared');
  check(await withApp(page, app => { const c = app.model.elements.find(e => e.id === 'f7').config.userConfig; return !c.provider && !c.model; }), 'the override of the Urgency Classifier is removed');
  await resume(page);
  await atNote(page, 'fallback');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-note-text').textContent) === 'With nothing set on the element, the call goes to OpenAI with gpt-4.1-mini: the default from variables.yaml.', 'and its call goes to the global default, OpenAI with gpt-4.1-mini');
  check(await withApp(page, app => app.stage.effects.agent && app.stage.effects.agent.el.id === 'f7' && app.stage.effects.agent.card.data.title === 'OpenAI' && app.stage.effects.agent.card.data.subtitle === 'gpt-4.1-mini'), 'the model shown above the agent says the same');
  await shot(page, '33-f03-fallback');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed'], 90000);
  await settle(page, 500);
  check(await withApp(page, app => app.state.status === 'completed' && app.data.urgency === 'URGENT' && app.data.riskLevel === 'LOW' && app.data.invoiceData.currency === 'JPY'), 'a run in the simulator goes through all three agents');
  await shot(page, '34-f03-completed');
  await page.keyboard.press('Escape');
  await settle(page, 300);

  // ── 10. Feature 04: file extraction ────────────────────────────────────────
  console.log('\nFeature 04: File Extraction');
  await showFeaturePage(page, '04');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-04' && Boolean(app.model.cms['/Files/Documents/InvoiceSample'])), 'the real Feature04 process and the sample invoice are loaded');
  await withApp(page, app => { app.tour.start(0); });
  await atTitle(page, 'query');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').textContent) === 'User message — passing a file', 'the first title screen is the section "User message — passing a file"');
  await resume(page);
  await atNote(page, 'query');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const field = h.host.shadowRoot.querySelector('[data-tour="query"]').getBoundingClientRect();
    return Math.abs(spot.top - field.top) < 12 && h.host.shadowRoot.querySelector('[data-tour="query"] .chip').textContent.includes('ivy.cms.co("/Files/Documents/InvoiceSample")') && !h.host.shadowRoot.querySelector('[data-tour="query"] .field-msg').textContent;
  }), 'the note points at the user message with the CMS reference, which raises no warning');
  await shot(page, '40-f04-query');
  await resume(page);
  await atNote(page, 'attached');
  check(await withApp(page, (app, h) => app.panel.call.files.length === 1 && app.panel.call.files[0].mime === 'application/pdf' && h.host.shadowRoot.querySelector('.tour-note-text').textContent.includes('InvoiceSample.pdf')), 'the PDF is attached to the call');
  await shot(page, '41-f04-attached');
  await resume(page);
  await atNote(page, 'json');
  check(await withApp(page, app => app.tour.current.quote) === '{\n  "invoiceNumber": "INV-0001-0002",\n  "supplierName": "Demo Company AG",\n  "totalAmount": 29727.50,\n  "currency": "CHF",\n  "invoiceDate": "2024-01-15"\n}', 'the answer has the five fields of the sample invoice, the date as yyyy-MM-dd');
  await resume(page);
  await atNote(page, 'result');
  check(await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('[data-field="invoiceResult"] .data-object tr')].map(r => r.lastChild.textContent).join('|')) === 'INV-0001-0002|Demo Company AG|29727.50|CHF|2024-01-15', 'in.invoiceResult holds the object');
  await shot(page, '42-f04-result');
  await resume(page);
  await atNote(page, 'nothing');
  check(await withApp(page, app => app.tour.index === 1 && app.panel.call.files.length === 0 && app.state.status === 'running' && /^\{\n  "invoiceNumber": null,\n  "supplierName": null,/.test(app.tour.current.quote)), 'chapter 2: with a wrong path nothing is attached and every field is null');
  await shot(page, '43-f04-wrong-path');
  await resume(page);
  await atNote(page, 'providerEdit');
  check(await withApp(page, (app, h) => {
    const c = app.model.elements.find(e => e.id === 'f5').config.userConfig;
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const field = h.host.shadowRoot.querySelector('[data-tour="provider"]').getBoundingClientRect();
    return c.provider === '"Ollama"' && c.query.includes('InvoiceSample")') && field.height > 0 && Math.abs(spot.top - field.top) < 12 && h.host.shadowRoot.querySelector('[data-tour="provider"] .select-chips').textContent === 'Ollama';
  }), 'then the path is right again and the agent is switched to Ollama');
  await shot(page, '44-f04-provider');
  await resume(page);
  await atNote(page, 'pdfRefused');
  check(await withApp(page, app => app.state.status === 'failed' && app.visual.error === 'f5' && app.panel.logs[app.panel.logs.length - 1].message === 'Ollama does not accept PDF files, so the call with InvoiceSample.pdf failed'), 'Ollama rejects the PDF and the agent step fails');
  await shot(page, '45-f04-pdf-refused');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 500);
  check(await withApp(page, app => app.state.status === 'completed' && app.data.invoiceResult.totalAmount === '29727.50'), 'a run in the simulator extracts the invoice again');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => { const chip = h.host.shadowRoot.querySelector('.msg.user .file-chip'); return Boolean(chip) && chip.textContent === 'InvoiceSample.pdfapplication/pdf'; }), 'the Agent conversation shows the attached file in the user message');
  await shot(page, '46-f04-conversation');
  await withApp(page, app => { const el = app.model.elements.find(e => e.id === 'f5'); app.select('f5'); app.setAgentConfig(el, 'query', el.config.userConfig.query.replace('InvoiceSample', 'Missing')); });
  await settle(page);
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('[data-tour="query"] .field-msg').textContent) === 'There is no CMS object at /Files/Documents/Missing, so nothing will be attached.', 'a path that does not exist is flagged in the field');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(third.problems.length === 0, 'no console errors or warnings' + (third.problems.length ? ': ' + third.problems.slice(0, 4).join(' | ') : ''));
  check(third.external.length === 0, 'no request leaves the page (offline-ready)' + (third.external.length ? ': ' + third.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── 11. Feature 05: callable process tools ─────────────────────────────────
  console.log('\nFeature 05: Callable Process Tools');
  const fifth = await openGuide();
  page = fifth.page;
  check(await page.evaluate(() => window.swInteractive.has('feature-05')), 'feature-05.js is loaded and registered');
  await showFeaturePage(page, '05');
  await openWalkthrough(page);
  check(await withApp(page, (app, h) => app.def.id === 'feature-05' && app.model.docs.length === 2 &&
    [...h.host.shadowRoot.querySelectorAll('.tab')].map(n => n.textContent).join('|') === 'Feature05.p.json|Feature05Tools.p.json|variables.yaml'), 'the process and the file with its tools are loaded, each with a tab');
  await withApp(page, app => { app.tour.start(0); });
  await atTitle(page, 'tools');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').textContent) === 'Tools', 'the first title screen is the section "Tools"');
  await resume(page);
  await atNote(page, 'available');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const field = h.host.shadowRoot.querySelector('[data-tour="tools"]');
    return Math.abs(spot.top - field.getBoundingClientRect().top) < 12 &&
      [...field.querySelectorAll('.chip')].map(n => n.textContent.replace(/^\S+ /, '')).join('|') === 'lookupApprovalPolicy (amount)|calculateEffectiveTaxRate (currency)|chooseApprover (amount)';
  }), 'the note points at "Available tools" with the three tools of the tools file');
  await shot(page, '50-f05-available-tools');
  await resume(page);
  await atNote(page, 'offered');
  check(await withApp(page, app => app.tour.current.quote.map(l => l.text).join('|')) === 'lookupApprovalPolicy(amount)|calculateEffectiveTaxRate(currency)|chooseApprover(amount)', 'the three tools go to the model with the request');
  await resume(page);
  await atNote(page, 'asks');
  check(await withApp(page, app => app.tour.current.quote === 'calculateEffectiveTaxRate(currency: "JPY")' && app.stage.view.tilt > 0.55 && app.runner.running), 'the model asks for calculateEffectiveTaxRate with the currency of the invoice');
  await shot(page, '51-f05-tool-call');
  await resume(page);
  await atNote(page, 'answers');
  check(await withApp(page, app => app.tour.current.quote === '{ "taxRate" : "8%" }' && app.visual.executed['tools-f13'] === 1), 'the tool\'s Script ran and its result goes back: 8%');
  await resume(page);
  await atNote(page, 'decision');
  check(await withApp(page, app => app.tour.current.quote) === '{\n  "approverUsername": "bob.smith",\n  "effectiveTaxRate": "8%",\n  "isAutoApprove": false\n}', 'after three tool calls the model returns the decision');
  check(await withApp(page, app => app.panel.call.steps.map(s => s.name).join('|')) === 'calculateEffectiveTaxRate|lookupApprovalPolicy|chooseApprover', 'in the order the system message names the tools');
  await resume(page);

  await atNote(page, 'tag');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const tags = h.host.shadowRoot.querySelector('[data-tour="tags"]');
    const canvases = [...h.host.shadowRoot.querySelectorAll('.canvas-host canvas')].filter(c => c.style.display !== 'none');
    return app.tour.index === 1 && app.state.tab === 'tools' && app.state.selection === 'tools-f10' && canvases.length === 1 &&
      tags.textContent === 'tool' && Math.abs(spot.top - tags.getBoundingClientRect().top) < 12;
  }), 'chapter 2 opens Feature05Tools.p.json and points at the tag "tool" of a start element');
  await shot(page, '52-f05-tool-tag');
  await resume(page);
  await atNote(page, 'input');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('[data-tour="params"]').textContent.includes('currencyStringISO 4217 currency code of the invoice') &&
    h.host.shadowRoot.querySelector('[data-tour="signature"] input').value === 'calculateEffectiveTaxRate'), 'the Start tab shows signature, parameter and its description');
  await resume(page);
  await atNote(page, 'implementation');
  check(await withApp(page, (app, h) => app.state.selection === 'tools-f13' && h.host.shadowRoot.querySelector('[data-tour="code"] textarea').value.includes('in.taxRate = "8%";') &&
    !h.host.shadowRoot.querySelector('[data-tour="code"] .field-msg').textContent), 'the Script of the tool is shown and raises no error');
  await shot(page, '53-f05-tool-script');
  await resume(page);
  await atNote(page, 'called');
  check(await withApp(page, (app, h) => app.state.tab === 'tools' && app.runner.running && app.visual.toolActive === 'tools-f10' && app.visual.active === 'f5' &&
    h.host.shadowRoot.querySelector('.tour-note-text').textContent.startsWith('The model passed JPY.')), 'then the agent calls the tool: the run is followed into the tools file');
  await shot(page, '54-f05-inside-the-tool');
  await resume(page);
  await atNote(page, 'returned');
  check(await withApp(page, app => app.tour.current.quote === '{ "taxRate" : "8%" }' && app.visual.executed['tools-f11'] === 1), 'and out again with the result');
  await resume(page);

  await atNote(page, 'object');
  check(await withApp(page, (app, h) => app.tour.index === 2 && [...h.host.shadowRoot.querySelectorAll('[data-field="invoiceDecision"] .data-object tr')].map(r => r.textContent).join('|') === 'approverUsernameStringbob.smith|effectiveTaxRateString8%|isAutoApproveBooleanfalse'), 'chapter 3: in.invoiceDecision holds the three fields');
  await resume(page);
  await atNote(page, 'gateway');
  check(await withApp(page, (app, h) => app.state.selection === 'fG' && h.host.shadowRoot.querySelector('[data-tour="conditions"]').textContent.includes('Manager Reviewin.invoiceDecision.isAutoApprove == false')), 'the gateway\'s condition is shown');
  await shot(page, '55-f05-gateway');
  await resume(page);
  await atNote(page, 'review');
  check(await withApp(page, (app, h) => app.state.status === 'waiting-user' && app.visual.active === 'f8' && h.host.shadowRoot.querySelector('.tour-note-text').textContent.includes('bob.smith')), 'the process waits at Manager Review, assigned to bob.smith');
  await shot(page, '56-f05-manager-review');
  await resume(page);

  await atNote(page, 'rename');
  await withApp(page, app => {
    app.memo.typed = [];
    app.memo.off = app.events.on(e => { if (e.type === 'config' && e.key === 'signature') app.memo.typed.push(e.element.config.signature); });
  });
  await resume(page);
  await atNote(page, 'renamed');
  check(await withApp(page, app => { app.memo.off(); return app.tour.index === 3 && app.memo.typed.length >= 9 && app.memo.typed[0] === 'calculateEffectivTaxRate' && app.model.elements.find(e => e.id === 'tools-f10').config.signature === 'calculateTaxRate'; }), 'chapter 4: the signature is renamed, letter by letter');
  await resume(page);
  await atNote(page, 'dropped');
  check(await withApp(page, app => app.tour.current.quote.map(l => l.text).join('|') === 'lookupApprovalPolicy|chooseApprover' && !app.panel.logs.some(l => l.level === 'error' || l.level === 'warn')), 'only two tools reach the model, and nothing is logged about it');
  await resume(page);
  await atNote(page, 'guessed');
  check(await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('.tour-note-quote > div.wrong')].map(n => n.textContent).join('|')) === '  "effectiveTaxRate": "10%", (wrong)', 'the model guesses the tax rate, and only that line is marked');
  await shot(page, '57-f05-guessed');
  await resume(page);
  await atNote(page, 'unprompted');
  check(await withApp(page, app => { const el = app.model.elements.find(e => e.id === 'f5'); return !el.config.userConfig.system.includes('chooseApprover') && el.config.userConfig.tools.includes('chooseApprover') && app.model.elements.find(e => e.id === 'tools-f10').config.signature === 'calculateEffectiveTaxRate'; }), 'then the signature is back and the system message no longer names chooseApprover');
  await resume(page);
  await atNote(page, 'invented');
  check(await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('.tour-note-quote > div.wrong')].map(n => n.textContent).join('|') === '  "approverUsername": "finance.manager", (wrong)' && app.panel.call.steps.length === 2), 'the tool is never called and the approver is made up');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['waiting-user', 'completed', 'failed'], 90000);
  await settle(page, 400);
  check(await withApp(page, (app, h) => app.state.status === 'waiting-user' && h.host.shadowRoot.querySelector('.run-status').textContent.includes('bob.smith') && app.data.invoiceDecision.effectiveTaxRate === '8%'), 'a run in the simulator stops at Manager Review for bob.smith');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => {
    const root = h.host.shadowRoot;
    return root.querySelectorAll('.msg.tools .tool-spec').length === 3 && root.querySelectorAll('.msg.toolcall').length === 3 &&
      [...root.querySelectorAll('.msg.tool .msg-text')].map(n => n.textContent.replace(/\s+/g, ' ')).join('|') === '{ "taxRate" : "8%" }|{ "policy" : "REQUIRES_APPROVAL" }|{ "approver" : "bob.smith" }';
  }), 'the Agent conversation lists the tools, the three calls and their results');
  await shot(page, '58-f05-conversation');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  check(await withApp(page, app => app.state.status === 'completed' && app.visual.executed.f9 === 1 && !app.visual.executed.f1), 'Continue finishes the process at "Reviewed"');
  await clickInApp(page, '.tab[data-tab="tools"]');
  await settle(page, 400);
  const startAt = await withApp(page, app => app.stages.tools.worldToClient(96, 320));
  await page.mouse.click(startAt.x, startAt.y);
  await settle(page);
  check(await withApp(page, (app, h) => app.state.selection === 'tools-f20' && h.host.shadowRoot.querySelector('.inscription-title').textContent === 'Sub Start - chooseApprover(String)' && app.visual.executed['tools-f23'] === 1), 'the tools file can be opened and its elements selected; they show that they ran');
  await shot(page, '59-f05-tools-file');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(fifth.problems.length === 0, 'no console errors or warnings' + (fifth.problems.length ? ': ' + fifth.problems.slice(0, 4).join(' | ') : ''));
  check(fifth.external.length === 0, 'no request leaves the page (offline-ready)' + (fifth.external.length ? ': ' + fifth.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── Feature 06: Java tools ─────────────────────────────────────────────────
  console.log('\nFeature 06: Java Tools');
  const sixth = await openGuide();
  page = sixth.page;
  const FX_SUMMARY = 'Invoice INV-2024-00123 from Acme Supplies Ltd. totals JPY 10,560.00, which is equivalent to approximately 70.75 USD at a rate of 0.0067.';
  await showFeaturePage(page, '06');
  await openWalkthrough(page);
  check(await withApp(page, (app, h) => app.def.id === 'feature-06' &&
    [...h.host.shadowRoot.querySelectorAll('.tab')].map(n => n.textContent).join('|') === 'Feature06.p.json|FxRateConverterTool.java|TutorialToolProvider.java|SmartWorkflowToolsProvider|variables.yaml'), 'the process and the three source files of the Java tool each have a tab');
  await withApp(page, app => { app.tour.start(0); });
  await atTitle(page, 'implement');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-title').textContent) === 'Step 1 — Implement SmartWorkflowTool', 'the first title screen is "Step 1 — Implement SmartWorkflowTool"');
  await resume(page);
  await atNote(page, 'name');
  check(await withApp(page, (app, h) => {
    const code = app.sourceCode.tool;
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const outer = code.getBoundingClientRect();
    const line = code.textarea.value.split('\n').findIndex(l => l.includes('return "convertToUSD";'));
    return app.state.tab === 'src:tool' && code.textarea.readOnly && line > 10 && spot.height < 30 && spot.top > outer.top && spot.bottom < outer.bottom &&
      h.host.shadowRoot.querySelector('.editor-source:not([hidden]) .tk-key') !== null;
  }), 'chapter 1 shows FxRateConverterTool.java, highlighted and read-only, with the spotlight on the line of name()');
  await shot(page, '60-f06-java-source');
  await resume(page);
  await atNote(page, 'spi');
  check(await withApp(page, app => app.state.tab === 'src:spi' && app.sourceText.spi.trim() === 'tutorial.tool.TutorialToolProvider' && !app.sourceCode.spi.textarea.readOnly), 'chapter 3 shows the SPI file with the provider class');
  await resume(page);
  await atNote(page, 'selected');
  check(await withApp(page, (app, h) => app.state.tab === 'process' && h.host.shadowRoot.querySelector('[data-tour="tools"] .select-chips').textContent.replace(/^\S+ /, '') === 'convertToUSD'), 'chapter 4: the agent has convertToUSD selected');
  await resume(page);
  await atNote(page, 'asks');
  check(await withApp(page, app => app.tour.current.quote) === 'convertToUSD(amount: "10560.00", currency: "JPY")', 'the model asks for convertToUSD with amount and currency');
  await resume(page);
  await atNote(page, 'computed');
  check(await withApp(page, app => app.tour.current.quote) === '10560.00 JPY = 70.75 USD (rate: 0.0067)', 'the tool returns the line that the Java method formats');
  await shot(page, '61-f06-tool-result');
  await resume(page);
  await atNote(page, 'summary');
  check(await withApp(page, app => app.tour.current.quote) === FX_SUMMARY, 'and the summary carries the USD amount and the rate');
  await resume(page);
  await atNote(page, 'unregistered');
  check(await withApp(page, app => app.tour.index === 4 && app.state.tab === 'src:spi' && app.sourceText.spi === '' && app.javaTools().length === 0), 'chapter 5: the SPI file is emptied and the tool is no longer registered');
  await shot(page, '62-f06-spi-empty');
  await resume(page);
  await atNote(page, 'unknown');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('[data-tour="tools"] .select-chips').textContent === 'convertToUSD' && !h.host.shadowRoot.querySelector('[data-tour="tools"] .field-msg').textContent), 'the agent still shows the name, without any warning');
  await resume(page);
  await atNote(page, 'cannot');
  check(await withApp(page, app => app.panel.call.tools.length === 0 && app.panel.call.steps.length === 0 && /I could not convert the amount to USD/.test(app.tour.current.quote)), 'no tool goes with the request, and the model cannot convert');
  await resume(page);
  await atNote(page, 'same');
  check(await withApp(page, app => !app.model.elements.find(e => e.id === 'f5').config.userConfig.tools && app.javaTools().length === 1 && /I could not convert/.test(app.tour.current.quote)), 'the same happens when the tool is registered but not selected');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 400);
  check(await withApp(page, app => app.state.status === 'completed' && app.data.summary) === FX_SUMMARY, 'a run in the simulator converts the amount again');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.msg.tools .tool-spec code').textContent === 'convertToUSD(amount: String, currency: String)' && h.host.shadowRoot.querySelector('.msg.tool .msg-text').textContent === '10560.00 JPY = 70.75 USD (rate: 0.0067)'), 'the Agent conversation shows the Java tool, its call and its result');
  await shot(page, '63-f06-conversation');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(sixth.problems.length === 0, 'no console errors or warnings' + (sixth.problems.length ? ': ' + sixth.problems.slice(0, 4).join(' | ') : ''));
  check(sixth.external.length === 0, 'no request leaves the page (offline-ready)' + (sixth.external.length ? ': ' + sixth.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── Feature 07: web search tool ────────────────────────────────────────────
  console.log('\nFeature 07: Web Search Tool');
  const seventh = await openGuide();
  page = seventh.page;
  await showFeaturePage(page, '07');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-07' && app.javaTools().map(t => t.name).join() === 'webSearch' && /WhitelistDomains: ""/.test(app.variablesText)), 'the real Feature07 process is loaded, with the built-in webSearch tool and its variables');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'selected');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('[data-tour="tools"] .select-chips').textContent.replace(/^\S+ /, '') === 'webSearch'), 'chapter 1: the agent has webSearch selected');
  await resume(page);
  await atNote(page, 'searches');
  check(await withApp(page, app => app.tour.index === 1 && app.tour.current.quote) === 'webSearch(query: "What are the latest features in Axon Ivy 14?")', 'chapter 2: the model searches for the user\'s question');
  await resume(page);
  await atNote(page, 'results');
  check(await withApp(page, app => app.tour.current.quote.map(l => l.text).join('|')) === 'https://developer.axonivy.com/release-notes/14.0|https://blog.example.com/axon-ivy-14-first-look|https://forum.example.org/t/axon-ivy-14', 'three results come back');
  await shot(page, '70-f07-results');
  await resume(page);
  await atNote(page, 'answer');
  check(await withApp(page, app => /^Axon Ivy 14 introduces Smart Workflow/.test(app.tour.current.quote) && app.panel.call.answer.endsWith('Source: https://developer.axonivy.com/release-notes/14.0')), 'the answer is the tutorial\'s example output, with its source');
  await resume(page);
  await atNote(page, 'trusted');
  check(await withApp(page, app => app.state.tab === 'variables' && /WhitelistDomains: "developer\.axonivy\.com"/.test(app.variablesText)), 'chapter 3 types a whitelist into variables.yaml');
  await shot(page, '71-f07-whitelist');
  await resume(page);
  await atNote(page, 'filtered');
  check(await withApp(page, app => app.tour.current.quote.map(l => l.text).join('|')) === 'https://developer.axonivy.com/release-notes/14.0', 'and only the result from that domain reaches the model');
  await resume(page);
  await atNote(page, 'ignored');
  check(await withApp(page, app => app.tour.index === 3 && app.panel.call.steps.length === 0 && app.panel.call.tools.length === 1 && /^I do not have current information/.test(app.tour.current.quote)), 'chapter 4: without the instruction the model does not search');
  await resume(page);
  await atNote(page, 'excluded');
  check(await withApp(page, app => app.tour.current.quote) === 'All 3 result(s) were excluded by the configured domain whitelist.', 'a whitelist nothing passes returns no results and says why');
  await resume(page);
  await atNote(page, 'empty');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 400);
  check(await withApp(page, app => app.state.status === 'completed' && /Source: https:\/\/developer\.axonivy\.com\/release-notes\/14\.0$/.test(app.data.searchResult) && /WhitelistDomains: ""/.test(app.variablesText)), 'a run in the simulator searches again, with the original variables');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.msg.tool .msg-text').textContent.includes('"url" : "https://blog.example.com/axon-ivy-14-first-look"')), 'the Agent conversation shows the search result as JSON');
  await shot(page, '72-f07-conversation');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(seventh.problems.length === 0, 'no console errors or warnings' + (seventh.problems.length ? ': ' + seventh.problems.slice(0, 4).join(' | ') : ''));
  check(seventh.external.length === 0, 'no request leaves the page (offline-ready)' + (seventh.external.length ? ': ' + seventh.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── Feature 08: observability, with a stand-in for Arize Phoenix ───────────
  console.log('\nFeature 08: Observability');
  const observed = await openGuide();
  page = observed.page;
  await showFeaturePage(page, '08');
  await openWalkthrough(page);
  const px = (fn, ...args) => withApp(page, (app, h, ...rest) => {
    const root = h.host.shadowRoot;
    const rows = [...root.querySelectorAll('.px-table tr.row')].map(r => r.children[2].textContent);
    return (new Function('app', 'root', 'rows', 'view', 'args', 'return (' + rest[0] + ')(app, root, rows, view, ...args)'))(app, root, rows, app.views.phoenix, rest.slice(1));
  }, fn.toString(), ...args);
  check(await withApp(page, (app, h) => app.def.id === 'feature-08' && Boolean(app.views.phoenix) &&
    ['view:settings', 'variables', 'view:phoenix'].every(id => h.host.shadowRoot.querySelector('.tab[data-tab="' + id + '"]')) &&
    app.model.elements.some(e => e.isAgent && e.name === 'Invoice Approval Agent')), 'the lesson runs Feature05 and brings the Designer Settings and a Phoenix tab');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'phoenix');
  check(await px((app, root, rows, view) => app.state.tab === 'view:phoenix' && view.spans().length === 0 && Boolean(root.querySelector('.px-empty'))), 'chapter 1: Phoenix is empty before anything is set up');
  await shot(page, '88-f08-empty');
  await resume(page);
  await atNote(page, 'settings');
  check(await withApp(page, (app, h) => app.state.tab === 'view:settings' && /Vm Args/.test(h.host.shadowRoot.querySelector('.st-item.focus').textContent)), 'Step 2 opens the Settings of the Axon Ivy PRO Designer 14 at Engine: Vm Args');
  await resume(page);
  await atNote(page, 'optExporter');
  check(await withApp(page, (app, h) => {
    const field = h.host.shadowRoot.querySelector('.st-item.focus textarea');
    return / -Dotel\.exporter\.otlp\.endpoint=http:\/\/localhost:6006 /.test(app.views.settings.value()) && field.value === app.views.settings.value() && field.scrollHeight <= field.clientHeight + 2;
  }), 'the -Dotel… options are typed into Vm Args, and the whole value is visible');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const option = app.views.settings.rect('opt:otel.traces.exporter').getBoundingClientRect();
    const field = h.host.shadowRoot.querySelector('.st-item.focus textarea').getBoundingClientRect();
    return option.width > 0 && option.width < field.width && spot.width < field.width && Math.abs(spot.left - option.left) < 12;
  }), 'the first note points at that one option, not at the whole field');
  await shot(page, '88a-f08-vm-args');
  await resume(page);
  await atNote(page, 'optEndpoint');
  await resume(page);
  await atNote(page, 'optProject');
  await shot(page, '88b-f08-vm-args-project');
  await resume(page);
  await atNote(page, 'reload');
  await resume(page);
  await atNote(page, 'engine');
  await resume(page);
  await atNote(page, 'enable');
  check(await withApp(page, app => /Openinference:\n\s+Enabled: "true"/.test(app.variablesText)), 'and the export is switched on in variables.yaml');
  await resume(page);
  await atNote(page, 'arrived');
  check(await px((app, root, rows, view) => view.spans().some(s => s.name === 'AI Agent') && rows.includes('HTTP/1.1 GET') && rows.some(r => r.startsWith('Background Job')) && !rows.includes('AI Assistant')),
    'after a run the traces arrive; Root Spans lists only the HTTP request and the background jobs');
  await shot(page, '89-f08-arrived');
  await resume(page);
  await atNote(page, 'noRoots');
  check(await px((app, root, rows, view) => view.state.filter === "span_kind == 'LLM'" && rows.length === 0 && Boolean(root.querySelector('.px-empty .px-hint'))), 'chapter 2: span_kind == \'LLM\' under Root Spans finds nothing, and says why');
  await resume(page);
  await atNote(page, 'all');
  check(await px((app, root, rows) => rows.length === 4 && rows.every(r => r === 'AI Assistant')), 'with All the four calls to the model are listed');
  await shot(page, '90-f08-llm-all');
  await resume(page);
  await atNote(page, 'tree');
  check(await px((app, root) => {
    const names = [...root.querySelectorAll('.px-node .lbl')].map(n => n.textContent);
    return ['HTTP/1.1 GET', 'HttpProcessRequest', 'AI Agent', 'CircuitBreakerGuardrail', 'AI Assistant', 'Tool', 'Rest Client langChain'].every(n => names.includes(n)) && names.filter(n => n === 'Tool').length === 3;
  }), 'the trace tree: HTTP request, agent, guardrails, model calls and three tools');
  await shot(page, '91-f08-trace');
  await resume(page);
  await atNote(page, 'messages');
  check(await px((app, root) => /UserMessage \{ name = null, contents = \[TextContent/.test(root.querySelector('.px-span').textContent) && /gpt-4\.1-mini/.test(root.querySelector('.px-span').textContent)), 'the LLM span shows the model and the messages as langchain4j prints them');
  await resume(page);
  await atNote(page, 'tool');
  check(await px((app, root, rows, view) => view.current().kind === 'tool' && root.querySelector('.px-span').textContent.includes(view.current().attributes['tool.name'])), 'a Tool span holds the arguments and the result');
  await shot(page, '92-f08-tool');
  await resume(page);
  await atNote(page, 'noParams');
  check(await px((app, root) => /"temperature": 0\.0/.test(root.querySelector('.px-span').textContent)), 'chapter 3: without a temperature on the agent, the default 0.0 was sent');
  await resume(page);
  await atNote(page, 'params');
  check(await px((app, root, rows, view) => view.current().attributes['llm.invocation_parameters'] === '{"temperature":0.2}' && /"temperature": 0\.2/.test(root.querySelector('.px-span').textContent)), 'with 0.2 on the agent the new call shows it');
  await shot(page, '93-f08-params');
  await resume(page);
  await atNote(page, 'hidden');
  check(await px((app, root, rows, view) => !Object.keys(view.current().attributes).some(k => k.startsWith('llm.input_messages')) && root.querySelectorAll('.px-span .px-none').length >= 2), 'chapter 4: with the Hide… variables the span has no messages');
  await shot(page, '94-f08-hidden');
  await resume(page);
  await atNote(page, 'kept');
  check(await px((app, root) => /token_count/.test(root.querySelector('.px-attrs').textContent) && /ivy/.test(root.querySelector('.px-attrs').textContent)), 'but its token counts and Ivy ids are still there');
  await shot(page, '95-f08-kept');
  await resume(page);
  await atNote(page, 'guardrailSpans');
  check(await px((app, root, rows) => rows.slice().sort().join('|') === 'CircuitBreakerGuardrail|CircuitBreakerGuardrail|SensitiveDataOutputGuardrail'), 'chapter 5: one span per guardrail evaluation, the internal circuit breaker included');
  await shot(page, '96-f08-guardrails');
  await resume(page);
  await atNote(page, 'guardrailInfo');
  check(await px((app, root) => /SUCCESS/.test(root.querySelector('.px-span').textContent) && /OUTPUT/.test(root.querySelector('.px-span').textContent)), 'the guardrail span names its type and result');
  await shot(page, '97-f08-guardrail');
  await resume(page);
  await atNote(page, 'nothing');
  check(await px((app, root, rows, view) => view.spans().length === 0 && /Vm Args/.test(root.querySelector('.px-hint').textContent)), 'chapter 6: the variable alone sends nothing');
  await resume(page);
  await atNote(page, 'noAi');
  check(await px((app, root, rows, view) => view.spans().length > 0 && view.spans().every(s => s.kind === 'unknown') && rows.includes('HTTP/1.1 GET')), 'the Vm Args alone send only the engine\'s spans');
  await shot(page, '98-f08-no-ai');
  await resume(page);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(observed.problems.length === 0, 'no console errors or warnings' + (observed.problems.length ? ': ' + observed.problems.slice(0, 4).join(' | ') : ''));
  check(observed.external.length === 0, 'no request leaves the page (offline-ready)' + (observed.external.length ? ': ' + observed.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── Features 09 to 11: guardrails ──────────────────────────────────────────
  console.log('\nFeature 09: Output Guardrail');
  const guards = await openGuide();
  page = guards.page;
  const OUTPUT_VIOLATION = 'The guardrail com.axonivy.utils.smart.workflow.guardrails.adapter.OutputGuardrailAdapter failed with this message: The AI response was blocked because it contains sensitive data such as API keys or private keys';
  await showFeaturePage(page, '09');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-09' && app.model.elements.find(e => e.id === 'fE').attachedTo === 'f5'), 'the real Feature09 process is loaded, with the Error Boundary Event on its agent');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'guardrail');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('[data-tour="outputGuardrails"] .select-chips').textContent.includes('SensitiveDataOutputGuardrail')), 'chapter 1: the agent has SensitiveDataOutputGuardrail as output guardrail');
  await resume(page);
  await atNote(page, 'inspects');
  check(await withApp(page, app => app.tour.current.quote) === 'sk-proj-4f8Kq2ZtY7mN1xLb9RcV3wHs6Jd0PaEu', 'the guardrail finds the key in the model\'s answer');
  await shot(page, '80-f09-guardrail-finds-key');
  await resume(page);
  await atNote(page, 'blocked');
  check(await withApp(page, app => app.panel.call.status === 'blocked' && app.data.result === undefined), 'the answer is blocked and never mapped');
  await resume(page);
  await atNote(page, 'code');
  check(await withApp(page, (app, h) => app.tour.index === 1 && app.state.selection === 'fE' && h.host.shadowRoot.querySelector('.inscription-title').textContent === 'Error Boundary - Guardrail blocked' &&
    h.host.shadowRoot.querySelector('[data-tour="errorCode"] input').value === 'smartworkflow:guardrail:output:violation'), 'chapter 2 opens the boundary event with its error code');
  await resume(page);
  await atNote(page, 'caught');
  check(await withApp(page, app => app.visual.active === 'fE' && app.visual.error === 'f5' && app.runner.running), 'the event catches the error and the run goes on from it');
  await shot(page, '81-f09-error-caught');
  await resume(page);
  await atNote(page, 'log');
  check(await withApp(page, app => app.panel.logs[app.panel.logs.length - 1].message) === 'Blocked by guardrail: ' + OUTPUT_VIOLATION, 'chapter 3: the script logs the reason of the violation');
  await resume(page);
  await atNote(page, 'unhandled');
  check(await withApp(page, app => app.tour.index === 3 && app.state.status === 'failed' && app.model.elements.find(e => e.id === 'fE').config.errorCode === 'smartworkflow:guardrail:input:violation'), 'chapter 4: with the wrong code on the event the process fails at the agent');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 400);
  check(await withApp(page, app => app.state.status === 'completed' && app.data.result === 'Blocked by guardrail: ' + app.panel.call.error && app.visual.executed.fC === 1), 'a run in the simulator ends on the handled path');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => { const root = h.host.shadowRoot; return Boolean(root.querySelector('.msg.discarded')) && root.querySelector('.guard.bad').textContent.includes('SensitiveDataOutputGuardrail blocked:') && root.querySelector('.chat-note.error').textContent.includes('failed with this message'); }), 'the Agent conversation shows the discarded answer, the guardrail and the error');
  await shot(page, '82-f09-conversation');
  await page.keyboard.press('Escape');
  await settle(page, 300);

  console.log('\nFeature 10: Input Guardrail');
  await showFeaturePage(page, '10');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-10' && app.model.elements.filter(e => e.type === 'RequestStart').length === 2), 'the real Feature10 process with its two flows is loaded');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'leak');
  check(await withApp(page, (app, h) => !app.model.elements.find(e => e.id === 'f5').config.userConfig.inputGuardrails && h.host.shadowRoot.querySelectorAll('.tour-note-quote > div.wrong').length === 2 &&
    app.panel.call.answer.includes('My system prompt is: "You are a helpful customer support agent."')), 'chapter 1: without the guardrail the model reveals its system prompt');
  await resume(page);
  await atNote(page, 'matched');
  check(await withApp(page, app => app.tour.index === 1 && app.tour.current.quote === 'System:' && app.stage.view.tilt === 0), 'chapter 2: the regex guardrail matches a pattern before anything is sent');
  await shot(page, '83-f10-regex');
  await resume(page);
  await atNote(page, 'never');
  check(await withApp(page, app => app.panel.call.status === 'blocked' && app.panel.call.answer === undefined && !app.panel.logs.some(l => /REST service/.test(l.message))), 'no model call was made');
  await resume(page);
  await atNote(page, 'extraCall');
  check(await withApp(page, app => { const a = app.stage.effects.agent; return app.tour.index === 2 && a && a.el.id === 'f15' && /guardrail classifier/.test(a.card.data.subtitle) &&
    app.panel.call && !app.panel.call.answer && app.panel.call.guardrails.some(g => g.classifier) && app.panel.logs.filter(l => /REST service/.test(l.message)).length === 1; }), 'chapter 3: the classifier makes its own round trip to the provider before the agent call');
  await shot(page, '84a-f10-extra-call');
  await resume(page);
  await atNote(page, 'classified');
  check(await withApp(page, (app, h) => app.tour.index === 2 && app.visual.active === 'f15' && h.host.shadowRoot.querySelector('.tour-note-title').textContent === 'The classifier says YES' &&
    app.panel.logs.filter(l => /REST service/.test(l.message)).length === 1), 'chapter 3 runs the second flow: the classifier call answers YES');
  await shot(page, '84-f10-classifier');
  await resume(page);
  await atNote(page, 'unhandled');
  check(await withApp(page, app => app.tour.index === 3 && app.state.status === 'failed' && app.visual.error === 'f5'), 'chapter 4: an event with the output code does not catch the input violation');
  await resume(page);
  await atNote(page, 'benign');
  check(await withApp(page, (app, h) => h.host.shadowRoot.querySelector('.tour-note-title').textContent === 'The classifier says NO' && app.data.query === 'Please act as a patient teacher and explain your refund policy.'), 'a harmless role passes the classifier');
  await resume(page);
  await atNote(page, 'served');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await withApp(page, app => { app.select('f10'); });
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 400);
  check(await withApp(page, app => app.state.status === 'completed' && app.visual.executed.fC2 === 1 && !app.visual.executed.fC), 'in the simulator, Run starts at the selected start: the second flow');
  await page.keyboard.press('Escape');
  await settle(page, 300);

  console.log('\nFeature 11: PII Masking Guardrail');
  await showFeaturePage(page, '11');
  await openWalkthrough(page);
  const PII = ['00:1A:2B:3C:4D:5E', 'john.doe@example.com', '+1-555-123-4567', '4532015112830366', '123-45-6789', '15/06/1990', '192.168.1.42'];
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'output');
  check(await withApp(page, (app, h) => app.def.id === 'feature-11' && ['inputGuardrails', 'outputGuardrails'].every(name => h.host.shadowRoot.querySelector('[data-tour="' + name + '"] .select-chips').textContent.includes('PiiMaskingGuardrail'))), 'chapter 1: PiiMaskingGuardrail is in both lists');
  await resume(page);
  await atNote(page, 'masked');
  check(await withApp(page, (app, h, values) => app.tour.index === 2 && values.every(v => !app.tour.current.quote.includes(v)) && /<EMAIL_[0-9a-f]{12}>/.test(app.tour.current.quote), PII), 'chapter 3: the message is masked, no personal value is left in it');
  await shot(page, '85-f11-masked');
  await resume(page);
  await atNote(page, 'sent');
  check(await withApp(page, (app, h, values) => values.every(v => !app.panel.call.user.includes(v) && app.panel.call.userOriginal.includes(v)), PII), 'what goes to the model contains only placeholders');
  await resume(page);
  await atNote(page, 'restored');
  check(await withApp(page, app => app.tour.index === 3 && app.tour.current.quote.map(l => l.text).join('\n')) === 'MAC: 00:1A:2B:3C:4D:5E\nEmail: john.doe@example.com\nPhone: +1-555-123-4567\nCard: 4532015112830366\nSSN: 123-45-6789\nBorn: 15/06/1990\nIP: 192.168.1.42', 'chapter 4: the output guardrail restores the seven values');
  await resume(page);
  await atNote(page, 'placeholders');
  check(await withApp(page, (app, h) => app.tour.index === 4 && h.host.shadowRoot.querySelectorAll('.tour-note-quote > div.wrong').length === 7), 'chapter 5: registered in input only, every line keeps its placeholder');
  await resume(page);
  await atNote(page, 'paraphrased');
  check(await withApp(page, app => app.data.result.split('\n')[1] === 'Email: (an anonymised email)'), 'without the system message the reworded placeholders cannot be restored');
  await shot(page, '86-f11-paraphrased');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 400);
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => { const root = h.host.shadowRoot; return app.data.result.startsWith('MAC: 00:1A:2B:3C:4D:5E') && Boolean(root.querySelector('.msg.user.before')) && Boolean(root.querySelector('.msg.assistant.before')) &&
    [...root.querySelectorAll('.guard.ok')].map(n => n.textContent.replace(/\s+/g, ' ').trim()).join('|') === 'PiiMaskingGuardrail replaced 7 value(s) by placeholders|PiiMaskingGuardrail put 7 original value(s) back'; }), 'the Agent conversation shows the message before and after masking, and the answer before and after restoring');
  await shot(page, '87-f11-conversation');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(guards.problems.length === 0, 'no console errors or warnings' + (guards.problems.length ? ': ' + guards.problems.slice(0, 4).join(' | ') : ''));
  check(guards.external.length === 0, 'no request leaves the page (offline-ready)' + (guards.external.length ? ': ' + guards.external.slice(0, 3).join(', ') : ''));
  await page.close();

  // ── Feature 12: conversation memory ────────────────────────────────────────
  console.log('\nFeature 12: Conversation Memory');
  const twelfth = await openGuide();
  page = twelfth.page;
  await showFeaturePage(page, '12');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-12' && app.def.file === 'Feature13.p.json' && app.model.dataClass.fields.some(f => f.name === 'aiMemoryId')), 'the lesson runs the Feature13 process, whose data class has aiMemoryId');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'named');
  check(await withApp(page, (app, h) => { const row = h.host.shadowRoot.querySelector('[data-field="aiMemoryId"]'); const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect(); return Boolean(row) && Math.abs(spot.top - row.getBoundingClientRect().top) < 14; }), 'chapter 1 points at the field in the Process data view');
  await resume(page);
  await atNote(page, 'written');
  check(await withApp(page, app => app.tour.index === 1 && /^[0-9a-f-]{36}$/.test(app.data.aiMemoryId)), 'chapter 2: when the agent is suspended the field holds an id');
  await resume(page);
  await atNote(page, 'traceStart');
  check(await withApp(page, app => app.tour.index === 2 && !app.data.aiMemoryId), 'chapter 3 traces the id: empty at the start');
  await resume(page);
  await atNote(page, 'traceSuspended');
  const tracedId = await withApp(page, app => app.data.aiMemoryId);
  check(/^[0-9a-f-]{36}$/.test(tracedId) && await withApp(page, (app, h, id) => h.host.shadowRoot.querySelector('.tour-note-text').textContent.includes(id), tracedId), 'set while the agent is suspended, and named in the note');
  await shot(page, '96-f12-memory-id');
  await resume(page);
  await atNote(page, 'traceResumed');
  check(await withApp(page, (app, h, id) => app.panel.call.restored && app.panel.call.memoryId === id && app.data.aiMemoryId === id, tracedId), 'the agent goes on with the conversation stored under that id');
  await resume(page);
  await atNote(page, 'traceCleared');
  check(await withApp(page, app => app.data.aiMemoryId === ''), 'and the field is empty again when the agent has finished');
  await resume(page);
  await atNote(page, 'forgotten');
  check(await withApp(page, (app, h) => app.tour.index === 3 && app.model.elements.find(e => e.id === 'f26').config.output.code.endsWith('in.aiMemoryId = "";') && app.visual.executed.f26 === 1 &&
    Boolean(h.host.shadowRoot.querySelector('.task-dialog')) && app.panel.call.restored !== true), 'chapter 4: with the id cleared the agent asks its question a second time');
  await shot(page, '97-f12-forgotten');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(twelfth.problems.length === 0, 'no console errors or warnings' + (twelfth.problems.length ? ': ' + twelfth.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

  // ── Feature 13: human in the loop ──────────────────────────────────────────
  console.log('\nFeature 13: Human in the Loop');
  const thirteenth = await openGuide();
  page = thirteenth.page;
  const QUESTION = 'Invoice INV-2025-0892 from Apex Solutions Ltd. totals $12,500 USD, which is above $2,000. What is your justification reason for approving it?';
  await showFeaturePage(page, '13');
  await openWalkthrough(page);
  check(await withApp(page, (app, h) => app.def.id === 'feature-13' && app.model.docs.map(d => d.file).join('|') === 'Feature13.p.json|Feature13Tools.p.json' && app.model.elements.find(e => e.id === 'f26').kind === 'usertask'), 'the real Feature13 process and its tools file are loaded');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'memoryField');
  check(await withApp(page, (app, h) => Boolean(h.host.shadowRoot.querySelector('[data-field="aiMemoryId"]')) && !app.data.aiMemoryId), 'chapter 1 points at the field aiMemoryId, which is still empty');
  await resume(page);
  await atNote(page, 'throws');
  check(await withApp(page, (app, h) => app.tour.index === 1 && app.state.tab === 'tools' && app.state.selection === 'tools-f32' && h.host.shadowRoot.querySelector('[data-tour="throws"] input').value === 'human:decision'), 'chapter 2: the tool ends in an Error End that throws human:decision');
  await resume(page);
  await atNote(page, 'boundaryMap');
  check(await withApp(page, (app, h) => app.tour.index === 2 && app.state.selection === 'f32' && h.host.shadowRoot.querySelector('[data-tour="outputMap"]').textContent.includes('out.decisionerror.getAttribute("decision") as tutorial.HumanFeedback')), 'chapter 3: the boundary event maps the question from the error into the process data');
  await resume(page);
  await atNote(page, 'asks');
  check(await withApp(page, (app, q) => app.tour.index === 3 && app.tour.current.quote === q, QUESTION) || await withApp(page, (app, h, q) => app.tour.current.quote === q, QUESTION), 'chapter 4: the model calls askUserFeedback with its question');
  await resume(page);
  await atNote(page, 'idWritten');
  check(await withApp(page, app => app.panel.call.status === 'suspended' && /^[0-9a-f-]{36}$/.test(app.data.aiMemoryId) && app.data.aiMemoryId === app.panel.call.memoryId), 'the agent is suspended and the memory id is written to in.aiMemoryId');
  await resume(page);
  await atNote(page, 'dialogOpen');
  check(await withApp(page, (app, h, q) => {
    const box = h.host.shadowRoot.querySelector('.task-dialog');
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    return Boolean(box) && app.state.status === 'dialog' && app.visual.active === 'f26' && box.querySelector('.task-dialog-question').textContent === q &&
      box.querySelector('.task-dialog-head').textContent === 'Provide feedback for Invoice Approval Agent' && Math.abs(spot.top - box.getBoundingClientRect().top) < 12;
  }, QUESTION), 'the user task opens a dialog with the question of the agent');
  await shot(page, '93-f13-user-dialog');
  await resume(page);
  await atNote(page, 'resolved');
  check(await withApp(page, (app, h) => app.tour.index === 4 && !h.host.shadowRoot.querySelector('.task-dialog') && app.data.result === 'Cloud capacity for the Q3 product launch; budget approved by the CFO.' && app.state.selection === 'f26'), 'chapter 5: the answer is typed and submitted; the output code of the task is shown');
  await resume(page);
  await atNote(page, 'resumes');
  check(await withApp(page, app => app.panel.call.restored === true && app.panel.call.continuation === 'continue with my selection from the tool' && app.panel.call.steps[0].human === true), 'the agent runs again and takes up the stored conversation');
  await shot(page, '94-f13-agent-resumes');
  await resume(page);
  await atNote(page, 'confirmed');
  check(await withApp(page, app => app.tour.current.quote) === 'Invoice INV-2025-0892 from Apex Solutions Ltd. for $12,500 USD is approved. An approval task will be created with the justification reason: "Cloud capacity for the Q3 product launch; budget approved by the CFO."', 'and confirms the approval with the reason of the person');
  await resume(page);
  await atNote(page, 'approvalTask');
  check(await withApp(page, (app, h) => app.data.aiMemoryId === '' && h.host.shadowRoot.querySelector('.tour-note-text').textContent.includes('“Invoice INV-2025-0892 Approval”')), 'the approval task is created and the memory id is cleared');
  await resume(page);
  await atNote(page, 'auto');
  check(await withApp(page, app => app.tour.index === 5 && app.panel.call.steps.length === 0 && app.tour.current.quote.includes('approved automatically') && !app.visual.executed.f26), 'chapter 6: the invoice below the limit is approved without the tool');
  await resume(page);
  await atNote(page, 'cannotAsk');
  check(await withApp(page, app => app.tour.index === 6 && app.panel.call.tools.length === 0 && app.model.elements.find(e => e.id === 'tools-f30').tags.length === 0), 'chapter 7: without the tool tag the agent has nothing to ask with');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['dialog', 'completed', 'failed'], 90000);
  await settle(page, 300);
  check(await withApp(page, (app, h) => app.state.status === 'dialog' && document.activeElement === h.host && h.host.shadowRoot.activeElement === h.host.shadowRoot.querySelector('.task-dialog textarea')), 'a run in the simulator stops at the dialog, ready for typing');
  await page.keyboard.type('Approved by the board.');
  await clickInApp(page, '.task-dialog .run-btn');
  await waitForStatus(page, ['waiting', 'completed', 'failed'], 90000);
  await settle(page, 300);
  check(await withApp(page, app => app.state.status === 'waiting' && app.data.result.endsWith('with the justification reason: "Approved by the board."')), 'the typed answer ends up in the confirmation of the agent');
  await clickInApp(page, '.panel-tab[data-tab="chat"]');
  await settle(page);
  check(await withApp(page, (app, h) => { const root = h.host.shadowRoot; return root.querySelector('.chat-note.info').textContent.includes('stored under') && root.querySelector('.msg.tool .msg-tag').textContent === 'answered by a human' && root.querySelector('.msg.tool .msg-text').textContent === 'Approved by the board.'; }), 'the Agent conversation shows the restored conversation with the human answer');
  await shot(page, '95-f13-conversation');
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  check(await withApp(page, app => app.state.status) === 'completed', 'Continue finishes the process');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(thirteenth.problems.length === 0, 'no console errors or warnings' + (thirteenth.problems.length ? ': ' + thirteenth.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

  // ── Feature 15: circuit breaker ────────────────────────────────────────────
  console.log('\nFeature 15: Circuit Breaker');
  const fifteenth = await openGuide();
  page = fifteenth.page;
  await showFeaturePage(page, '15');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-15' && app.model.elements.filter(e => e.type === 'RequestStart').length === 3 && /Enabled: "false"/.test(app.variablesText)), 'the real Feature15 process with its three starts is loaded; the switch is off');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'normal');
  check(await withApp(page, app => app.tour.current.quote.startsWith('The invoice INV-2024-00123 from Acme Supplies Ltd.')), 'chapter 1: with the switch off the agent summarises the invoice');
  await resume(page);
  await atNote(page, 'on');
  check(await withApp(page, (app, h) => app.tour.index === 1 && app.state.tab === 'variables' && /Enabled: "true"/.test(app.variablesText) && app.visual.executed.f22 === 1 &&
    h.host.shadowRoot.querySelector('.var-effect.bad').textContent === 'Every agent call in the application is stopped.'), 'chapter 2: the script of "Stop all agents" sets the variable to "true"');
  await shot(page, '91-f15-switch-on');
  await resume(page);
  await atNote(page, 'stopCode');
  check(await withApp(page, app => app.tour.index === 2 && app.panel.call.status === 'blocked' && app.panel.call.guardrails[0].name === 'CircuitBreakerGuardrail' && app.panel.call.answer === undefined), 'chapter 3: the agent call is stopped before the model');
  await shot(page, '92-f15-stopped');
  await resume(page);
  await atNote(page, 'log');
  check(await withApp(page, app => app.tour.index === 3 && app.panel.logs.slice(-2).map(l => l.level).join() === 'warn,error' && app.panel.logs[app.panel.logs.length - 1].message === 'AI is currently unavailable - invoice routed to manual review.'), 'chapter 4: the fallback logs why, and what happens instead');
  await resume(page);
  await atNote(page, 'flag');
  check(await withApp(page, app => app.data.isStopped === true), 'and sets in.isStopped');
  await resume(page);
  await atNote(page, 'off');
  check(await withApp(page, app => app.tour.index === 4 && /Enabled: "false"/.test(app.variablesText)), 'chapter 5: "Re-enable agents" sets the variable back');
  await resume(page);
  await atNote(page, 'newRun');
  check(await withApp(page, app => app.panel.call.status === 'answered' && app.visual.executed.fC === 1), 'a new run calls the model; the stopped run was not repeated');
  await resume(page);
  await atNote(page, 'unhandled');
  check(await withApp(page, app => app.tour.index === 5 && app.state.status === 'failed' && app.visual.error === 'f5'), 'chapter 6: an event for a guardrail violation does not catch the stop');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  check(await withApp(page, app => /Enabled: "false"/.test(app.variablesText)), 'afterwards the switch is off again');
  await withApp(page, app => { app.setVariables(app.variablesText.replace('Enabled: "false"', 'Enabled: "true"')); });
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 400);
  check(await withApp(page, app => app.state.status === 'completed' && app.data.isStopped === true && app.visual.executed.fC === 1), 'in the simulator, setting the variable by hand stops the agent too');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(fifteenth.problems.length === 0, 'no console errors or warnings' + (fifteenth.problems.length ? ': ' + fifteenth.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

  // ── Feature 17: model settings ────────────────────────────────────────────
  console.log('\nFeature 17: Model Settings');
  const seventeenth = await openGuide();
  page = seventeenth.page;
  await showFeaturePage(page, '17');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'feature-17' && app.model.elements.filter(e => e.isAgent).map(e => e.config.userConfig.temperature).join('|') === '"0.0"|in.temperature'), 'the real Feature17 process with its two agents is loaded');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'optional');
  check(await withApp(page, (app, h) => {
    const root = h.host.shadowRoot;
    const spot = root.querySelector('.tour-spot').getBoundingClientRect();
    const field = root.querySelector('[data-tour="modelGroup"] [data-tour="temperature"]');
    return Math.abs(spot.top - field.getBoundingClientRect().top) < 12 && field.querySelector('input').value === '"0.0"' && root.querySelectorAll('[data-tour="temperature"]').length === 1 && ![...root.querySelectorAll('.section-title')].some(n => n.textContent.includes('Advanced'));
  }), 'chapter 1: the temperature field is in the Model group, and there is no Advanced group');
  await resume(page);
  await atNote(page, 'plain');
  check(await withApp(page, app => app.tour.index === 1 && app.panel.call.temperature === 0 && app.tour.current.quote === 'Friendly reminder: invoice INV-2024-00123 is past due'), 'chapter 2: the first agent runs at 0.0');
  await resume(page);
  await atNote(page, 'lively');
  check(await withApp(page, (app, h) => app.panel.call.temperature === 1 && app.tour.current.quote !== 'Friendly reminder: invoice INV-2024-00123 is past due' && h.host.shadowRoot.querySelector('.chat-temp').textContent === 'temperature 1.0'), 'the second runs at the 1.0 from the process data and words it differently');
  await resume(page);
  await atNote(page, 'third');
  check(await withApp(page, app => { const lines = app.tour.current.quote.map(l => l.text.replace(/^(run \d)?\s+\S+\s+/, '')); return app.tour.index === 2 && new Set([lines[0], lines[2], lines[4]]).size === 1 && new Set([lines[1], lines[3], lines[5]]).size === 3; }), 'chapter 3: over three runs the line at 0.0 stays, the line at 1.0 changes every time');
  await shot(page, '90-f17-three-runs');
  await resume(page);
  await atNote(page, 'silent');
  check(await withApp(page, (app, h) => app.tour.index === 3 && app.data.temperature === 'high' && app.panel.call.temperature === 0 && h.host.shadowRoot.querySelector('.tour-note-text').textContent.includes('sends 0.0 instead')), 'chapter 4: a value that is no number is sent as 0.0');
  await resume(page);
  await atNote(page, 'noVariety');
  check(await withApp(page, app => app.data.creativeSubject === app.data.deterministicSubject && !app.panel.logs.some(l => l.category !== 'USER' && l.level !== 'info')), 'both agents then write the same line, and nothing warns about it');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(seventeenth.problems.length === 0, 'no console errors or warnings' + (seventeenth.problems.length ? ': ' + seventeenth.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

  // ── Appendix 04: key concepts ──────────────────────────────────────────────
  console.log('\nAppendix 04: Key Concepts');
  const concepts = await openGuide();
  page = concepts.page;
  await showFeaturePage(page, 'a04');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'appendix-04' && app.def.file === 'Feature05.p.json' && app.tour.chapters.length === 11), 'the Key Concepts page opens a walkthrough on the Feature05 process, one chapter per section');
  await withApp(page, app => { app.tour.start(0); });
  await atNote(page, 'fromUser');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot');
    const field = h.host.shadowRoot.querySelector('[data-tour="query"]').getBoundingClientRect();
    return !spot.hidden && Math.abs(spot.getBoundingClientRect().top - field.top) < 12;
  }), 'chapter 1: the notes name the System message, the User message and the tools as all the agent knows');
  await resume(page);
  await atNote(page, 'user');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const user = h.host.shadowRoot.querySelector('.chat .msg.user').getBoundingClientRect();
    return app.tour.index === 1 && app.state.panelTab === 'chat' && Math.abs(spot.left - user.left) < 12 && /Invoice Number: INV-2024-00123/.test(app.panel.call.user);
  }), 'chapter 2: a note points at the User message in the conversation, the invoice in place of the expression');
  await shot(page, 'a04-1-user-message');
  await resume(page);
  await atNote(page, 'tokens');
  check(await withApp(page, app => {
    const lines = app.tour.current.quote.map(l => l.text);
    const n = lines.slice(0, -1).map(l => Number(/≈ ([\d,]+)/.exec(l)[1].replace(/,/g, '')));
    return app.tour.index === 2 && n.length === 4 && n.every((v, i) => i === 0 || v > n[i - 1]) && /^total/.test(lines[4]);
  }), 'chapter 3: four requests in one call, each longer than the one before, and their total');
  await shot(page, 'a04-2-tokens');
  await resume(page);
  await atNote(page, 'resolved');
  check(await withApp(page, (app, h) => app.panel.call.model === 'gpt-4.1-mini' && h.host.shadowRoot.querySelector('.tour-note-title').textContent === 'OpenAI · gpt-4.1-mini'), 'chapter 4: empty Provider and Model resolve to OpenAI and its default model');
  await resume(page);
  await atNote(page, 'resolvedOwn');
  check(await withApp(page, app => app.panel.call.model === 'gpt-4.1'), 'a model set on the element wins');
  await resume(page);
  await atNote(page, 'inherited');
  check(await withApp(page, app => app.tour.index === 6 && /DefaultInput: "PromptInjectionInputGuardrail"/.test(app.variablesText) && app.panel.call.guardrails[0].name === 'PromptInjectionInputGuardrail' && !app.panel.call.guardrails[0].allowed), 'chapter 7: an empty guardrail field inherits the default, which blocks');
  await shot(page, 'a04-3-inherited-guardrail');
  await resume(page);
  await atNote(page, 'guessed');
  check(await withApp(page, app => app.panel.call.tools.length === 0 && app.tour.current.quote.filter(l => l.wrong).length === 3), 'an empty Available tools field means no tools: all three fields are guessed');
  await resume(page);
  await atNote(page, 'fresh');
  check(await withApp(page, app => app.tour.index === 7 && app.panel.call.steps.length === 0 && !app.panel.call.restored), 'chapter 8: a second call starts without the conversation of the first');
  await resume(page);
  await atNote(page, 'person');
  check(await withApp(page, app => app.tour.index === 8 && app.data.invoiceDecision.isAutoApprove === false), 'chapter 9: the process, not the prompt, sends the invoice to Manager Review');
  await resume(page);
  await atNote(page, 'immediate');
  check(await withApp(page, app => app.tour.index === 10 && /DefaultModel: "gpt-4.1"/.test(app.variablesText) && app.panel.call.model === 'gpt-4.1'), 'chapter 11: a changed variable counts from the next call');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 30000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.tour-cover .tour-play');
  check(await withApp(page, app => !/DefaultModel|Guardrails/.test(app.variablesText)), 'afterwards variables.yaml is as the lesson ships it');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(concepts.problems.length === 0, 'no console errors or warnings' + (concepts.problems.length ? ': ' + concepts.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

  // ── Appendix 05: troubleshooting ────────────────────────────────────────────
  console.log('\nAppendix 05: Troubleshooting');
  const trouble = await openGuide();
  page = trouble.page;
  await showFeaturePage(page, 'a05');
  await openWalkthrough(page);
  check(await withApp(page, app => app.def.id === 'appendix-05' && app.def.file === 'Feature13.p.json'), 'the Troubleshooting page opens a walkthrough on the Human in the Loop process');
  // the guide starts the walkthrough at once; the intro card is what other hosts open on
  await withApp(page, app => app.tour.showIntro());
  check(await withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('.tour-cover .tour-card-count')].map(n => n.textContent).join('|') === ' · 6 causes| · 11 causes| · 4 behaviours| · 7 problems| · 3 messages'),
    'the intro card says how many causes each problem has');
  await withApp(page, app => { app.tour.start(0); });
  const lastLog = () => withApp(page, app => { const logs = app.panel.logs; return logs.length ? String(logs[logs.length - 1].message) : ''; });
  const quoteOf = () => withApp(page, app => { const q = app.tour.current.quote; return Array.isArray(q) ? q.map(l => l.text).join('|') : String(q || ''); });
  /** The screen before a cause: its chapter, its label ("Cause 1 of 6") and its name, on black. */
  const screenShows = (context, label, name) => withApp(page, (app, h, context, label, name) => {
    const box = h.host.shadowRoot.querySelector('.tour-title:not([hidden]) .tour-screen');
    const text = sel => (box.querySelector(sel) || {}).textContent;
    return Boolean(box) && text('.tour-screen-context') === context && text('.tour-screen-label') === label && text('h3') === name && !app.tour.current;
  }, context, label, name);
  const step = async (key, fits, label) => {
    await atNote(page, key);
    const ok = await fits();
    check(ok, label);
    await resume(page);
  };
  const logIs = expected => async () => { const m = await lastLog(); return typeof expected === 'function' ? expected(m) : m === expected; };
  const SKIPPED = 'Agent call was skipped, since there was no user query';
  /** The parts of the chapter that plays, as the player lists them. */
  const parts = () => withApp(page, (app, h) => [...h.host.shadowRoot.querySelectorAll('.player .tour-parts .tour-part')].map(b => ({
    n: b.querySelector('.tour-part-n').textContent, current: b.classList.contains('current'), done: b.classList.contains('done'),
    name: (b.querySelector('.tour-part-title') || {}).textContent || '', title: b.getAttribute('title')
  })));

  // The player splits a chapter into its causes, 1.1 to 1.6, and each can be started on its own
  await atScreen(page, 'causeBreaker');
  let list = await parts();
  check(list.map(x => x.n).join(' ') === '1.1 1.2 1.3 1.4 1.5 1.6' && list[0].current && list[0].name === 'The circuit breaker is on' && list[2].title === 'Cause 3 of 6: A guardrail blocked it',
    'the player lists the six causes of the chapter as 1.1 to 1.6, the current one with its name');
  await clickInApp(page, '.player .tour-part:nth-child(5)');
  await atScreen(page, 'causeFile');
  list = await parts();
  check(await withApp(page, app => app.tour.index === 0 && app.tour.part === 4) && list[4].current && list.slice(0, 4).every(x => x.done) && list[4].name === 'A file emptied the User message',
    'clicking 1.5 starts that cause directly; the causes before it show as done');
  await shot(page, 'a05-player-parts');
  await withApp(page, app => app.tour.back());
  await atScreen(page, 'causeMapping');
  check(await withApp(page, app => app.tour.part === 3), 'back, at the very start of a cause, goes to the cause before it (1.4)');
  await withApp(page, app => { app.tour.start(0); });

  // 1 — The agent did not answer: six causes, each after a screen of its own
  await atScreen(page, 'causeBreaker');
  check(await screenShows('The agent did not answer', 'Cause 1 of 6', 'The circuit breaker is on'), 'a screen before each cause: "Cause 1 of 6 — The circuit breaker is on"');
  await shot(page, 'a05-cause-screen');
  await resume(page);
  await step('breakerLog', logIs(m => m.startsWith('Unhandled error smartworkflow:stop')), 'cause 1: the circuit breaker, an unhandled smartworkflow:stop');
  await step('skippedLog', logIs(SKIPPED), 'cause 2: a blank user message, the call is skipped');
  await atScreen(page, 'causeGuardrail');
  check(await screenShows('The agent did not answer', 'Cause 3 of 6', 'A guardrail blocked it'), 'cause 3 has its screen');
  await resume(page);
  await atNote(page, 'guardBlocked');
  check(await withApp(page, app => /DefaultInput: "PromptInjectionInputGuardrail"/.test(app.variablesText) && app.panel.call.guardrails[0].name === 'PromptInjectionInputGuardrail' && !app.panel.call.guardrails[0].allowed &&
    !app.model.elements.find(e => e.id === 'f5').config.userConfig.inputGuardrails), 'cause 3: the default guardrail blocks the agent, which has none of its own');
  await shot(page, 'a05-default-guardrail');
  await resume(page);
  await step('guardLog', logIs(m => m.startsWith('Unhandled error smartworkflow:guardrail:input:violation')), 'and the log has the unhandled violation');
  await step('mapLog', logIs('Failed to map result to in.decision'), 'cause 4: a target of another type, the mapping fails and is logged');
  await step('fileSkipped', async () => (await lastLog()) === SKIPPED && (await quoteOf()).includes('Unsupported CMS file type for object: PurchaseOrder with extension: docx'), 'cause 5: a Word file takes the whole user message down');
  await step('toolsWhy', () => withApp(page, app => !app.model.elements.find(e => e.id === 'f5').config.userConfig.tools), 'cause 6: no tools selected');

  // 2 — The agent answered, but not as expected: eleven causes
  await step('explains', async () => (await quoteOf()).includes('I have no tool to ask for one'), 'not as expected, cause 1: without tools the agent explains instead of asking');
  await step('dropped', async () => (await quoteOf()) === 'askUserFeedback', 'cause 2: a start without the tool tag, the selected tool is dropped');
  await step('noPause', async () => (await quoteOf()).includes('My instructions do not say how to get one'), 'cause 5: the tool is offered but not named, so the agent never pauses');
  await step('nothingAttached', () => withApp(page, (app, h) => app.panel.call.files.length === 0 && Boolean(h.host.shadowRoot.querySelector('.chat .file-chip.missing'))), 'cause 6: a misspelled CMS path attaches nothing');
  await step('pdfRejected', logIs('Ollama does not accept PDF files, so the call with InvoiceSample.pdf failed'), 'cause 7: a PDF sent to Ollama fails at the provider');
  await atScreen(page, 'causeTemperature');
  check(await screenShows('The agent answered, but not as expected', 'Cause 11 of 11', 'The output varies more, or less, than expected'), 'the causes the simulator cannot run have their screens too (cause 11 of 11)');
  list = await parts();
  check(list.length === 11 && list[10].n === '2.11' && list[10].current && list.slice(0, 10).every(x => x.done), 'chapter 2 lists its causes as 2.1 to 2.11');
  await resume(page);
  await atNote(page, 'temperatureWhy');
  check(await withApp(page, (app, h) => {
    const spot = h.host.shadowRoot.querySelector('.tour-spot').getBoundingClientRect();
    const fieldBox = h.host.shadowRoot.querySelector('[data-tour="temperature"]').getBoundingClientRect();
    return Math.abs(spot.top - fieldBox.top) < 12;
  }), 'and are explained on their field');
  await resume(page);

  // 3 — Messages and expressions: four behaviours
  await atNote(page, 'binarySent');
  check(await withApp(page, (app, h) => /^Binary@[0-9a-f]{6}$/.test(app.panel.call.system) && app.state.panelTab === 'chat' && app.panel.call.files.length === 0 &&
    Boolean(h.host.shadowRoot.querySelector('.chat .msg.system .file-chip.binary')) && app.tour.current.quote[0].wrong === true),
    'messages, behaviour 1: a PDF in the System message reaches the model as Binary@…, marked as wrong in the note and in the conversation');
  await shot(page, 'a05-system-file');
  await resume(page);
  await atNote(page, 'systemFromScript');
  check(await withApp(page, (app, h) => !h.host.shadowRoot.querySelector('.tour-spot').hidden && app.tour.current.quote.some(l => l.text === '<%=in.systemPrompt%>')),
    'and the other fix: read the text in a Script before the agent, then use the field');
  await resume(page);
  await atScreen(page, 'behaviourRaw');
  check(await screenShows('Messages and expressions', 'Behaviour 2 of 4', 'An unresolved expression is inserted as its own raw text'), 'messages: behaviour 2 has its screen');
  await resume(page);
  await step('rawSent', () => withApp(page, app => app.panel.call.user === '<%=in.query%'), 'behaviour 2: an unclosed expression goes to the model as raw text');
  await step('queryFailed', logIs(SKIPPED), 'behaviour 3: an expression that fails in the user message, the call is skipped');
  await step('noSystem', () => withApp(page, app => app.panel.call.system === '' && app.state.panelTab === 'chat'), 'behaviour 4: an expression that fails in the system message, the call is sent without one');
  await step('withoutRules', async () => (await quoteOf()).includes('My instructions do not say how to get one'), 'and the agent answers without its rules');

  // 4 — Configuration: seven problems
  await step('unknownProvider', logIs('Unknown model provider Open AI'), 'configuration, problem 1: a provider that is not installed');
  await step('unauthorized', logIs(m => m.includes('401 Unauthorized')), 'problem 2: no API key, 401 Unauthorized');
  await step('modelLog', logIs("Failed to extract config 'model' for value 'gpt-4o'"), 'problem 3: an unquoted model name does not compile');
  await step('stillDefault', () => withApp(page, app => /\n {8}Model: "gpt-4o"\n/.test(app.variablesText) && app.panel.call.model === 'gpt-4.1-mini'), 'problem 4: a variable called Model is ignored');
  await atScreen(page, 'problemSpi');
  check(await screenShows('Configuration', 'Problem 7 of 7', 'A custom tool or guardrail does not appear in the pickers'), 'problem 7 has its screen');
  await resume(page);

  // 5 — Human in the loop: three messages
  await step('noMemory', logIs(m => m.includes('Found no pending ChatMemory for id: INV-2025-0892')), 'human in the loop, message 1: the wrong id, no pending ChatMemory');
  await atScreen(page, 'messageAiMessage');
  check(await screenShows('Human in the loop', 'Message 2 of 3', 'Found no pending AiMessage for id'), 'message 2 has its screen');
  await resume(page);
  await step('noRequest', logIs(m => m.includes('Found no pending ToolExecutionRequest')), 'message 3: resolve() twice, no pending ToolExecutionRequest');

  // 6 and 7
  await step('unhandled', logIs(m => m.startsWith('Unhandled error smartworkflow:stop')), 'a BPM error with another code goes past the boundary event');
  await atNote(page, 'conversation');
  check(await withApp(page, app => app.tour.index === 6 && app.state.panelTab === 'chat' && app.panel.call.tools.length === 1), 'last chapter: the Agent conversation shows what the model received');
  await shot(page, '95-a05-conversation');
  await resume(page);
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 60000, polling: 50 });
  await settle(page, 500);
  check(await withApp(page, app => app.model.elements.find(e => e.id === 'f5').config.userConfig.query === '<%=in.query%>' && /Enabled: "false"/.test(app.variablesText) && !/Guardrails:|Model: "gpt-4o"/.test(app.variablesText)), 'afterwards the process and variables.yaml are as the tutorial ships them');
  await clickInApp(page, '.tour-cover .tour-play');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(trouble.problems.length === 0, 'no console errors or warnings' + (trouble.problems.length ? ': ' + trouble.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

  // ── 12. Fallback renderer and narrow layout ─────────────────────────────────
  console.log('\nFallback renderer and narrow layout');
  const flat = await openGuide('?renderer=canvas', { width: 900, height: 900 });
  page = flat.page;
  await openFeature01(page);
  check(await withApp(page, app => app.stage.kind) === 'canvas', 'the 2D canvas renderer can stand in for WebGL');
  check(await withApp(page, app => app.root.dataset.layout) === 'narrow', 'a narrow screen switches to the compact layout');
  await atNote(page, 'system');
  check(await withApp(page, (app, h) => {
    const note = h.host.shadowRoot.querySelector('.tour-note').getBoundingClientRect();
    const host = h.host.getBoundingClientRect();
    return note.left >= host.left && note.right <= host.right && note.top >= host.top && note.bottom <= host.bottom;
  }), 'in the narrow layout the note stays inside the simulation');
  await shot(page, '16-fallback-narrow-note');
  await resume(page);
  await clickInApp(page, '.tour-exit');
  await page.waitForFunction(() => window.swInteractive.instances()[0].app.mode === 'explore', { timeout: 10000, polling: 50 });
  await settle(page, 500);
  await clickInApp(page, '.run-btn.primary');
  await waitForStatus(page, ['completed', 'failed']);
  await settle(page, 400);
  check(await withApp(page, app => app.data.summary) === EXPECTED, 'the run works with the fallback renderer');
  await shot(page, '17-fallback-completed');
  check(flat.problems.length === 0, 'no console errors or warnings' + (flat.problems.length ? ': ' + flat.problems.slice(0, 4).join(' | ') : ''));
  await page.close();

} catch (e) {
  failures.push('aborted: ' + (e && e.stack ? e.stack : e));
  console.error(e);
} finally {
  await browser.close();
  await server.close();
}

console.log('\n' + (checks - failures.filter(f => !f.startsWith('aborted')).length) + ' of ' + checks + ' checks passed. Screenshots: ' + shots);
if (failures.length) {
  console.error('\nFailed:\n' + failures.map(f => '  - ' + f).join('\n'));
  process.exit(1);
}
