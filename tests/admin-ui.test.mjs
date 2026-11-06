// DOM integration against an isolated real HTTP server, never customer tariffs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { createSiteServer } from '../server.mjs';
import { passwordRecord } from '../.server/auth.mjs';
import { atomicJson } from '../.server/storage.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error('UI did not reach expected state');
}
test('Login, service search, numeric validation, drafts across services, saving and logout', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'text-admin-ui-')),
    password = 'isolated-test-password-2026';
  await atomicJson(path.join(dir, 'credentials.json'), await passwordRecord(password));
  const app = await createSiteServer({ root, dataDir: dir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const dom = new JSDOM(await readFile(path.join(root, '.server/admin/index.html'), 'utf8'), {
      url: base + '/admin/',
      runScripts: 'outside-only',
    }),
    w = dom.window,
    $ = (id) => w.document.getElementById(id);
  let cookie = '',
    payloads = [];
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new w.Event('close'));
  };
  w.fetch = async (url, options = {}) => {
    if (url.endsWith('/save')) payloads.push(JSON.parse(options.body));
    const r = await fetch(base + url, {
      ...options,
      headers: { ...options.headers, Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    return r;
  };
  function input(element, value) {
    element.value = value;
    element.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
  function select(name) {
    const b = [...$('services').querySelectorAll('button')].find((b) => b.textContent === name);
    assert.ok(b, name);
    b.click();
  }
  try {
    w.eval(await readFile(path.join(root, '.server/admin/admin.js'), 'utf8'));
    input($('password'), password);
    $('login-form').requestSubmit($('login-form').querySelector('[type=submit]'));
    await until(() => $('dashboard').hidden === false);
    assert.equal($('logout').hidden, false);
    input($('service-search'), 'копирование');
    assert.equal($('services').querySelectorAll('button').length, 2);
    input($('service-search'), '');
    select('Печать документов');
    const chooseCategory = (name) => {
      const b = [...$('categories').querySelectorAll('button')].find(
        (b) => b.dataset.category === name,
      );
      assert.ok(b, name);
      b.click();
    };
    chooseCategory('Бумага');
    assert.equal($('fields').querySelectorAll('.field-group').length, 1);
    const paperRow = [...$('fields').querySelectorAll('.field-row')].find(
      (r) => /Формат: А3/.test(r.textContent) && /Color Copy 300/.test(r.textContent),
    );
    assert.ok(paperRow);
    assert.match(paperRow.textContent, /один раз на лист/);
    const paperInput = paperRow.querySelector('input');
    assert.equal(paperInput.value, '38');
    input(paperInput, '64');
    assert.match(paperRow.querySelector('.field-example').textContent, /640/);
    chooseCategory('Двусторонняя печать');
    chooseCategory('Бумага');
    assert.equal(w.document.getElementById(paperInput.id).value, '64');
    w.document
      .getElementById(paperInput.id)
      .closest('.field-row')
      .querySelector('.field-meta button')
      .click();
    assert.equal($('save').disabled, true);
    select('Пакетное ламинирование');
    chooseCategory('Скидки и тираж');
    const discount = $('fields').querySelector('input');
    assert.equal(discount.value, '20');
    assert.equal(discount.max, '100');
    input(discount, '101');
    assert.equal($('save').disabled, true);
    input(discount, '25');
    assert.equal($('save').disabled, false);
    assert.match(discount.closest('.field-row').querySelector('.field-example').textContent, /750/);
    select('Копирование документов');
    const numeric = $('fields').querySelector('input');
    input(numeric, '-3');
    assert.equal($('save').disabled, true);
    assert.match($('save-status').textContent, /Проверьте/);
    input(numeric, '14');
    assert.equal($('save').disabled, false);
    select('Печать фотографий');
    select('Копирование документов');
    assert.equal($('fields').querySelector('input').value, '14');
    assert.match($('save-status').textContent, /2/);
    $('save').click();
    await until(
      () =>
        payloads.length === 1 &&
        $('save').disabled &&
        $('save-status').textContent === 'Все изменения сохранены',
    );
    assert.equal($('fields').querySelector('input').value, '14');
    assert.deepEqual(
      Object.values(payloads[0].changes).sort((a, b) => a - b),
      [0.25, 14],
    );
    const stored = app.store.overrides();
    assert.deepEqual(
      Object.values(stored).sort((a, b) => a - b),
      [0.25, 14],
    );
    select('Пакетное ламинирование');
    chooseCategory('Скидки и тираж');
    assert.equal($('fields').querySelector('input').value, '25');
    $('history-open').click();
    assert.equal($('history-list').querySelectorAll('.history-row').length, 1);
    $('history-dialog').close();
    $('logout').click();
    await until(() => $('login-view').hidden === false);
    assert.equal($('dashboard').hidden, true);
  } finally {
    w.close();
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
