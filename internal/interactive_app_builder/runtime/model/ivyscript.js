/**
 * A deliberately small IvyScript interpreter — just enough to run the script steps and
 * script fields that appear in the tutorial processes:
 *
 *   in.invoiceText = "INVOICE\n" + "Invoice Number: ..." ;   assignments to process data
 *   ivy.log.error(out.summary);                              runtime log calls
 *   in.summary                                               field expressions (macros, mappings)
 *   tutorial.InvoiceData.class                               class literals
 *   in.result.totalAmount                                    fields of a data class object
 *   dev.langchain4j.internal.Json.toJson(in.result)          the JSON call the tutorials log with
 *   in.invoiceDecision.isAutoApprove == false                conditions of a gateway
 *   double amount = Double.parseDouble(in.amount.trim());    local variables, a few Java statics
 *   if (...) { ... } else if (...) { ... } else { ... }      the rules inside a tool's script
 *   try { ... } catch (NumberFormatException e) { ... }
 *   new DecisionMaker(in.aiMemoryId).resolve(result.answer)  objects the surroundings provide
 *   error.getAttribute("decision") as tutorial.HumanFeedback  a cast is read and ignored
 *
 * Anything outside that subset raises an IvyScriptError of kind "unsupported" with a message
 * the UI can show as-is, so learners are told what the simulation cannot do instead of
 * getting a silent wrong answer.
 */

export class IvyScriptError extends Error {
  constructor(message, { pos = 0, kind = 'syntax' } = {}) {
    super(message);
    this.name = 'IvyScriptError';
    this.pos = pos;
    this.kind = kind;
  }
}

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
const KEYWORDS = new Set(['if', 'else', 'for', 'while', 'do', 'return', 'new', 'import', 'try', 'catch', 'finally', 'throw', 'switch', 'function', 'var']);
const LITERALS = new Set(['true', 'false', 'null']);
const PUNCTUATION = ['==', '!=', '&&', '||', '<=', '>=', '.', ',', ';', '(', ')', '+', '-', '*', '/', '=', '<', '>', '!', '[', ']', '{', '}', '?', ':', '%'];
const SUPPORTED_HINT = 'This simulation understands assignments, if/else, try/catch, comparisons, text joined with +, and ivy.log calls.';
// binary operators, loosest first
const LEVELS = [['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];

// ── Tokenizer ────────────────────────────────────────────────────────────────

export function tokenize(source) {
  const src = String(source == null ? '' : source);
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new IvyScriptError('Comment is not closed with */', { pos: i });
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const start = i;
      let value = '';
      i++;
      let closed = false;
      while (i < src.length) {
        const c = src[i];
        if (c === '\\') {
          const n = src[i + 1];
          if (n === 'n') value += '\n';
          else if (n === 't') value += '\t';
          else if (n === 'r') value += '\r';
          else if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(src.substr(i + 2, 4))) {
            value += String.fromCharCode(parseInt(src.substr(i + 2, 4), 16));
            i += 4;
          } else if (n !== undefined) value += n;
          i += 2;
          continue;
        }
        if (c === ch) { closed = true; i++; break; }
        if (c === '\n') break;
        value += c;
        i++;
      }
      if (!closed) throw new IvyScriptError('Text is not closed with ' + ch, { pos: start });
      tokens.push({ t: 'str', v: value, pos: start });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const m = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
      tokens.push({ t: 'num', v: parseFloat(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
      tokens.push({ t: 'id', v: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    const p = PUNCTUATION.find(x => src.startsWith(x, i));
    if (!p) throw new IvyScriptError("Unexpected character '" + ch + "'", { pos: i });
    tokens.push({ t: 'p', v: p, pos: i });
    i += p.length;
  }
  tokens.push({ t: 'eof', v: '', pos: src.length });
  return tokens;
}

// ── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  constructor(source) {
    this.tokens = tokenize(source);
    this.i = 0;
  }

  peek() { return this.tokens[this.i]; }
  next() { return this.tokens[this.i++]; }
  is(type, value) {
    const t = this.peek();
    return t.t === type && (value === undefined || t.v === value);
  }

  expectPunct(value) {
    if (!this.is('p', value)) {
      const t = this.peek();
      throw new IvyScriptError("Expected '" + value + "'" + (t.t === 'eof' ? ' at the end' : " but found '" + t.v + "'"), { pos: t.pos });
    }
    return this.next();
  }

  program() {
    const statements = [];
    while (!this.is('eof')) {
      if (this.is('p', ';')) { this.next(); continue; }
      statements.push(this.statement());
    }
    return statements;
  }

  /** A statement ends with ';' — or with the end of the script or of its block. */
  end() {
    if (this.is('eof') || this.is('p', '}')) return;
    this.expectPunct(';');
  }

  block() {
    const open = this.expectPunct('{');
    const body = [];
    while (!this.is('p', '}')) {
      if (this.is('eof')) throw new IvyScriptError("A block is not closed with '}'", { pos: open.pos });
      if (this.is('p', ';')) { this.next(); continue; }
      body.push(this.statement());
    }
    this.next();
    return { type: 'block', body, pos: open.pos };
  }

  statement() {
    const start = this.peek();
    if (this.is('p', '{')) return this.block();
    if (this.is('id', 'if')) {
      this.next();
      this.expectPunct('(');
      const test = this.expression();
      this.expectPunct(')');
      const then = this.statement();
      let otherwise = null;
      if (this.is('id', 'else')) { this.next(); otherwise = this.statement(); }
      return { type: 'if', test, then, otherwise, pos: start.pos };
    }
    if (this.is('id', 'import')) {
      // import a.b.C; — the class is then known by its short name
      this.next();
      const parts = [];
      while (!this.is('p', ';') && !this.is('eof')) parts.push(this.next().v);
      this.end();
      return { type: 'import', name: parts.join(''), pos: start.pos };
    }
    if (this.is('id', 'try')) {
      this.next();
      const body = this.block();
      const handlers = [];
      while (this.is('id', 'catch')) {
        this.next();
        this.expectPunct('(');
        const javaType = this.next();
        const name = this.next();
        if (javaType.t !== 'id' || name.t !== 'id') throw new IvyScriptError('Expected catch (Type name)', { pos: javaType.pos });
        this.expectPunct(')');
        handlers.push({ javaType: javaType.v, name: name.v, body: this.block() });
      }
      if (!handlers.length) throw new IvyScriptError("'try' needs a 'catch' in this simulation", { pos: start.pos, kind: 'unsupported' });
      return { type: 'try', body, handlers, pos: start.pos };
    }
    // a local variable: Type name = value;
    const name = this.tokens[this.i + 1];
    const after = this.tokens[this.i + 2];
    const word = t => t && t.t === 'id' && !KEYWORDS.has(t.v) && !LITERALS.has(t.v);
    if (word(start) && word(name) && after && after.t === 'p' && (after.v === '=' || after.v === ';')) {
      this.next();
      this.next();
      let value = null;
      if (this.is('p', '=')) { this.next(); value = this.expression(); }
      this.end();
      return { type: 'declare', varType: start.v, name: name.v, value, pos: start.pos };
    }
    const left = this.expression();
    let node = { type: 'expr', expr: left, pos: start.pos };
    if (this.is('p', '=')) {
      this.next();
      node = { type: 'assign', target: left, value: this.expression(), pos: start.pos };
    }
    this.end();
    return node;
  }

  singleExpression() {
    const expr = this.expression();
    if (!this.is('eof')) {
      const t = this.peek();
      throw new IvyScriptError("Unexpected '" + t.v + "'", { pos: t.pos });
    }
    return expr;
  }

  expression() {
    const test = this.binary(0);
    if (this.is('id', 'as')) {
      // a cast: value as some.Type — the value stays what it is
      this.next();
      this.dottedName();
      return test;
    }
    if (!this.is('p', '?')) return test;
    const mark = this.next();
    const yes = this.expression();
    this.expectPunct(':');
    return { type: 'cond', test, yes, no: this.expression(), pos: mark.pos };
  }

  /** a.b.C */
  dottedName() {
    const first = this.next();
    if (first.t !== 'id') throw new IvyScriptError('Expected a name', { pos: first.pos });
    const parts = [first.v];
    while (this.is('p', '.')) {
      this.next();
      const part = this.next();
      if (part.t !== 'id') throw new IvyScriptError("Expected a name after '.'", { pos: part.pos });
      parts.push(part.v);
    }
    return parts.join('.');
  }

  binary(level) {
    if (level >= LEVELS.length) return this.unary();
    let left = this.binary(level + 1);
    while (this.is('p') && LEVELS[level].includes(this.peek().v)) {
      const op = this.next();
      left = { type: 'binary', op: op.v, left, right: this.binary(level + 1), pos: op.pos };
    }
    return left;
  }

  unary() {
    if (this.is('p', '!') || this.is('p', '-')) {
      const op = this.next();
      return { type: 'unary', op: op.v, operand: this.unary(), pos: op.pos };
    }
    return this.primary();
  }

  primary() {
    const t = this.next();
    let node;
    if (t.t === 'str') node = { type: 'str', value: t.v, pos: t.pos };
    else if (t.t === 'num') node = { type: 'num', value: t.v, pos: t.pos };
    else if (t.t === 'id' && t.v === 'new') {
      const className = this.dottedName();
      this.expectPunct('(');
      const args = [];
      if (!this.is('p', ')')) {
        args.push(this.expression());
        while (this.is('p', ',')) { this.next(); args.push(this.expression()); }
      }
      this.expectPunct(')');
      node = { type: 'new', className, args, pos: t.pos };
    } else if (t.t === 'id') {
      if (KEYWORDS.has(t.v)) {
        throw new IvyScriptError("'" + t.v + "' is not part of this simulation here. " + SUPPORTED_HINT, { pos: t.pos, kind: 'unsupported' });
      }
      if (t.v === 'true' || t.v === 'false') node = { type: 'lit', value: t.v === 'true', pos: t.pos };
      else if (t.v === 'null') node = { type: 'lit', value: null, pos: t.pos };
      else node = { type: 'name', name: t.v, pos: t.pos };
    } else if (t.t === 'p' && t.v === '(') {
      node = this.expression();
      this.expectPunct(')');
    } else if (t.t === 'eof') {
      throw new IvyScriptError('The expression is incomplete', { pos: t.pos });
    } else {
      throw new IvyScriptError("Unexpected '" + t.v + "'", { pos: t.pos });
    }

    for (;;) {
      if (this.is('p', '.')) {
        this.next();
        const prop = this.next();
        if (prop.t !== 'id') throw new IvyScriptError("Expected a name after '.'", { pos: prop.pos });
        node = { type: 'member', object: node, prop: prop.v, pos: prop.pos };
      } else if (this.is('p', '(')) {
        const open = this.next();
        const args = [];
        if (!this.is('p', ')')) {
          args.push(this.expression());
          while (this.is('p', ',')) { this.next(); args.push(this.expression()); }
        }
        this.expectPunct(')');
        node = { type: 'call', callee: node, args, pos: open.pos };
      } else break;
    }
    return node;
  }
}

export function parseScript(source) { return new Parser(source).program(); }
export function parseExpression(source) { return new Parser(source).singleExpression(); }

// ── Evaluation ───────────────────────────────────────────────────────────────

/** Flattens `a.b.c` into ['a','b','c'] when the node is a plain dotted name, else null. */
function dottedName(node) {
  const parts = [];
  let n = node;
  while (n && n.type === 'member') { parts.unshift(n.prop); n = n.object; }
  if (!n || n.type !== 'name') return null;
  parts.unshift(n.name);
  return parts;
}

function fieldOf(ctx, name, pos) {
  const field = (ctx.fields || []).find(f => f.name === name);
  if (!field) {
    throw new IvyScriptError("Field '" + name + "' does not exist on " + (ctx.dataClassName || 'the process data'), { pos, kind: 'field' });
  }
  return field;
}

function isDataRoot(name) { return name === 'in' || name === 'out'; }

/** An object of a data class: { __type: 'tutorial.InvoiceData', invoiceNumber: '…', … }. */
const isTyped = value => value !== null && typeof value === 'object' && typeof value.__type === 'string';
const classOf = (ctx, name) => (ctx.classes && ctx.classes[name]) || null;
const NUMERIC_TYPE = /(^|\.)(BigDecimal|BigInteger|Number|Integer|Long|Double|Float|Short)$/;

/** The field `path[i]` of the data class `type`; throws when that class has no such field. */
function subField(ctx, type, path, i, pos) {
  const cls = classOf(ctx, type);
  const sub = cls ? cls.fields.find(f => f.name === path[i]) : null;
  if (!sub) {
    throw new IvyScriptError("'" + path.slice(0, i + 1).join('.') + "' cannot be read: " + path[i - 1] + ' has no field ' + path[i], { pos, kind: 'field' });
  }
  return sub;
}

/**
 * JSON as langchain4j's Json.toJson writes it: indented, with ` : ` between name and value.
 * Fields of a known data class come in the order of the class, and numbers keep their digits.
 */
export function toJson(value, ctx = {}, indent = '') {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (value.__class) return JSON.stringify(value.__class);
  if (!isTyped(value)) return JSON.stringify(value);
  const cls = classOf(ctx, value.__type);
  const names = cls ? cls.fields.map(f => f.name) : Object.keys(value).filter(k => k !== '__type');
  if (!names.length) return '{ }';
  const inner = indent + '  ';
  return '{\n' + names.map(name => {
    const field = cls ? cls.fields.find(f => f.name === name) : null;
    const v = value[name];
    const number = field && NUMERIC_TYPE.test(field.type) && v != null && /^-?\d+(\.\d+)?$/.test(String(v));
    return inner + JSON.stringify(name) + ' : ' + (number ? String(v) : toJson(v, ctx, inner));
  }).join(',\n') + '\n' + indent + '}';
}

/**
 * Any value as Json.toJson writes it — what a tool hands back to the model: objects over
 * several lines with " : ", lists on one line, entries without a value left out.
 */
export function prettyJson(value, indent = '') {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return value.length ? '[ ' + value.map(item => prettyJson(item, indent)).join(', ') + ' ]' : '[ ]';
  const names = Object.keys(value).filter(name => value[name] !== null && value[name] !== undefined);
  if (!names.length) return '{ }';
  const inner = indent + '  ';
  return '{\n' + names.map(name => inner + JSON.stringify(name) + ' : ' + prettyJson(value[name], inner)).join(',\n') + '\n' + indent + '}';
}

/** A map as Json.toJson writes it. */
export function mapJson(values) {
  const names = Object.keys(values || {});
  if (!names.length) return '{ }';
  return '{\n' + names.map(name => '  ' + JSON.stringify(name) + ' : ' + toJson(values[name], {}, '  ')).join(',\n') + '\n}';
}

/** An exception a script can catch: it carries the name of its Java class. */
function javaError(javaType, message, pos) {
  const error = new IvyScriptError(javaType + ': ' + message, { pos, kind: 'runtime' });
  error.javaType = javaType;
  error.javaMessage = message;
  return error;
}

const JAVA_NUMBER = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?[dDfF]?\s*$/;
const JAVA_INTEGER = /^[-+]?\d+$/;

function parseJavaNumber(value, pattern, pos) {
  if (value === null || value === undefined) throw javaError('NullPointerException', 'the value to parse is null', pos);
  if (typeof value === 'number') return value;
  const raw = text(value);
  if (!pattern.test(raw)) throw javaError('NumberFormatException', raw.trim() === '' ? 'empty String' : 'For input string: "' + raw + '"', pos);
  return parseFloat(raw);
}

/** Static Java methods the tutorial processes call. */
const STATIC_METHODS = {
  'dev.langchain4j.internal.Json.toJson': (args, ctx) => toJson(args[0], ctx),
  'Double.parseDouble': (args, ctx, pos) => parseJavaNumber(args[0], JAVA_NUMBER, pos),
  'Double.valueOf': (args, ctx, pos) => parseJavaNumber(args[0], JAVA_NUMBER, pos),
  'Integer.parseInt': (args, ctx, pos) => parseJavaNumber(args[0], JAVA_INTEGER, pos),
  'Integer.valueOf': (args, ctx, pos) => parseJavaNumber(args[0], JAVA_INTEGER, pos),
  'String.valueOf': args => text(args[0])
};

/** Which thrown Java exception a catch clause takes. */
function catches(declared, thrown) {
  if (declared === thrown || ['Exception', 'Throwable', 'RuntimeException'].includes(declared)) return true;
  return declared === 'IllegalArgumentException' && thrown === 'NumberFormatException';
}

const NUMERIC_LOCAL = /^(double|float|int|long|short|Double|Float|Integer|Long|Short|Number)$/;

function text(value) {
  if (value == null) return '';
  if (typeof value === 'object' && value.__class) return 'class ' + value.__class;
  if (isTyped(value)) {
    return value.__type.split('.').pop() + '[' + Object.keys(value).filter(k => !k.startsWith('__')).map(k => k + '=' + text(value[k])).join(', ') + ']';
  }
  return String(value);
}

function defaultFor(field) {
  const type = field.type || 'String';
  if (type === 'String') return '';
  if (type === 'Number' || type === 'Integer' || type === 'Double') return 0;
  if (type === 'Boolean') return false;
  return null;
}

const STRING_METHODS = {
  toString: s => s,
  equals: (s, a) => typeof a === 'string' && s === a,
  equalsIgnoreCase: (s, a) => typeof a === 'string' && s.toLowerCase() === a.toLowerCase(),
  trim: s => s.trim(),
  toUpperCase: s => s.toUpperCase(),
  toLowerCase: s => s.toLowerCase(),
  length: s => s.length,
  isEmpty: s => s.length === 0,
  isBlank: s => s.trim().length === 0,
  contains: (s, a) => s.includes(text(a)),
  startsWith: (s, a) => s.startsWith(text(a)),
  endsWith: (s, a) => s.endsWith(text(a)),
  replace: (s, a, b) => s.split(text(a)).join(text(b)),
  substring: (s, a, b) => s.substring(Number(a) || 0, b === undefined ? undefined : Number(b))
};

const isNumeric = value => typeof value === 'number' || (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value));

function number(value, pos) {
  if (!isNumeric(value)) throw new IvyScriptError("'" + text(value) + "' is not a number", { pos, kind: 'runtime' });
  return typeof value === 'number' ? value : parseFloat(value);
}

/** A condition has to be true or false; nothing (null) counts as false. */
function truth(value, pos) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined) return false;
  throw new IvyScriptError("'" + text(value) + "' is neither true nor false", { pos, kind: 'runtime' });
}

/** == as IvyScript compares: by value. */
function same(a, b) {
  const none = v => v === null || v === undefined;
  if (none(a) || none(b)) return none(a) && none(b);
  if (isNumeric(a) && isNumeric(b)) return number(a) === number(b);
  if (typeof a === 'object' || typeof b === 'object') return a === b;
  return text(a) === text(b);
}

function evaluate(node, ctx) {
  switch (node.type) {
    case 'str':
    case 'num':
    case 'lit':
      return node.value;
    case 'unary': {
      const value = evaluate(node.operand, ctx);
      return node.op === '!' ? !truth(value, node.pos) : -number(value, node.pos);
    }
    case 'cond':
      return truth(evaluate(node.test, ctx), node.pos) ? evaluate(node.yes, ctx) : evaluate(node.no, ctx);
    case 'binary': {
      if (node.op === '&&') return truth(evaluate(node.left, ctx), node.pos) && truth(evaluate(node.right, ctx), node.pos);
      if (node.op === '||') return truth(evaluate(node.left, ctx), node.pos) || truth(evaluate(node.right, ctx), node.pos);
      const a = evaluate(node.left, ctx);
      const b = evaluate(node.right, ctx);
      switch (node.op) {
        case '+': return typeof a === 'number' && typeof b === 'number' ? a + b : text(a) + text(b);
        case '-': return number(a, node.pos) - number(b, node.pos);
        case '*': return number(a, node.pos) * number(b, node.pos);
        case '/': return number(a, node.pos) / number(b, node.pos);
        case '%': return number(a, node.pos) % number(b, node.pos);
        case '==': return same(a, b);
        case '!=': return !same(a, b);
        case '<': return number(a, node.pos) < number(b, node.pos);
        case '>': return number(a, node.pos) > number(b, node.pos);
        case '<=': return number(a, node.pos) <= number(b, node.pos);
        default: return number(a, node.pos) >= number(b, node.pos);
      }
    }
    case 'name':
    case 'member':
      return evaluateReference(node, ctx);
    case 'new': {
      const make = constructorOf(node, ctx);
      return make(...node.args.map(a => evaluate(a, ctx)));
    }
    case 'call':
      return evaluateCall(node, ctx);
    default:
      throw new IvyScriptError('Unsupported expression', { pos: node.pos, kind: 'unsupported' });
  }
}

/** The classes a script may create with `new` are given by its surroundings (ctx.constructors). */
function constructorOf(node, ctx) {
  const known = ctx.constructors || {};
  const make = known[node.className] || known[node.className.split('.').pop()];
  if (!make) throw new IvyScriptError("'new " + node.className + "' is not part of this simulation. " + SUPPORTED_HINT, { pos: node.pos, kind: 'unsupported' });
  return make;
}

function evaluateReference(node, ctx) {
  const path = dottedName(node);
  if (path) {
    const root = path[0];
    if (isDataRoot(root)) {
      if (path.length === 1) return ctx.data;
      const field = fieldOf(ctx, path[1], node.pos);
      let value = ctx.data[field.name];
      if (value === undefined || value === null) value = defaultFor(field);
      // fields of a data class object, e.g. in.result.totalAmount (null while the object is missing)
      let type = field.type || 'String';
      for (let i = 2; i < path.length; i++) {
        const sub = subField(ctx, type, path, i, node.pos);
        value = value == null ? null : value[sub.name];
        if (value === undefined) value = null;
        type = sub.type;
      }
      return value;
    }
    if (ctx.locals && ctx.locals.has(root)) {
      if (path.length > 1) throw new IvyScriptError("Cannot read '" + path.slice(1).join('.') + "' of " + root, { pos: node.pos, kind: 'unsupported' });
      return ctx.locals.get(root);
    }
    if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, root)) {
      // e.g. param.amount in the mapping of a sub-process start
      let value = ctx.vars[root];
      for (let i = 1; i < path.length; i++) {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'object') throw new IvyScriptError("Cannot read '" + path.slice(i).join('.') + "' of " + path.slice(0, i).join('.'), { pos: node.pos, kind: 'unsupported' });
        value = value[path[i]];
      }
      return value === undefined ? null : value;
    }
    if (root === 'ivy') {
      throw new IvyScriptError("Only ivy.log is available in this simulation, not '" + path.join('.') + "'", { pos: node.pos, kind: 'unsupported' });
    }
    if (path.length > 1 && path[path.length - 1] === 'class') {
      return { __class: path.slice(0, -1).join('.') };
    }
    throw new IvyScriptError("Unknown variable '" + root + "'. Process data is available as in. or out.", { pos: node.pos, kind: 'field' });
  }
  // member access on a computed value, e.g. ("a" + "b").length — only methods are supported
  throw new IvyScriptError("Cannot read '" + node.prop + "' here", { pos: node.pos, kind: 'unsupported' });
}

function evaluateCall(node, ctx) {
  const path = dottedName(node.callee);
  if (path && STATIC_METHODS[path.join('.')]) return STATIC_METHODS[path.join('.')](node.args.map(a => evaluate(a, ctx)), ctx, node.pos);
  // static methods the surroundings provide, e.g. CircuitBreakerSignal.stopAll()
  if (path && ctx.statics && ctx.statics[path.join('.')]) return ctx.statics[path.join('.')](node.args.map(a => evaluate(a, ctx)));
  if (path && path[0] === 'ivy') {
    if (path.length === 3 && path[1] === 'log' && LOG_LEVELS.includes(path[2])) {
      if (node.args.length < 1) throw new IvyScriptError('ivy.log.' + path[2] + '(...) needs a message', { pos: node.pos });
      // further arguments fill {0}, {1}, … of the message
      const rest = node.args.slice(1).map(a => text(evaluate(a, ctx)));
      const message = text(evaluate(node.args[0], ctx)).replace(/\{(\d+)\}/g, (all, n) => (Number(n) < rest.length ? rest[Number(n)] : all));
      if (ctx.log) ctx.log(path[2], message);
      return undefined;
    }
    throw new IvyScriptError("'" + path.join('.') + "(...)' is not available in this simulation — only ivy.log." + LOG_LEVELS.slice(1, 5).join('/') + '(...)', { pos: node.pos, kind: 'unsupported' });
  }
  if (node.callee.type === 'member') {
    const target = evaluate(node.callee.object, ctx);
    const method = node.callee.prop;
    const args = node.args.map(a => evaluate(a, ctx));
    if (target === null || target === undefined) return null; // a call on nothing yields nothing, as in IvyScript
    if (typeof target === 'string' && STRING_METHODS[method]) return STRING_METHODS[method](target, ...args);
    if (typeof target === 'number' && method === 'toString') return String(target);
    if (typeof target === 'boolean' && method === 'toString') return String(target);
    if (target instanceof IvyScriptError && method === 'getMessage') return target.javaMessage || target.message;
    if (target && target.__class && method === 'toString') return text(target);
    // a caught BPM error, as an Error Boundary Event hands it to the process data
    if (target && target.__bpmError && method === 'getMessage') return target.message;
    if (target && target.__bpmError && method === 'getErrorCode') return target.errorCode;
    if (target && target.__bpmError && method === 'getAttribute') {
      const value = (target.attributes || {})[text(args[0])];
      return value === undefined ? null : value;
    }
    if (target && target.__bpmError && method === 'setAttribute') {
      target.attributes = target.attributes || {};
      target.attributes[text(args[0])] = args[1];
      return undefined;
    }
    // an object the surroundings created, e.g. new DecisionMaker(...)
    if (target && target.__native && typeof target[method] === 'function') return target[method](...args);
    throw new IvyScriptError("The method '" + method + "()' is not part of this simulation", { pos: node.callee.pos, kind: 'unsupported' });
  }
  throw new IvyScriptError('This call is not part of this simulation', { pos: node.pos, kind: 'unsupported' });
}

function coerce(field, value, pos) {
  const type = field.type || 'String';
  if (type === 'String') {
    if (isTyped(value)) {
      throw new IvyScriptError('A ' + value.__type + ' object cannot be assigned to ' + field.name + ', which is a String', { pos, kind: 'runtime' });
    }
    return text(value);
  }
  if (type === 'Number' || type === 'Integer' || type === 'Double') {
    const n = typeof value === 'number' ? value : parseFloat(text(value));
    if (Number.isNaN(n)) throw new IvyScriptError("'" + text(value) + "' is not a number, but " + field.name + ' is a ' + type, { pos, kind: 'runtime' });
    return n;
  }
  if (type === 'Boolean') return value === true || text(value) === 'true';
  // every other type is a class: only an object of that class fits (or nothing)
  if (value === null || value === undefined) return null;
  if (isTyped(value) && value.__type === type) return value;
  const what = isTyped(value) ? 'A ' + value.__type + ' object' : typeof value === 'string' ? 'A String' : 'This value';
  throw new IvyScriptError(what + ' cannot be assigned to ' + field.name + ', which is a ' + type, { pos, kind: 'runtime' });
}

function assign(targetNode, value, ctx) {
  const path = dottedName(targetNode);
  if (path && path.length === 1 && ctx.locals && ctx.locals.has(path[0])) {
    ctx.locals.set(path[0], value);
    return;
  }
  if (!path || !isDataRoot(path[0]) || path.length !== 2) {
    throw new IvyScriptError('Only process data fields such as in.summary can be assigned', { pos: targetNode.pos, kind: path ? 'field' : 'unsupported' });
  }
  const field = fieldOf(ctx, path[1], targetNode.pos);
  const coerced = coerce(field, value, targetNode.pos);
  ctx.data[field.name] = coerced;
  if (ctx.onAssign) ctx.onAssign(field.name, coerced);
}

/** Statically checks field references without running anything. */
function check(node, ctx) {
  if (!node) return;
  switch (node.type) {
    case 'import': return;
    case 'new': constructorOf(node, ctx); node.args.forEach(a => check(a, ctx)); return;
    case 'block': node.body.forEach(s => check(s, ctx)); return;
    case 'if': check(node.test, ctx); check(node.then, ctx); check(node.otherwise, ctx); return;
    case 'try':
      check(node.body, ctx);
      node.handlers.forEach(handler => {
        if (ctx.localNames) ctx.localNames.add(handler.name);
        check(handler.body, ctx);
      });
      return;
    case 'declare':
      check(node.value, ctx);
      if (ctx.localNames) ctx.localNames.add(node.name);
      return;
    case 'unary': check(node.operand, ctx); return;
    case 'cond': check(node.test, ctx); check(node.yes, ctx); check(node.no, ctx); return;
    case 'assign': {
      const path = dottedName(node.target);
      if (path && path.length === 1 && ctx.localNames && ctx.localNames.has(path[0])) {
        check(node.value, ctx);
        return;
      }
      if (!path || !isDataRoot(path[0]) || path.length !== 2) {
        throw new IvyScriptError('Only process data fields such as in.summary can be assigned', { pos: node.target.pos, kind: 'field' });
      }
      fieldOf(ctx, path[1], node.target.pos);
      check(node.value, ctx);
      return;
    }
    case 'expr': check(node.expr, ctx); return;
    case 'binary': check(node.left, ctx); check(node.right, ctx); return;
    case 'call': {
      const path = dottedName(node.callee);
      if (path && (STATIC_METHODS[path.join('.')] || (ctx.statics && ctx.statics[path.join('.')]))) {
        node.args.forEach(a => check(a, ctx));
        return;
      }
      if (path && path[0] === 'ivy') {
        if (!(path.length === 3 && path[1] === 'log' && LOG_LEVELS.includes(path[2]))) {
          throw new IvyScriptError("'" + path.join('.') + "(...)' is not available in this simulation — only ivy.log.info/warn/error(...)", { pos: node.pos, kind: 'unsupported' });
        }
      } else if (node.callee.type === 'member') check(node.callee.object, ctx);
      node.args.forEach(a => check(a, ctx));
      return;
    }
    case 'name':
    case 'member': {
      const path = dottedName(node);
      if (!path) { check(node.object, ctx); return; }
      if (isDataRoot(path[0])) {
        if (path.length > 1) {
          let type = fieldOf(ctx, path[1], node.pos).type || 'String';
          for (let i = 2; i < path.length; i++) type = subField(ctx, type, path, i, node.pos).type;
        }
        return;
      }
      if (ctx.localNames && ctx.localNames.has(path[0])) return;
      if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, path[0])) return;
      if (path[0] === 'ivy') return;
      if (path.length > 1 && path[path.length - 1] === 'class') return;
      throw new IvyScriptError("Unknown variable '" + path[0] + "'. Process data is available as in. or out.", { pos: node.pos, kind: 'field' });
    }
    default:
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ScriptContext
 * @property {Object} data                         process data values (shared by in. and out.)
 * @property {{name:string,type?:string}[]} fields data class fields
 * @property {string} [dataClassName]
 * @property {Object} [classes]                     other data classes by full name: { name, fields }
 * @property {Object} [cms]                         CMS objects by path (see macro.js)
 * @property {(level:string,message:string)=>void} [log]
 * @property {(field:string,value:any)=>void} [onAssign]
 * @property {Object} [vars]                       extra variables, e.g. { result }
 */

/** Runs a script step. Throws IvyScriptError. */
export function runScript(source, ctx) {
  const scope = { ...ctx, locals: new Map() };
  parseScript(source).forEach(stmt => execute(stmt, scope));
}

function execute(stmt, ctx) {
  switch (stmt.type) {
    case 'assign':
      assign(stmt.target, evaluate(stmt.value, ctx), ctx);
      return;
    case 'import':
      return;
    case 'declare': {
      const value = stmt.value ? evaluate(stmt.value, ctx) : null;
      ctx.locals.set(stmt.name, value !== null && NUMERIC_LOCAL.test(stmt.varType) ? number(value, stmt.pos) : value);
      return;
    }
    case 'block':
      stmt.body.forEach(s => execute(s, ctx));
      return;
    case 'if':
      if (truth(evaluate(stmt.test, ctx), stmt.test.pos)) execute(stmt.then, ctx);
      else if (stmt.otherwise) execute(stmt.otherwise, ctx);
      return;
    case 'try':
      try {
        execute(stmt.body, ctx);
      } catch (e) {
        const handler = e instanceof IvyScriptError && e.javaType ? stmt.handlers.find(h => catches(h.javaType, e.javaType)) : null;
        if (!handler) throw e;
        ctx.locals.set(handler.name, e);
        execute(handler.body, ctx);
      }
      return;
    default:
      evaluate(stmt.expr, ctx);
  }
}

/** Evaluates one expression and returns its value. Throws IvyScriptError. */
export function evalExpression(source, ctx) {
  return evaluate(parseExpression(source), ctx);
}

/** Executes `<target> = value`, the way the agent maps its result. Throws IvyScriptError. */
export function assignTo(target, value, ctx) {
  assign(parseExpression(target), value, ctx);
}

/** Returns null when the script would run, otherwise the IvyScriptError describing why not. */
export function validateScript(source, ctx) {
  try {
    const scope = { ...ctx, localNames: new Set() };
    parseScript(source).forEach(stmt => check(stmt, scope));
    return null;
  } catch (e) {
    if (e instanceof IvyScriptError) return e;
    throw e;
  }
}

/** Validates a single expression; `assignable` additionally requires an in./out. field. */
export function validateExpression(source, ctx, { assignable = false } = {}) {
  try {
    const node = parseExpression(source);
    if (assignable) check({ type: 'assign', target: node, value: null }, ctx);
    else check(node, ctx);
    return null;
  } catch (e) {
    if (e instanceof IvyScriptError) return e;
    throw e;
  }
}

/** Converts a character offset into a 1-based line/column pair. */
export function positionOf(source, pos) {
  const before = String(source).slice(0, pos);
  const line = before.split('\n').length;
  return { line, column: pos - before.lastIndexOf('\n') };
}
