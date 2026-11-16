/**
 * Parser for the subset of YAML that variables.yaml uses: nested maps of string values,
 * indented with spaces, with `#` comments. Values stay strings, as Ivy variables are.
 */

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function unquote(raw) {
  const v = raw.trim();
  if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
    return v.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
  }
  if (v.length >= 2 && v[0] === "'" && v[v.length - 1] === "'") return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** Finds the colon that separates key and value, ignoring colons inside quotes. */
function splitKeyValue(content) {
  let quote = null;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === ':' && (i === content.length - 1 || /\s/.test(content[i + 1]))) {
      return [content.slice(0, i), content.slice(i + 1)];
    }
  }
  return null;
}

/**
 * @returns {{ value: Object, errors: {line:number,message:string}[] }}
 */
export function parseYaml(source) {
  const errors = [];
  const root = {};
  // One frame per open map: `indent` of its key line, `childIndent` of its entries.
  const stack = [{ indent: -1, node: root, childIndent: null }];

  String(source == null ? '' : source).split(/\r?\n/).forEach((rawLine, index) => {
    const lineNo = index + 1;
    if (!rawLine.trim()) return;
    if (/^ *\t/.test(rawLine)) {
      errors.push({ line: lineNo, message: 'Indent with spaces, not tabs' });
      return;
    }
    const line = stripComment(rawLine).replace(/\s+$/, '');
    const content = line.trim();
    if (!content || content === '---') return;
    const indent = line.length - line.trimStart().length;

    if (content === '-' || content.startsWith('- ')) {
      errors.push({ line: lineNo, message: 'Lists are not used in variables.yaml — expected "Key: value"' });
      return;
    }
    const kv = splitKeyValue(content);
    if (!kv) {
      errors.push({ line: lineNo, message: 'Expected "Key: value"' });
      return;
    }
    const key = unquote(kv[0]);
    const rest = kv[1].trim();
    if (!key) {
      errors.push({ line: lineNo, message: 'The key before ":" is missing' });
      return;
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const frame = stack[stack.length - 1];
    if (frame.childIndent == null) frame.childIndent = indent;
    else if (frame.childIndent !== indent) {
      errors.push({ line: lineNo, message: 'Indentation does not match the lines above' });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(frame.node, key)) {
      errors.push({ line: lineNo, message: 'The key "' + key + '" is defined twice' });
    }
    if (rest === '') {
      const child = {};
      frame.node[key] = child;
      stack.push({ indent, node: child, childIndent: null });
    } else {
      frame.node[key] = unquote(rest);
    }
  });

  return { value: root, errors };
}

/** Reads `AI.DefaultProvider`-style paths below the top-level `Variables:` key. */
export function readVariable(parsed, path) {
  let node = parsed && parsed.Variables;
  for (const key of path.split('.')) {
    if (node == null || typeof node !== 'object') return '';
    node = node[key];
  }
  return typeof node === 'string' ? node : '';
}

/** True when `Variables.<path>` exists as a nested block. */
export function hasBlock(parsed, path) {
  let node = parsed && parsed.Variables;
  for (const key of path.split('.')) {
    if (node == null || typeof node !== 'object') return false;
    node = node[key];
  }
  return node != null && typeof node === 'object';
}

/**
 * Sets `Variables.<path>` in the text of a variables.yaml and returns the new text. The
 * line that holds the value is rewritten; keys that do not exist yet are added at the end of
 * the block they belong to. Comments and everything else stay as they are.
 */
export function setVariable(source, path, value) {
  const lines = String(source == null ? '' : source).replace(/\r\n/g, '\n').split('\n');
  const keys = ['Variables'].concat(path.split('.'));
  const quoted = '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  const indentOf = line => /^ */.exec(line)[0].length;
  const isEntry = line => Boolean(stripComment(line).trim());
  let from = 0; // first line of the block that is searched
  let to = lines.length; // one past its last line
  let indent = -1; // indent of the key that owns the block
  for (let depth = 0; depth < keys.length; depth++) {
    let found = -1;
    let childIndent = null;
    for (let i = from; i < to; i++) {
      if (!isEntry(lines[i])) continue;
      const at = indentOf(lines[i]);
      if (childIndent === null) childIndent = at;
      if (at !== childIndent) continue;
      const pair = splitKeyValue(stripComment(lines[i]).trim());
      if (pair && unquote(pair[0]) === keys[depth]) { found = i; break; }
    }
    if (found < 0) {
      // add the rest of the path at the end of this block
      const base = childIndent !== null ? childIndent : indent + 2;
      let at = to;
      while (at > from && !isEntry(lines[at - 1])) at--;
      const added = keys.slice(depth).map((key, n) => ' '.repeat(base + n * 2) + key + ':' + (depth + n === keys.length - 1 ? ' ' + quoted : ''));
      lines.splice(at, 0, ...added);
      return lines.join('\n');
    }
    if (depth === keys.length - 1) {
      const head = /^( *)([^:]+:)/.exec(lines[found]);
      const comment = lines[found].slice(stripComment(lines[found]).length);
      lines[found] = head[1] + head[2] + ' ' + quoted + (comment ? ' ' + comment.trim() : '');
      return lines.join('\n');
    }
    // the block of the key that was found: the lines below it that are indented deeper
    indent = indentOf(lines[found]);
    from = found + 1;
    let end = from;
    while (end < to && (!isEntry(lines[end]) || indentOf(lines[end]) > indent)) end++;
    to = end;
  }
  return lines.join('\n');
}
