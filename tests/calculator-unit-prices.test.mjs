import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const groups = [
  ['copycenter', 'COPYCENTER'],
  ['project', 'PROJECT'],
  ['leaflet', 'LEAFLET'],
  ['uv', 'UV'],
];
const money = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
let checked = 0;
for (const [name, globalName] of groups) {
  const services = JSON.parse(
    fs.readFileSync(path.join(root, name + '-content.json'), 'utf8'),
  ).services;
  for (const service of services) {
    if (name === 'project' && !['2.2', '2.3', '2.4', '2.7'].includes(service.id)) continue;
    const dom = new JSDOM(fs.readFileSync(path.join(root, service.path, 'index.html'), 'utf8'), {
      url: 'https://example.invalid/' + service.path,
      runScripts: 'outside-only',
    });
    const w = dom.window,
      d = w.document;
    w.TEXT_APP = { getCart: () => [], notify() {} };
    w.TEXT_FILES = { validate: () => null };
    for (const file of [
      'copycenter-engine.js',
      name + '-pricing-data.js',
      name + '-pricing.js',
      name + '-services.js',
      ...(['leaflet', 'uv'].includes(name) ? [name + '-ui.js'] : []),
      name === 'project' ? 'project.js' : 'copycenter.js',
    ]) {
      w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
    }
    const unit = d.querySelector('[data-cc-unit]');
    assert.ok(unit, service.id);
    const presets = [...d.querySelectorAll('[data-cc-quantity]')].filter(
      (b) => b.dataset.ccQuantity !== 'custom' && !b.disabled,
    );
    const quantityCell = d.querySelector('.cc-quantity').dataset.ccField;
    const pricing = w['TEXT_' + globalName + '_PRICING'];
    for (const button of [presets[0], presets.at(-1)]) {
      button.click();
      const quantity = Number(button.dataset.ccQuantity),
        q = pricing.quote(service.id, {
          ...pricing.defaults(service.id),
          [quantityCell]: quantity,
        });
      assert.equal(q.valid, true, service.id);
      const expected = q.range
        ? `${money(q.price / quantity)}–${money(q.upper / quantity)}`
        : money(q.price / quantity);
      assert.ok(
        unit.textContent.includes(expected + ' ₽'),
        `${service.id}: correct per-unit cost for ${quantity}`,
      );
      assert.equal(unit.hidden, false);
    }
    const select = d.querySelector('[data-cc-quantity="custom"]');
    select.click();
    const input = d.querySelector(`[data-cc-cell="${quantityCell}"]`);
    if (input.tagName === 'INPUT') {
      input.value = '0';
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      assert.equal(d.querySelector('[data-cc-add]').disabled, true);
      assert.equal(unit.hidden, true, 'Invalid totals do not leave a stale unit price');
      d.querySelector('[data-cc-reset]').click();
      assert.equal(unit.hidden, false);
    }
    dom.window.close();
    checked++;
  }
}
assert.equal(checked, 32);
console.log(
  `Unit prices: ${checked} calculators, both ends of the quantity presets, invalid quantity and reset checked.`,
);
