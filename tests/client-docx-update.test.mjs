import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createSiteServer } from '../server.mjs';
const read = (name) => readFile(new URL('../' + name, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 20));

test('Full-site search finds articles, inflected services, typos, FAQs and geographic intent', async () => {
  const dom = new JSDOM('', { url: 'http://localhost/', runScripts: 'outside-only' }),
    w = dom.window;
  Object.defineProperty(w.document, 'currentScript', {
    value: { src: 'http://localhost/site-search.js' },
  });
  try {
    for (const name of ['site-search-index.js', 'site-search-geography.js', 'site-search.js'])
      w.eval(await read(name));
    await w.TEXT_SITE_SEARCH.ready();
    const find = (q) => w.TEXT_SITE_SEARCH.find(q, 200);
    assert.ok(
      find('пружину').some((d) => d.k === 'Статья'),
      'Articles are searchable by their content',
    );
    assert.ok(
      find('печать наклеек').some((d) => d.k === 'Услуга' && d.u.startsWith('nakleyki-i-stikery/')),
    );
    assert.ok(
      find('наклйки').some((d) => d.k === 'Услуга'),
      'One-character typo',
    );
    assert.ok(
      find('Калистратиха').some((d) => d.k === 'Населённый пункт' && d.u.includes('kalmanskii')),
    );
    assert.ok(find('печать наклеек в Калистратихе').some((d) => d.k === 'Населённый пункт'));
    assert.ok(find('макет').some((d) => d.k === 'Вопросы и ответы'));
  } finally {
    w.close();
  }
});

test('Town anchors expand their district and choosing a service preserves the exact town', async () => {
  const html = await read('cities/altayskiy-kray/index.html');
  const dom = new JSDOM(html, {
      url: 'http://localhost/cities/altayskiy-kray/#selo-kalistratikha-kalmanskii-munitsipal-nyi-raion',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    }),
    w = dom.window,
    d = w.document;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(d, 'currentScript', {
    value: { src: 'http://localhost/cities.js' },
    configurable: true,
  });
  try {
    w.eval(await read('site-geo.js'));
    await tick();
    w.eval(await read('cities.js'));
    const town = d.getElementById('selo-kalistratikha-kalmanskii-munitsipal-nyi-raion');
    assert.equal(town.open, true);
    assert.equal(town.closest('.tc-district').open, true);
    const link = town.querySelector('a[href*="inzhenernaya-pechat"]');
    assert.ok(link);
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    assert.match(w.TEXT_GEO.get().residence.name, /Калистратиха/);
    assert.equal(w.TEXT_GEO.get().fulfillment, 'delivery');
    assert.ok(town.querySelector('a[href*="yandex.ru/maps/"]').href.includes('%D0%9A%D0%B0'));
  } finally {
    w.close();
  }
});

test('Cart delivery requires a selected town, keeps pickup usable and clears obsolete pickup addresses', async () => {
  const dom = new JSDOM(
      '<header id="header"><div class="header-actions"></div></header><section id="panel"></section>',
      { url: 'http://localhost/', runScripts: 'outside-only' },
    ),
    w = dom.window,
    d = w.document;
  Object.defineProperty(d, 'currentScript', { value: { src: 'http://localhost/site-geo.js' } });
  w.TEKST_GEODATA = {
    regions: ['Алтайский край'],
    districts: ['Район'],
    rows: [
      ['Барнаул', 0, 0, 600000, 53, 83, 'г', 'one'],
      ['Бийск', 0, 0, 200000, 52, 85, 'г', 'two'],
    ],
  };
  try {
    w.eval(await read('site-geo.js'));
    w.eval(await read('cart-extras.js'));
    await tick();
    const panel = d.getElementById('panel');
    panel.innerHTML = w.TEXT_CART_EXTRAS.render({
      productTotal: 1000,
      designId: 'design-basic',
      siteRoot: 'http://localhost/',
    });
    w.TEXT_CART_EXTRAS.mount(panel);
    assert.equal(panel.validateDelivery(), true);
    panel.querySelector('[value="delivery"]').click();
    assert.equal(panel.validateDelivery(), false);
    assert.equal(panel.querySelector('[name="carrier"]:checked').value, 'ozon');
    panel.querySelector('[name="carrier"][value="cdek"]').click();
    assert.equal(w.TEXT_GEO.get().carrier, 'cdek');
    assert.equal(panel.querySelector('.cart-other-address').hidden, false);
    panel.querySelector('[value="pickup"]').click();
    panel.querySelector('[value="delivery"]').click();
    assert.equal(panel.querySelector('[name="carrier"]:checked').value, 'ozon');
    assert.equal(w.TEXT_GEO.get().carrier, 'ozon');
    w.TEXT_GEO.choose((await w.TEXT_GEO.search('Барнаул'))[0]);
    assert.equal(panel.validateDelivery(), true);
    assert.equal(panel.querySelector('[data-pickup-town]').textContent, 'Барнаул');
    assert.equal(new URL(panel.querySelector('.cart-pickup-info a').href).hostname, 'www.ozon.ru');
    panel.querySelector('#cart-pvz-address').value = 'Старый ПВЗ';
    panel.querySelector('#cart-pvz-address').dispatchEvent(new w.Event('input'));
    assert.equal(panel.querySelector('[data-pickup-address]').textContent, 'Старый ПВЗ');
    w.TEXT_GEO.choose((await w.TEXT_GEO.search('Бийск'))[0]);
    assert.equal(panel.querySelector('#cart-pvz-address').value, '');
    assert.equal(panel.querySelector('[data-pickup-town]').textContent, 'Бийск');
    assert.equal(panel.querySelector('[data-pickup-preference]').hidden, true);
    assert.equal(panel.querySelector('.cart-pickup-map-link').href, 'https://www.ozon.ru/geo/');
    const input = panel.querySelector('#cart-delivery-town');
    input.value = 'Не выбран';
    input.dispatchEvent(new w.Event('input'));
    assert.equal(panel.validateDelivery(), false);
    panel.querySelector('[value="pickup"]').click();
    assert.equal(panel.validateDelivery(), true);
    assert.match(panel.querySelector('.cart-delivery-minimum').textContent, /2.000/);
  } finally {
    w.close();
  }
});

test('Server fixes designer prices, rejects multiple design rates and saves delivery in a local order', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'tekst-docx-'));
  const app = await createSiteServer({
    dataDir,
    publicOrigin: undefined,
    ordersOptions: { gatewayUrl: '' },
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  const post = (url, data) =>
    fetch(origin + url, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  const design = { key: 'design', id: 'design-basic', price: 1, description: 'Дизайн' };
  const body = {
    requestId: crypto.randomUUID(),
    kind: 'cart',
    contact: {
      name: 'Тест локальной сборки',
      phone: '+79990000000',
      comment: 'Доставка: село Калистратиха, Калманский район, Алтайский край. ПВЗ: согласовать.',
    },
    consent: '2026-10-07',
    items: [design],
    files: [],
    pageUrl: origin + '/',
  };
  try {
    let response = await post('/api/orders/draft', body);
    assert.equal(response.status, 201, await response.clone().text());
    const draft = await response.json();
    assert.equal(draft.total, 750);
    assert.equal(draft.changed, true);
    response = await fetch(origin + '/api/orders/' + draft.id + '/submit', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'X-Order-Token': draft.uploadToken,
      },
      body: JSON.stringify({ acceptRecalculation: true }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, 'preview');
    const saved = JSON.parse(
      await readFile(path.join(dataDir, 'orders', draft.id, 'order.json'), 'utf8'),
    );
    assert.match(saved.contact.comment, /Калистратиха/);
    assert.equal(saved.quote.rows[0].price, 750);
    assert.equal((await fetch(result.links.pdf)).status, 200);
    response = await post('/api/orders/draft', {
      ...body,
      requestId: crypto.randomUUID(),
      items: [design, { ...design, key: 'second', id: 'design-press' }],
    });
    assert.equal(response.status, 400);
  } finally {
    await new Promise((r) => app.server.close(r));
    await rm(dataDir, { recursive: true, force: true });
  }
});
