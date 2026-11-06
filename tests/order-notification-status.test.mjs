import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { createSiteServer } from '../server.mjs';

const origin = 'https://orders.example.invalid';
async function setup(gateway) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'tekst-status-test-'));
  const app = await createSiteServer({ dataDir, publicOrigin: origin, ordersOptions: gateway });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const request = (url, options = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: app.server.address().port,
          path: url,
          method: options.body ? 'POST' : 'GET',
          headers: {
            Host: new URL(origin).host,
            Origin: origin,
            'Content-Type': 'application/json',
            ...(options.token ? { 'X-Order-Token': options.token } : {}),
          },
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
      req.end(options.body && JSON.stringify(options.body));
    });
  const create = async () => {
    const r = await request('/api/orders/draft', {
      body: {
        requestId: randomUUID(),
        kind: 'request',
        contact: { name: 'Private', phone: '+79991112233', comment: 'Private' },
        consent: '2026-10-07',
        items: [],
        files: [],
        pageUrl: origin + '/',
      },
    });
    assert.equal(r.status, 201);
    return r.json();
  };
  return {
    app,
    request,
    create,
    async close() {
      await new Promise((r) => app.server.close(r));
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}
const gatewayUrl = 'https://gateway.sibsoft-it.ru/api/v1/leads/site_testOnlyLocal';

test('Notification status requires the private order capability, caches checks and never resends a lead', async () => {
  let now = Date.now(),
    status = 'queued',
    posts = 0,
    gets = 0;
  const t = await setup({
    gatewayUrl,
    now: () => now,
    fetchGateway: async (url, options) => {
      if (options.method === 'POST') {
        posts++;
        return Response.json({ status: 'queued', delivery_id: 17 }, { status: 202 });
      }
      gets++;
      assert.equal(url, gatewayUrl + '/deliveries/17');
      assert.match(options.headers['Idempotency-Key'], /^text-order-/);
      return Response.json({ status });
    },
  });
  try {
    const o = await t.create(),
      endpoint = '/api/orders/' + o.id + '/notification';
    assert.equal((await t.request(endpoint)).status, 404);
    assert.equal((await t.request(endpoint, { token: 'a'.repeat(64) })).status, 404);
    assert.equal((await t.request(endpoint, { token: o.uploadToken })).status, 409);
    assert.equal(gets, 0);
    assert.equal(
      (await t.request('/api/orders/' + o.id + '/submit', { body: {}, token: o.uploadToken }))
        .status,
      200,
    );
    const read = () => t.request(endpoint, { token: o.uploadToken });
    let r = await read();
    assert.deepEqual(await r.json(), { notification: 'pending' });
    assert.match(r.headers.get('cache-control'), /no-store/);
    await Promise.all([read(), read()]);
    assert.equal(gets, 1);
    status = 'sent';
    now += 11000;
    assert.deepEqual(await (await read()).json(), { notification: 'delivered' });
    now += 11000;
    await read();
    assert.equal(gets, 2);
    assert.equal(posts, 1);
  } finally {
    await t.close();
  }
});
test('Gateway errors and unknown responses never become confirmed delivery; terminal failure is separate', async () => {
  for (const state of ['failed', 'retry', 'sending', 'surprise', 'unavailable']) {
    const t = await setup({
      gatewayUrl,
      fetchGateway: async (_, options) =>
        options.method === 'POST'
          ? Response.json({ status: 'queued', delivery_id: 20 }, { status: 202 })
          : state === 'unavailable'
            ? new Response('', { status: 503 })
            : Response.json({ status: state }),
    });
    try {
      const o = await t.create();
      await t.request('/api/orders/' + o.id + '/submit', { body: {}, token: o.uploadToken });
      const r = await t.request('/api/orders/' + o.id + '/notification', { token: o.uploadToken });
      assert.deepEqual(await r.json(), {
        notification:
          state === 'failed'
            ? 'failed'
            : ['retry', 'sending'].includes(state)
              ? 'pending'
              : 'unknown',
      });
    } finally {
      await t.close();
    }
  }
});
test('A repeated gateway acknowledgment can already be sent without starting another delivery', async () => {
  const t = await setup({
    gatewayUrl,
    fetchGateway: async (_, options) =>
      options.method === 'POST'
        ? Response.json({ status: 'sent', delivery_id: 30, duplicate: true }, { status: 202 })
        : Response.json({ status: 'sent' }),
  });
  try {
    const o = await t.create();
    const r = await t.request('/api/orders/' + o.id + '/submit', {
      body: {},
      token: o.uploadToken,
    });
    assert.equal((await r.json()).status, 'queued');
    assert.deepEqual(
      await (
        await t.request('/api/orders/' + o.id + '/notification', { token: o.uploadToken })
      ).json(),
      { notification: 'delivered' },
    );
  } finally {
    await t.close();
  }
});
