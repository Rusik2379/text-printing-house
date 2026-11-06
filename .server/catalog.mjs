import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseFormula, references, tariffLiterals } from './formula.mjs';
import { buildPresentation } from './presentation.mjs';

const books = [
  ['copycenter', 'Копицентр'],
  ['project', 'Проектная документация'],
  ['leaflet', 'Листовая полиграфия'],
  ['uv', 'UV-печать и резка'],
];
const dictionary = {
  flat: 'Обычные стикеры',
  threeD: 'Объёмные стикеры',
  vinyl: 'Сольвентная печать',
  uv: 'УФ-печать',
  white: 'Белая плёнка',
  transparent: 'Прозрачная плёнка',
  holographic: 'Голографическая плёнка',
  rectangle: 'Прямоугольные',
  round: 'Круглые',
  figure: 'Фигурные',
  minimum: 'Минимальный чек, ₽',
  capacityPerDay: 'Объём производства за день, ₽',
  packFactor: 'Коэффициент стикерпака',
  lamination: 'Коэффициент ламинации',
  roundCorners: 'Коэффициент скругления',
  cards: 'Визитки',
  oneSide: 'Одна сторона, ₽',
  twoSides: 'Две стороны, ₽',
  interior: 'Интерьерная',
  cast: 'Литой баннер',
  edge: 'Проклейка края',
  eyelets: 'Люверсы',
  banner: 'Баннеры',
  poster: 'Постеры',
  canvas: 'Холст',
  film: 'Плёнка',
  cut: 'Плоттерная резка',
  pvc: 'ПВХ',
  foam: 'Пенокартон',
  simpleCutFactor: 'Коэффициент простой резки',
  uvDtfFactor: 'Коэффициент UV-DTF',
  uvDtfMinimum: 'Минимальный чек UV-DTF, ₽',
  paperMinimum: 'Минимальный чек бумажных наклеек, ₽',
  paperCutPrice: 'Печать с резкой, ₽/лист',
  paperPrice: 'Печать без резки, ₽/лист',
  threeDPackFactor: 'Коэффициент объёмного стикерпака',
  threeDPackMinimum: 'Минимальный чек объёмного стикерпака, ₽',
  copycenterCapacity: 'Копицентр: объём за день, ₽',
  projectCapacity: 'Проектная печать: объём за день, ₽',
  leafletCapacity: 'Листовая печать: объём за день, ₽',
  uvCapacity: 'UV-печать: объём за день, ₽',
};
const hash = (s) => createHash('sha256').update(s).digest('hex');
const financial =
  /цена|цен[уы]|стоим|тариф|₽|руб|коэф|нацен|надбав|скид|доплат|минимальн.*чек|база|подготовк|односторон|двусторон|фальцовка|перепл[её]т/i;
const axis =
  /^(?:формат|ширина|высота|толщина|диаметр|площадь|тираж|количество|код|ключ|листов|размер|плотность|от\s*\d|до\s*\d)/i;
const own = (o, k) => Object.hasOwn(o, k);
export function parseAssignment(source) {
  const start = source.indexOf('=', source.search(/(?:globalThis|window)\.TEXT_/));
  if (start < 0) throw Error('Expected pricing data');
  const first = source.indexOf('{', start);
  let depth = 0,
    string = false,
    escape = false,
    end = -1;
  for (let i = first; i < source.length; i++) {
    const c = source[i];
    if (string) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') string = false;
    } else if (c === '"') string = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  if (end < 0) throw Error('Incomplete pricing data');
  return {
    data: JSON.parse(source.slice(first, end)),
    prefix: source.slice(0, first),
    suffix: source.slice(end),
  };
}
function get(o, p) {
  for (const k of p) {
    if (!o || !own(o, k)) throw Error('Unknown pricing field');
    o = o[k];
  }
  return o;
}
function set(o, p, v) {
  const parent = get(o, p.slice(0, -1));
  parent[p.at(-1)] = v;
}
function textCell(c) {
  return typeof c?.v === 'string' && !c.v.startsWith('=') ? c.v : '';
}
function caption(cells, ref) {
  const [, col, rowText] = ref.match(/^([A-Z]+)(\d+)$/);
  const row = +rowText;
  const column = (s) => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0),
    index = column(col);
  const adjacent = Object.entries(cells)
    .filter(
      ([r, c]) =>
        r.match(/\d+$/)?.[0] === rowText &&
        column(r.replace(/\d+$/, '')) < index &&
        column(r.replace(/\d+$/, '')) >= index - 3 &&
        !(typeof c.v === 'string' && c.v.startsWith('=')),
    )
    .sort(([a], [b]) => column(a.replace(/\d+$/, '')) - column(b.replace(/\d+$/, '')));
  const left = adjacent
    .filter(([r, c]) => {
      if (typeof c.v !== 'number') return true;
      const columnName = r.replace(/\d+$/, '');
      for (let n = 1; n < row; n++) {
        const h = textCell(cells[columnName + n]);
        if (h) return axis.test(h);
      }
      return false;
    })
    .map(([, v]) => v.v)
    .filter((v) => v !== null && v !== undefined && v !== '')
    .join(' · ');
  let header = '';
  for (let r = row - 1; r >= Math.max(1, row - 80); r--) {
    const value = textCell(cells[col + r]);
    if (value && (financial.test(value) || axis.test(value) || value.length > 2)) {
      header = value;
      break;
    }
  }
  return { left, header, label: [left, header].filter(Boolean).join(' · ') || ref };
}

export async function loadCatalog(root) {
  const modules = new Map(),
    fields = new Map(),
    services = [],
    rowAliases = new Map();
  async function module(file) {
    if (!modules.has(file)) {
      const source = await readFile(path.join(root, file), 'utf8');
      modules.set(file, { ...parseAssignment(source), source });
    }
    return modules.get(file);
  }
  function field(file, p, info, literal, alias) {
    const base = get(modules.get(file).data, p);
    const value = literal ? literal.v : base;
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    const id = hash(JSON.stringify([file, p, literal?.start ?? null])).slice(0, 24),
      fingerprint = hash(JSON.stringify([base, literal?.start ?? null]));
    if (alias && rowAliases.has(alias)) {
      const previous = fields.get(rowAliases.get(alias));
      previous.targets.push({ file, path: p, literal });
      previous.fingerprint = hash(previous.fingerprint + fingerprint);
      return previous.id;
    }
    const discount = /скид|discount/i.test(info.label + p.join('.'));
    fields.set(id, {
      id,
      file,
      path: p,
      fingerprint,
      literal,
      targets: [{ file, path: p, literal }],
      base: value,
      min: discount ? 0 : info.unit === 'coefficient' ? 0.001 : info.unit === 'capacity' ? 1 : 0,
      max: discount ? 1 : info.unit === 'coefficient' ? 100 : 1e8,
      ...info,
    });
    if (alias) rowAliases.set(alias, id);
    return id;
  }
  for (const [section, title] of books) {
    const file = section + '-pricing-data.js',
      m = await module(file),
      names = (await module(section + '-services.js')).data;
    for (const [serviceId, item] of Object.entries(m.data)) {
      const service = {
        id: serviceId,
        name: names[serviceId]?.name || serviceId,
        section,
        title,
        path: names[serviceId]?.path,
        groups: [],
      };
      services.push(service);
      const { book, schema } = item,
        inputs = new Set(schema.fields.map((f) => schema.sheet + '!' + f.cell));
      if (schema.rows)
        for (let n = schema.rows.start; n <= schema.rows.end; n++)
          for (const col of schema.rows.cols) inputs.add(schema.sheet + '!' + col + n);
      const reached = new Set(),
        queue = [
          [schema.sheet, schema.total],
          ...schema.outputs.map((o) => [schema.sheet, o.cell]),
        ];
      if (serviceId === '1.1')
        queue.push(
          ...['I2', 'E9', 'E11', 'I13', 'I14', 'I15', 'I16'].map((r) => [schema.sheet, r]),
        );
      while (queue.length) {
        const [sheet, ref] = queue.pop(),
          key = sheet + '!' + ref;
        if (reached.has(key) || inputs.has(key)) continue;
        reached.add(key);
        const v = book.sheets[sheet]?.cells[ref]?.v;
        if (typeof v === 'string' && v.startsWith('=')) {
          try {
            queue.push(...references(parseFormula(v), book, sheet));
          } catch {
            throw Error(`Неподдерживаемая формула ${serviceId} ${key}`);
          }
        }
      }
      for (const [sheet, table] of Object.entries(book.sheets)) {
        const entries = [];
        for (const [ref, cell] of Object.entries(table.cells)) {
          if (!reached.has(sheet + '!' + ref) || inputs.has(sheet + '!' + ref)) continue;
          const cap = caption(table.cells, ref),
            p = [serviceId, 'book', 'sheets', sheet, 'cells', ref, 'v'];
          const output = schema.outputs.find(
            (o) => sheet === schema.sheet && o.cell === ref,
          )?.label;
          const label = output || cap.label;
          if (typeof cell.v === 'number') {
            if (axis.test(cap.header) && !financial.test(cap.header)) continue;
            const unit = /коэф|скид/i.test(label) ? 'coefficient' : 'money';
            const id = field(file, p, { service: serviceId, group: sheet, label, ref, unit });
            if (id) entries.push(id);
          } else if (typeof cell.v === 'string' && cell.v.startsWith('=')) {
            const literals = tariffLiterals(parseFormula(cell.v), cell.v);
            for (const [index, l] of literals.entries()) {
              if (!financial.test(label) && !financial.test(sheet) && !(l.v >= 10 || l.v < 3))
                continue;
              const unit = /коэф|скид/i.test(label)
                ? 'coefficient'
                : financial.test(label) || financial.test(sheet)
                  ? 'money'
                  : l.v < 3
                    ? 'coefficient'
                    : 'money';
              const row = Number(ref.match(/\d+$/)[0]),
                isRow =
                  sheet === schema.sheet &&
                  schema.rows &&
                  row >= schema.rows.start &&
                  row <= schema.rows.end;
              const template = isRow
                ? cell.v.replace(
                    /("(?:[^"]|"")*"|'(?:[^']|'')*')|(\$?[A-Z]+\$?)(\d+)/g,
                    (s, quoted, col, n) =>
                      quoted || (!col.includes('$') && Number(n) === row ? col + '#' : s),
                  )
                : null;
              const alias = template
                ? JSON.stringify([file, serviceId, sheet, ref.replace(/\d+$/, ''), template, index])
                : null;
              // Branch context keeps distinct format/material/quantity tariffs understandable.
              const inputNames = Object.fromEntries(schema.fields.map((f) => [f.cell, f.label]));
              const conditions = l.context
                .split(' · ')
                .filter((x) => !x.includes('OK') && !/=\s*$/.test(x));
              const positives = new Set(
                conditions
                  .filter((x) => !x.startsWith('иначе '))
                  .map((x) => x.match(/^([A-Z]+\d+) = /)?.[1])
                  .filter(Boolean),
              );
              const context = conditions
                .filter(
                  (x) =>
                    !x.startsWith('иначе ') ||
                    !positives.has(x.match(/^иначе ([A-Z]+\d+) = /)?.[1]),
                )
                .map((x) =>
                  x
                    .replace(/^иначе (.*) = (.*)$/, '$1 ≠ $2')
                    .replace(
                      /\b[A-Z]+\d+\b/g,
                      (r) => inputNames[r] || (/^[BCDE]\d+$/.test(r) && isRow ? 'Листы' : r),
                    ),
                )
                .join(' · ');
              const head =
                output ||
                (cap.header === 'Значение' ? cap.left.split(' · ').at(-1) : cap.header) ||
                ref;
              const id = field(
                file,
                p,
                {
                  service: serviceId,
                  group: sheet,
                  label: head + (context ? ' · ' + context : ''),
                  ref,
                  unit,
                },
                l,
                alias,
              );
              if (id) entries.push(id);
            }
          }
        }
        if (entries.length) service.groups.push({ name: sheet, fields: [...new Set(entries)] });
      }
    }
  }
  async function structured(file, id, name, section, filter) {
    const m = await module(file),
      service = {
        id,
        name,
        section,
        title:
          section === 'stickers'
            ? 'Наклейки и стикеры'
            : section === 'wide'
              ? 'Широкий формат'
              : 'Общие настройки',
        groups: [],
      };
    services.push(service);
    const groups = new Map();
    function walk(value, p = []) {
      if (typeof value === 'number') {
        if (!filter(p)) return;
        const keys = p.map((k) => dictionary[k] || String(k));
        let label = keys.join(' · ');
        const rate = p.indexOf('rates');
        if (p.includes('paperDiscounts'))
          label =
            'Скидка на бумажные наклейки · ' +
            ['1–3 листа', '4–6 листов', '7–10 листов', '11–20 листов', 'от 21 листа'][p.at(-1)] +
            ' (доля от 0 до 1)';
        if (rate >= 0) {
          const parent = get(m.data, p.slice(0, rate)),
            tail = p.slice(rate + 1);
          if (Array.isArray(parent.rates) && Array.isArray(parent.rates[0]) && tail.length === 2) {
            label = `Площадь ${parent.areas?.[tail[0]] ?? tail[0]} мм² · ${parent.quantities?.[tail[1]] ?? tail[1]} шт. · ₽/шт.`;
          } else if (file === 'pricing.js' && tail.length === 2) {
            const row = parent.rates[tail[0]];
            label = `${row.paper} · ${row.quantity} шт. · ${dictionary[tail[1]]}`;
          }
        }
        const unit = /coefficient|Factor|lamination|roundCorners|discount/i.test(p.join('.'))
          ? 'coefficient'
          : /Capacity|capacity/i.test(p.join('.'))
            ? 'capacity'
            : 'money';
        const group =
            rate >= 0 ? 'Тарифы' : unit === 'coefficient' ? 'Коэффициенты' : 'Условия расчёта',
          fid = field(file, p, { service: id, group, label, unit });
        if (fid) {
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group).push(fid);
        }
        return;
      }
      if (value && typeof value === 'object')
        for (const [k, v] of Object.entries(value))
          walk(v, [...p, Array.isArray(value) ? Number(k) : k]);
    }
    walk(m.data);
    service.groups = Array.from(groups, ([name, fields]) => ({ name, fields }));
  }
  await structured(
    'sticker-pricing.js',
    'stickers-flat',
    'Обычные и объёмные стикеры',
    'stickers',
    (p) =>
      ['rates', 'coefficients', 'minimum', 'capacityPerDay', 'packFactor'].some((k) =>
        p.includes(k),
      ),
  );
  await structured('stickerpack-pricing.js', 'stickerpacks', 'Стикерпаки', 'stickers', (p) =>
    ['rates', 'coefficients', 'minimum', 'capacityPerDay', 'packFactor'].some((k) => p.includes(k)),
  );
  await structured('wide-format-pricing.js', 'wide', 'Все услуги широкого формата', 'wide', (p) =>
    ['rates', 'minimums', 'capacityPerDay', 'simpleCutFactor'].some((k) => p.includes(k)),
  );
  await structured(
    'pricing.js',
    'common',
    'Общие настройки и визитки',
    'common',
    (p) => !p.includes('quantity') && !p.includes('uvMinimums'),
  );
  const uvGroups = {
    6.1: 'uv-direct',
    6.2: 'wide-cut',
    6.3: 'uv-laser',
    6.4: 'uv-engraving',
    6.5: 'uv-direct',
    6.6: 'uv-keychains',
    6.7: 'uv-shields',
    6.8: 'uv-shields',
    6.9: 'uv-keychains',
  };
  function mergeFields(old, f) {
    if (old.base !== f.base) throw Error('Несогласованные общие тарифы ' + f.label);
    old.targets.push(...f.targets);
    old.fingerprint = hash(old.fingerprint + f.fingerprint);
    fields.delete(f.id);
    for (const s of services)
      for (const g of s.groups) g.fields = g.fields.map((id) => (id === f.id ? old.id : id));
  }
  // The cart applies one minimum to a production group; keep its services in sync.
  const sharedMinimums = new Map();
  for (const f of [...fields.values()]) {
    const group =
      f.file === 'uv-pricing-data.js' && /минимальн.*чек/i.test(f.label)
        ? uvGroups[f.service]
        : f.file === 'wide-format-pricing.js' && f.path[0] === 'minimums'
          ? f.path[1]
          : (f.file === 'sticker-pricing.js' && f.path.join('.') === 'flat.minimum') ||
              (f.file === 'stickerpack-pricing.js' && f.path.join('.') === 'minimum')
            ? 'stickers'
            : (f.file === 'sticker-pricing.js' && f.path.join('.') === 'threeD.minimum') ||
                (f.file === 'pricing.js' && f.path.join('.') === 'settings.threeDPackMinimum')
              ? 'stickers3d'
              : null;
    if (!group) continue;
    const old = sharedMinimums.get(group);
    if (!old) {
      sharedMinimums.set(group, f);
      continue;
    }
    mergeFields(old, f);
  }
  const cards = modules.get('pricing.js').data.cards,
    cardBook = modules.get('leaflet-pricing-data.js').data['3.1'],
    cardCells = cardBook.book.sheets[cardBook.schema.sheet].cells;
  for (const f of [...fields.values()].filter(
    (f) => f.file === 'pricing.js' && f.path[0] === 'cards',
  )) {
    let ref;
    if (f.path[1] === 'rates') {
      const row = cards.rates[f.path[2]],
        found = Object.keys(cardCells).find(
          (r) =>
            /^X\d+$/.test(r) &&
            cardCells[r].v === row.paper &&
            cardCells['Y' + r.slice(1)]?.v === row.quantity,
        );
      if (found) ref = (f.path[3] === 'oneSide' ? 'Z' : 'AA') + found.slice(1);
    } else if (f.path[1] === 'lamination') ref = 'AC2';
    else if (f.path[1] === 'roundCorners') ref = 'AC3';
    const matching =
      ref &&
      [...fields.values()].find(
        (x) =>
          x.file === 'leaflet-pricing-data.js' &&
          x.service === '3.1' &&
          x.ref === ref &&
          !x.literal,
      );
    if (matching) mergeFields(matching, f);
  }
  // Service descriptors provide names only and must not be served as rewritten tariffs.
  for (const [file] of modules) if (file.endsWith('-services.js')) modules.delete(file);
  const sourceRevision = hash(
    Array.from(fields.values())
      .map((f) => f.id + f.fingerprint)
      .join('|'),
  );
  // Keep legacy tariff identities valid for existing backups and overrides.
  // Only the shared document-copy rates are exposed for drawing-copy editing.
  const drawingCopy = services.find((service) => service.id === '2.5');
  drawingCopy.groups = services.find((service) => service.id === '1.2').groups;
  const activeFields = new Map(
    [
      ...new Set(services.flatMap((service) => service.groups.flatMap((group) => group.fields))),
    ].map((id) => [id, fields.get(id)]),
  );
  const presentation = buildPresentation(activeFields, services, modules);
  function validate(overrides) {
    if (
      !overrides ||
      typeof overrides !== 'object' ||
      Array.isArray(overrides) ||
      Object.keys(overrides).length > fields.size
    )
      throw Error('Некорректный набор тарифов.');
    for (const [id, value] of Object.entries(overrides)) {
      const f = fields.get(id);
      if (
        !f ||
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < f.min ||
        value > f.max ||
        Math.abs(value * 1e6 - Math.round(value * 1e6)) > 0.0001
      )
        throw Error('Недопустимое значение тарифа.');
    }
  }
  function render(file, overrides) {
    const m = modules.get(file);
    if (!m) return null;
    const data = structuredClone(m.data),
      formulas = new Map();
    for (const [id, value] of Object.entries(overrides)) {
      const f = fields.get(id);
      if (!f) continue;
      for (const t of f.targets) {
        if (t.file !== file) continue;
        if (!t.literal) set(data, t.path, value);
        else {
          const key = JSON.stringify(t.path);
          if (!formulas.has(key)) formulas.set(key, { path: t.path, changes: [] });
          formulas.get(key).changes.push({ start: t.literal.start, end: t.literal.end, value });
        }
      }
    }
    for (const { path: p, changes } of formulas.values()) {
      let v = get(data, p);
      for (const c of changes.sort((a, b) => b.start - a.start))
        v = v.slice(0, c.start) + String(c.value) + v.slice(c.end);
      set(data, p, v);
    }
    if (file === 'pricing.js')
      data.settings.uvMinimums = Object.fromEntries(
        [...sharedMinimums]
          .filter(([g]) => g.startsWith('uv-'))
          .map(([g, f]) => [g, overrides[f.id] ?? f.base]),
      );
    return m.prefix + JSON.stringify(data) + m.suffix;
  }
  function view(overrides) {
    return {
      sourceRevision,
      services: presentation.services,
      fields: Array.from(
        activeFields.values(),
        ({ file, path, fingerprint, literal, targets, ...f }) => ({
          ...f,
          ...presentation.metadata.get(f.id),
          value: overrides[f.id] ?? f.base,
        }),
      ),
    };
  }
  return { sourceRevision, fields, modules, services, validate, render, view };
}
