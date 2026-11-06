import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source = await readFile(new URL('../site-geo.js', import.meta.url), 'utf8');
const pageScript = await readFile(new URL('../delivery-page.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../dostavka-i-oplata/index.html', import.meta.url), 'utf8');
const KEY = 'text-print-delivery-v1';
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const fixture = {
  regions: ['Алтайский край', 'Новосибирская область'],
  districts: ['Городской округ город Барнаул', 'Калманский район', 'Другой район'],
  rows: [
    ['г. Барнаул', 0, 0, 630000, 53.35, 83.76, 'г.', 'barnaul'],
    ['село Калистратиха', 0, 1, 550, 53.05, 83.4, 'с.', 'kalistratiha'],
    ['село Александровка', 0, 1, 1000, 53.2, 83.5, 'с.', 'aleks-a'],
    ['село Александровка', 1, 2, 2000, 55.0, 83.0, 'с.', 'aleks-n'],
    ['г. Новосибирск', 1, 2, 1600000, 55.03, 82.92, 'г.', 'novosibirsk'],
  ],
};
async function setup({
  html = null,
  stored = null,
  permission = 'prompt',
  position,
  noData = false,
} = {}) {
  const dom = new JSDOM(
    html ||
      '<header id="header"><div class="header-actions"><button class="cart-button">Корзина</button></div></header>',
    {
      url: 'http://localhost:4197/dostavka-i-oplata/',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    },
  );
  const w = dom.window;
  const d = w.document;
  let calls = 0;
  Object.defineProperty(d, 'currentScript', {
    value: { src: 'http://localhost:4197/site-geo.js' },
    configurable: true,
  });
  Object.defineProperty(w, 'isSecureContext', { value: true });
  Object.defineProperty(w.navigator, 'permissions', {
    value: { query: async () => ({ state: permission }) },
  });
  Object.defineProperty(w.navigator, 'geolocation', {
    value: {
      getCurrentPosition(resolve, reject) {
        calls++;
        if (position) resolve({ coords: position });
        else reject({ code: 1 });
      },
    },
  });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event('close'));
  };
  if (stored)
    w.localStorage.setItem(KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
  if (!noData) w.TEKST_GEODATA = fixture;
  w.eval(source);
  await tick();
  return { w, d, geo: w.TEXT_GEO, calls: () => calls, close: () => w.close() };
}

test('First visit and opening the selector do not ask for location or load the large directory', async () => {
  const app = await setup({ noData: true });
  try {
    assert.equal(app.calls(), 0);
    app.d.getElementById('geo-header-button').click();
    assert.equal(app.d.getElementById('geo-dialog').open, true);
    assert.equal(app.d.querySelector('[data-geo-directory]'), null);
    assert.equal(app.calls(), 0);
  } finally {
    app.close();
  }
});

test('Search distinguishes identical town names by region and district', async () => {
  const app = await setup();
  try {
    const matches = await app.geo.search('Александровка');
    assert.equal(matches.length, 2);
    assert.equal(matches[0].region, 'Новосибирская область');
    assert.equal(matches[1].region, 'Алтайский край');
    const specific = await app.geo.search('Александровка Алтайский');
    assert.equal(specific.length, 1);
    assert.equal(specific[0].oktmo, 'aleks-a');
    assert.equal((await app.geo.search('г. Барнаул'))[0].name, 'г. Барнаул');
  } finally {
    app.close();
  }
});

test('Changing the selected town clears a stale pickup address; retaining the same town preserves it', async () => {
  const app = await setup();
  try {
    const [first] = await app.geo.search('Барнаул');
    const [second] = await app.geo.search('Калистратиха');
    app.geo.choose(first);
    app.geo.save({ pvzAddress: 'Старый адрес', pickup: first, fulfillment: 'delivery' });
    app.geo.choose(first);
    assert.equal(app.geo.get().pvzAddress, 'Старый адрес');
    app.geo.choose(second);
    assert.equal(app.geo.get().pvzAddress, '');
    assert.equal(app.geo.get().pickup, null);
    assert.equal(app.geo.get().fulfillment, 'delivery');
    assert.equal(JSON.parse(app.w.localStorage.getItem(KEY)).residence.oktmo, 'kalistratiha');
    assert.match(app.d.getElementById('geo-header-button').textContent, /Калистратиха/);
  } finally {
    app.close();
  }
});

test('An existing manual selection survives granted geolocation and a page reload', async () => {
  const residence = {
    name: 'село Калистратиха',
    region: 'Алтайский край',
    district: 'Калманский район',
    oktmo: 'kalistratiha',
  };
  const app = await setup({
    stored: { residence },
    permission: 'granted',
    position: { latitude: 55.03, longitude: 82.92, accuracy: 20 },
  });
  try {
    assert.equal(app.calls(), 0);
    assert.equal(app.geo.get().residence.name, residence.name);
    assert.match(app.d.getElementById('geo-header-button').textContent, /Калистратиха/);
  } finally {
    app.close();
  }
});

test('Granted geolocation proposes a town for confirmation; denial and imprecision preserve manual search', async () => {
  const auto = await setup({
    permission: 'granted',
    position: { latitude: 53.35, longitude: 83.76, accuracy: 100 },
  });
  try {
    assert.equal(auto.geo.get().residence, null, 'An inferred town is not a confirmed choice');
    assert.equal(auto.d.getElementById('geo-dialog').open, true);
    assert.match(auto.d.querySelector('.geo-candidate').textContent, /Верно определили/);
    auto.d.querySelector('.geo-candidate .button-primary').click();
    assert.equal(auto.geo.get().residence?.oktmo, 'barnaul');
    assert.equal(auto.d.getElementById('geo-dialog').open, false);
  } finally {
    auto.close();
  }
  const denied = await setup();
  try {
    await assert.rejects(denied.geo.detect(), /не предоставлен/);
    assert.equal(denied.geo.get().residence, null);
    assert.equal((await denied.geo.search('Калистратиха')).length, 1);
  } finally {
    denied.close();
  }
  const imprecise = await setup({
    position: { latitude: 53.35, longitude: 83.76, accuracy: 50000 },
  });
  try {
    await assert.rejects(imprecise.geo.detect(), /неточно/);
  } finally {
    imprecise.close();
  }
});

test('Keyboard selection works and delivery page stays in sync with the shared header', async () => {
  const app = await setup({ html: page });
  try {
    app.w.eval(pageScript);
    const input = app.d.getElementById('delivery-town');
    input.value = 'Калистратиха';
    input.dispatchEvent(new app.w.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(input.getAttribute('aria-expanded'), 'true');
    input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(
      new app.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    assert.equal(app.geo.get().residence.oktmo, 'kalistratiha');
    assert.match(app.d.getElementById('delivery-selected').textContent, /Калистратиха/);
    assert.match(app.d.getElementById('geo-header-button').textContent, /Калистратиха/);
    app.geo.choose((await app.geo.search('Барнаул'))[0]);
    assert.equal(input.value, 'г. Барнаул');
    assert.match(app.d.getElementById('delivery-selected').textContent, /Барнаул/);
    input.value = 'Александровка';
    input.dispatchEvent(new app.w.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    input.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    input.dispatchEvent(
      new app.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    assert.equal(
      app.geo.get().residence.oktmo,
      'aleks-a',
      'ArrowUp initially selects the last suggestion',
    );
  } finally {
    app.close();
  }
});

test('Corrupt storage and a failed directory request do not break the selector and can be retried', async () => {
  const app = await setup({ stored: '{invalid', noData: true });
  try {
    assert.equal(app.geo.get().residence, null);
    const pending = app.geo.search('Барнаул');
    app.d.querySelector('[data-geo-directory]').onerror();
    await assert.rejects(pending, /Не удалось загрузить/);
    app.w.TEKST_GEODATA = fixture;
    assert.equal((await app.geo.search('Барнаул'))[0].oktmo, 'barnaul');
  } finally {
    app.close();
  }
});

test('Stored town labels render as text and clearing storage updates the header', async () => {
  const app = await setup({
    stored: { residence: { name: '<img src=x onerror=alert(1)>', region: 'Регион' } },
  });
  try {
    assert.equal(app.d.getElementById('geo-header-button').querySelector('img'), null);
    app.w.localStorage.removeItem(KEY);
    app.w.dispatchEvent(new app.w.StorageEvent('storage', { key: KEY }));
    assert.match(app.d.getElementById('geo-header-button').textContent, /Ваш город/);
  } finally {
    app.close();
  }
});
