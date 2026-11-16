/**
 * The built-in guardrails of Smart Workflow (14.0.0), as the simulation applies them. The
 * rules are the ones of the Java classes of the same names:
 *
 *   PromptInjectionInputGuardrail     three regular expressions over the user message
 *   AiPromptInjectionInputGuardrail   one extra model call that answers YES or NO
 *   PiiMaskingGuardrail               replaces personal data by <TYPE_hash> placeholders on
 *                                     the way in and puts the originals back on the way out
 *   SensitiveDataOutputGuardrail      API keys and private keys in the model's answer
 *
 * A guardrail that blocks makes the agent element throw a BPM error; the message of that
 * error is how langchain4j words a failed guardrail.
 */
import { readVariable } from './yaml.js';

export const VIOLATION = {
  input: 'smartworkflow:guardrail:input:violation',
  output: 'smartworkflow:guardrail:output:violation'
};
const ADAPTER = {
  input: 'com.axonivy.utils.smart.workflow.guardrails.adapter.InputGuardrailAdapter',
  output: 'com.axonivy.utils.smart.workflow.guardrails.adapter.OutputGuardrailAdapter'
};
const DEFAULT_VARIABLE = { input: 'AI.Guardrails.DefaultInput', output: 'AI.Guardrails.DefaultOutput' };
export const CLASSIFIER = {
  PROVIDER: 'AI.Guardrails.PromptInjection.Classifier.Provider',
  MODEL: 'AI.Guardrails.PromptInjection.Classifier.Model',
  MIN_LENGTH: 'AI.Guardrails.PromptInjection.Classifier.MinLength'
};

/** GuardrailResult$Failure of langchain4j: what getMessage() of the BPM error returns. */
export const violationMessage = (side, reason) => 'The guardrail ' + ADAPTER[side] + ' failed with this message: ' + reason;

/** The guardrails that apply: the element's own list, or else the default of variables.yaml. */
export function guardrailNames(side, selected, variables) {
  if (selected && selected.length) return [...new Set(selected)];
  return [...new Set(readVariable(variables || {}, DEFAULT_VARIABLE[side]).split(',').map(s => s.trim()).filter(Boolean))];
}

const allow = (extra = {}) => ({ allowed: true, ...extra });
const block = reason => ({ allowed: false, reason });

// ── PromptInjectionInputGuardrail ────────────────────────────────────────────

const PROMPT_INJECTION = /(ignore (all )?previous|disregard (all )?(previous |your )?instructions?|forget (all )?(previous |your )?instructions?|forget everything|pretend (to be|you are|you're)|you are now|(reveal|show|print|repeat|output|display) (me )?(your |the )?system prompt|your system prompt|system:|assistant:)/i;
const EXCESSIVE_SPECIAL_CHARS = /[^\w\s]{10,}/;
// as in the Java class: this range includes the line break, so a message of several lines is rejected too
const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

/** Which of the three checks of PromptInjectionInputGuardrail a message fails, or null. */
export function promptInjectionMatch(message) {
  const text = String(message == null ? '' : message);
  const keyword = PROMPT_INJECTION.exec(text);
  if (keyword) return { check: 'keyword', text: keyword[0] };
  if (EXCESSIVE_SPECIAL_CHARS.test(text)) return { check: 'special-characters' };
  if (CONTROL_CHARS.test(text)) return { check: 'control-character' };
  return null;
}

// ── AiPromptInjectionInputGuardrail ──────────────────────────────────────────

/**
 * Stand-in for the classifier model. It follows the classes of the real classifier prompt in
 * a few patterns: overriding instructions, a role that removes restrictions, extracting the
 * system prompt, lasting changes of behaviour — and answers NO when the message only asks
 * about such attacks.
 */
export function classifyInjection(message) {
  const text = String(message || '');
  if (/^\s*(is this|analy[sz]e|classify|explain|what is|what are|give examples|how does)\b/i.test(text)) return 'NO';
  const attacks = [
    /\b(ignore|disregard|forget|override|bypass|disable)\b[^.\n]*\b(instructions?|rules|guidelines|guidance|everything|safety|security|restrictions?|filters?)\b/i,
    /\b(you are now|act as|pretend)\b[^.\n]*\b(unrestricted|no (rules|guidelines|restrictions|safety|limits)|without (any )?(rules|restrictions|guidelines)|admin|jailbreak|DAN)\b/i,
    /\b(no|without) (guidelines|restrictions|safety rules|rules)\b/i,
    /\b(reveal|show|print|repeat|display|output)\b[^.\n]*\b(system prompt|hidden instructions|developer message|internal configuration)\b/i,
    /\bfrom now on\b[^.\n]*\b(ignore|no restrictions|never refuse|disable)\b/i,
    /\bwhat (can|could) you tell me that you normally (couldn't|could not|can't|cannot)\b/i
  ];
  return attacks.some(pattern => pattern.test(text)) ? 'YES' : 'NO';
}

// ── SensitiveDataOutputGuardrail ─────────────────────────────────────────────

const SECRET_PATTERNS = [
  /\bsk-(?:[a-zA-Z0-9_]+-)*[a-zA-Z0-9_]{20,}\b/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\bgh[posr]_[a-zA-Z0-9]{36}\b|\bgithub_pat_[a-zA-Z0-9_]{82}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bxai-[a-zA-Z0-9]{50,}\b/,
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/
];

/** The API keys configured for the providers: an answer that contains one is blocked as well. */
function configuredKeys(variables) {
  const providers = ((((variables || {}).Variables || {}).AI || {}).Providers) || {}; // variables: the parsed variables.yaml
  return Object.keys(providers).map(name => (providers[name] && typeof providers[name] === 'object' ? String(providers[name].APIKey || '') : '')).filter(key => key.trim());
}

/** The part of a message SensitiveDataOutputGuardrail objects to, or null. */
export function sensitiveDataMatch(message, variables) {
  const text = String(message == null ? '' : message);
  if (!text.trim()) return null;
  const key = configuredKeys(variables).find(k => text.includes(k));
  if (key) return { check: 'configured-key', text: key };
  for (const pattern of SECRET_PATTERNS) {
    const m = pattern.exec(text);
    if (m) return { check: 'pattern', text: m[0] };
  }
  return null;
}

// ── PiiMaskingGuardrail ──────────────────────────────────────────────────────

const K = [];
(() => {
  // the SHA-256 round constants: fractional parts of the cube roots of the first 64 primes
  for (let n = 2; K.length < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) K.push(Math.floor((Math.cbrt(n) % 1) * 4294967296) >>> 0);
  }
})();

/** SHA-256 of a text (UTF-8), as lower-case hex. */
export function sha256Hex(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((bytes[offset + i * 4] << 24) | (bytes[offset + i * 4 + 1] << 16) | (bytes[offset + i * 4 + 2] << 8) | bytes[offset + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (hh + s1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) >>> 0; });
  }
  return h.map(v => v.toString(16).padStart(8, '0')).join('');
}

function isValidCreditCard(raw) {
  const digits = raw.replace(/[\s-]/g, '');
  if (digits.length < 13 || digits.length > 19 || /\D/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alternate) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

const PHONE = '(?:\\+|00)[1-9]\\d{0,2}[\\s.\\-]?(?:\\(?\\d{1,4}\\)?[\\s.\\-]?){1,4}\\d{2,4}';
/** The phone rule must not start inside a word or number; older browsers have no lookbehind. */
function phoneRule() {
  try {
    return { type: 'PHONE', pattern: new RegExp('(?<![A-Za-z0-9])' + PHONE, 'g') };
  } catch (e) {
    return { type: 'PHONE', pattern: new RegExp(PHONE, 'g'), valid: (value, text, at) => at === 0 || !/[A-Za-z0-9]/.test(text[at - 1]) };
  }
}

/** PiiMaskingRuleRegistry: the rules, in the order they are applied. */
const PII_RULES = [
  { type: 'IP_ADDRESS', pattern: /\b(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
  { type: 'MAC_ADDRESS', pattern: /\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
  { type: 'EMAIL', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  phoneRule(),
  { type: 'CREDIT_DEBIT_CARD_NUMBER', pattern: /\b(?:\d[ -]?){13,19}\b/g, valid: isValidCreditCard },
  { type: 'SSN', pattern: /\b(?!000|666|9\d{2})\d{3}[- ]\d{2}[- ]\d{4}\b/g },
  { type: 'DATE_OF_BIRTH', pattern: /\b(0?[1-9]|[12]\d|3[01])[/.-](0?[1-9]|1[0-2])[/.-](19|20)\d{2}\b/g }
];

/**
 * PiiDetector.detectAndMask: every value a rule finds becomes <TYPE_hash>, the hash being the
 * first 12 hex digits of its SHA-256.
 * @returns {{ text: string, map: [string, string][] }}  map: placeholder → original, in order
 */
export function maskPii(message) {
  const map = new Map();
  let text = String(message == null ? '' : message);
  PII_RULES.forEach(rule => {
    text = text.replace(rule.pattern, (...args) => {
      const value = args[0];
      const at = args[args.length - 2];
      if (rule.valid && !rule.valid(value, args[args.length - 1], at)) return value;
      const placeholder = '<' + rule.type + '_' + sha256Hex(value).slice(0, 12) + '>';
      map.set(placeholder, value);
      return placeholder;
    });
  });
  return { text, map: [...map.entries()] };
}

/** PiiDetector.restore: every placeholder is replaced by its original again. */
export function restorePii(message, map) {
  let text = String(message == null ? '' : message);
  [...(map || [])].reverse().forEach(([placeholder, value]) => { text = text.split(placeholder).join(value); });
  return text;
}

// ── evaluation ───────────────────────────────────────────────────────────────

const GUARDRAILS = {
  input: {
    PromptInjectionInputGuardrail(message) {
      const match = promptInjectionMatch(message);
      return match ? { ...block("The input message is rejected because it's empty or contains malicious content"), match } : allow();
    },
    AiPromptInjectionInputGuardrail(message, ctx) {
      const minLength = parseInt(readVariable(ctx.variables || {}, CLASSIFIER.MIN_LENGTH), 10) || 0;
      if (String(message).length < minLength) return allow();
      const out = ctx.classify(message);
      const precaution = 'Safety check could not be completed. The message has been blocked as a precaution.';
      if (out.error) return { ...block(precaution), classifier: out };
      const verdict = String(out.verdict).trim().toUpperCase();
      if (verdict.startsWith('YES')) return { ...block('The input message is rejected because it contains malicious content'), classifier: out };
      return verdict.startsWith('NO') ? allow({ classifier: out }) : { ...block(precaution), classifier: out };
    },
    PiiMaskingGuardrail: (message, ctx) => pii(message, ctx)
  },
  output: {
    SensitiveDataOutputGuardrail(message, ctx) {
      const match = sensitiveDataMatch(message, ctx.variables);
      return match ? { ...block('The AI response was blocked because it contains sensitive data such as API keys or private keys'), match } : allow();
    },
    PiiMaskingGuardrail: (message, ctx) => pii(message, ctx)
  }
};

/**
 * PiiMaskingGuardrail is one object for both lists: the first message of a call it sees is
 * masked, the second one restored — whichever list it was asked from. In only one of the two
 * lists it therefore masks and never restores.
 */
function pii(message, ctx) {
  if (ctx.state.pii === undefined) {
    const masked = maskPii(message);
    ctx.state.pii = masked.map;
    return masked.map.length ? allow({ rewritten: masked.text, masked: masked.map.length }) : allow();
  }
  const map = ctx.state.pii;
  ctx.state.pii = undefined;
  if (!map.length) return allow();
  const restored = restorePii(message, map);
  return restored === message ? allow() : allow({ rewritten: restored, restored: map.filter(([placeholder]) => String(message).includes(placeholder)).length });
}

/** The names the editor offers, as DefaultGuardrailProvider lists them. */
export const GUARDRAIL_NAMES = {
  input: ['PromptInjectionInputGuardrail', 'AiPromptInjectionInputGuardrail', 'PiiMaskingGuardrail'],
  output: ['SensitiveDataOutputGuardrail', 'PiiMaskingGuardrail']
};

/**
 * @param {'input'|'output'} side
 * @param {string} name
 * @param {string} message  the user message, or the model's answer
 * @param {{ state: Object, variables: Object, classify: (message: string) => Object }} ctx
 * @returns {{ allowed: boolean, reason?: string, rewritten?: string }|null}  null: no guardrail of that name
 */
export function evaluateGuardrail(side, name, message, ctx) {
  const guardrail = GUARDRAILS[side][name];
  return guardrail ? guardrail(String(message == null ? '' : message), ctx) : null;
}

// ── Circuit breaker ──────────────────────────────────────────────────────────

/** The error code of a call the circuit breaker stopped: not a guardrail violation. */
export const STOP = 'smartworkflow:stop';
export const CIRCUIT_BREAKER = {
  NAME: 'CircuitBreakerGuardrail',
  VARIABLE: 'AI.CircuitBreaker.Enabled',
  REASON: 'All AI agent activities are currently stopped.'
};

/** "true" stops every agent call; "false" or nothing lets them run. */
export function circuitBreakerOn(variables) {
  return readVariable(variables || {}, CIRCUIT_BREAKER.VARIABLE).trim().toLowerCase() === 'true';
}

/**
 * CircuitBreakerSignal for scripts: stopAll() and resumeAll() write the variable. The names
 * work with or without the package, as after an import.
 * @param {(enabled: boolean) => void} set
 */
export function circuitBreakerStatics(set) {
  const statics = {};
  ['', 'com.axonivy.utils.smart.workflow.guardrails.circuitbreaker.'].forEach(prefix => {
    statics[prefix + 'CircuitBreakerSignal.stopAll'] = () => { set(true); };
    statics[prefix + 'CircuitBreakerSignal.resumeAll'] = () => { set(false); };
  });
  return statics;
}
