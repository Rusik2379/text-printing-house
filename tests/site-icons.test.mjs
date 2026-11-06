import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM(
    '<body><button aria-label="Загрузить макет"><span data-icon="upload"></span></button><svg class="icon chrome-cart-icon"><path d="M2 3h3l3 13h11l3-10H6"></path></svg><section id="dialog"></section></body>',
    { runScripts: 'outside-only' },
  ),
  w = dom.window;
w.eval(fs.readFileSync('site-icons.js', 'utf8'));
assert.equal(w.document.querySelector('button').getAttribute('aria-label'), 'Загрузить макет');
assert.equal(w.document.querySelector('button svg').dataset.textIcon, 'upload');
assert.equal(w.document.querySelector('.chrome-cart-icon').dataset.textIcon, 'cart');
for (const name of w.TEXT_ICONS.names) {
  const d = JSDOM.fragment(w.TEXT_ICONS.render(name)),
    s = d.querySelector('svg');
  assert.equal(s.getAttribute('aria-hidden'), 'true');
  assert.ok(s.querySelector('g'));
  assert.equal(s.getAttribute('focusable'), 'false');
}
w.document.querySelector('#dialog').innerHTML =
  '<button id="copy">Скопировать <span data-icon="copy"></span></button><span data-icon="info"></span>';
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(w.document.querySelector('#copy svg').dataset.textIcon, 'copy');
assert.equal(w.document.querySelector('#dialog>svg').dataset.textIcon, 'info');
assert.equal(w.document.querySelectorAll('[data-icon]').length, 0);
const count = w.document.querySelectorAll('svg').length;
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(
  w.document.querySelectorAll('svg').length,
  count,
  'Hydration settles without an observer loop',
);
dom.window.close();
console.log(
  'Shared icons: accessible controls, static cart, all glyphs and dynamic dialog hydration passed.',
);
