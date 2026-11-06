import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { createSiteServer } from '../server.mjs';
import { createOrders } from '../.server/orders.mjs';
import { createQuotation } from '../.server/quotation.mjs';
import { loadCatalog, parseAssignment } from '../.server/catalog.mjs';
const publicOrigin = 'https://orders.example.invalid';
const gatewayUrl = 'https://gateway.sibsoft-it.ru/api/v1/leads/site_testOnlyLocal';
async function setup(options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'tekst-orders-'));
  const app = await createSiteServer({ dataDir, publicOrigin, ...options });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const request = (url, options = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        base + url,
        {
          method: options.method || 'GET',
          headers: { Host: new URL(publicOrigin).host, Origin: publicOrigin, ...options.headers },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve(
              new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers }),
            ),
          );
        },
      );
      req.on('error', reject);
      req.end(options.body);
    });
  const json = (url, body, token) =>
    request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Order-Token': token } : {}) },
      body: JSON.stringify(body),
    });
  const close = async () => {
    await new Promise((r) => app.server.close(r));
    await rm(dataDir, { recursive: true, force: true });
  };
  return { app, request, json, close, dataDir };
}
const draft = () => ({
  requestId: randomUUID(),
  contact: {
    name: 'Тест локально',
    phone: '+7 999 111-22-33',
    comment: 'Проверить порядок листов',
  },
  consent: '2026-10-07',
  items: [
    {
      key: 'row-1',
      id: '1.1',
      configuration: { B7: 25 },
      price: 1,
      description: 'Подменённая цена',
    },
  ],
  files: [{ name: '../Макет.pdf', size: 4, itemKey: 'row-1' }],
  pageUrl: publicOrigin + '/kopitsentr/pechat-dokumentov/',
  utm: { utm_source: 'test' },
});

test('An artwork request without a basket uploads originals, creates documents and preserves an unknown price', async () => {
  const messages = [],
    t = await setup({
      ordersOptions: {
        gatewayUrl,
        fetchGateway: async (url, options) => {
          messages.push(JSON.parse(options.body));
          return Response.json({ status: 'queued', delivery_id: 77 }, { status: 202 });
        },
      },
    });
  try {
    const b = {
      ...draft(),
      kind: 'request',
      items: [],
      files: [{ name: 'Макет.pdf', size: 4 }],
      pageUrl: publicOrigin + '/',
    };
    let r = await t.json('/api/orders/draft', b);
    assert.equal(r.status, 201);
    const d = await r.json();
    assert.equal(d.changed, false);
    r = await t.json('/api/orders/' + d.id + '/submit', {}, d.uploadToken);
    assert.equal(r.status, 409, 'A selected file is not a completed upload');
    assert.equal(messages.length, 0);
    r = await t.request('/api/orders/' + d.id + '/files/' + d.files[0].id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Order-Token': d.uploadToken },
      body: 'test',
    });
    assert.equal(r.status, 200);
    r = await t.json('/api/orders/' + d.id + '/submit', {}, d.uploadToken);
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.status, 'queued');
    assert.ok(result.number);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].budget, 'Требуется расчёт');
    assert.equal(messages[0].source, 'Форма заявки сайта ТЕКСТ');
    assert.ok(messages[0].fields['Макет 1: Макет.pdf']);
    assert.equal(
      (await t.request(new URL(result.links.pdf).pathname)).headers.get('content-type'),
      'application/pdf',
    );
    assert.equal(
      await (await t.request(new URL(result.links.files[0].url).pathname)).text(),
      'test',
    );
    const saved = JSON.parse(
      await readFile(path.join(t.dataDir, 'orders', d.id, 'order.json'), 'utf8'),
    );
    assert.equal(saved.kind, 'request');
    assert.equal(saved.quote.rows.length, 0);
    assert.equal(t.app.orders.adminList({}).orders[0].kind, 'request');
    assert.equal(t.app.orders.adminDetail(d.id).links.files.length, 1);
    const empty = {
      ...b,
      requestId: randomUUID(),
      contact: { ...b.contact, comment: '' },
      files: [],
    };
    assert.equal((await t.json('/api/orders/draft', empty)).status, 400);
    assert.equal(
      (await t.json('/api/orders/draft', { ...b, requestId: randomUUID(), kind: 'cart' })).status,
      400,
      'Empty baskets remain invalid',
    );
    const textOnly = { ...b, requestId: randomUUID(), files: [] };
    assert.equal(
      (await t.json('/api/orders/draft', textOnly)).status,
      201,
      'A described task can be submitted before its artwork is ready',
    );
  } finally {
    await t.close();
  }
});
test('Customer contact is validated, saved and forwarded to the mocked gateway', async () => {
  const messages = [],
    t = await setup({
      ordersOptions: {
        gatewayUrl,
        fetchGateway: async (url, options) => {
          messages.push(JSON.parse(options.body));
          return Response.json({ status: 'queued', delivery_id: 51 }, { status: 202 });
        },
      },
    });
  try {
    for (const contact of [
      { channel: 'email' },
      { channel: 'telegram' },
      { channel: 'telegram', telegram: 'https://t.me/test_user' },
      { channel: 'telegram', telegram: 'a'.repeat(40) },
    ]) {
      const b = draft();
      b.files = [];
      Object.assign(b.contact, contact);
      assert.equal((await t.json('/api/orders/draft', b)).status, 400);
    }
    for (const channel of ['max', 'telegram']) {
      const b = draft();
      b.files = [];
      Object.assign(b.contact, { channel, telegram: '  customer_test  ' });
      const response = await t.json('/api/orders/draft', b);
      assert.equal(response.status, 201, await response.clone().text());
      const d = await response.json();
      const saved = JSON.parse(
        await readFile(path.join(t.dataDir, 'orders', d.id, 'order.json'), 'utf8'),
      );
      assert.equal(saved.contact.channel, channel);
      assert.equal(saved.contact.telegram, channel === 'telegram' ? '@customer_test' : undefined);
      const result = await t.json(
        '/api/orders/' + d.id + '/submit',
        { acceptRecalculation: true },
        d.uploadToken,
      );
      assert.equal(result.status, 200);
      assert.equal((await result.json()).status, 'queued');
      const sent = messages.at(-1);
      assert.equal(sent.telegram, channel === 'telegram' ? '@customer_test' : undefined);
      assert.equal(
        sent.fields['Связаться с клиентом'],
        channel === 'telegram' ? 'Telegram: @customer_test' : 'MAX: ' + b.contact.phone,
      );
    }
  } finally {
    await t.close();
  }
});
test('Server prices, protected uploads, PDF/ZIP, gateway retry and idempotency', async () => {
  let time = Date.now(),
    calls = 0;
  const messages = [];
  const t = await setup({
    ordersOptions: {
      gatewayUrl,
      now: () => time,
      fetchGateway: async (url, options) => {
        calls++;
        messages.push({ url, options, payload: JSON.parse(options.body) });
        return calls === 1
          ? new Response('{}', { status: 503 })
          : Response.json({ status: 'queued', delivery_id: 17, duplicate: false }, { status: 202 });
      },
    },
  });
  try {
    const body = draft(),
      key = randomBytes(32).toString('hex');
    let r = await t.json('/api/orders/draft', body, key);
    assert.equal(r.status, 201, await r.clone().text());
    const o = await r.json();
    assert.equal(o.total, 175);
    assert.equal(o.changed, true);
    assert.equal(o.uploadToken, key);
    assert.ok(!o.files[0].name.includes('/'));
    r = await t.json('/api/orders/draft', body, key);
    assert.equal(
      r.status,
      200,
      'Lost draft response can be retried with the same client capability',
    );
    r = await t.json('/api/orders/draft', body);
    assert.equal(r.status, 409, 'A UUID does not reveal an upload capability');
    r = await t.json('/api/orders/' + o.id + '/submit', {}, key);
    assert.equal(r.status, 409);
    r = await t.json('/api/orders/' + o.id + '/submit', { acceptRecalculation: true }, key);
    assert.equal(r.status, 409, 'Missing files block finalization');
    const upload = '/api/orders/' + o.id + '/files/' + o.files[0].id;
    r = await t.request(upload, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Order-Token': randomBytes(32).toString('hex'),
      },
      body: 'test',
    });
    assert.equal(r.status, 404);
    r = await t.request(upload, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Order-Token': key },
      body: 'test',
    });
    assert.equal(r.status, 200);
    r = await t.json('/api/orders/' + o.id + '/submit', { acceptRecalculation: true }, key);
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.status, 'retrying');
    assert.equal(calls, 1);
    r = await t.request(new URL(result.links.pdf).pathname);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.ok(r.headers.get('content-disposition').startsWith('attachment'));
    const pdf = Buffer.from(await r.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    r = await t.request(new URL(result.links.zip).pathname);
    assert.equal(r.status, 200);
    const zip = Buffer.from(await r.arrayBuffer());
    assert.equal(zip.readUInt32LE(), 0x04034b50);
    assert.ok(zip.includes(Buffer.from('Макет.pdf')));
    r = await t.request(new URL(result.links.files[0].url).pathname);
    assert.equal(await r.text(), 'test');
    time += 40000;
    await t.app.orders.tick();
    assert.equal(calls, 2);
    assert.equal(
      messages[0].options.headers['Idempotency-Key'],
      messages[1].options.headers['Idempotency-Key'],
    );
    assert.equal(messages[1].payload.budget, '175 ₽');
    assert.ok(messages[1].payload.fields['Расчёт PDF'].startsWith(publicOrigin));
    assert.ok(messages[1].payload.description.includes('Формат'));
    assert.equal(messages[1].payload.utm_source, 'test');
    assert.ok(!('attachments' in messages[1].payload));
    r = await t.json('/api/orders/' + o.id + '/submit', { acceptRecalculation: true }, key);
    assert.equal((await r.json()).status, 'queued');
    assert.equal(calls, 2, 'Repeat submit does not notify twice');
    r = await t.request('/.server/orders.mjs');
    assert.equal(r.status, 404);
    r = await t.request('/api/admin/orders');
    assert.equal(r.status, 401);
    r = await t.request('/api/orders/draft', {
      method: 'POST',
      headers: { Origin: 'https://bad.invalid', 'Content-Type': 'application/json' },
      body: JSON.stringify(draft()),
    });
    assert.equal(r.status, 403);
    time += 31 * 86400000;
    r = await t.request(new URL(result.links.pdf).pathname);
    assert.equal(r.status, 404);
    await t.app.orders.cleanup();
    assert.equal(
      await readFile(path.join(t.dataDir, 'orders', o.id, 'order.json')).then(
        () => true,
        () => false,
      ),
      false,
    );
  } finally {
    await t.close();
  }
});
test('Validation and local preview never call the real gateway', async () => {
  const t = await setup({
    publicOrigin: undefined,
    ordersOptions: {
      gatewayUrl,
      fetchGateway: () => {
        throw Error('Must not notify from localhost');
      },
    },
  });
  // Local request host/origin replace the production helper defaults.
  const port = t.app.server.address().port,
    base = 'http://127.0.0.1:' + port;
  const post = (url, b, key) =>
    fetch(base + url, {
      method: 'POST',
      headers: {
        Origin: base,
        'Content-Type': 'application/json',
        ...(key ? { 'X-Order-Token': key } : {}),
      },
      body: JSON.stringify(b),
    });
  try {
    const b = draft();
    b.files = [];
    b.pageUrl = base + '/';
    b.items[0].price = 175;
    let r = await post('/api/orders/draft', { ...b, consent: 'no' });
    assert.equal(r.status, 400);
    r = await post('/api/orders/draft', { ...b, files: [{ name: 'evil.exe', size: 10 }] });
    assert.equal(r.status, 400);
    r = await post('/api/orders/draft', b);
    assert.equal(r.status, 201, await r.clone().text());
    const o = await r.json();
    assert.equal(o.changed, false, JSON.stringify(o));
    r = await post('/api/orders/' + o.id + '/submit', {}, o.uploadToken);
    const result = await r.json();
    assert.equal(result.status, 'preview');
    assert.ok(result.links.pdf.startsWith(base));
  } finally {
    await t.close();
  }
});
test('Every published calculator can be quoted on the server and new tariff revisions reach orders', async () => {
  const catalog = await loadCatalog(fileURLToPath(new URL('../', import.meta.url)));
  let revision = 1,
    overrides = {};
  const store = { snapshot: () => ({ revision }), overrides: () => overrides },
    pricing = await createQuotation(fileURLToPath(new URL('../', import.meta.url)), catalog, store);
  for (const section of ['copycenter', 'project', 'leaflet', 'uv', 'sticker', 'wide-format']) {
    const services = parseAssignment(
      await readFile(new URL('../' + section + '-services.js', import.meta.url), 'utf8'),
    ).data;
    for (const s of Object.values(services)) {
      const q = pricing.quote([
        {
          key: 'check-' + s.id.replace('.', '-'),
          id: s.id,
          configuration: s.defaults || {},
          price: null,
        },
      ]);
      assert.equal(q.rows.length, 1, s.name);
      assert.ok(Number.isFinite(q.total), s.name);
      assert.ok(q.rows[0].description.length > 0, s.name);
    }
  }
  const item = { key: 'tariff-check', id: '1.1', configuration: { B7: 25 }, price: 175 };
  const before = pricing.quote([item]);
  const field = [...catalog.fields.values()].find(
    (f) =>
      f.file === 'copycenter-pricing-data.js' &&
      f.service === '1.1' &&
      f.ref === 'E6' &&
      f.base === 7,
  );
  assert.ok(field);
  overrides = { [field.id]: field.base * 2 };
  revision++;
  const after = pricing.quote([item]);
  assert.ok(after.total > before.total, 'Saved tariffs change the server quote');
});
test('Pending delivery survives server restart', async () => {
  let time = Date.now(),
    attempts = 0;
  const options = {
    gatewayUrl,
    now: () => time,
    fetchGateway: async () =>
      ++attempts === 1
        ? new Response('{}', { status: 503 })
        : Response.json({ status: 'queued', delivery_id: 99 }, { status: 202 }),
  };
  const t = await setup({ ordersOptions: options });
  let restored;
  try {
    const b = draft();
    b.files = [];
    const d = await (await t.json('/api/orders/draft', b)).json();
    const result = await (
      await t.json('/api/orders/' + d.id + '/submit', { acceptRecalculation: true }, d.uploadToken)
    ).json();
    assert.equal(result.status, 'retrying');
    t.app.orders.close();
    restored = await createOrders({
      root: fileURLToPath(new URL('../', import.meta.url)),
      dataDir: t.dataDir,
      catalog: t.app.catalog,
      store: t.app.store,
      publicOrigin,
      ...options,
    });
    time += 40000;
    await restored.tick();
    const saved = JSON.parse(
      await readFile(path.join(t.dataDir, 'orders', d.id, 'order.json'), 'utf8'),
    );
    assert.equal(saved.status, 'queued');
    assert.equal(attempts, 2);
  } finally {
    restored?.close();
    await t.close();
  }
});
