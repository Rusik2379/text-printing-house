import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const code = await readFile(new URL('../consent.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('Initial and dynamic private data and file capabilities are masked before recording', async () => {
  const dom = new JSDOM(html, {
    url: 'https://text-print.ru/?private=secret',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    d = w.document,
    calls = [];
  try {
    d.body.insertAdjacentHTML(
      'beforeend',
      '<input name="name" value="Иван"><textarea>Секрет</textarea><span data-cc-file-label>Личный.pdf</span><a href="/order-files/secret/quote">PDF</a>',
    );
    w.ym = (...args) => calls.push(args);
    w.eval(code);
    assert.equal(d.querySelector('input[name=name]').classList.contains('ym-disable-keys'), true);
    assert.equal(d.querySelector('textarea').classList.contains('ym-disable-keys'), true);
    assert.equal(
      d.querySelector('[data-cc-file-label]').classList.contains('ym-hide-content'),
      true,
    );
    assert.equal(
      d.querySelector('a[href*="/order-files/"]').classList.contains('ym-disable-tracklink'),
      true,
    );
    assert.equal(d.querySelector('script[src*="mc.yandex.ru"]'), null);
    d.querySelector('[data-cookie-choice="analytics"]').click();
    d.querySelector('script[src*="mc.yandex.ru"]').onload();
    d.body.insertAdjacentHTML(
      'beforeend',
      '<div class="request-form"><input name="phone"><p class="file-feedback">private.jpg</p></div><div class="order-confirmation">TXT-private<a download href="blob:private">ZIP</a></div><a id="late">Download</a>',
    );
    await tick();
    for (const selector of ['.request-form', '.order-confirmation', '.file-feedback'])
      assert.equal(d.querySelector(selector).classList.contains('ym-hide-content'), true);
    assert.equal(d.querySelector('input[name=phone]').classList.contains('ym-disable-keys'), true);
    assert.equal(d.querySelector('a[download]').classList.contains('ym-disable-tracklink'), true);
    d.querySelector('#late').href = '/order-files/new-secret/archive';
    await tick();
    assert.equal(d.querySelector('#late').classList.contains('ym-disable-tracklink'), true);
    w.TEXT_ANALYTICS.track('order_accepted', { phone: 'secret', url: '/order-files/token' });
    const goal = calls.find((a) => a[1] === 'reachGoal');
    assert.deepEqual(goal, [86530452, 'reachGoal', 'order_accepted']);
    assert.equal(calls.find((a) => a[1] === 'init')[2].url, 'https://text-print.ru/');
    assert.equal(calls.filter((a) => a[1] === 'hit').length, 0, 'Only one initial view');
    assert.ok(!JSON.stringify(calls).includes('secret'));
  } finally {
    w.close();
  }
});

test('Revoking consent discards events waiting for the external tag', async () => {
  const dom = new JSDOM(html, { url: 'https://text-print.ru/', runScripts: 'outside-only' });
  const w = dom.window,
    d = w.document,
    calls = [];
  try {
    w.ym = (...args) => calls.push(args);
    w.eval(code);
    d.querySelector('[data-cookie-choice="analytics"]').click();
    assert.equal(w.TEXT_ANALYTICS.allowed(), true);
    w.TEXT_ANALYTICS.track('order_accepted');
    d.querySelector('[data-cookie-settings]').click();
    d.querySelector('[data-cookie-analytics]').checked = false;
    d.querySelector('[data-cookie-choice="analytics"]').click();
    assert.equal(w.TEXT_ANALYTICS.allowed(), false);
    d.querySelector('[data-cookie-settings]').click();
    d.querySelector('[data-cookie-analytics]').checked = true;
    d.querySelector('[data-cookie-choice="analytics"]').click();
    d.querySelector('script[src*="mc.yandex.ru"]').onload();
    assert.equal(calls.filter((a) => a[1] === 'reachGoal').length, 0);
  } finally {
    w.close();
  }
});

test('Initial view strips private parameters from referrers and omits file capability URLs', () => {
  for (const [referrer, expected] of [
    ['https://example.com/search?phone=private#private', 'https://example.com/search'],
    ['https://text-print.ru/order-files/private/quote', ''],
  ]) {
    const dom = new JSDOM(html, {
      url: 'https://text-print.ru/?private=value',
      referrer,
      runScripts: 'outside-only',
    });
    const w = dom.window,
      d = w.document,
      calls = [];
    try {
      w.ym = (...args) => calls.push(args);
      w.eval(code);
      d.querySelector('[data-cookie-choice="analytics"]').click();
      d.querySelector('script[src*="mc.yandex.ru"]').onload();
      assert.equal(calls.length, 1, 'Exactly one initial page view');
      assert.equal(calls[0][1], 'init');
      assert.equal(calls[0][2].referrer, expected);
      assert.equal(calls[0][2].url, 'https://text-print.ru/');
      assert.ok(!JSON.stringify(calls).includes('private'));
    } finally {
      w.close();
    }
  }
});
