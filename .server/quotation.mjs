import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { ApiError } from './storage.mjs';

// Only trusted repository scripts run here. Customer input is data, never code.
const scripts = [
  'catalog.js',
  'pricing.js',
  'stickerpack-pricing.js',
  'sticker-pricing.js',
  'sticker-services.js',
  'stickerpack-calculator.js',
  'sticker-special-calculator.js',
  'stickerpack-sharing.js',
  'wide-format-services.js',
  'wide-format-pricing.js',
  'wide-format-calculator.js',
  'wide-format-sharing.js',
  ...['copycenter', 'project', 'leaflet', 'uv'].flatMap((s) => [
    s + '-services.js',
    s + '-pricing-data.js',
  ]),
  'copycenter-engine.js',
  ...['copycenter', 'project', 'leaflet', 'uv'].map((s) => s + '-pricing.js'),
];
const safeText = (v, max) =>
  String(v ?? '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim()
    .slice(0, max);
export async function createQuotation(root, catalog, store) {
  const sources = new Map(
    await Promise.all(scripts.map(async (f) => [f, await readFile(path.join(root, f), 'utf8')])),
  );
  let cached, revision;
  function runtime() {
    if (cached && revision === store.snapshot().revision) return cached;
    const c = {};
    c.window = c;
    vm.createContext(c);
    for (const f of scripts)
      vm.runInContext(
        catalog.modules.has(f) ? catalog.render(f, store.overrides()) : sources.get(f),
        c,
        { filename: f, timeout: 3000 },
      );
    cached = c;
    revision = store.snapshot().revision;
    return c;
  }
  function quote(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 50)
      throw new ApiError(400, 'Добавьте от 1 до 50 позиций в корзину.');
    const c = runtime(),
      keys = new Set();
    const rows = items.map((item) => {
      if (
        !item ||
        typeof item.key !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(item.key) ||
        keys.has(item.key)
      )
        throw new ApiError(400, 'Некорректная позиция корзины.');
      keys.add(item.key);
      const designerPrices = { 'design-press': 500, 'design-basic': 750, 'design-both': 1000 };
      const designerNames = {
        'design-press': 'Предпечатная подготовка',
        'design-basic': 'Базовый дизайн',
        'design-both': 'Предпечатная подготовка + Дизайн',
      };
      const designer = Object.hasOwn(designerPrices, item.id);
      const service = designer
        ? { id: item.id, name: designerNames[item.id] }
        : c.TEXT_CATALOG.find((s) => s.id === item.id);
      if (!service) throw new ApiError(400, 'Неизвестная услуга.');
      const config = item.configuration;
      if (
        config &&
        (typeof config !== 'object' ||
          Array.isArray(config) ||
          JSON.stringify(config).length > 30000)
      )
        throw new ApiError(400, 'Некорректные параметры расчёта.');
      const row = {
        key: item.key,
        id: item.id,
        price: null,
        description: safeText(item.description, 2500),
        comment: safeText(item.comment, 2000),
      };
      if (designer) {
        if (config)
          throw new ApiError(400, 'Дополнительная услуга дизайнера не требует калькулятора.');
        row.price = designerPrices[item.id];
        row.description = designerNames[item.id] + ' · согласуем состав работ до исполнения.';
      }
      if (config) {
        let q;
        for (const [group, api] of [
          ['COPYCENTER', 'COPYCENTER'],
          ['PROJECT', 'PROJECT'],
          ['LEAFLET', 'LEAFLET'],
          ['UV', 'UV'],
        ]) {
          if (!c['TEXT_' + group + '_SERVICES']?.[item.id]) continue;
          q = c['TEXT_' + api + '_PRICING'].quote(item.id, JSON.parse(JSON.stringify(config)));
          if (!q?.valid)
            throw new ApiError(400, 'Проверьте параметры услуги «' + service.name + '».');
          row.price = q.price;
          row.priceUpper = q.upper;
          row.configuration = q.configuration;
          row.description = q.description;
          if (q.exportLines?.length) row.exportLines = JSON.parse(JSON.stringify(q.exportLines));
          row.pricingGroup = c['TEXT_' + group + '_SERVICES'][item.id].pricingGroup;
          break;
        }
        if (!q && c.TEXT_STICKER_SERVICES?.[item.id]) {
          const s = c.TEXT_STICKER_SERVICES[item.id];
          q = c.TEXT_QUOTE_STICKER_SERVICE(item.id, config);
          if (q) {
            row.price = q.subtotal;
            row.pricingGroup = s.pricingGroup;
            row.configuration = config;
            const labels = c.TEXT_STICKERPACK_SHARING.labels;
            row.description = [
              `Размер: ${config.width} × ${config.height} мм`,
              `Количество: ${config.quantity} шт.`,
              labels.material[config.material],
              labels.print[config.print],
              labels.shape[config.shape],
              config.perPack ? `Стикеров в наборе: ${config.perPack}` : '',
              config.stickerWidth
                ? `Размер стикера: ${config.stickerWidth} × ${config.stickerHeight} мм`
                : '',
              labels.cut[config.cut],
            ]
              .filter(Boolean)
              .join(' · ');
          }
        }
        if (!q && c.TEXT_WIDE_SERVICES?.[item.id]) {
          q = c.TEXT_QUOTE_WIDE_SERVICE(item.id, config);
          if (q) {
            row.price = q.subtotal;
            row.pricingGroup = c.TEXT_WIDE_SERVICES[item.id].pricingGroup;
            row.configuration = config;
            row.description =
              c.TEXT_WIDE_SHARING.description(config, item.id) +
              ' · Количество: ' +
              config.quantity +
              ' шт.';
          }
        }
        if (!q || !Number.isFinite(row.price) || row.price < 0 || row.price > 1e8)
          throw new ApiError(400, 'Параметры услуги «' + service.name + '» требуют уточнения.');
      }
      if (row.comment) row.description += '\nКомментарий: ' + row.comment;
      return JSON.parse(JSON.stringify(row));
    });
    if (rows.filter((r) => r.id.startsWith('design-')).length > 1)
      throw new ApiError(400, 'Выберите не более одной услуги дизайнера.');
    const breakdown = JSON.parse(JSON.stringify(c.TEXT_STICKER_CART_BREAKDOWN(rows)));
    const upper =
      breakdown.total +
      rows.reduce((sum, r) => sum + (r.priceUpper > r.price ? r.priceUpper - r.price : 0), 0);
    const changed = rows.some(
      (r, i) =>
        r.price !== items[i].price ||
        (r.priceUpper ?? r.price) !== (items[i].priceUpper ?? items[i].price),
    );
    return {
      rows,
      breakdown,
      total: breakdown.total,
      upper,
      changed,
      catalog: JSON.parse(
        JSON.stringify([
          ...c.TEXT_CATALOG,
          { id: 'design-press', name: 'Предпечатная подготовка', category: 'Услуги дизайнера' },
          { id: 'design-basic', name: 'Базовый дизайн', category: 'Услуги дизайнера' },
          {
            id: 'design-both',
            name: 'Предпечатная подготовка + Дизайн',
            category: 'Услуги дизайнера',
          },
        ]),
      ),
      revision: store.snapshot().revision,
    };
  }
  function example(id, configuration = {}) {
    const c = runtime();
    for (const group of ['COPYCENTER', 'PROJECT', 'LEAFLET', 'UV'])
      if (c['TEXT_' + group + '_SERVICES']?.[id]) {
        const q = c['TEXT_' + group + '_PRICING'].quote(id, configuration);
        if (!q?.valid) throw Error('Invalid content price: ' + id + ' ' + q?.error);
        return {
          price: q.price,
          upper: q.upper ?? q.price,
          description: q.description,
          details: JSON.parse(JSON.stringify(q.details || [])),
        };
      }
    for (const group of ['STICKER', 'WIDE'])
      if (c['TEXT_' + group + '_SERVICES']?.[id]) {
        const q = c['TEXT_QUOTE_' + group + '_SERVICE'](id, {
          ...c['TEXT_' + group + '_SERVICES'][id].defaults,
          ...configuration,
        });
        if (!q) throw Error('Invalid content price: ' + id);
        return { price: q.total, upper: q.total, details: [] };
      }
    throw Error('Unknown content price service: ' + id);
  }
  function minimum(id) {
    const c = runtime();
    if (id === '1.4') {
      const d = c.TEXT_COPYCENTER_DATA[id];
      return new c.TEXT_COPYCENTER_ENGINE(d.book, { [d.schema.sheet + '!E8']: 0 }).get(
        d.schema.sheet,
        'E10',
      );
    }
    for (const group of ['STICKER', 'WIDE', 'UV']) {
      const service = c['TEXT_' + group + '_SERVICES']?.[id];
      if (service?.pricingGroup)
        return c.TEXT_STICKER_CART_BREAKDOWN([{ price: 0, pricingGroup: service.pricingGroup }])
          .total;
    }
    const q = example(id),
      detail = q.details.find(
        (d) => /минимальн.*(?:чек|стоим)/i.test(d.label) && typeof d.value === 'number',
      );
    if (!detail) throw Error('Minimum is not specified: ' + id);
    return detail.value;
  }
  // Public discovery receives the existing runtime, never workbook data or tariffs.
  return { quote, example, minimum, describeRuntime: runtime };
}
