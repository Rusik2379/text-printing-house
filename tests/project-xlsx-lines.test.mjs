import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const c = {
  TextEncoder,
  Uint8Array,
  Uint32Array,
  atob,
  Date,
  URL,
  AbortSignal,
  document: { currentScript: { src: 'https://example.invalid/cart-xlsx.js' } },
};
c.window = c;
vm.createContext(c);
for (const f of [
  'catalog.js',
  'project-pricing-data.js',
  'copycenter-engine.js',
  'project-pricing.js',
  'cart-pdf.js',
  'cart-xlsx.js',
  'vendor/xlsx/order-template.js',
])
  vm.runInContext(await readFile(new URL('../' + f, import.meta.url), 'utf8'), c);
test('Mixed project rows export separately, folding and binding reconcile to the saved total', async () => {
  for (const id of ['2.1', '2.6'])
    for (const count of [1, 50, 2000]) {
      const configuration =
        id === '2.6'
          ? {
              B4: 'Да',
              rows: [
                { B: 'A4', C: 'Стандартная (80 г/м²)', D: 'Ч/Б', E: count },
                { B: 'A3', C: 'Color Copy 120 г/м²', D: 'Цвет', E: count + 2 },
              ],
            }
          : {
              B4: 'Под A4',
              B5: 'Да',
              B7: 'A4',
              rows: [
                { B: 'A1', C: 'Ч/Б', D: count },
                { B: 'A3x6', C: 'Цвет', D: count + 2 },
              ],
            };
      const q = c.TEXT_PROJECT_PRICING.quote(id, configuration);
      assert.equal(q.valid, true, JSON.stringify(q));
      assert.ok(q.exportLines.length >= 3);
      assert.equal(
        Math.round(q.exportLines.reduce((n, l) => n + l.price, 0) * 100),
        Math.round(q.price * 100),
        id + ' decomposed operations equal quote',
      );
      const item = {
          id,
          price: q.price,
          configuration: q.configuration,
          description: q.description,
          exportLines: q.exportLines,
        },
        model = c.TEXT_CART_XLSX.model([item], c.TEXT_CATALOG, {});
      assert.equal(model.cart.length, q.exportLines.length);
      assert.equal(model.cart[0].quantity, count);
      assert.equal(model.cart[0].unit, 'л.');
      assert.ok(model.cart[1].description.includes(id === '2.6' ? 'Печать' : 'Фальцовка'));
      assert.equal(model.lower, q.price);
      assert.equal(
        model.cart.reduce((n, l) => n + Math.round(l.price * 100), 0),
        Math.round(q.price * 100),
      );
      if (id === '2.1' && count === 1) {
        await mkdir(new URL('../.work/xlsx-lines/', import.meta.url), { recursive: true });
        await writeFile(
          new URL('../.work/xlsx-lines/project-mixed.xlsx', import.meta.url),
          c.TEKST_XLSX(model),
        );
      }
    }
});
test('Older project basket items request missing decomposition; unavailable or changed rates preserve the saved total', async () => {
  const q = c.TEXT_PROJECT_PRICING.quote('2.1', {
    rows: [
      { B: 'A1', C: 'Ч/Б', D: 10 },
      { B: 'A4', C: 'Ч/Б', D: 1 },
    ],
  });
  const item = {
    id: '2.1',
    price: q.price,
    configuration: q.configuration,
    description: q.description,
  };
  c.fetch = async () => ({ ok: true, json: async () => ({ lines: q.exportLines }) });
  let prepared = await c.TEXT_CART_XLSX.prepare([item]);
  assert.ok(prepared[0].exportLines);
  assert.equal(c.TEXT_CART_XLSX.model(prepared, c.TEXT_CATALOG, {}).cart.length, 2);
  c.fetch = async () => {
    throw Error('Offline');
  };
  prepared = await c.TEXT_CART_XLSX.prepare([item]);
  const fallback = c.TEXT_CART_XLSX.model(prepared, c.TEXT_CATALOG, {});
  assert.equal(fallback.cart.length, 3);
  assert.equal(fallback.cart[0].price, null);
  assert.equal(fallback.cart.at(-1).price, q.price);
  assert.equal(fallback.lower, q.price);
});
