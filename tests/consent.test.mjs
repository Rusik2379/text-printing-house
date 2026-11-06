import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const code = readFileSync(new URL('../consent.js', import.meta.url), 'utf8');
const key = 'text-print-consent-v1';
const saved = (analytics, age = 0) =>
  JSON.stringify({ version: 1, analytics, updatedAt: new Date(Date.now() - age).toISOString() });

// A browser boundary fake: run the shipped script, observe storage and network requests.
function browser({
  hostname = 'text-print.ru',
  stored,
  blockedStorage = false,
  cookies = [],
} = {}) {
  const values = new Map([
    ['text-print-cart-v1', '[{"id":"3.1"}]'],
    ['_ym_uid', '123'],
  ]);
  if (stored !== undefined) values.set(key, stored);
  const events = new Map(),
    scripts = [],
    calls = [],
    expired = [];
  const element = (dataset = {}) => ({
    dataset,
    hidden: false,
    listeners: new Map(),
    addEventListener(name, fn) {
      this.listeners.set(name, fn);
    },
    click() {
      document.activeElement = this;
      this.listeners.get('click')?.();
    },
    focus() {
      document.activeElement = this;
    },
    remove() {
      this.removed = true;
    },
  });
  const close = element(),
    analytics = element({ cookieChoice: 'analytics' });
  const status = element(),
    settings = element(),
    banner = element(),
    option = element(),
    analyticsInput = element();
  banner.querySelector = (selector) =>
    selector.includes('current')
      ? status
      : selector.includes('option')
        ? option
        : selector.includes('choice')
          ? analytics
          : selector.includes('analytics')
            ? analyticsInput
            : close;
  banner.contains = (target) => [close, analytics, analyticsInput].includes(target);
  const document = {
    title: 'ТЕКСТ',
    activeElement: null,
    head: {
      append(tag) {
        scripts.push(tag);
      },
    },
    querySelector: () => banner,
    querySelectorAll: (s) => (s === '[data-cookie-settings]' ? [settings] : []),
    createElement: () => element(),
    dispatchEvent() {},
  };
  Object.defineProperty(document, 'cookie', {
    get: () => cookies.join(';'),
    set: (value) => expired.push(value),
  });
  const localStorage = {
    getItem(name) {
      if (blockedStorage) throw Error('disabled');
      return values.get(name) ?? null;
    },
    setItem(name, value) {
      if (blockedStorage) throw Error('disabled');
      values.set(name, value);
    },
    removeItem(name) {
      values.delete(name);
    },
    key(index) {
      return [...values.keys()][index];
    },
    get length() {
      return values.size;
    },
  };
  const window = {
    ym: (...args) => calls.push(args),
    addEventListener: (name, fn) => events.set(name, fn),
  };
  const location = {
    hostname,
    origin: 'https://' + hostname,
    pathname: '/company/',
    search: '?private=do-not-report',
  };
  vm.runInNewContext(code, {
    window,
    document,
    localStorage,
    location,
    Date,
    JSON,
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {},
  });
  return {
    banner,
    close,
    analytics,
    analyticsInput,
    option,
    settings,
    status,
    scripts,
    calls,
    values,
    expired,
    document,
    window,
    revoke() {
      settings.click();
      analyticsInput.checked = false;
      analytics.click();
    },
    storage(value) {
      if (value === null) values.delete(key);
      else values.set(key, value);
      events.get('storage')({ key });
    },
    escape() {
      banner.listeners.get('keydown')({ key: 'Escape' });
    },
    load() {
      scripts.at(-1).onload?.();
    },
  };
}

test('No choice means visible banner and no analytics request', () => {
  const b = browser();
  assert.equal(b.banner.hidden, false);
  assert.equal(b.scripts.length, 0);
  assert.equal(b.calls.length, 0);
});

test('Conversion goals need current production consent and never accept arbitrary data', () => {
  const b = browser();
  b.window.TEXT_ANALYTICS.track('order_sent');
  assert.equal(b.calls.length, 0);
  b.analytics.click();
  b.window.TEXT_ANALYTICS.track('order_accepted');
  assert.equal(b.calls.length, 0);
  b.load();
  assert.equal(
    b.calls.filter((a) => a[1] === 'reachGoal').length,
    1,
    'Consented events wait for the tag to load',
  );
  for (const goal of [
    'order_sent',
    'order_accepted',
    'order_notification_failed',
    'phone_click',
    'telegram_click',
    'max_click',
    'email_click',
    'pdf_download',
    'xlsx_download',
  ])
    b.window.TEXT_ANALYTICS.track(goal);
  assert.equal(b.calls.filter((a) => a[1] === 'reachGoal').length, 10);
  assert.ok(b.calls.filter((a) => a[1] === 'reachGoal').every((a) => a.length === 3));
  b.window.TEXT_ANALYTICS.track('phone=+79990000000');
  assert.equal(b.calls.filter((a) => a[1] === 'reachGoal').length, 10);
  b.revoke();
  b.window.TEXT_ANALYTICS.track('order_sent');
  assert.equal(b.calls.filter((a) => a[1] === 'reachGoal').length, 10);
  const preview = browser({ hostname: 'telegadocs.ru' });
  preview.analytics.click();
  preview.window.TEXT_ANALYTICS.track('order_sent');
  assert.equal(preview.calls.length, 0);
});

test('Refusal persists across page loads and keeps the cart', () => {
  const b = browser();
  b.close.click();
  assert.equal(JSON.parse(b.values.get(key)).analytics, false);
  assert.equal(b.banner.hidden, true);
  assert.equal(b.scripts.length, 0);
  assert.equal(b.values.get('text-print-cart-v1'), '[{"id":"3.1"}]');
  assert.equal(browser({ stored: b.values.get(key) }).banner.hidden, true);
});

test('Production consent loads once, excludes query parameters and enables requested recordings', () => {
  const b = browser();
  b.analytics.click();
  assert.equal(b.scripts.length, 1);
  assert.equal(b.calls.length, 0, 'Do not initialize before script has loaded');
  b.load();
  b.load();
  assert.deepEqual(
    b.calls.map((args) => args[1]),
    ['init'],
  );
  assert.equal(b.scripts[0].src, 'https://mc.yandex.ru/metrika/tag.js?id=86530452');
  assert.equal(b.calls[0][2].ssr, true);
  assert.equal(b.calls[0][2].webvisor, true);
  assert.equal(b.calls[0][2].clickmap, true);
  assert.equal(b.calls[0][2].trackLinks, true);
  assert.equal(b.calls[0][2].defer, undefined);
  assert.equal(b.calls[0][2].url, 'https://text-print.ru/company/');
  b.settings.click();
  b.analytics.click();
  assert.equal(b.scripts.length, 1);
});

test('Existing valid production consent applies on the next page', () => {
  const b = browser({ stored: saved(true) });
  assert.equal(b.banner.hidden, true);
  assert.equal(b.scripts.length, 1);
});

test('Local, preview and look-alike hosts do not load analytics even with consent', () => {
  for (const hostname of [
    '127.0.0.1',
    'localhost',
    'rusik2379.github.io',
    'text-print.ru.example.test',
  ]) {
    const b = browser({ hostname, stored: saved(true) });
    b.analytics.click();
    assert.equal(b.scripts.length, 0, hostname);
  }
});

test('Revoke stops the initialized counter and clears only analytics data', () => {
  const b = browser({ hostname: 'www.text-print.ru', cookies: ['_ym_uid=123', 'cart=keep'] });
  b.analytics.click();
  b.load();
  b.revoke();
  assert.equal(b.calls.at(-1)[1], 'destruct');
  assert.equal(b.scripts[0].removed, true);
  assert.equal(b.values.has('_ym_uid'), false);
  assert.equal(b.values.has('text-print-cart-v1'), true);
  assert.ok(b.expired.some((value) => value.includes('domain=.text-print.ru')));
  assert.ok(b.expired.every((value) => value.startsWith('_ym_uid=')));
  b.analytics.click();
  b.load();
  assert.equal(b.calls.filter((args) => args[1] === 'init').length, 2);
});

test('Revoking a pending request prevents late load/error handlers affecting a new choice', () => {
  const b = browser();
  b.analytics.click();
  const old = b.scripts[0],
    lateLoad = old.onload,
    lateError = old.onerror;
  b.revoke();
  b.analytics.click();
  lateLoad();
  lateError();
  assert.equal(b.calls.length, 0);
  assert.equal(b.scripts[1].removed, undefined);
  b.load();
  assert.equal(b.calls.length, 1);
});

test('Failed load can retry without phantom initialization', () => {
  const b = browser();
  b.analytics.click();
  b.scripts[0].onerror();
  assert.equal(b.calls.length, 0);
  b.settings.click();
  b.analytics.click();
  b.load();
  assert.equal(b.calls.length, 1);
});

test('Expired, future, corrupt or old-version choices require a new selection', () => {
  for (const stored of [
    'oops',
    'null',
    '{}',
    saved('yes'),
    saved(true, 180 * 86400000 + 1000),
    saved(true, -86400000),
    saved(true).replace('"version":1', '"version":0'),
  ]) {
    const b = browser({ stored });
    assert.equal(b.banner.hidden, false, stored);
    assert.equal(b.scripts.length, 0);
  }
});

test('Storage restrictions preserve immediate refusal without throwing', () => {
  const b = browser({ blockedStorage: true });
  b.close.click();
  assert.equal(b.banner.hidden, true);
  assert.equal(b.scripts.length, 0);
});

test('Settings preserve the choice, support Escape and restore keyboard focus', () => {
  const b = browser();
  b.close.click();
  b.settings.click();
  assert.equal(b.banner.hidden, false);
  assert.equal(b.status.hidden, false);
  assert.equal(b.document.activeElement, b.analyticsInput);
  b.escape();
  assert.equal(b.banner.hidden, true);
  assert.equal(b.document.activeElement, b.settings);
  b.settings.click();
  b.analytics.click();
  assert.equal(b.document.activeElement, b.settings);
});

test('Closing settings keeps saved consent; only saving the checkbox changes it', () => {
  const b = browser({ stored: saved(true) });
  b.settings.click();
  assert.equal(b.option.hidden, false);
  assert.equal(b.analytics.textContent, 'Сохранить');
  b.analyticsInput.checked = false;
  b.close.click();
  assert.equal(JSON.parse(b.values.get(key)).analytics, true);
  b.revoke();
  assert.equal(JSON.parse(b.values.get(key)).analytics, false);
});

test('Shipped banner has one action, supports closing and reopening settings in the DOM', () => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {
    url: 'https://telegadocs.ru/',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    banner = w.document.querySelector('#cookie-banner');
  try {
    w.eval(code);
    assert.equal(banner.querySelector('[data-cookie-choice="necessary"]'), null);
    assert.equal(banner.querySelectorAll('.button').length, 1);
    assert.equal(banner.querySelector('[data-cookie-option]').hidden, true);
    banner.querySelector('[data-cookie-close]').click();
    assert.equal(banner.hidden, true);
    assert.equal(JSON.parse(w.localStorage.getItem(key)).analytics, false);
    w.document.querySelector('[data-cookie-settings]').click();
    assert.equal(banner.hidden, false);
    assert.equal(banner.querySelector('[data-cookie-option]').hidden, false);
    const checkbox = banner.querySelector('[data-cookie-analytics]');
    checkbox.checked = true;
    banner.querySelector('[data-cookie-choice="analytics"]').click();
    assert.equal(banner.hidden, true);
    assert.equal(JSON.parse(w.localStorage.getItem(key)).analytics, true);
    assert.equal(
      w.document.querySelector('script[src*="mc.yandex.ru"]'),
      null,
      'Demo domain never loads analytics',
    );
  } finally {
    w.close();
  }
});

test('Another tab can allow, revoke or clear the choice', () => {
  const b = browser();
  b.storage(saved(true));
  b.load();
  b.storage(saved(false));
  assert.equal(b.calls.at(-1)[1], 'destruct');
  assert.equal(b.banner.hidden, true);
  b.storage(null);
  assert.equal(b.banner.hidden, false);
});
