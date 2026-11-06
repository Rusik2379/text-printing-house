import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)),
  load = async (f) => new JSDOM(await readFile(path.join(root, f), 'utf8'));
test('All six hubs and 55 services retain static headings, useful links and calculator-backed content', async () => {
  const profiles = JSON.parse(
    await readFile(path.join(root, 'service-enrichment.json'), 'utf8'),
  ).services;
  for (const s of Object.values(profiles)) {
    const dom = await load(s.path + 'index.html'),
      d = dom.window.document;
    assert.equal(d.querySelectorAll('h1').length, 1, s.id);
    assert.equal(
      d.querySelectorAll('nav[class*=breadcrumb] a').length,
      2,
      s.id + ' parent must be an actual link',
    );
    assert.equal(d.querySelector('.intent-chips'), null, s.id);
    assert.equal(d.querySelectorAll('.geo-answer-card').length, 2, s.id);
    assert.ok(
      d.querySelectorAll('main .featured-card').length >= 1,
      s.id + ' related services must be static',
    );
    dom.window.close();
  }
  for (const route of [...new Set(Object.values(profiles).map((s) => s.path.split('/')[0]))]) {
    const dom = await load(route + '/index.html'),
      d = dom.window.document;
    assert.equal(d.querySelectorAll('h1').length, 1, route);
    assert.equal(d.querySelectorAll('#category-choice-audit table').length, 0, route);
    assert.ok(
      d.querySelectorAll('#category-choice-audit .category-choice-card').length >= 4,
      route,
    );
    assert.ok(d.querySelectorAll('#category-choice-audit .category-price-card').length >= 4, route);
    assert.ok(d.querySelectorAll('#category-choice-audit [data-price-example]').length >= 4, route);
    assert.ok(d.querySelectorAll('details').length >= 4, route);
    dom.window.close();
  }
});
test('Clear order instructions, live review links, complete footer and a no-JS selection path', async () => {
  const home = await load('index.html'),
    d = home.window.document;
  assert.ok(d.querySelector('#calculators').textContent.includes('50+ калькуляторов'));
  assert.ok(d.querySelector('#calculators').textContent.includes('PDF и Excel заказа'));
  assert.equal(d.querySelector('.feedback-rating,.feedback-source'), null);
  assert.equal(d.querySelectorAll('#footer-services a:not(.footer-cities-link)').length, 6);
  assert.equal(
    d.querySelectorAll('#footer-services .footer-cities-link[href="cities/"]').length,
    1,
  );
  for (const url of ['guide/', 'equipment/', 'for-business/', 'company/clients/'])
    assert.ok(
      [...d.querySelectorAll('footer a')].some((a) => a.getAttribute('href') === url),
      url,
    );
  home.window.close();
  const order = await load('kak-oformit-zakaz/index.html'),
    body = order.window.document.querySelector('main').textContent;
  assert.ok(body.includes('всех 55 услуг'));
  assert.ok(body.includes('номер заявки'));
  assert.ok(!body.includes('Открыть письмо'));
  order.window.close();
  const reviews = await load('company/request/index.html');
  assert.ok(!reviews.window.document.querySelector('main').textContent.includes('чтобы мы могли.'));
  assert.equal(reviews.window.document.querySelectorAll('.map-link-grid-v7 a').length, 3);
  reviews.window.close();
  const selector = await load('podbor-uslugi/index.html');
  assert.equal(selector.window.document.querySelectorAll('[data-pick]').length, 6);
  assert.equal(
    selector.window.document.querySelectorAll('#selector-category-links a[href]').length,
    6,
  );
  selector.window.close();
});
test('Equipment photos are local and complete; C7100 remains a future purchase', async () => {
  const dirs = (await readdir(path.join(root, 'equipment'), { withFileTypes: true })).filter((e) =>
    e.isDirectory(),
  );
  assert.equal(dirs.length, 13);
  for (const dir of dirs) {
    const file = 'equipment/' + dir.name + '/index.html',
      dom = await load(file),
      d = dom.window.document,
      image = d.querySelector('.equipment-photo-stage img');
    assert.ok(image, dir.name);
    const src = image.getAttribute('src');
    assert.ok(!/^https?:/.test(src));
    assert.ok(image.alt.length > 3);
    await stat(path.resolve(path.dirname(path.join(root, file)), src));
    if (dir.name.includes('c7100'))
      assert.match(d.querySelector('main').textContent, /планир|планируем|будущ/i);
    dom.window.close();
  }
});
