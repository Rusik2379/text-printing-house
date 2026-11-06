// Report candidates first. --apply removes CSS selectors; review dynamic UI before using it.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as css from 'css-tree';

const root = path.resolve(import.meta.dirname, '..');
const skip = new Set([
  '.git',
  '.work',
  '.build',
  'node_modules',
  'vendor',
  'docs',
  'preview',
  'infrastructure',
]);
async function walk(dir = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(file)));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

const files = await walk();
const tokens = new Set();
const filenames = new Set();
const extensions =
  /[\p{L}\p{N}_%.()-]+\.(?:avif|webp|png|jpe?g|gif|svg|ico|pdf|xlsx|ttf|otf|woff2?)/gu;
for (const file of files.filter((file) => /\.(?:html|js|mjs|json|py|css)$/.test(file))) {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  if (!file.endsWith('.css')) {
    for (const match of source.matchAll(/[a-zA-Z_][a-zA-Z0-9_-]*/g)) tokens.add(match[0]);
  }
  for (const match of source.matchAll(extensions)) filenames.add(match[0]);
}
// Templates and concatenation can create class families, e.g. `is-${state}`.
const prefixes = new Set([...tokens].filter((token) => token.endsWith('-')));
function knownClass(name) {
  if (tokens.has(name)) return true;
  for (let i = name.indexOf('-'); i >= 0; i = name.indexOf('-', i + 1)) {
    if (prefixes.has(name.slice(0, i + 1))) return true;
  }
  return false;
}
function applyEdits(source, edits) {
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  }
  return source;
}
function removeEmptyBlocks(source) {
  while (true) {
    const ast = css.parse(source, { positions: true });
    const edits = [];
    css.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        if (node.block && node.block.children.isEmpty) {
          edits.push({ start: node.loc.start.offset, end: node.loc.end.offset, value: '' });
        }
      },
    });
    if (!edits.length) return source;
    source = applyEdits(source, edits);
  }
}
const unusedSelectors = [];
for (const file of files.filter((file) => file.endsWith('.css'))) {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  const ast = css.parse(source, { positions: true });
  const edits = [];
  css.walk(ast, {
    visit: 'Rule',
    enter(node) {
      if (node.prelude?.type !== 'SelectorList') return;
      const selectors = node.prelude.children.toArray();
      const unused = selectors.filter((selector) =>
        selector.children
          .toArray()
          .some((child) => child.type === 'ClassSelector' && !knownClass(child.name)),
      );
      if (!unused.length) return;
      unusedSelectors.push({ file, selectors: unused.map((selector) => css.generate(selector)) });
      const keep = selectors.filter((selector) => !unused.includes(selector));
      edits.push(
        keep.length
          ? {
              start: node.prelude.loc.start.offset,
              end: node.prelude.loc.end.offset,
              value: keep.map((selector) => css.generate(selector)).join(',\n'),
            }
          : { start: node.loc.start.offset, end: node.loc.end.offset, value: '' },
      );
    },
  });
  if (process.argv.includes('--apply')) {
    const cleaned = removeEmptyBlocks(applyEdits(source, edits));
    if (cleaned !== source) await fs.writeFile(path.join(root, file), cleaned);
  }
}

const orphanAssets = [];
for (const file of files.filter(
  (file) => file.startsWith('assets/') && /\.(avif|webp|png|jpe?g|gif|svg|ico)$/i.test(file),
)) {
  const basename = path.basename(file);
  // These filenames are assembled from catalogue data.
  if (!filenames.has(basename) && !basename.startsWith('popular-art-')) {
    orphanAssets.push({ file, bytes: (await fs.stat(path.join(root, file))).size });
  }
}
await fs.mkdir(path.join(root, '.work'), { recursive: true });
await fs.writeFile(
  path.join(root, '.work/unused-report.json'),
  JSON.stringify({ unusedSelectors, orphanAssets }, null, 2),
);
console.log(
  JSON.stringify({
    unusedSelectorGroups: unusedSelectors.length,
    orphanAssets: orphanAssets.length,
    orphanBytes: orphanAssets.reduce((total, file) => total + file.bytes, 0),
  }),
);
console.log('Review .work/unused-report.json; assets and dynamic classes require manual review.');
