// Checks the tutorial pages. No dependencies: node .github/scripts/check-docs.mjs
//
// Every page exists in several places, and they must stay the same:
//   tutorial/doc/<page>.md       = tutorial/cms/Files/<Folder>/<page>.md  (and <page>_en.md, if there is one)
//   tutorial/doc/jp/<page>.md    = tutorial/cms/Files/<Folder>/<page>_ja.md
// It also checks that every page has an English and a Japanese version, that every page the
// guide lists (TutorialPagesBean) exists, and that every image a page uses exists.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tutorial = join(root, 'tutorial');
const docDir = join(tutorial, 'doc');
const jpDir = join(docDir, 'jp');
const cmsDir = join(tutorial, 'cms/Files');
const imagesDir = join(cmsDir, 'Images');
const FOLDERS = { feature: 'Features', practice: 'Practices', appendix: 'Appendix' };

const problems = [];
const rel = path => relative(root, path).replace(/\\/g, '/');
// line endings depend on the checkout (Windows), so they do not count as a difference
const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const mdFiles = dir => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md')) : []);
const pageOf = file => file.replace(/\.md$/, '');
const cmsFile = (page, suffix = '') => {
  const folder = FOLDERS[page.split('-')[0]];
  return folder ? join(cmsDir, folder, page + suffix + '.md') : null;
};

function same(a, b) {
  if (!existsSync(a)) { problems.push('missing: ' + rel(a)); return; }
  if (!existsSync(b)) { problems.push('missing: ' + rel(b) + ' (a copy of ' + rel(a) + ')'); return; }
  if (read(a) !== read(b)) problems.push('not the same: ' + rel(a) + ' and ' + rel(b));
}

// 1 — the copies are the same
const pages = mdFiles(docDir).map(pageOf);
for (const page of pages) {
  const cms = cmsFile(page);
  if (!cms) { problems.push('unknown kind of page: ' + rel(join(docDir, page + '.md'))); continue; }
  same(join(docDir, page + '.md'), cms);
  const en = cmsFile(page, '_en');
  if (existsSync(en)) same(join(docDir, page + '.md'), en);
  same(join(jpDir, page + '.md'), cmsFile(page, '_ja'));
}

// 2 — nothing exists in one place only
for (const page of mdFiles(jpDir).map(pageOf)) {
  if (!pages.includes(page)) problems.push('Japanese page without an English one: ' + rel(join(jpDir, page + '.md')));
}
for (const folder of Object.values(FOLDERS)) {
  for (const file of mdFiles(join(cmsDir, folder))) {
    const page = pageOf(file).replace(/_(en|ja)$/, '');
    if (!pages.includes(page)) problems.push('CMS page without a copy in tutorial/doc: ' + rel(join(cmsDir, folder, file)));
  }
}

// 3 — every page the guide lists exists
const bean = read(join(tutorial, 'src/tutorial/TutorialPagesBean.java'));
const count = Number((/FEATURE_COUNT\s*=\s*(\d+)/.exec(bean) || [])[1] || 0);
const ids = name => ((new RegExp(name + '\\s*=\\s*List\\.of\\(([^)]*)\\)').exec(bean) || [])[1] || '').match(/\d+/g) || [];
const listed = [
  ...Array.from({ length: count }, (_, i) => 'feature-' + String(i + 1).padStart(2, '0')),
  ...ids('PRACTICE_IDS').map(id => 'practice-' + id),
  ...ids('APPENDIX_IDS').map(id => 'appendix-' + id)
];
if (!listed.length) problems.push('could not read the page list in TutorialPagesBean.java');
for (const page of listed) {
  if (!pages.includes(page)) problems.push('listed in TutorialPagesBean.java but missing: tutorial/doc/' + page + '.md');
}

// 4 — every image a page uses exists (cms:/Files/Images/<name>, with or without extension)
const images = existsSync(imagesDir) ? readdirSync(imagesDir) : [];
const hasImage = name => images.some(file => {
  const base = file.replace(/\.[^.]+$/, '');
  return file === name || base === name || base === name + '_en' || base === name + '_ja';
});
const pageFiles = [
  ...mdFiles(docDir).map(f => join(docDir, f)),
  ...mdFiles(jpDir).map(f => join(jpDir, f)),
  ...Object.values(FOLDERS).flatMap(folder => mdFiles(join(cmsDir, folder)).map(f => join(cmsDir, folder, f)))
];
for (const file of pageFiles) {
  for (const m of read(file).matchAll(/cms:\/Files\/Images\/([\w.-]+)/g)) {
    if (!hasImage(m[1])) problems.push('missing image ' + m[1] + ' (used in ' + rel(file) + ')');
  }
}

if (problems.length) {
  console.error(problems.length + ' problem(s):\n' + [...new Set(problems)].map(p => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('OK: ' + pages.length + ' pages, their copies are the same, both languages exist, all images exist.');
