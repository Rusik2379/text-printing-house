// Render the existing homepage UI before first paint, using its shipped renderer.
// This is a source preparation step; the production image needs no DOM library.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'index.html');
const source = await fs.readFile(file, 'utf8');
const dom = new JSDOM(source, {
  url: 'https://homepage-build.invalid/',
  runScripts: 'outside-only',
  includeNodeLocations: true,
});
const w = dom.window;
const d = w.document;
const grid = d.querySelector('#popular-grid');
assert.ok(grid, 'Homepage popular grid must exist');
const gridLocation = dom.nodeLocation(grid);
const placeholders = [...d.querySelectorAll('[data-icon], svg[data-text-icon]')].map((el) => ({
  name: el.dataset.icon || el.dataset.textIcon,
  location: dom.nodeLocation(el),
}));
grid.replaceChildren(); // Rebuild from the current catalogue, even on subsequent runs.
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.ResizeObserver = w.IntersectionObserver = class {
  observe() {}
  disconnect() {}
};
w.requestAnimationFrame = () => 0;
w.cancelAnimationFrame = () => {};
let currentScript;
Object.defineProperty(d, 'currentScript', { get: () => currentScript });
let rendered = false;
for (const script of d.querySelectorAll('script[src]')) {
  const name = path.basename(new URL(script.src).pathname);
  currentScript = script;
  w.eval(await fs.readFile(path.join(root, name), 'utf8'));
  if (name === 'app.js') {
    rendered = true;
    break;
  }
}
assert.ok(rendered && w.TEXT_ICONS, 'Homepage renderer and shared icons must be available');
assert.equal(grid.children.length, 12, 'The existing twelve popular services must be preserved');

const manifest = JSON.parse(
  await fs.readFile(path.join(root, 'scripts/image-variants.json'), 'utf8'),
);
for (const img of grid.querySelectorAll('img')) {
  const key = decodeURIComponent(new URL(img.src).pathname).slice(1);
  const image = manifest[key];
  assert.ok(image?.variants.length, `Responsive variants missing: ${key}`);
  img.setAttribute('srcset', image.variants.map((v) => `${v.path} ${v.width}w`).join(', '));
  img.setAttribute('sizes', '(max-width: 700px) 62vw, (max-width: 1100px) 30vw, 240px');
  img.setAttribute('decoding', 'async');
}
// Keep relative links so deployment under a path works just like the client renderer.
for (const el of grid.querySelectorAll('[href], [src]')) {
  for (const attr of ['href', 'src']) {
    const value = el.getAttribute(attr);
    if (value?.startsWith('https://homepage-build.invalid/'))
      el.setAttribute(attr, value.slice('https://homepage-build.invalid/'.length));
  }
}
const edits = placeholders.map(({ name, location }) => ({
  start: location.startOffset,
  end: location.endOffset,
  text: w.TEXT_ICONS.render(name),
}));
edits.push({
  start: gridLocation.startTag.endOffset,
  end: gridLocation.endTag.startOffset,
  text: grid.innerHTML,
});
let output = source;
for (const edit of edits.sort((a, b) => b.start - a.start))
  output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
dom.window.close();
if (output !== source) await fs.writeFile(file, output);
console.log(
  `Homepage ready before JavaScript: ${placeholders.length} icons and 12 responsive popular services.`,
);
