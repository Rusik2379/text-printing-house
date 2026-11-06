import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
const root = fileURLToPath(new URL('../', import.meta.url)),
  manifest = JSON.parse(await readFile(path.join(root, 'scripts/image-variants.json'), 'utf8'));
let pages = 0,
  images = 0;
async function walk(dir = '') {
  for (const e of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (
      e.name.startsWith('.') ||
      [
        'node_modules',
        'vendor',
        'tests',
        'docs',
        'assets',
        'preview',
        'scripts',
        'deploy',
      ].includes(e.name)
    )
      continue;
    const file = path.posix.join(dir, e.name);
    if (e.isDirectory()) await walk(file);
    else if (e.name === 'index.html') {
      const full = path.join(root, file),
        html = await readFile(full, 'utf8'),
        dom = new JSDOM(html, { includeNodeLocations: true }),
        edits = [];
      for (const img of dom.window.document.images) {
        const src = img.getAttribute('src');
        if (!src || /^(?:https?:|data:)/.test(src)) continue;
        const key = path
            .relative(root, path.resolve(path.dirname(full), src.split('?')[0]))
            .split(path.sep)
            .join('/'),
          info = manifest[key];
        if (!info) continue;
        const rel = (p) =>
          path.relative(path.dirname(full), path.join(root, p)).split(path.sep).join('/');
        const sizes = key.endsWith('/sibsoft-logo.png')
          ? '(max-width: 380px) 144px, (max-width: 700px) 160px, 196px'
          : img.closest('.featured-art')
            ? '(max-width: 700px) 62vw, (max-width: 1100px) 30vw, 240px'
            : img.closest('.equipment-mini-img')
              ? '160px'
              : '(max-width: 700px) calc(100vw - 40px), (max-width: 1100px) calc(50vw - 40px), 650px';
        const l = dom.nodeLocation(img);
        let tag = html
          .slice(l.startOffset, l.endOffset)
          .replace(/\s(?:srcset|sizes|decoding)="[^"]*"/g, '');
        tag = tag.replace(
          /\s*\/?>$/,
          ` srcset="${info.variants.map((v) => rel(v.path) + ' ' + v.width + 'w').join(', ')}" sizes="${sizes}" decoding="async">`,
        );
        edits.push({ start: l.startOffset, end: l.endOffset, tag });
        images++;
      }
      let out = html;
      for (const e of edits.sort((a, b) => b.start - a.start))
        out = out.slice(0, e.start) + e.tag + out.slice(e.end);
      dom.window.close();
      if (out !== html) {
        await writeFile(full, out);
        pages++;
      }
    }
  }
}
await walk();
console.log(`Responsive image markup: ${images} placements on ${pages} updated pages.`);
