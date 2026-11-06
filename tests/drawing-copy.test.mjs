import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../.server/catalog.mjs';
import { createQuotation } from '../.server/quotation.mjs';
import { createPublicAi } from '../.server/public-ai.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('Drawing copy shares document-copy tariffs, server validation and public parameters; folding stays independent', async () => {
  const catalog = await loadCatalog(root);
  let overrides = {},
    revision = 'base';
  const store = { snapshot: () => ({ revision }), overrides: () => overrides };
  const pricing = await createQuotation(root, catalog, store),
    ai = await createPublicAi({ root, catalog, store });
  const base = 'https://example.invalid/';
  const documents = ai.parameters({ serviceId: '1.2' }, base),
    drawings = ai.parameters({ serviceId: '2.5' }, base);
  assert.deepEqual(drawings.configuration, documents.configuration);
  assert.deepEqual(drawings.fields, documents.fields);
  assert.deepEqual(drawings.inputSchema, documents.inputSchema);
  assert.equal(drawings.service.url, base + 'proektnaya-dokumentatsiya/kopirovanie-chertezhey/');
  assert.equal(drawings.inputSchema.properties.rows, undefined);
  const view = catalog.view({}),
    a = view.services.find((s) => s.id === '1.2'),
    b = view.services.find((s) => s.id === '2.5');
  assert.deepEqual(b.groups, a.groups, 'Both admin pages edit the same rate identities');
  assert.ok(
    view.fields
      .filter((f) => f.service === '1.2')
      .every((f) => f.sharedWith.includes('Копирование чертежей')),
  );
  assert.ok(
    !view.fields.some((f) => f.service === '2.5'),
    'Retired engineering rates are hidden from current editing',
  );
  const configuration = { B4: 'A4', B5: 'Ч/Б', B6: 'Со стекла', B7: 25 };
  const quote = (id) => pricing.quote([{ key: 'check', id, configuration, price: 250 }]);
  assert.equal(quote('2.5').total, quote('1.2').total);
  assert.equal(quote('2.5').rows[0].id, '2.5');
  const folding = pricing.example('2.3', { B4: 'A1', B5: 10 });
  const rate = view.fields.find((f) => f.service === '1.2' && f.base === 10);
  assert.ok(rate);
  overrides = { [rate.id]: 14 };
  revision = 'updated';
  assert.equal(quote('1.2').total, 350);
  assert.equal(quote('2.5').total, 350, 'Admin edits reach both calculators after revision change');
  assert.deepEqual(
    pricing.example('2.3', { B4: 'A1', B5: 10 }),
    folding,
    'The separate folding service is unchanged',
  );
  for (const invalid of [
    { B4: 'A1' },
    { rows: [{ B: 'A1', C: 'Ч/Б', D: 10 }] },
    { B7: 0 },
    { B9: 1 },
  ]) {
    assert.throws(() => ai.calculate({ serviceId: '2.5', configuration: invalid }, base));
  }
  assert.throws(
    () =>
      pricing.quote([
        {
          key: 'legacy',
          id: '2.5',
          price: 1300,
          configuration: { rows: [{ B: 'A1', C: 'Ч/Б', D: 10 }] },
        },
      ]),
    /Проверьте параметры/,
  );
});
