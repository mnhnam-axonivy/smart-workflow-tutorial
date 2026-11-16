/**
 * The Java tool of the lesson, as far as a browser can have it. Java is not compiled here:
 * what the tool tells the model (name, description, parameters) and the exchange rates are
 * read out of the real FxRateConverterTool.java, and `execute` does in JavaScript what the
 * method of the same name does in Java.
 */

/** The text block or string a method returns: `return """ … """;` or `return "…";`. */
function returned(source, method) {
  const body = new RegExp(method + '\\(\\)\\s*\\{([\\s\\S]*?)\\n  \\}').exec(source);
  if (!body) return '';
  const block = /return\s+"""\n([\s\S]*?)"""/.exec(body[1]);
  if (block) {
    const lines = block[1].split('\n');
    const indent = Math.min(...lines.filter(l => l.trim()).map(l => /^ */.exec(l)[0].length));
    return lines.map(l => l.slice(indent)).join('\n').trim();
  }
  const plain = /return\s+"((?:[^"\\]|\\.)*)"/.exec(body[1]);
  return plain ? plain[1] : '';
}

/** What FxRateConverterTool.java declares: { name, description, params, rates }. */
export function readJavaTool(source) {
  const params = [];
  const pattern = /new ToolParameter\(\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\s*\)/g;
  let m;
  while ((m = pattern.exec(source))) params.push({ name: m[1], description: m[2], type: m[3] });
  const rates = {};
  const table = /RATES_TO_USD\s*=\s*Map\.of\(([\s\S]*?)\);/.exec(source);
  const pair = /"([A-Z]{3})",\s*([\d.]+)/g;
  while (table && (m = pair.exec(table[1]))) rates[m[1]] = parseFloat(m[2]);
  return { name: returned(source, 'name'), description: returned(source, 'description'), params, rates };
}

/** FxRateConverterTool.execute: "10560.00 JPY = 70.75 USD (rate: 0.0067)". */
export function convertToUsd(rates, args) {
  const currency = String(args.currency).toUpperCase().trim();
  const amount = parseFloat(String(args.amount).replace(/[^0-9.]/g, ''));
  if (args.amount == null || args.currency == null || Number.isNaN(amount)) throw new Error('NumberFormatException');
  const rate = Object.prototype.hasOwnProperty.call(rates, currency) ? rates[currency] : 1.0;
  return amount.toFixed(2) + ' ' + currency + ' = ' + (amount * rate).toFixed(2) + ' USD (rate: ' + rate.toFixed(4) + ')';
}

/**
 * The Java tools Smart Workflow would find (SpiLoader): the SPI file has to name the
 * provider class, and the provider has to return the tool.
 * @param {{ tool: string, provider: string, spi: string }} sources  current text of the three files
 */
export function registeredJavaTools(sources) {
  const named = String(sources.spi || '').split(/\r?\n/).map(line => line.replace(/#.*$/, '').trim()).includes('tutorial.tool.TutorialToolProvider');
  if (!named || !/new\s+FxRateConverterTool\s*\(\s*\)/.test(sources.provider || '')) return [];
  const tool = readJavaTool(sources.tool || '');
  return [{ name: tool.name, description: tool.description, params: tool.params, execute: args => convertToUsd(tool.rates, args) }];
}
