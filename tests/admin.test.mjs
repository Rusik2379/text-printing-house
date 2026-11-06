import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createSiteServer } from '../server.mjs';
import { loadCatalog, parseAssignment } from '../.server/catalog.mjs';
import { buildPresentation } from '../.server/presentation.mjs';
import { passwordRecord, createAuth } from '../.server/auth.mjs';
import { atomicJson, outsideRoot } from '../.server/storage.mjs';
import { parseFormula, tariffLiterals } from '../.server/formula.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const password = 'test-admin-unique-password-2026';
function change(context, f, value) {
  const restore = [];
  for (const t of f.targets) {
    const global = {
      'copycenter-pricing-data.js': 'TEXT_COPYCENTER_DATA',
      'project-pricing-data.js': 'TEXT_PROJECT_DATA',
      'leaflet-pricing-data.js': 'TEXT_LEAFLET_DATA',
      'uv-pricing-data.js': 'TEXT_UV_DATA',
    }[t.file];
    if (!global) continue;
    let o = context[global];
    for (const k of t.path.slice(0, -1)) o = o[k];
    const k = t.path.at(-1),
      old = o[k];
    restore.push(() => {
      o[k] = old;
    });
    o[k] = t.literal ? old.slice(0, t.literal.start) + value + old.slice(t.literal.end) : value;
  }
  return () => restore.reverse().forEach((fn) => fn());
}
test('Only monetary literals are editable; formula conditions, references and precision are fixed', () => {
  const s = '=ROUND(IF(B7<=50,10,8)*B7*1.15,2)';
  assert.deepEqual(
    tariffLiterals(parseFormula(s), s).map((l) => l.v),
    [10, 8, 1.15],
  );
  const size = '=B4*B5/1000000';
  assert.equal(tariffLiterals(parseFormula(size), size).length, 0);
  assert.throws(() => outsideRoot(root, path.join(root, 'assets', 'private')));
});
test('Every workbook service has a real editable tariff and baseline formulas remain unchanged', async () => {
  const catalog = await loadCatalog(root);
  const context = {};
  context.window = context;
  vm.createContext(context);
  for (const file of [
    'copycenter-pricing-data.js',
    'project-pricing-data.js',
    'leaflet-pricing-data.js',
    'uv-pricing-data.js',
  ])
    vm.runInContext(catalog.render(file, {}), context);
  for (const file of [
    'copycenter-engine.js',
    'copycenter-pricing.js',
    'project-pricing.js',
    'leaflet-pricing.js',
    'uv-pricing.js',
  ])
    vm.runInContext(await readFile(path.join(root, file), 'utf8'), context);
  const apis = {
    copycenter: context.TEXT_COPYCENTER_PRICING,
    project: context.TEXT_PROJECT_PRICING,
    leaflet: context.TEXT_LEAFLET_PRICING,
    uv: context.TEXT_UV_PRICING,
  };
  let checked = 0;
  for (const service of catalog.services.filter((s) => apis[s.section])) {
    const api = apis[service.section],
      baseline = api.quote(service.id, {});
    assert.ok(baseline.valid, service.name + ' baseline');
    let affected = false;
    for (const id of service.groups.flatMap((g) => g.fields)) {
      const f = catalog.fields.get(id);
      if (f.base === 0) continue;
      const restore = change(context, f, Math.round(f.base * 2 * 1e6) / 1e6),
        quote = api.quote(service.id, {});
      restore();
      if (quote.valid && quote.price !== baseline.price) {
        affected = true;
        break;
      }
    }
    assert.ok(affected, service.name + ' must expose an active price');
    checked++;
  }
  assert.equal(checked, 35);
});
test('HTTP authentication, CSRF, revision conflicts, persistence and rollback', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'text-admin-test-'));
  await atomicJson(path.join(directory, 'credentials.json'), await passwordRecord(password));
  let app = await createSiteServer({ root, dataDir: directory });
  const start = async () => {
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    return 'http://127.0.0.1:' + app.server.address().port;
  };
  let base = await start(),
    cookie = '',
    csrf = '';
  async function request(endpoint, data, headers = {}) {
    const response = await fetch(base + endpoint, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data === undefined
          ? {}
          : { Origin: base, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }),
        ...headers,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return response;
  }
  async function login(pass = password) {
    const r = await request('/api/admin/login', { password: pass });
    if (r.ok) {
      cookie = r.headers.get('set-cookie').split(';')[0];
      csrf = (await r.json()).csrf;
    }
    return r;
  }
  try {
    assert.equal((await request('/api/admin/catalog')).status, 401);
    const font = await request('/assets/fonts/DejaVuSans.ttf');
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('content-type'), 'font/ttf');
    for (const url of [
      '/.git/config',
      '/.server/admin/index.html',
      '/scripts/admin-setup.mjs',
      '/server.mjs',
      '/package.json',
      '/%2e%2etext-admin/credentials.json',
      '/%2e%2e%5c.text-admin%5ccredentials.json',
    ])
      assert.equal((await request(url)).status, 404, url);
    assert.equal(
      (await request('/api/admin/login', { password }, { Origin: 'https://evil.test' })).status,
      403,
    );
    const badHost = await new Promise((resolve, reject) => {
      const r = http.get(base + '/api/admin/session', { headers: { Host: 'evil.test' } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      r.on('error', reject);
    });
    assert.equal(badHost, 400);
    assert.equal((await login('wrong')).status, 401);
    const logged = await login();
    assert.equal(logged.status, 200);
    assert.match(logged.headers.get('set-cookie'), /HttpOnly/);
    assert.match(logged.headers.get('set-cookie'), /SameSite=Strict/);
    let data = await (await request('/api/admin/catalog')).json();
    const f = data.fields.find((f) => f.service === '1.2' && f.base === 10),
      newValue = 14;
    assert.equal(
      (
        await request(
          '/api/admin/save',
          { revision: data.revision, changes: { [f.id]: newValue } },
          { 'X-CSRF-Token': 'bad' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          '/api/admin/save',
          { revision: data.revision, changes: { [f.id]: newValue } },
          { Origin: 'https://evil.test' },
        )
      ).status,
      403,
    );
    for (const changes of [
      { [f.id]: -1 },
      { [f.id]: '=1+1' },
      { [f.id]: 1e20 },
      { __unknown__: 30 },
    ])
      assert.equal(
        (await request('/api/admin/save', { revision: data.revision, changes })).status,
        400,
      );
    const saved = await request('/api/admin/save', {
      revision: data.revision,
      changes: { [f.id]: newValue },
    });
    assert.equal(saved.status, 200);
    const next = await saved.json();
    assert.notEqual(next.revision, data.revision);
    assert.equal(
      (await request('/api/admin/save', { revision: data.revision, changes: { [f.id]: 16 } }))
        .status,
      409,
    );
    const context = {};
    context.window = context;
    vm.createContext(context);
    for (const file of [
      'copycenter-pricing-data.js',
      'copycenter-engine.js',
      'copycenter-pricing.js',
    ])
      vm.runInContext(await (await request('/' + file)).text(), context);
    assert.equal(context.TEXT_COPYCENTER_PRICING.quote('1.2', { B7: 25 }).price, 350);
    const exported = await (await request('/api/admin/export')).json();
    assert.equal(exported.overrides[f.id], 14);
    assert.equal(exported.password, undefined);
    await new Promise((r) => app.server.close(r));
    app = await createSiteServer({ root, dataDir: directory });
    base = await start();
    cookie = '';
    csrf = '';
    assert.equal((await login()).status, 200);
    data = await (await request('/api/admin/catalog')).json();
    assert.equal(data.fields.find((x) => x.id === f.id).value, 14);
    assert.equal(
      (
        await request('/api/admin/import', {
          revision: data.revision,
          backup: { ...exported, sourceRevision: 'wrong' },
        })
      ).status,
      400,
    );
    const rolled = await request('/api/admin/rollback', {
      revision: data.revision,
      id: data.history[0].id,
    });
    assert.equal(rolled.status, 200);
    data = await (await request('/api/admin/catalog')).json();
    assert.equal(data.fields.find((x) => x.id === f.id).value, 10);
    assert.equal((await request('/api/admin/logout', {})).status, 200);
    assert.equal((await request('/api/admin/catalog')).status, 401);
    for (let i = 0; i < 5; i++) assert.equal((await login('wrong-password')).status, 401);
    assert.equal((await login()).status, 429);
  } finally {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
    await rm(directory, { recursive: true, force: true });
  }
});
test('Password changes revoke sessions; production cookies are secure; idle sessions expire', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'text-admin-auth-'));
  await atomicJson(path.join(directory, 'credentials.json'), await passwordRecord(password));
  let time = 1000;
  try {
    const auth = await createAuth(directory, {
        secure: true,
        now: () => time,
        idleMs: 100,
        maxMs: 1000,
      }),
      req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
      logged = await auth.login(req, password);
    assert.match(logged.cookie, /__Host-text-admin/);
    assert.match(logged.cookie, /; Secure/);
    req.headers.cookie = logged.cookie.split(';')[0];
    assert.ok(auth.session(req));
    time += 101;
    assert.equal(auth.session(req), null);
    const next = await auth.login(req, password);
    req.headers.cookie = next.cookie.split(';')[0];
    assert.ok(auth.session(req));
    const other = await auth.login(
      { headers: {}, socket: { remoteAddress: '127.0.0.2' } },
      password,
    );
    await assert.rejects(
      auth.changePassword(req, 'wrong', 'new-long-password-2026'),
      (e) => e.status === 401,
    );
    await auth.changePassword(req, password, 'new-long-password-2026');
    assert.equal(auth.session(req), null);
    assert.equal(auth.session({ headers: { cookie: other.cookie.split(';')[0] } }), null);
    await assert.rejects(auth.login(req, password), (e) => e.status === 401);
    assert.ok((await auth.login(req, 'new-long-password-2026')).csrf);
    const persisted = await createAuth(directory);
    assert.ok((await persisted.login(req, 'new-long-password-2026')).csrf);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('Edited sticker, pack, wide-format rates and shared minima reach quotes and cart', async () => {
  const c = await loadCatalog(root),
    overrides = {};
  const minimum = [...c.fields.values()].find(
    (f) => f.file === 'sticker-pricing.js' && f.path.join('.') === 'flat.minimum',
  );
  overrides[minimum.id] = 725;
  const uv = [...c.fields.values()].find(
    (f) => f.service === '6.1' && /минимальный чек/i.test(f.label),
  );
  overrides[uv.id] = 950;
  const packRate = [...c.fields.values()].find(
    (f) => f.file === 'stickerpack-pricing.js' && f.path.join('.') === 'rates.0.0',
  );
  overrides[packRate.id] = 100;
  const flatRate = [...c.fields.values()].find(
    (f) => f.file === 'sticker-pricing.js' && f.path.join('.') === 'flat.rates.0.0',
  );
  overrides[flatRate.id] = 40;
  const wideMin = [...c.fields.values()].find((f) =>
    f.targets.some(
      (t) => t.file === 'wide-format-pricing.js' && t.path.join('.') === 'minimums.wide-cut',
    ),
  );
  overrides[wideMin.id] = 675;
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of [
    'pricing.js',
    'sticker-pricing.js',
    'stickerpack-pricing.js',
    'wide-format-pricing.js',
    'uv-pricing-data.js',
  ])
    vm.runInContext(c.render(file, overrides), ctx);
  for (const file of [
    'sticker-services.js',
    'stickerpack-calculator.js',
    'sticker-special-calculator.js',
    'wide-format-services.js',
    'wide-format-calculator.js',
    'copycenter-engine.js',
    'uv-pricing.js',
  ])
    vm.runInContext(await readFile(path.join(root, file), 'utf8'), ctx);
  const config = { width: 20, height: 20, quantity: 50, print: 'vinyl', material: 'white' };
  assert.equal(ctx.TEXT_CALCULATE_STICKERS(config).unit, 40);
  assert.equal(ctx.TEXT_CALCULATE_STICKERPACKS(config).unit, 120);
  const cart = ctx.TEXT_STICKER_CART_BREAKDOWN([
    { price: 10, pricingGroup: 'stickers' },
    { price: 10, pricingGroup: 'uv-direct' },
    { price: 10, pricingGroup: 'wide-cut' },
  ]);
  assert.equal(cart.total, 725 + 950 + 675);
  assert.equal(
    ctx.TEXT_UV_PRICING.quote('6.2', {}).details.find((f) => /Минимальный чек/.test(f.label)).value,
    675,
  );
  assert.equal(
    ctx.TEXT_UV_PRICING.quote('6.5', {}).details.find((f) => /Минимальный чек/.test(f.label)).value,
    950,
  );
  const cards = [...c.fields.values()].find((f) => f.service === '3.1' && f.ref === 'Z2');
  const cardChanges = { [cards.id]: 11 };
  const legacy = parseAssignment(c.render('pricing.js', cardChanges)).data.cards.rates.find(
    (r) => r.paper === 'Color Copy 350гр' && r.quantity === 100,
  );
  assert.equal(legacy.oneSide, 11);
  const color = [...c.fields.values()].find(
    (f) => f.service === '1.1' && f.ref === 'I5' && !f.literal,
  );
  const colorCtx = {};
  vm.createContext(colorCtx);
  vm.runInContext(c.render('copycenter-pricing-data.js', { [color.id]: 28 }), colorCtx);
  for (const file of ['copycenter-engine.js', 'copycenter-pricing.js'])
    vm.runInContext(await readFile(path.join(root, file), 'utf8'), colorCtx);
  const q = colorCtx.TEXT_COPYCENTER_PRICING.quote('1.1', { B5: 'цветная', B7: 10, colorRate: 20 });
  assert.equal(q.price, 280);
  assert.ok(q.description.includes('28 ₽'));
  assert.equal(colorCtx.TEXT_COPYCENTER_PRICING.colorRates().find((r) => r.key === '20').value, 28);
});
test('Human categories and units preserve tariff identities and explain paper, discounts and matrices', async () => {
  const c = await loadCatalog(root),
    before = JSON.stringify([...c.fields.values()]),
    revision = c.sourceRevision;
  const presentation = buildPresentation(c.fields, c.services, c.modules),
    view = c.view({});
  assert.equal(JSON.stringify([...c.fields.values()]), before);
  assert.equal(c.sourceRevision, revision);
  for (const s of c.services) {
    const presented = presentation.services.find((x) => x.id === s.id);
    assert.deepEqual(
      new Set(presented.groups.flatMap((g) => g.fields)),
      new Set(s.groups.flatMap((g) => g.fields)),
    );
    assert.ok(presented.groups.every((g) => g.description && g.name !== 'КАЛЬКУЛЯТОР'));
  }
  for (const f of view.fields) {
    assert.ok(f.description.length > 35, f.id);
    assert.ok(f.displayUnit, f.id);
    const raw = c.fields.get(f.id);
    assert.equal(f.base, raw.base);
    assert.equal(f.min, raw.min);
    assert.equal(f.max, raw.max);
  }
  const paper = view.fields.find((f) => f.service === '1.1' && f.ref === 'E9' && f.base === 38);
  assert.match(paper.label, /Формат: А3/);
  assert.match(paper.label, /Color Copy 300/);
  assert.doesNotMatch(paper.label, /≠|иначе/);
  assert.equal(paper.category, 'Бумага');
  assert.equal(paper.displayUnit, '₽ / физический лист');
  assert.match(paper.description, /один раз на лист/);
  const discount = view.fields.find((f) => f.service === '1.4' && f.ref === 'E6');
  assert.equal(discount.displayScale, 100);
  assert.equal(discount.value, 0.2);
  assert.equal(discount.displayUnit, '%');
  const laminate = view.fields.find((f) => f.service === '1.4' && f.base === 25);
  assert.match(laminate.label, /125 мкм/);
  assert.doesNotMatch(laminate.label, /≠/);
  const photo = view.fields.find((f) => f.service === '1.3' && f.base === 320);
  assert.match(photo.label, /11–50/);
  assert.doesNotMatch(photo.label, /иначе/);
  const secondSide = view.fields.find((f) => f.service === '3.2' && f.ref === 'H4');
  assert.equal(secondSide.displayScale, 100);
  assert.equal(secondSide.example, 'surcharge');
  assert.equal(secondSide.value, 0.35);
  assert.match(secondSide.description, /1,35/);
  const pack = view.fields.find((f) => f.service === '3.2' && f.ref === 'B4');
  assert.match(pack.label, /120 г\/м² · 250 листов/);
  assert.equal(pack.displayUnit, '₽ / пачка');
  const engraving = view.fields.find((f) => f.service === '6.7' && f.ref === 'E9');
  assert.equal(engraving.displayKind, 'money');
  assert.equal(engraving.displayUnit, '₽ / см²');
  const cards = view.fields.find((f) => f.service === '3.1' && f.ref === 'Z2');
  assert.match(cards.label, /100 шт./);
  assert.equal(cards.displayUnit, '₽ / визитка');
  assert.ok(cards.sharedWith.includes('Общие настройки и визитки'));
  const wide = view.fields.find(
    (f) =>
      c.fields.get(f.id).file === 'wide-format-pricing.js' &&
      c.fields.get(f.id).path.join('.') === 'models.pvc.rates.solvent.3.0.0',
  );
  assert.match(wide.label, /3 мм/);
  assert.match(wide.label, /40000 мм²/);
  assert.match(wide.label, /1 шт./);
});
