/**
 * Expands Ivy macros — text with embedded `<%= expression %>` parts — the way the
 * AgenticProcessCall does for its "User message" and "System message" fields.
 *
 * As in Smart Workflow's QueryExpander, an expression that is exactly `ivy.cms.co("path")`
 * is not evaluated but loaded from the CMS: a PNG, JPG, JPEG or PDF file is attached to the
 * message, a TXT or MD file and a text object become text, and a path that does not exist
 * contributes nothing.
 */
import { evalExpression, validateExpression, IvyScriptError } from './ivyscript.js';

// Same patterns as Smart Workflow's QueryExpander: an expression never spans lines.
const MACRO = /<%=(.+?)%>/g;
const CMS = /^ivy\.cms\.co\(["'](.+?)["']\)$/;

const FILE_TYPES = {
  png: { kind: 'image', mime: 'image/png' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  pdf: { kind: 'pdf', mime: 'application/pdf' }
};
const TEXT_TYPES = ['txt', 'md'];

/** The CMS path of an `ivy.cms.co("…")` expression, or null for any other expression. */
export function cmsPathOf(code) {
  const m = CMS.exec(String(code == null ? '' : code).trim());
  return m ? m[1] : null;
}

/** Splits a template into literal text and expression parts. */
export function parseMacro(template) {
  const src = String(template == null ? '' : template);
  const parts = [];
  let last = 0;
  let m;
  MACRO.lastIndex = 0;
  while ((m = MACRO.exec(src))) {
    if (m.index > last) parts.push({ type: 'text', value: src.slice(last, m.index) });
    parts.push({ type: 'expr', raw: m[0], code: m[1].trim(), cms: cmsPathOf(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: 'text', value: src.slice(last) });
  return parts;
}

/**
 * What a CMS path contributes to the message. `ctx.cms` maps paths to the objects of the
 * lesson: { name, extension, reads } for a file (`reads` is what a model reads in it) or
 * { name, text } for a text object.
 */
function loadCms(path, code, ctx) {
  const object = ctx.cms ? ctx.cms[path] : null;
  if (!object) return { type: 'missing', code, path, value: '' };
  const extension = String(object.extension || '').toLowerCase();
  if (!extension) return { type: 'expr', code, value: String(object.text == null ? '' : object.text) };
  if (FILE_TYPES[extension]) {
    return { type: 'file', code, path, name: object.name + '.' + extension, ...FILE_TYPES[extension], reads: object.reads || '', value: '' };
  }
  if (TEXT_TYPES.includes(extension)) return { type: 'expr', code, value: String(object.reads || '') };
  throw new IvyScriptError('Unsupported CMS file type for object: ' + object.name + ' with extension: ' + extension, { kind: 'runtime' });
}

/**
 * Resolves every expression against the script context.
 * @returns {{ text: string, parts: Object[], files: Object[], error: IvyScriptError|null }}
 *   parts: { type: 'text' | 'expr', value } for text, { type: 'file', name, kind, mime, path, reads }
 *   for an attached file, { type: 'missing', path } for a CMS path that does not exist
 */
export function expandMacro(template, ctx) {
  const resolved = [];
  let error = null;
  for (const part of parseMacro(template)) {
    if (part.type === 'text') { resolved.push({ type: 'text', value: part.value }); continue; }
    try {
      if (part.cms) {
        resolved.push(loadCms(part.cms, part.code, ctx));
        continue;
      }
      const value = evalExpression(part.code, ctx);
      const str = value == null ? '' : (typeof value === 'object' && value.__class ? 'class ' + value.__class : String(value));
      resolved.push({ type: 'expr', code: part.code, value: str });
    } catch (e) {
      if (!(e instanceof IvyScriptError)) throw e;
      if (!error) error = e;
      resolved.push({ type: 'expr', code: part.code, value: '' });
    }
  }
  return { text: resolved.map(p => p.value).join(''), parts: resolved, files: resolved.filter(p => p.type === 'file'), error };
}

/** Returns the first problem found in the template's expressions, or null. */
export function validateMacro(template, ctx) {
  for (const part of parseMacro(template)) {
    if (part.type !== 'expr' || part.cms) continue;
    const error = validateExpression(part.code, ctx);
    if (error) return error;
  }
  const src = String(template == null ? '' : template);
  const open = src.replace(MACRO, '').indexOf('<%');
  if (open >= 0) return new IvyScriptError('An expression starts with <%= but is not closed with %>', { kind: 'syntax' });
  return null;
}

/** CMS paths the template names that do not exist: they will attach nothing. */
export function missingCms(template, ctx) {
  return parseMacro(template).filter(p => p.cms && !(ctx.cms && ctx.cms[p.cms])).map(p => p.cms);
}
