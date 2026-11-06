import { createQuotation } from './quotation.mjs';
import { ApiError } from './storage.mjs';

const groups = ['COPYCENTER', 'PROJECT', 'LEAFLET', 'UV', 'STICKER', 'WIDE'];
const labels = {
  width: 'Ширина, мм',
  height: 'Высота, мм',
  quantity: 'Количество, шт.',
  print: 'Технология печати',
  material: 'Материал',
  shape: 'Форма',
  cut: 'Контурная резка',
  stickerWidth: 'Ширина стикера, мм',
  stickerHeight: 'Высота стикера, мм',
  perPack: 'Стикеров в наборе',
  thickness: 'Толщина, мм',
  complexity: 'Сложность резки',
  colorRate: 'Тариф цветной печати A4',
};
const normalize = (text) =>
  String(text)
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[\s\p{P}]+/gu, ' ')
    .trim();
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));
function input(value) {
  if (
    !plain(value) ||
    Object.keys(value).some((k) => !['serviceId', 'configuration'].includes(k)) ||
    typeof value.serviceId !== 'string' ||
    !/^\d\.\d{1,2}$/.test(value.serviceId)
  )
    throw new ApiError(400, 'Укажите serviceId услуги.');
  const config = value.configuration ?? {};
  if (!plain(config) || JSON.stringify(config).length > 30000)
    throw new ApiError(400, 'Некорректные параметры расчёта.');
  return { id: value.serviceId, config };
}
export async function createPublicAi({ root, catalog, store }) {
  const pricing = await createQuotation(root, catalog, store);
  function context(id, config = {}) {
    const c = pricing.describeRuntime(),
      group = groups.find((g) => Object.hasOwn(c['TEXT_' + g + '_SERVICES'] || {}, id)),
      service = c.TEXT_CATALOG.find((s) => s.id === id);
    if (!group || !service) throw new ApiError(404, 'Услуга не найдена.');
    const descriptor = c['TEXT_' + group + '_SERVICES'][id],
      api = c['TEXT_' + group + '_PRICING'],
      defaults = api?.defaults ? api.defaults(id) : descriptor.defaults;
    for (const [key, v] of Object.entries(config)) {
      if (!Object.hasOwn(defaults, key)) throw new ApiError(400, 'Неизвестный параметр: ' + key);
      if (key === 'rows') {
        const rowSchema = c.TEXT_PROJECT_DATA[id]?.schema.rows,
          cols = rowSchema?.cols || [];
        if (
          !rowSchema ||
          !Array.isArray(v) ||
          v.length < 1 ||
          v.length > rowSchema.end - rowSchema.start + 1
        )
          throw new ApiError(400, 'Проверьте состав листов.');
        for (const row of v)
          if (
            !plain(row) ||
            Object.keys(row).some((col) => !cols.includes(col)) ||
            Object.values(row).some(
              (x) =>
                !['string', 'number'].includes(typeof x) ||
                (typeof x === 'number' && !Number.isFinite(x)) ||
                (typeof x === 'string' && x.length > 200),
            )
          )
            throw new ApiError(400, 'Некорректная строка листов.');
      } else if (
        !['string', 'number'].includes(typeof v) ||
        (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > 1e8)) ||
        (typeof v === 'string' && v.length > 200)
      )
        throw new ApiError(400, 'Некорректное значение параметра: ' + key);
    }
    const values = { ...clone(defaults), ...clone(config) };
    if (
      group === 'STICKER' &&
      (descriptor.variableShape ? values.shape : descriptor.shape) === 'round'
    ) {
      if (Object.hasOwn(config, 'height') && values.height !== values.width)
        throw new ApiError(400, 'У круглой наклейки ширина и высота должны совпадать.');
      values.height = values.width;
    }
    return { c, group, service, descriptor, api, defaults, values };
  }
  function summary(s, base) {
    const c = pricing.describeRuntime(),
      g = groups.find((g) => c['TEXT_' + g + '_SERVICES']?.[s.id]),
      path = c['TEXT_' + g + '_SERVICES'][s.id].path;
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.intro,
      url: new URL(path, base).href,
      canonicalUrl: new URL(path, 'https://text-print.ru/').href,
    };
  }
  function search(params, base) {
    if ([...params.keys()].some((k) => !['q', 'limit', 'category'].includes(k)))
      throw new ApiError(400, 'Неизвестный параметр поиска.');
    const query = params.get('q') || '',
      category = params.get('category') || '',
      limit = Number(params.get('limit') || 10);
    if (
      query.length > 200 ||
      category.length > 100 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 55
    )
      throw new ApiError(400, 'Проверьте поисковый запрос и число результатов (1–55).');
    const words = normalize(query).split(' ').filter(Boolean),
      items = pricing
        .describeRuntime()
        .TEXT_CATALOG.filter(
          (s) =>
            (!category || normalize(s.category) === normalize(category)) &&
            words.every((w) =>
              normalize(s.name + ' ' + s.category + ' ' + s.intro + ' ' + s.materials).includes(w),
            ),
        )
        .map((s) => ({
          s,
          score: words.reduce((score, w) => score + (normalize(s.name).includes(w) ? 5 : 1), 0),
        }))
        .sort(
          (a, b) => b.score - a.score || a.s.id.localeCompare(b.s.id, undefined, { numeric: true }),
        );
    return {
      total: items.length,
      services: items.slice(0, limit).map(({ s }) => summary(s, base)),
      revision: store.snapshot().revision,
    };
  }
  function parameters(payload, base) {
    const { id, config } = input(payload),
      ctx = context(id, config),
      { c, group, service, descriptor, api, defaults } = ctx;
    const values = api?.normalize ? api.normalize(id, ctx.values) : ctx.values;
    const fields = [],
      properties = {};
    function field(key, label, value, options, min, max, step) {
      const choices = options?.map((option) => ({
        value: typeof defaults[key] === 'number' ? Number(option) : String(option),
        label: String(option),
      }));
      const spec = {
        title: label,
        type: choices
          ? typeof defaults[key] === 'number'
            ? 'number'
            : 'string'
          : step === 1
            ? 'integer'
            : typeof value === 'number'
              ? 'number'
              : 'string',
        default: value,
      };
      if (choices) spec.enum = choices.map((o) => o.value);
      else {
        if (Number.isFinite(min)) spec.minimum = min;
        if (Number.isFinite(max)) spec.maximum = max;
        if (typeof step === 'number') spec.multipleOf = step;
      }
      properties[key] = spec;
      fields.push({
        key,
        label,
        value,
        ...(choices ? { options: choices } : {}),
        ...(Number.isFinite(min) ? { minimum: min } : {}),
        ...(Number.isFinite(max) ? { maximum: max } : {}),
        ...(step ? { step } : {}),
      });
    }
    if (api?.fields) {
      for (const f of api.fields(id, values)) {
        field(
          f.cell,
          f.label,
          values[f.cell],
          f.options,
          f.positive ? undefined : f.min,
          f.max,
          f.step,
        );
        if (f.positive) properties[f.cell].exclusiveMinimum = 0;
      }
      if (id === '1.1') field('colorRate', labels.colorRate, values.colorRate, [15, 20, 25, 30]);
      if (values.rows) {
        const schema = c.TEXT_PROJECT_DATA[id].schema,
          rowProperties = {};
        for (const f of api.rowFields(id, values))
          rowProperties[f.col] = {
            title: f.label,
            type: f.options ? 'string' : 'integer',
            ...(f.options ? { enum: clone(f.options) } : { minimum: 1 }),
          };
        properties.rows = {
          type: 'array',
          title: 'Состав листов',
          minItems: 1,
          maxItems: schema.rows.end - schema.rows.start + 1,
          items: {
            type: 'object',
            properties: rowProperties,
            required: schema.rows.cols,
            additionalProperties: false,
          },
          default: clone(values.rows),
        };
        fields.push({
          key: 'rows',
          label: 'Состав листов',
          value: clone(values.rows),
          columns: Object.entries(rowProperties).map(([key, v]) => ({ key, ...v })),
        });
      }
    } else {
      for (const key of Object.keys(defaults)) {
        let options;
        if (key === 'print')
          options =
            group === 'WIDE'
              ? Object.keys(descriptor.prints)
              : Object.keys(
                  descriptor.prints ||
                    (['paper'].includes(descriptor.kind)
                      ? { digital: '' }
                      : ['3d', '3d-pack', 'uv-dtf'].includes(descriptor.kind)
                        ? { uv: '' }
                        : { uv: '', vinyl: '' }),
                );
        if (key === 'material')
          options =
            group === 'WIDE'
              ? descriptor.materialsByPrint[values.print] || []
              : values.print === 'vinyl'
                ? ['white']
                : descriptor.materials;
        if (key === 'shape') options = ['rectangle', 'round', 'figure'];
        if (key === 'cut') options = ['yes', 'no'];
        if (key === 'complexity') options = ['simple', 'complex'];
        if (key === 'thickness') options = descriptor.model === 'pvc' ? ['3', '5'] : ['5'];
        field(
          key,
          labels[key] || key,
          values[key],
          options,
          typeof values[key] === 'number'
            ? ['quantity', 'perPack'].includes(key)
              ? 1
              : 0.001
            : undefined,
          undefined,
          ['quantity', 'perPack'].includes(key) ? 1 : undefined,
        );
        if (options) {
          const dictionary =
            key === 'print'
              ? descriptor.prints || c.TEXT_STICKERPACK_SHARING.labels.print
              : key === 'material'
                ? group === 'WIDE'
                  ? descriptor.materials
                  : c.TEXT_STICKERPACK_SHARING.labels.material
                : c.TEXT_STICKERPACK_SHARING.labels[key];
          for (const o of fields.at(-1).options) o.label = dictionary?.[o.value] || o.label;
        }
      }
    }
    for (const [key, value] of Object.entries(values))
      if (!Object.hasOwn(properties, key))
        properties[key] = {
          type: typeof value,
          default: value,
          description:
            'Параметр конфигурации, неактивный при текущем выборе. Значение учитывается только при включении соответствующей опции.',
        };
    return {
      service: summary(service, base),
      configuration: clone(values),
      fields,
      inputSchema: { type: 'object', properties, additionalProperties: false },
      currency: 'RUB',
      revision: store.snapshot().revision,
      notes:
        'Размеры указаны в миллиметрах. Для зависимых вариантов повторно запросите параметры с выбранной конфигурацией. Расчёт не оформляет заказ.',
    };
  }
  function calculate(payload, base) {
    const { id, config } = input(payload),
      { service, descriptor, values } = context(id, config),
      result = pricing.quote([{ key: 'preview', id, configuration: values, price: null }]),
      row = result.rows[0];
    const link = new URL(descriptor.path, base);
    link.search = ['4', '5'].includes(id[0])
      ? new URLSearchParams(
          Object.fromEntries(Object.entries(row.configuration).map(([k, v]) => [k, String(v)])),
        )
      : new URLSearchParams({ calc: JSON.stringify(row.configuration) });
    link.hash = 'calculator';
    return {
      service: summary(service, base),
      configuration: row.configuration,
      price: result.total,
      upper: result.upper,
      currency: 'RUB',
      description: row.description,
      breakdown: result.breakdown,
      lines: row.exportLines || [],
      url: link.href,
      revision: result.revision,
      orderCreated: false,
      notice:
        'Предварительный расчёт по текущим тарифам. Макет и срок согласуются перед запуском печати.',
    };
  }
  return { search, parameters, calculate };
}
