import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JSDOM } from 'jsdom';
import { createSiteServer } from '../server.mjs';
import { passwordRecord } from '../.server/auth.mjs';
import { atomicJson } from '../.server/storage.mjs';
import { defaultRatings } from '../.server/site-ratings.mjs';

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'text-ratings-')),
    password = 'isolated-ratings-2026';
  await atomicJson(path.join(dir, 'credentials.json'), await passwordRecord(password));
  let app,
    base,
    cookie = '',
    csrf;
  async function start() {
    app = await createSiteServer({ dataDir: dir, ordersOptions: { gatewayUrl: '' } });
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + app.server.address().port;
    cookie = '';
  }
  async function stop() {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
  }
  const request = (url, options = {}) =>
    fetch(base + url, {
      ...options,
      headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    });
  const post = (url, data, headers = {}) =>
    request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...headers,
      },
      body: JSON.stringify(data),
    });
  async function login() {
    const r = await post('/api/admin/login', { password });
    assert.equal(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
    csrf = (await r.json()).csrf;
  }
  await start();
  return {
    dir,
    password,
    start,
    stop,
    request,
    post,
    login,
    get app() {
      return app;
    },
    get base() {
      return base;
    },
    async close() {
      await stop();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
test('Header ratings: protected saves, strict validation, conflict protection, cache invalidation and restart persistence', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request('/api/admin/ratings')).status, 401);
    await f.login();
    const original = await (await f.request('/api/admin/ratings')).json();
    assert.deepEqual(original.ratings, defaultRatings);
    const beforeTariffs = f.app.store.snapshot(),
      paths = ['/', '/listovaya-poligrafiya/', '/listovaya-poligrafiya/vizitki/', '/requirements/'];
    const before = await Promise.all(paths.map(async (p) => (await f.request(p)).text()));
    assert.ok(before.every((html) => html.includes('data-rating-value="yandex">5,0')));
    const ratings = {
        yandex: { rating: 4.8, count: 250 },
        gis: { rating: 4.7, count: 620 },
        google: { rating: 4.9, count: 42 },
      },
      payload = { revision: original.revision, ratings };
    assert.equal((await f.post('/api/admin/ratings', payload, { 'X-CSRF-Token': '' })).status, 403);
    assert.equal(
      (await f.post('/api/admin/ratings', payload, { Origin: 'https://other.invalid' })).status,
      403,
    );
    for (const invalid of [
      null,
      [],
      { ...ratings, unknown: { rating: 4, count: 1 } },
      { ...ratings, yandex: { rating: 5.1, count: 1 } },
      { ...ratings, yandex: { rating: 4.55, count: 1 } },
      { ...ratings, yandex: { rating: '4.5', count: 1 } },
      { ...ratings, gis: { rating: 4.8, count: -1 } },
      { ...ratings, gis: { rating: 4.8, count: 1.5 } },
      { ...ratings, gis: { rating: 4.8, count: 10000001 } },
    ])
      assert.equal(
        (await f.post('/api/admin/ratings', { ...payload, ratings: invalid })).status,
        400,
      );
    const saved = await f.post('/api/admin/ratings', payload);
    assert.equal(saved.status, 200);
    assert.equal(saved.headers.get('cache-control'), 'no-store');
    assert.equal((await f.post('/api/admin/ratings', payload)).status, 409);
    const check = async () => {
      for (const p of paths) {
        const html = await (await f.request(p)).text();
        for (const [id, v] of Object.entries(ratings)) {
          assert.ok(
            html.includes(`data-rating-value="${id}">${v.rating.toFixed(1).replace('.', ',')}`),
            p,
          );
          assert.ok(html.includes(`data-rating-count="${id}">${v.count}`), p);
        }
      }
    };
    await check();
    assert.deepEqual(f.app.store.snapshot(), beforeTariffs, 'Ratings do not modify tariffs');
    assert.deepEqual(
      JSON.parse(await readFile(path.join(f.dir, 'site-settings.json'), 'utf8')).ratings,
      ratings,
    );
    assert.equal((await f.request('/site-settings.json')).status, 404);
    await f.stop();
    await f.start();
    await check();
    await f.login();
    assert.deepEqual((await (await f.request('/api/admin/ratings')).json()).ratings, ratings);
  } finally {
    await f.close();
  }
});
test('Admin ratings UI: previews, validation, retained drafts between tabs, saving, reset and logout', async () => {
  const f = await fixture(),
    dom = new JSDOM(
      await readFile(new URL('../.server/admin/index.html', import.meta.url), 'utf8'),
      { url: f.base + '/admin/', runScripts: 'outside-only' },
    ),
    w = dom.window,
    $ = (id) => w.document.getElementById(id);
  let cookie = '';
  w.fetch = async (url, options = {}) => {
    const r = await fetch(f.base + url, {
      ...options,
      headers: { Origin: f.base, ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    });
    if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    return r;
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event('close'));
  };
  const until = async (fn) => {
    for (let i = 0; i < 150; i++) {
      if (fn()) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error('Ratings UI did not settle');
  };
  const input = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  try {
    w.eval(await readFile(new URL('../.server/admin/admin.js', import.meta.url), 'utf8'));
    input('password', f.password);
    $('login-form').requestSubmit($('login-form').querySelector('[type=submit]'));
    await until(() => !$('dashboard').hidden);
    $('ratings-tab').click();
    await until(() => $('rating-yandex'));
    assert.equal($('dashboard').hidden, true);
    assert.equal($('ratings-view').hidden, false);
    assert.equal($('rating-gis').value, '4.9');
    assert.equal($('ratings-save').disabled, true);
    input('rating-yandex', '5.2');
    assert.equal($('ratings-save').disabled, true);
    input('rating-yandex', '4.8');
    input('count-yandex', '234');
    assert.equal($('preview-yandex').textContent, '★ 4,8 · 234');
    assert.equal($('ratings-save').disabled, false);
    $('tariffs-tab').click();
    assert.equal($('ratings-view').hidden, true);
    $('ratings-tab').click();
    assert.equal($('rating-yandex').value, '4.8');
    $('ratings-form').requestSubmit();
    await until(
      () =>
        $('ratings-save').disabled && $('ratings-status').textContent === 'Все оценки сохранены',
    );
    assert.match(await (await f.request('/')).text(), /data-rating-count="yandex">234/);
    input('count-google', '100');
    $('ratings-cancel').click();
    assert.equal($('count-google').value, '10');
    assert.equal($('ratings-save').disabled, true);
    $('logout').click();
    await until(() => !$('login-view').hidden);
    assert.equal($('ratings-view').hidden, true);
    assert.equal($('ratings-fields').childElementCount, 0);
    assert.equal($('tariffs-tab').getAttribute('aria-selected'), 'true');
  } finally {
    w.close();
    await f.close();
  }
});
