/**
 * Preview of the Feature Guide without an Axon Ivy engine.
 *
 * It serves the tutorial project's real page — TutorialPages.xhtml with its scripts, styles,
 * markdown and images — after resolving the few JSF bits the engine would normally render
 * (the bean's markdown, the CMS image bridge, CMS labels). Use it to develop a simulation and
 * to check how it sits in the guide:
 *
 *   npm run preview            →  http://127.0.0.1:4310/
 *   …/?lang=jp                 start with the Japanese session language
 *   …/?renderer=canvas         force the 2D fallback renderer
 */
import http from 'node:http';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../runtime/model/yaml.js';

const here = dirname(fileURLToPath(import.meta.url));
const tutorial = resolve(here, '../../../tutorial');
const resources = join(tutorial, 'webContent/resources');
const cms = join(tutorial, 'cms');

const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.html': 'text/html; charset=utf-8' };
const FOLDERS = { Feature: ['Features', 'feature-'], Practice: ['Practices', 'practice-'], Appendix: ['Appendix', 'appendix-'] };

const escapeHtml = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const read = file => readFileSync(file, 'utf8');

/** Same choice the bean makes: Japanese = the "_ja" file, otherwise the first non-Japanese one. */
function markdown(kind, id, japanese) {
  const [folder, prefix] = FOLDERS[kind];
  const base = join(cms, 'Files', folder, prefix + id);
  const candidates = japanese ? [base + '_ja.md'] : [base + '.md', base + '_en.md'];
  const file = candidates.find(existsSync);
  return file ? read(file) : '';
}

function allMarkdown() {
  const out = [];
  Object.values(FOLDERS).forEach(([folder]) => {
    const dir = join(cms, 'Files', folder);
    readdirSync(dir).filter(f => f.endsWith('.md')).forEach(f => out.push(read(join(dir, f))));
  });
  return out;
}

function imagePaths() {
  const seen = new Set();
  allMarkdown().forEach(md => {
    for (const m of md.matchAll(/\(cms:(\/[^)]+)\)/g)) seen.add(m[1]);
  });
  return [...seen];
}

const imageFile = (path, suffix = '') => join(cms, path + suffix + '.png');

let labels = null;
function cmsLabel(path) {
  if (!labels) labels = parseYaml(read(join(cms, 'cms_en.yaml'))).value;
  let node = labels;
  for (const key of path.split('/').filter(Boolean)) node = node && typeof node === 'object' ? node[key] : undefined;
  return typeof node === 'string' ? node : path.split('/').pop();
}

function guidePage(query) {
  const xhtml = read(join(tutorial, 'dialog/tutorial/TutorialPages/TutorialPages.xhtml'));
  const open = '<ui:define name="content">';
  let body = xhtml.slice(xhtml.indexOf(open) + open.length, xhtml.lastIndexOf('</ui:define>'));

  const paths = imagePaths();
  const bridge = paths.map(p => '<span data-cms-path="' + p + '"><img src="/cms' + p + '" alt="" /></span>').join('\n');
  const japaneseBridge = paths.filter(p => existsSync(imageFile(p, '_ja'))).map(p =>
    '<span data-cms-path-ja="' + p + '"><img src="data:image/png;base64,' + readFileSync(imageFile(p, '_ja')).toString('base64') + '" alt="" /></span>').join('\n');

  body = body
    .replace(/<h:outputStylesheet\s+library="css"\s+name="([^"]+)"\s*\/>/g, '<link rel="stylesheet" href="/resources/css/$1" />')
    .replace(/<h:outputScript\s+library="js"\s+name="([^"]+)"\s*\/>/g, '<script src="/resources/js/$1"></script>')
    .replace(/#\{tutorialPagesBean\.sessionLang\}/g, query.get('lang') === 'jp' ? 'jp' : 'en')
    .replace(/#\{tutorialPagesBean\.get(Jp)?(Feature|Practice|Appendix)\('(\w+)'\)\}/g, (m, jp, kind, id) => escapeHtml(markdown(kind, id, Boolean(jp))))
    .replace(/<ui:repeat value="#\{tutorialPagesBean\.cmsImagePaths\}"[\s\S]*?<\/ui:repeat>/, bridge)
    .replace(/<ui:repeat value="#\{tutorialPagesBean\.jpCmsImagePaths\}"[\s\S]*?<\/ui:repeat>/, japaneseBridge)
    .replace(/#\{ivy\.cms\.co\('([^']+)'\)\}/g, (m, key) => escapeHtml(cmsLabel(key)))
    .replace(/<h:form[^>]*>/g, '<form onsubmit="return false" style="display:inline">')
    .replace(/<\/h:form>/g, '</form>')
    .replace(/<p:commandButton\s+value="([^"]*)"[\s\S]*?\/>/g, '<button type="button" class="sw-lang-btn">$1</button>');

  const leftover = body.match(/#\{[^}]*\}|<\/?(?:h|p|ui|f):[\w-]+/);
  if (leftover) console.warn('[preview] not resolved: ' + leftover[0]);

  // only the two known values ever reach the page, so the query cannot inject script
  const renderer = ['webgl', 'canvas'].includes(query.get('renderer')) ? query.get('renderer') : null;
  const options = renderer ? '<script>window.swInteractiveOptions = { renderer: "' + renderer + '" };</script>' : '';
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Smart Workflow Feature Guide (preview)</title>' +
    // rough stand-in for the Freya theme the engine adds around the dialog
    '<style>:root{--ivy-primary-color:#007095}body{margin:0;background:#f8f9fa;font:14px "Segoe UI",system-ui,sans-serif}' +
    '#content{padding:24px 32px}button{font:inherit}</style>' + options + '</head>' +
    '<body class="body-hd"><div id="content" class="container frame full-width">' + body + '</div></body></html>';
}

function send(res, status, type, content) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(content);
}

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/') return send(res, 200, TYPES['.html'], guidePage(url.searchParams));
    if (url.pathname === '/favicon.ico') return send(res, 204, 'image/x-icon', '');
    let file = null;
    if (url.pathname.startsWith('/resources/')) file = join(resources, normalize(decodeURIComponent(url.pathname.slice('/resources/'.length))));
    else if (url.pathname.startsWith('/cms/')) file = imageFile(normalize(decodeURIComponent(url.pathname.slice('/cms'.length))));
    // inside those folders only (with the separator, so a sibling folder with a similar name does not count)
    if (file && (file.startsWith(resources + sep) || file.startsWith(cms + sep)) && existsSync(file)) {
      return send(res, 200, TYPES[extname(file)] || 'application/octet-stream', readFileSync(file));
    }
    return send(res, 404, 'text/plain', 'Not found');
  } catch (e) {
    console.error(e); // the details stay in the console
    return send(res, 500, 'text/plain', 'Internal error');
  }
}

/** Starts the preview server; resolves with { url, close }. Port 0 picks a free port. */
export function start(port = 4310) {
  return new Promise((resolveStart, reject) => {
    const server = http.createServer(handle);
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolveStart({ url: 'http://127.0.0.1:' + server.address().port + '/', close: () => new Promise(done => server.close(done)) });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await start(Number(process.env.PORT) || 4310);
  console.log('Feature Guide preview: ' + url);
}
