import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createSiteServer } from '../server.mjs';
import { passwordRecord } from '../.server/auth.mjs';
import { atomicJson } from '../.server/storage.mjs';
import { JSDOM } from 'jsdom';
test('Submitted orders persist in the protected admin list with contacts, search and exports', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'text-admin-orders-')),
    password = 'isolated-orders-test-2026';
  await atomicJson(path.join(dir, 'credentials.json'), await passwordRecord(password));
  let app;
  const start = async () => {
    app = await createSiteServer({
      dataDir: dir,
      ordersOptions: {
        gatewayUrl: undefined,
        fetchGateway: () => {
          throw Error('Real gateway must not be called');
        },
      },
    });
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    return 'http://127.0.0.1:' + app.server.address().port;
  };
  let base = await start(),
    cookie = '';
  const request = (url, options = {}) =>
      fetch(base + url, {
        ...options,
        headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
      }),
    post = (url, value, headers = {}) =>
      request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(value),
      });
  const login = async () => {
    const r = await post('/api/admin/login', { password });
    assert.equal(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
    return (await r.json()).csrf;
  };
  try {
    assert.equal((await request('/api/admin/orders')).status, 401);
    assert.equal((await request('/api/admin/orders/' + randomUUID())).status, 401);
    const payload = {
      requestId: randomUUID(),
      contact: {
        name: 'Тестовый клиент',
        phone: '+79991112233',
        channel: 'telegram',
        telegram: '@admin_test',
        comment: 'Сохранить порядок',
      },
      consent: '2026-10-07',
      items: [{ key: 'row-1', id: '1.1', configuration: { B7: 25 }, price: 175 }],
      files: [],
      pageUrl: base + '/kopitsentr/pechat-dokumentov/',
    };
    let r = await post('/api/orders/draft', payload);
    assert.equal(r.status, 201);
    const order = await r.json(),
      csrf = await login();
    assert.equal(
      (await (await request('/api/admin/orders')).json()).total,
      0,
      'Unsubmitted drafts are excluded',
    );
    r = await post(
      '/api/orders/' + order.id + '/submit',
      {},
      { 'X-Order-Token': order.uploadToken },
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, 'preview');
    r = await request('/api/admin/orders');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const list = await r.json();
    assert.equal(list.total, 1);
    assert.equal(list.orders[0].contact.telegram, '@admin_test');
    assert.equal(list.orders[0].total, 175);
    assert.equal(list.summary.orders, 1);
    for (const query of ['Тестовый', 'admin_test', '1112233', 'Печать документов'])
      assert.equal(
        (await (await request('/api/admin/orders?q=' + encodeURIComponent(query))).json()).total,
        1,
      );
    assert.equal((await (await request('/api/admin/orders?q=неизвестно')).json()).total, 0);
    assert.equal((await (await request('/api/admin/orders?status=failed')).json()).total, 0);
    assert.equal((await request('/api/admin/orders?page=-1')).status, 400);
    assert.equal((await request('/api/admin/orders?status=unknown')).status, 400);
    const detail = await (await request('/api/admin/orders/' + order.id)).json();
    assert.equal(detail.contact.comment, 'Сохранить порядок');
    assert.equal(detail.items[0].name, 'Печать документов');
    assert.equal(detail.items[0].price, 175);
    assert.ok(detail.links.pdf);
    assert.ok(detail.links.zip);
    assert.ok(!('uploadHash' in detail) && !('downloadToken' in detail));
    assert.equal(
      (await request(new URL(detail.links.pdf).pathname)).headers.get('content-type'),
      'application/pdf',
    );
    r = await post('/api/admin/logout', {}, { 'X-CSRF-Token': csrf });
    assert.equal(r.status, 200);
    assert.equal((await request('/api/admin/orders/' + order.id)).status, 401);
    await new Promise((r) => app.server.close(r));
    base = await start();
    cookie = '';
    await login();
    assert.equal(
      (await (await request('/api/admin/orders')).json()).orders[0].id,
      order.id,
      'Orders survive a restart',
    );
  } finally {
    if (app.server.listening) await new Promise((r) => app.server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
test('Admin orders UI opens a submitted order safely and clears customer data on logout', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'text-admin-orders-ui-')),
    password = 'isolated-orders-ui-2026';
  await atomicJson(path.join(dir, 'credentials.json'), await passwordRecord(password));
  const app = await createSiteServer({ dataDir: dir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const post = (url, data, headers = {}) =>
    fetch(base + url, {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
    });
  let cookie = '';
  const html = await readFile(new URL('../.server/admin/index.html', import.meta.url), 'utf8'),
    dom = new JSDOM(html, { url: base + '/admin/', runScripts: 'outside-only' }),
    w = dom.window,
    $ = (id) => w.document.getElementById(id);
  const until = async (check) => {
    for (let n = 0; n < 100; n++) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error('Orders UI did not settle');
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event('close'));
  };
  w.fetch = async (url, options = {}) => {
    const r = await fetch(base + url, {
      ...options,
      headers: { ...options.headers, Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    return r;
  };
  try {
    const contact = {
      name: '<img src=x onerror=alert(1)>',
      phone: '+79991112233',
      channel: 'telegram',
      telegram: '@safe_test',
      comment: 'Тест локально',
    };
    const draft = await (
      await post('/api/orders/draft', {
        requestId: randomUUID(),
        contact,
        consent: '2026-10-07',
        items: [{ key: 'one', id: '1.1', configuration: { B7: 25 }, price: 175 }],
        files: [],
        pageUrl: base + '/',
      })
    ).json();
    await post('/api/orders/' + draft.id + '/submit', {}, { 'X-Order-Token': draft.uploadToken });
    w.eval(await readFile(new URL('../.server/admin/admin.js', import.meta.url), 'utf8'));
    $('password').value = password;
    $('login-form').requestSubmit($('login-form').querySelector('[type=submit]'));
    await until(() => $('dashboard').hidden === false);
    $('orders-tab').click();
    await until(() => $('orders-list').querySelector('.order-list-row'));
    assert.equal($('dashboard').hidden, true);
    assert.equal($('orders-view').hidden, false);
    assert.equal($('orders-list').querySelector('img'), null);
    $('orders-list').querySelector('.order-list-row').click();
    await until(() => $('order-detail').querySelector('a[href*="/quote"]'));
    assert.ok($('order-detail').textContent.includes(contact.name));
    assert.ok($('order-detail').textContent.includes('@safe_test'));
    assert.equal($('order-detail').querySelector('img'), null);
    assert.ok($('order-detail').querySelector('a[href*="/archive"]'));
    $('tariffs-tab').click();
    assert.equal($('orders-view').hidden, true);
    assert.equal($('dashboard').hidden, false);
    $('orders-tab').click();
    await until(() => $('orders-feedback').textContent.startsWith('Найдено:'));
    $('logout').click();
    await until(() => $('login-view').hidden === false);
    assert.equal($('orders-view').hidden, true);
    assert.equal($('orders-list').textContent, '');
    assert.equal($('order-detail').textContent, '');
  } finally {
    w.close();
    await new Promise((r) => app.server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
