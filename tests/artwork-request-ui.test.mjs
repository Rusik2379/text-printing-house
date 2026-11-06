import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { randomUUID, webcrypto } from 'node:crypto';
const settle = () => new Promise((r) => setTimeout(r, 20));
async function ui(fetcher) {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), {
      url: 'https://example.invalid/',
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
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.AbortSignal = AbortSignal;
  w.crypto.randomUUID = randomUUID;
  w.crypto.getRandomValues = (a) => webcrypto.getRandomValues(a);
  w.fetch = fetcher;
  w.localStorage.setItem(
    'text-print-cart-v1',
    JSON.stringify([
      { key: 'unrelated-basket', id: '1.1', price: 250, description: 'Existing basket' },
    ]),
  );
  let currentScript;
  Object.defineProperty(d, 'currentScript', { get: () => currentScript });
  for (const script of d.querySelectorAll('script[src]')) {
    const file = new URL(script.src).pathname.split('/').pop();
    if (['consent.js', 'faq.js'].includes(file)) continue;
    currentScript = script;
    w.eval(await readFile(new URL('../' + file, import.meta.url), 'utf8'));
  }
  w.eval(await readFile(new URL('../orders-client.js', import.meta.url), 'utf8'));
  return {
    dom,
    w,
    d,
    fill() {
      const f = d.querySelector('#request-form');
      f.elements.name.value = 'Тест';
      f.elements.phone.value = '+70000000000';
      f.elements.personalDataConsent.checked = true;
      f.elements.comment.value = 'Нужно проверить макет';
      return f;
    },
  };
}
const config = () =>
  Response.json({
    enabled: true,
    mode: 'live',
    maxFileBytes: 104857600,
    maxTotalBytes: 524288000,
    maxFiles: 20,
    retentionDays: 30,
  });
test('Home upload and a service request both use the server without exporting unrelated basket items', async () => {
  const calls = [];
  let body;
  const t = await ui(async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/config')) return config();
    if (String(url).endsWith('/draft')) {
      body = JSON.parse(options.body);
      return Response.json({
        id: 'draft',
        changed: false,
        files: body.files.map(() => ({ id: 'artwork' })),
      });
    }
    if (options.method === 'PUT') return Response.json({ ok: true });
    return Response.json({
      status: 'queued',
      number: 'TXT-TEST',
      links: { pdf: '/order-files/test/quote', zip: '/order-files/test/archive' },
    });
  });
  try {
    const file = new t.w.File(['%PDF original'], 'Макет.pdf', { type: 'application/pdf' });
    t.d.querySelector('.hero-actions [data-action="upload"]').click();
    await settle();
    let form = t.fill(),
      input = form.querySelector('#file-input');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new t.w.Event('change'));
    assert.equal(form.dataset.orderCheckout, 'ready');
    assert.ok(form.textContent.includes('Макет прикреплён: Макет.pdf'));
    assert.equal(
      calls.filter((c) => c.options.method === 'PUT').length,
      0,
      'Choosing a file does not claim delivery',
    );
    form.dispatchEvent(new t.w.Event('submit', { cancelable: true }));
    await settle();
    assert.equal(body.kind, 'request');
    assert.equal(body.items.length, 0);
    assert.equal(body.files[0].name, 'Макет.pdf');
    assert.equal(calls.find((c) => c.options.method === 'PUT').options.body, file);
    assert.ok(t.d.querySelector('.order-confirmation-number').textContent.includes('TXT-TEST'));
    assert.ok(t.d.querySelector('.order-confirmation-status').textContent.includes('в очередь'));
    assert.equal(t.w.TEXT_APP.getCart().length, 1);
    t.w.TEXT_APP.prepareServiceRequest({ id: '5.9', comment: 'Нестандартные размеры', file });
    await settle();
    form = t.fill();
    form.dispatchEvent(new t.w.Event('submit', { cancelable: true }));
    await settle();
    assert.equal(body.kind, 'request');
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].id, '5.9');
    assert.equal(body.items[0].price, null);
    assert.equal(body.files.length, 1);
  } finally {
    t.w.close();
  }
});
test('Unavailable server never switches to email and the same form can reconnect and send', async () => {
  let unavailable = true,
    writes = 0;
  const t = await ui(async (url, options = {}) => {
    if (String(url).endsWith('/config')) {
      if (unavailable) throw Error('Offline');
      return config();
    }
    writes++;
    if (String(url).endsWith('/draft'))
      return Response.json({ id: 'draft', changed: false, files: [] });
    return Response.json({
      status: 'queued',
      number: 'TXT-RETRY',
      links: { pdf: '/order-files/test/quote', zip: '/order-files/test/archive' },
    });
  });
  try {
    t.d.querySelector('.hero-actions [data-action="upload"]').click();
    await settle();
    const form = t.fill();
    assert.equal(form.dataset.orderCheckout, 'unavailable');
    assert.ok(form.textContent.includes('файлы не переданы'));
    assert.equal(writes, 0);
    unavailable = false;
    form.dispatchEvent(new t.w.Event('submit', { cancelable: true }));
    await settle();
    assert.equal(writes, 2);
    assert.ok(t.d.querySelector('.order-confirmation-number').textContent.includes('TXT-RETRY'));
    assert.equal(form.querySelector('[type="submit"]').disabled, true);
  } finally {
    t.w.close();
  }
});
