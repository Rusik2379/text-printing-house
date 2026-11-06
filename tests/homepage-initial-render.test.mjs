import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('first-paint homepage content survives hydration without replacing its cards or icons', () => {
  const root = new URL('../', import.meta.url);
  const read = (file) => readFileSync(new URL(file, root), 'utf8');
  const dom = new JSDOM(read('index.html'), {
    url: 'https://example.invalid/text-printing-house/',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  const d = w.document;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.ResizeObserver = w.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  w.requestAnimationFrame = () => 0;
  w.cancelAnimationFrame = () => {};
  const hero = d.querySelector('.hero-copy');
  assert.equal(hero.querySelectorAll('[data-icon]').length, 0);
  assert.equal(hero.querySelectorAll('svg.icon').length, 5);
  const heroMarkup = hero.innerHTML;
  const cards = [...d.querySelectorAll('#popular-grid .featured-card')];
  assert.equal(cards.length, 12);
  for (const card of cards) {
    assert.equal(card.tagName, 'A');
    assert.match(card.href, /^https:\/\/example\.invalid\/text-printing-house\//);
    const img = card.querySelector('img');
    assert.ok(
      img.hasAttribute('width') && img.hasAttribute('height') && img.hasAttribute('srcset'),
    );
  }
  let currentScript;
  Object.defineProperty(d, 'currentScript', { get: () => currentScript });
  for (const script of d.querySelectorAll('script[src]')) {
    const file = path.basename(new URL(script.src).pathname);
    currentScript = script;
    w.eval(read(file));
    if (file === 'app.js') break;
  }
  assert.equal(hero.innerHTML, heroMarkup, 'Hero icons and text must not change at hydration');
  const hydrated = [...d.querySelectorAll('#popular-grid .featured-card')];
  assert.deepEqual(hydrated, cards, 'Already rendered popular cards must keep their DOM nodes');
  const catalog = d.querySelector('[data-action="catalog"]');
  assert.ok(w.TEXT_APP && catalog, 'Existing homepage application must initialize');
  dom.window.close();
});
