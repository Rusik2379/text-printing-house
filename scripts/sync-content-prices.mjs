// Bind public examples to the same tariff runtime used for checkout.
// Run after page generators, or after changing the base tariff files.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { loadCatalog } from '../.server/catalog.mjs';
import { createContentPrices } from '../.server/content-prices.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (f) => readFile(path.join(root, f), 'utf8');
const save = async (f, s) => {
  if ((await read(f)) !== s) await writeFile(path.join(root, f), s);
};
const manual = JSON.parse(await read('scripts/content-price-bindings.json'));
const registry = { cases: { ...manual.cases }, comparisons: {} };
const context = {};
context.window = context;
vm.createContext(context);
for (const name of ['copycenter', 'project', 'leaflet', 'sticker', 'wide', 'uv']) {
  const file = name === 'wide' ? 'wide-format-services.js' : name + '-services.js';
  vm.runInContext(await read(file), context);
}
for (const name of ['copycenter', 'project', 'leaflet', 'uv']) {
  for (const file of [
    name + '-pricing-data.js',
    ...(name === 'copycenter' ? ['copycenter-engine.js'] : []),
    name + '-pricing.js',
  ])
    vm.runInContext(await read(file), context);
}
const services = Object.assign(
  {},
  ...['COPYCENTER', 'PROJECT', 'LEAFLET', 'STICKER', 'WIDE', 'UV'].map(
    (n) => context['TEXT_' + n + '_SERVICES'],
  ),
);
const reference = JSON.parse(await read('seo-content.json')).service_search_terms;
const profiles = JSON.parse(await read('service-enrichment.json'));
const cells = {
  1.1: 'B7',
  1.3: 'B8',
  1.4: 'B6',
  1.5: 'B8',
  1.6: 'B11',
  1.7: 'B7',
  1.8: 'B7',
  1.9: 'B8',
  2.2: 'B8',
  2.4: 'B7',
  2.7: 'B7',
};
const patches = {
  3.2: { B7: 300 },
  4.5: { width: 30, height: 30 },
  4.7: { width: 152, height: 108, cut: 'no' },
  4.8: { width: 50, height: 50 },
  4.9: { width: 50, height: 50 },
  '4.10': { width: 50, height: 50 },
  5.8: { width: 210, height: 297 },
  5.9: { width: 600, height: 1200 },
};
const documents = new Map();
function document(file, html) {
  const dom = new JSDOM(html, { includeNodeLocations: true });
  documents.set(file, { html, dom, edits: [] });
  return documents.get(file);
}
function replace(doc, el, html) {
  const l = doc.dom.nodeLocation(el);
  if (!l?.startTag || !l.endTag) throw Error('Missing source location');
  doc.edits.push({ start: l.startOffset, end: l.endOffset, text: html });
}
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
let cards = 0;
for (const service of Object.values(services)) {
  const file = service.path + 'index.html',
    doc = document(file, await read(file)),
    d = doc.dom.window.document;
  let i = 0;
  for (const card of d.querySelectorAll('.cc-example')) {
    const key = 'card_' + service.id.replace('.', '_') + '_' + i++,
      configuration = JSON.parse(
        new URL(
          card.querySelector('a[href]').getAttribute('href'),
          'https://example.invalid',
        ).searchParams.get('calc'),
      );
    registry.cases[key] = { id: service.id, configuration, range: true };
    const strong = card.querySelector('strong');
    replace(
      doc,
      strong,
      `<strong data-price-example="${key}">${escape(strong.textContent)}</strong>`,
    );
    cards++;
  }
  const ref = reference[service.id];
  if (!ref?.points.length) continue;
  const override = profiles.services[service.id].priceExample;
  const points = override
    ? override.points.map((p) => ({ qty: p.quantity }))
    : [ref.points[0], ref.points.at(-1)];
  const key = 'geo_' + service.id.replace('.', '_');
  registry.comparisons[key] = {
    label: override?.label || ref.config,
    points: points.map((p, i) => {
      const id = service.id,
        cfg = { ...patches[id], ...override?.configuration },
        group = { 1: 'COPYCENTER', 2: 'PROJECT', 3: 'LEAFLET', 6: 'UV' }[id[0]];
      if (id === '2.1') cfg.rows = [{ B: 'A1', C: 'Ч/Б', D: p.qty }];
      else if (group)
        cfg[cells[id] || context['TEXT_' + group + '_PRICING'].quantityCell(id)] = p.qty;
      else cfg.quantity = p.qty;
      const pointKey = key + '_' + i;
      registry.cases[pointKey] = { id, configuration: cfg };
      return { key: pointKey, quantity: p.qty };
    }),
  };
  const heading = [...d.querySelectorAll('.geo-answer-card h3')].find(
    (h) => h.textContent === 'Сколько стоит',
  );
  if (!heading) throw Error('Missing price answer ' + service.id);
  replace(doc, heading.nextElementSibling, `<p data-price-comparison="${key}"></p>`);
}
// Article bindings retain existing markup and explicitly record each configuration.
for (const binding of manual.bindings) {
  let doc = documents.get(binding.file);
  if (!doc) doc = document(binding.file, await read(binding.file));
  const d = doc.dom.window.document;
  const el =
    d.querySelector(`[data-price-block="${binding.key}"]`) ||
    (binding.prefix
      ? [...d.querySelectorAll(binding.selector)].filter((e) =>
          e.textContent.replace(/\s+/g, ' ').trim().startsWith(binding.prefix),
        )[binding.occurrence]
      : d.querySelectorAll(binding.selector)[binding.index]);
  if (!el) throw Error('Price paragraph moved: ' + binding.file + ' ' + binding.prefix);
  replace(doc, el, binding.template);
}
for (const file of manual.pages || []) if (!documents.has(file)) document(file, await read(file));
await writeFile(
  path.join(root, '.server/content-price-cases.json'),
  JSON.stringify(registry, null, 2) + '\n',
);
const catalog = await loadCatalog(root),
  store = { snapshot: () => ({ revision: 'base' }), overrides: () => ({}) };
const prices = await createContentPrices({ root, catalog, store });
// Resolve every case eagerly, so a bad binding cannot reach deployment.
for (const key of Object.keys(registry.cases)) prices.text(key);
for (const key of Object.keys(registry.comparisons)) prices.comparison(key);
for (const [file, doc] of documents) {
  let end = Infinity,
    html = doc.html;
  for (const edit of doc.edits.sort((a, b) => b.start - a.start)) {
    if (edit.end > end) throw Error('Overlapping price edits in ' + file);
    html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
    end = edit.start;
  }
  await save(file, prices.render(html));
  doc.dom.window.close();
}
for (const [id, profile] of Object.entries(profiles.services))
  if (registry.comparisons['geo_' + id.replace('.', '_')])
    profile.answers.find((a) => a.title === 'Сколько стоит').text = prices.comparison(
      'geo_' + id.replace('.', '_'),
    );
await save('service-enrichment.json', JSON.stringify(profiles, null, 2) + '\n');
console.log(
  `Synchronized ${cards} example cards, ${Object.keys(registry.comparisons).length} price comparisons and ${manual.bindings.length} text blocks (${Object.keys(registry.cases).length} calculator cases).`,
);
