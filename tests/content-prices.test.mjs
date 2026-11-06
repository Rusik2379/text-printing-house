import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createSiteServer } from '../server.mjs';
import { loadCatalog } from '../.server/catalog.mjs';
import { createContentPrices } from '../.server/content-prices.mjs';
import { atomicJson } from '../.server/storage.mjs';
import { passwordRecord } from '../.server/auth.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const manual = JSON.parse(
  await readFile(new URL('../scripts/content-price-bindings.json', import.meta.url), 'utf8'),
);
const scripts = [
  'catalog',
  'pricing',
  'stickerpack-pricing',
  'sticker-pricing',
  'sticker-services',
  'stickerpack-calculator',
  'sticker-special-calculator',
  'stickerpack-sharing',
  'wide-format-services',
  'wide-format-pricing',
  'wide-format-calculator',
  'wide-format-sharing',
  ...['copycenter', 'project', 'leaflet', 'uv'].flatMap((n) => [
    n + '-services',
    n + '-pricing-data',
  ]),
  'copycenter-engine',
  ...['copycenter', 'project', 'leaflet', 'uv'].map((n) => n + '-pricing'),
];
async function runtime(read = async (name) => readFile(path.join(root, name), 'utf8')) {
  const c = {};
  c.window = c;
  vm.createContext(c);
  for (const name of scripts) vm.runInContext(await read(name + '.js'), c);
  return c;
}
function quote(c, s) {
  const group = { 1: 'COPYCENTER', 2: 'PROJECT', 3: 'LEAFLET', 6: 'UV' }[s.id[0]];
  if (group) {
    const q = c['TEXT_' + group + '_PRICING'].quote(s.id, s.configuration);
    assert.ok(q.valid, s.id + ': ' + q.error);
    return q;
  }
  const g = s.id[0] === '4' ? 'STICKER' : 'WIDE';
  return c['TEXT_QUOTE_' + g + '_SERVICE'](s.id, {
    ...c['TEXT_' + g + '_SERVICES'][s.id].defaults,
    ...s.configuration,
  });
}
const fmt = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(v);
const norm = (s) => s.replace(/\s+/g, ' ').trim();
test('Every published card, price comparison and article example agrees with the shipped calculator', async () => {
  const catalog = await loadCatalog(root),
    prices = await createContentPrices({
      root,
      catalog,
      store: { snapshot: () => ({ revision: 'base' }), overrides: () => ({}) },
    }),
    c = await runtime();
  let cases = 0;
  for (const [key, s] of Object.entries(prices.registry.cases))
    if (!s.kind) {
      const q = quote(c, s),
        n = (s.upper ? q.upper : (q.price ?? q.total)) / (s.divisor || 1);
      assert.equal(prices.value(key), n, key);
      cases++;
    }
  assert.ok(cases >= 300);
  const services = Object.assign(
    {},
    ...['COPYCENTER', 'PROJECT', 'LEAFLET', 'STICKER', 'WIDE', 'UV'].map(
      (g) => c['TEXT_' + g + '_SERVICES'],
    ),
  );
  const files = new Set([
    ...Object.values(services).map((s) => s.path + 'index.html'),
    ...manual.bindings.map((b) => b.file),
    ...(manual.pages || []),
  ]);
  let cards = 0,
    bindings = 0,
    comparisons = 0;
  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    assert.equal(prices.render(source), source, 'Static fallback is stale: ' + file);
    const dom = new JSDOM(source),
      d = dom.window.document;
    for (const el of d.querySelectorAll('[data-price-example]')) {
      assert.equal(norm(el.textContent), norm(prices.text(el.dataset.priceExample)), file);
      bindings++;
    }
    for (const el of d.querySelectorAll('[data-price-comparison]')) {
      assert.equal(norm(el.textContent), norm(prices.comparison(el.dataset.priceComparison)), file);
      comparisons++;
    }
    for (const card of d.querySelectorAll('.cc-example')) {
      assert.ok(card.querySelector('strong[data-price-example]'), file + ' missing card binding');
      const config = JSON.parse(
        new URL(
          card.querySelector('a').getAttribute('href'),
          'https://example.invalid',
        ).searchParams.get('calc'),
      );
      const service = Object.values(services).find((s) => s.path + 'index.html' === file),
        q = quote(c, { id: service.id, configuration: config });
      assert.equal(
        norm(card.querySelector('strong').textContent),
        norm(fmt(q.price) + (q.upper > q.price ? '–' + fmt(q.upper) : '') + ' ₽'),
        file,
      );
      cards++;
    }
    for (const container of d.querySelectorAll('.category-price-card,#article-price-example')) {
      const price = container.querySelector('[data-price-example]'),
        link = container.matches('a[href*="#calculator"]')
          ? container
          : container.querySelector('a[href*="#calculator"]');
      assert.ok(price && link, file + ' missing price or calculator link');
      const url = new URL(
        link.getAttribute('href'),
        'https://example.invalid/' + file.replace(/index\.html$/, ''),
      );
      const service = Object.values(services).find((s) => '/' + s.path === url.pathname);
      assert.ok(service, file + ' invalid calculator link');
      const config =
        service.id[0] === '4'
          ? c.TEXT_STICKERPACK_SHARING.read(url.searchParams, service.id)
          : service.id[0] === '5'
            ? c.TEXT_WIDE_SHARING.read(url.searchParams, service.id)
            : JSON.parse(url.searchParams.get('calc'));
      const q = quote(c, { id: service.id, configuration: config });
      assert.equal(
        norm(price.textContent),
        norm(fmt(q.price ?? q.total) + ' ₽'),
        file + ' link does not reproduce its price',
      );
    }
    if (file.endsWith('minimalnyy-chek-chto-eto-takoe/index.html'))
      assert.deepEqual(
        [...d.querySelectorAll('tbody tr td:first-child')].map((e) => e.textContent),
        [
          'Пакетное ламинирование',
          'Накатка на ПВХ',
          'Накатка на пенокартон',
          'Баннеры',
          'UV DTF-наклейки',
          'Бирки',
          'Шильды',
        ],
      );
    dom.window.close();
  }
  assert.equal(cards, 105);
  assert.equal(comparisons, 51);
  assert.ok(bindings > 350);
  console.log({
    calculatorCases: cases,
    cards,
    comparisons,
    priceLabels: bindings,
    pages: files.size,
  });
  assert.throws(() => prices.render('<span data-price-example="missing">0 ₽</span>'), /Unknown/);
});

test('Saving tariffs updates cached HTML, article prices, minima, discounts and FAQ data; rollback and restart preserve agreement', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tekst-price-test-')),
    password = 'test-content-prices-2026';
  await atomicJson(path.join(directory, 'credentials.json'), await passwordRecord(password));
  let app, base, cookie, csrf;
  const start = async () => {
    app = await createSiteServer({ root, dataDir: directory, ordersOptions: { gatewayUrl: '' } });
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + app.server.address().port;
    const r = await fetch(base + '/api/admin/login', {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    assert.equal(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
    csrf = (await r.json()).csrf;
  };
  const post = async (url, data) => {
    const r = await fetch(base + url, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: base,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify(data),
    });
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  };
  const getCatalog = async () =>
    (await fetch(base + '/api/admin/catalog', { headers: { Cookie: cookie } })).json();
  const close = async () => {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
  };
  try {
    await start();
    let catalog = await getCatalog();
    const fields = catalog.fields;
    const changes = {};
    const edit = (predicate, value) => {
      const f = fields.find(predicate);
      assert.ok(f, 'Tariff field not found');
      changes[f.id] = value;
    };
    edit((f) => f.id === '860d4ba27d64987f6baa0dd6', 12);
    edit((f) => f.id === '30f222e3b6d4782773606a43', 24);
    edit((f) => f.id === 'dd252273314420b06d068c2d', 4404);
    edit((f) => f.id === '0c75d81fc1ad68de7fd6a072', 980);
    edit((f) => f.id === '77453aa135e85261af9271d3', 1600);
    edit((f) => f.id === '8e3dc6fac99030e08bf05ad0', 1.7);
    edit((f) => f.id === '2e2e6757512d3e01ed5e8997', 95);
    edit((f) => f.id === 'e6b52c52c0c3a29a097b1247', 0.1);
    const page = '/kopitsentr/pechat-dokumentov/',
      before = await (await fetch(base + page)).text(); // warm the public HTML cache
    const saved = await post('/api/admin/save', { revision: catalog.revision, changes });
    const check = async () => {
      const c = await runtime(async (file) => (await fetch(base + '/' + file)).text());
      for (const [url, key] of [
        [page, 'doc10'],
        ['/company/article/stoimost-pechati-chertezhey-chto-vliyaet/', 'eng2'],
        ['/company/article/listovka-ili-flaer/', 'leaf6'],
        ['/company/article/kruglye-stikery-diametr-tirazh/', 'rounduv'],
        ['/company/article/banner-razmery-i-material/', 'banner1'],
        ['/company/article/tablichka-dlya-ofisa-maket-i-tekst/', 'uv200'],
      ]) {
        const html = await (await fetch(base + url)).text(),
          dom = new JSDOM(html),
          d = dom.window.document;
        const el =
          d.querySelector(`[data-price-example="${key}"]`) ||
          d.querySelector('[data-price-example="card_1_1_0"]');
        assert.ok(el, url);
        const q = quote(c, manual.cases[key]);
        assert.equal(norm(el.textContent), norm(fmt(q.price ?? q.total) + ' ₽'), url);
        dom.window.close();
      }
      const html = await (await fetch(base + '/kopitsentr/paketnoe-laminirovanie/')).text(),
        dom = new JSDOM(html),
        d = dom.window.document;
      assert.equal(d.querySelector('[data-price-example="minlam"]').textContent, '95 ₽');
      assert.equal(d.querySelector('[data-price-example="lamdiscount"]').textContent, '10 %');
      const faq = [...d.querySelectorAll('script[type="application/ld+json"]')]
        .flatMap((e) => {
          const x = JSON.parse(e.textContent);
          return x['@graph'] || (Array.isArray(x) ? x : [x]);
        })
        .find((x) => x['@type'] === 'FAQPage');
      assert.ok(JSON.stringify(faq).includes('95 ₽'));
      assert.ok(JSON.stringify(faq).includes('10%'));
      dom.window.close();
    };
    assert.notEqual(await (await fetch(base + page)).text(), before);
    await check();
    await close();
    await start();
    await check();
    catalog = await getCatalog();
    await post('/api/admin/rollback', { revision: catalog.revision, id: catalog.history[0].id });
    assert.equal(await (await fetch(base + page)).text(), before);
  } finally {
    if (app?.server.listening) await close();
    await rm(directory, { recursive: true, force: true });
  }
});
