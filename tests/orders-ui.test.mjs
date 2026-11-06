import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { randomUUID, webcrypto } from 'node:crypto';
const source = await readFile(new URL('../orders-client.js', import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 10));
test('Cart design rate, delivery choice and Back preserve the checkout draft', async () => {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), {
      url: 'http://localhost/',
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
  w.crypto.randomUUID = randomUUID;
  w.crypto.getRandomValues = (a) => webcrypto.getRandomValues(a);
  w.AbortSignal = AbortSignal;
  let currentScript;
  Object.defineProperty(d, 'currentScript', { get: () => currentScript });
  w.localStorage.setItem(
    'text-print-cart-v1',
    JSON.stringify([{ key: 'product', id: '1.1', price: 250, description: 'A4' }]),
  );
  w.fetch = async () =>
    Response.json({
      enabled: true,
      mode: 'preview',
      maxFileBytes: 1e8,
      maxTotalBytes: 5e8,
      maxFiles: 20,
      retentionDays: 30,
    });
  try {
    for (const script of d.querySelectorAll('script[src]')) {
      const name = new URL(script.src).pathname.split('/').pop();
      if (['consent.js', 'faq.js'].includes(name)) continue;
      currentScript = script;
      w.eval(await readFile(new URL('../' + name, import.meta.url), 'utf8'));
    }
    w.eval(source);
    w.TEXT_APP.openCart();
    d.querySelector('[data-design-choice="design-basic"]').click();
    assert.match(d.querySelector('.cart-summary').textContent, /1.000/);
    d.querySelector('[name="fulfillment"][value="delivery"]').click();
    d.querySelector('[data-action="request"][data-cart="true"]').click();
    assert.ok(d.querySelector('.cart-shipping-error:not([hidden])'));
    w.TEXT_GEO.choose({
      name: 'Калистратиха',
      region: 'Алтайский край',
      district: 'Калманский район',
      oktmo: 'test-town',
    });
    d.querySelector('[data-action="request"][data-cart="true"]').click();
    await tick();
    let form = d.querySelector('#request-form');
    form.elements.name.value = 'Локальный тест';
    form.elements.phone.value = '+79990000000';
    form.elements.comment.value = 'Сохранить порядок';
    d.querySelector('[data-checkout-back]').click();
    assert.ok(d.querySelector('.cart-panel'));
    assert.ok(d.querySelector('[data-design-choice="design-basic"]').checked);
    d.querySelector('[data-action="request"][data-cart="true"]').click();
    await tick();
    form = d.querySelector('#request-form');
    assert.equal(form.elements.name.value, 'Локальный тест');
    assert.equal(form.elements.comment.value, 'Сохранить порядок');
    assert.match(d.querySelector('.checkout-delivery-summary').textContent, /Калистратиха/);
  } finally {
    w.close();
  }
});
test('Shipped checkout switches contact channel and requires Telegram username', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.invalid/', runScripts: 'outside-only' }),
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
  let currentScript, payload;
  Object.defineProperty(d, 'currentScript', { get: () => currentScript });
  w.localStorage.setItem(
    'text-print-cart-v1',
    JSON.stringify([{ key: 'row-1', id: '1.1', price: 250, description: 'A4' }]),
  );
  w.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/config'))
      return Response.json({
        enabled: true,
        mode: 'preview',
        maxFileBytes: 104857600,
        maxTotalBytes: 524288000,
        maxFiles: 20,
        retentionDays: 30,
      });
    if (String(url).endsWith('/draft')) {
      payload = JSON.parse(options.body);
      return Response.json({ id: 'draft-id', changed: false, total: 250, files: [] });
    }
    return Response.json({
      status: 'preview',
      number: 'TXT-123',
      links: { pdf: '/order-files/key/quote', zip: '/order-files/key/archive' },
    });
  };
  try {
    for (const script of d.querySelectorAll('script[src]')) {
      const file = new URL(script.src).pathname.split('/').pop();
      if (['consent.js', 'faq.js'].includes(file)) continue;
      currentScript = script;
      w.eval(await readFile(new URL('../' + file, import.meta.url), 'utf8'));
    }
    w.eval(source);
    w.TEXT_APP.openCart();
    d.querySelector('[data-action="request"][data-cart="true"]').click();
    await tick();
    const form = d.querySelector('#request-form'),
      username = form.elements.telegram,
      field = form.querySelector('.checkout-telegram-field');
    form.elements.name.value = 'Иван';
    form.elements.phone.value = '+79991112233';
    form.elements.personalDataConsent.checked = true;
    const choose = (value) => {
      const radio = form.querySelector('[name="contactChannel"][value="' + value + '"]');
      radio.click();
    };
    assert.equal(field.hidden, true);
    assert.equal(username.disabled, true);
    assert.equal(form.checkValidity(), true);
    choose('telegram');
    assert.equal(field.hidden, false);
    assert.equal(username.required, true);
    assert.equal(form.checkValidity(), false);
    username.value = 'https://t.me/customer_test';
    assert.equal(form.checkValidity(), false);
    username.value = '@customer_test';
    assert.equal(form.checkValidity(), true);
    choose('max');
    assert.equal(field.hidden, true);
    assert.equal(new w.FormData(form).has('telegram'), false);
    assert.equal(form.checkValidity(), true);
    choose('telegram');
    form.dispatchEvent(new w.Event('submit', { cancelable: true }));
    await tick();
    assert.equal(payload.contact.channel, 'telegram');
    assert.equal(payload.contact.telegram, '@customer_test');
    assert.equal(payload.contact.phone, '+79991112233');
    assert.equal(form.querySelector('[type="submit"]').disabled, true);
  } finally {
    w.close();
  }
});
test('Checkout uploads originals, asks before updated price, retries and keeps basket', async () => {
  const dom = new JSDOM(
    '<div><p class="dialog-intro"></p><form><input name="name" value="Иван"><input name="phone" value="+79991112233"><textarea name="comment">Заказ</textarea><input name="personalDataConsent" value="2026-10-07"><input id="file-input" type="file"><p id="file-feedback"></p><div class="form-actions"><button type="submit">Отправить</button><button id="download-request" type="button">Скачать</button></div><p class="form-disclosure"></p></form></div>',
    { url: 'https://example.invalid/', runScripts: 'outside-only' },
  );
  const w = dom.window;
  w.AbortSignal = AbortSignal;
  w.crypto.randomUUID = randomUUID;
  w.crypto.getRandomValues = (a) => webcrypto.getRandomValues(a);
  w.eval(source);
  let calls = [],
    fails = true;
  const file = new w.File(['original'], 'макет.pdf', { type: 'application/pdf' }),
    items = [{ key: 'row-1', id: '1.1', price: 1, fileName: 'макет.pdf' }];
  w.TEXT_FILES = { get: async () => file, validate: () => '' };
  w.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/config'))
      return Response.json({
        enabled: true,
        mode: 'live',
        maxFileBytes: 104857600,
        maxTotalBytes: 524288000,
        maxFiles: 20,
        retentionDays: 30,
      });
    if (String(url).endsWith('/draft'))
      return Response.json({
        id: 'draft-id',
        changed: true,
        total: 250,
        upper: 250,
        files: [{ id: 'file-id' }],
      });
    if (options.method === 'PUT') {
      assert.equal(options.body, file);
      return Response.json({ ok: true });
    }
    if (fails) {
      fails = false;
      throw Error('Сеть недоступна');
    }
    return Response.json({
      status: 'queued',
      number: 'TXT-123',
      links: {
        pdf: 'https://example.invalid/order-files/key/quote',
        zip: 'https://example.invalid/order-files/key/archive',
      },
    });
  };
  const form = w.document.querySelector('form'),
    submit = form.querySelector('[type="submit"]');
  await w.TEXT_ORDER_CHECKOUT.mount({
    form,
    siteRoot: w.location.href,
    getItems: () => items,
    getFile: () => null,
    notify: () => {},
  });
  form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  await tick();
  assert.ok(submit.textContent.includes('Подтвердить'));
  assert.equal(calls.filter((c) => c.options.method === 'PUT').length, 0);
  form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  await tick();
  assert.equal(calls.filter((c) => c.options.method === 'PUT').length, 1);
  assert.ok(form.textContent.includes('Сеть недоступна'));
  assert.equal(submit.disabled, false);
  form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  await tick();
  assert.equal(
    calls.filter((c) => c.options.method === 'PUT').length,
    1,
    'Already uploaded file is not re-uploaded',
  );
  assert.equal(submit.disabled, true);
  assert.ok(
    w.document
      .querySelector('.order-confirmation-status')
      .textContent.includes('Уведомление поставлено в очередь'),
  );
  assert.equal(items.length, 1);
  assert.equal(w.document.querySelectorAll('.order-confirmation a[href*="order-files"]').length, 2);
  dom.window.close();
});
