// Keep the addition contract identical across every published calculator.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { randomUUID } from 'node:crypto';
const root = new URL('../', import.meta.url),
  sources = new Map();
async function read(file) {
  if (!sources.has(file)) sources.set(file, await readFile(new URL(file, root), 'utf8'));
  return sources.get(file);
}
const catalog = {};
catalog.window = catalog;
vm.createContext(catalog);
for (const group of ['copycenter', 'project', 'leaflet', 'sticker', 'wide-format', 'uv'])
  vm.runInContext(await read(group + '-services.js'), catalog);
const services = ['COPYCENTER', 'PROJECT', 'LEAFLET', 'STICKER', 'WIDE', 'UV'].flatMap((group) =>
  Object.values(catalog['TEXT_' + group + '_SERVICES']),
);
let mobile = 0;
for (const service of services) {
  const dom = new JSDOM(await read(service.path + 'index.html'), {
      url: 'https://example.invalid/' + service.path,
      runScripts: 'outside-only',
    }),
    w = dom.window,
    d = w.document;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.ResizeObserver = w.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  w.requestAnimationFrame = () => 0;
  w.cancelAnimationFrame = () => {};
  w.crypto.randomUUID = randomUUID;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  let currentScript;
  Object.defineProperty(d, 'currentScript', { get: () => currentScript });
  try {
    for (const script of d.querySelectorAll('script[src]')) {
      const file = path.basename(new URL(script.src).pathname);
      if (['consent.js', 'faq.js'].includes(file)) continue;
      currentScript = script;
      w.eval(await read(file));
    }
    const add = d.querySelector('[data-cc-add],#sp-add');
    assert.ok(add && !add.disabled, service.id + ' can be ordered');
    add.click();
    await new Promise((r) => setImmediate(r));
    assert.equal(w.TEXT_APP.getCart().length, 1, service.id + ' was added');
    assert.equal(
      d.querySelector('dialog').open,
      false,
      service.id + ' must keep the calculator visible',
    );
    assert.match(
      d.querySelector('#toast').textContent,
      /корзин/i,
      service.id + ' confirms the addition',
    );
    const mobileAdd = d.querySelector('#sp-mobile-total');
    if (mobileAdd) {
      mobileAdd.click();
      await new Promise((r) => setImmediate(r));
      assert.equal(w.TEXT_APP.getCart().length, 2, service.id + ' mobile add works');
      assert.equal(
        d.querySelector('dialog').open,
        false,
        service.id + ' mobile add must keep the calculator visible',
      );
      mobile++;
    }
    d.querySelector('header [data-action="cart"]').click();
    assert.equal(
      d.querySelector('dialog').open,
      true,
      service.id + ' still opens the basket on an explicit action',
    );
  } finally {
    w.close();
  }
}
assert.equal(services.length, 55);
console.log(
  'Cart behavior: all 55 calculators add without opening the basket; ' +
    mobile +
    ' mobile add buttons and explicit basket opening verified.',
);
