/**
 * The model providers Smart Workflow 14 ships with, as far as the simulation needs them:
 * the variables each one reads, its default model and the endpoint its request goes to.
 * Values mirror the smart-workflow-<provider> projects (e.g. OpenAiServiceConnector).
 * `pdf: false` marks the providers that the Model Provider Selection guide lists without PDF input.
 */
import { readVariable } from './yaml.js';

const PREFIX = 'AI.Providers.';

export const PROVIDERS = {
  OpenAI: { name: 'OpenAI', defaultModel: 'gpt-4.1-mini', base: 'https://api.openai.com', path: () => '/v1/chat/completions', needsKey: true },
  AzureOpenAI: { name: 'AzureOpenAI', defaultModel: '', azure: true, needsKey: true },
  Gemini: { name: 'Gemini', defaultModel: 'gemini-2.5-flash', base: 'https://generativelanguage.googleapis.com', path: model => '/v1beta/models/' + model + ':generateContent', needsKey: true },
  xAI: { name: 'xAI', defaultModel: 'grok-4-1-fast', base: 'https://api.x.ai', path: () => '/v1/chat/completions', needsKey: true, pdf: false },
  Anthropic: { name: 'Anthropic', defaultModel: 'claude-haiku-4-5-20251001', base: 'https://api.anthropic.com', path: () => '/v1/messages', needsKey: true },
  Ollama: { name: 'Ollama', defaultModel: 'llama3.2', base: 'http://localhost:11434', path: () => '/api/chat', needsKey: false, pdf: false }
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

/** `${decrypt:}` is how an unset password variable looks in variables.yaml. */
function blank(value) {
  const v = String(value == null ? '' : value).trim();
  return v === '' || /^\$\{decrypt:\s*\}$/.test(v);
}

const trimSlash = url => String(url).replace(/\/+$/, '');

/**
 * Resolves which provider/model an agent call would use, following ChatModelFactory:
 * the element's own provider, else AI.DefaultProvider, else "OpenAI".
 *
 * @returns {{ ok: true, name: string, model: string, url: string, missingKey: string|null, pdf: boolean }
 *          | { ok: false, name: string, message: string }}
 */
/**
 * ModelOptionUtils.toTemperature: empty, not a number or negative all become 0.0 — without
 * an error.
 */
export function toTemperature(value) {
  const raw = value == null ? '' : String(value).trim();
  if (raw === '' || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?[dDfF]?$/.test(raw)) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** A temperature the way Java prints a Double: 0.0, 0.7, 1.0. */
export const formatTemperature = n => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** The highest temperature a provider accepts, where the tutorial names one. */
export const MAX_TEMPERATURE = { OpenAI: 2, Anthropic: 1 };

export function resolveProvider(variables, elementProvider, elementModel) {
  const name = (elementProvider || '').trim() || readVariable(variables, 'AI.DefaultProvider').trim() || 'OpenAI';
  const def = PROVIDERS[name];
  if (!def) return { ok: false, name, message: 'Unknown model provider ' + name };

  const prefix = PREFIX + name + '.';
  if (def.azure) {
    const endpoint = readVariable(variables, prefix + 'Endpoint').trim();
    const deployment = readVariable(variables, prefix + 'DefaultDeployment').trim();
    const model = (elementModel || '').trim() || readVariable(variables, prefix + 'Deployments.' + deployment + '.Model').trim() || deployment;
    const key = deployment ? readVariable(variables, prefix + 'Deployments.' + deployment + '.APIKey') : '';
    const missing = blank(endpoint) ? prefix + 'Endpoint' : blank(deployment) ? prefix + 'DefaultDeployment' : blank(key) ? prefix + 'Deployments.' + deployment + '.APIKey' : null;
    return {
      ok: true,
      name,
      model,
      url: trimSlash(endpoint || 'https://<resource>.openai.azure.com') + '/openai/deployments/' + (deployment || '<deployment>') + '/chat/completions',
      missingKey: missing,
      pdf: def.pdf !== false
    };
  }

  const model = (elementModel || '').trim() || readVariable(variables, prefix + 'DefaultModel').trim() || def.defaultModel;
  const base = readVariable(variables, prefix + 'BaseUrl').trim() || def.base;
  const key = readVariable(variables, prefix + 'APIKey');
  return {
    ok: true,
    name,
    model,
    url: trimSlash(base) + def.path(model),
    missingKey: def.needsKey && blank(key) ? prefix + 'APIKey' : null,
    pdf: def.pdf !== false
  };
}
