// Presentation is separate from tariff identities, validation and formula rewriting.
const words = {
  flat: 'Обычные стикеры',
  threeD: 'Объёмные стикеры',
  vinyl: 'Сольвентная печать',
  solvent: 'Сольвентная печать',
  uv: 'УФ-печать',
  white: 'Белая плёнка',
  transparent: 'Прозрачная плёнка',
  holographic: 'Голографическая плёнка',
  rectangle: 'Прямоугольные',
  round: 'Круглые',
  figure: 'Фигурные',
  banner: 'Баннеры',
  poster: 'Постеры',
  canvas: 'Холст',
  film: 'Плёнка',
  cut: 'Плоттерная резка',
  pvc: 'Накатка на ПВХ',
  foam: 'Накатка на пенокартон',
  interior: 'Интерьерная печать',
  cast: 'Литой баннер',
  edge: 'Проклейка края',
  eyelets: 'Люверсы',
  paper: 'Бумага',
  framed: 'Холст на подрамнике',
  matte: 'Матовая',
  gloss: 'Глянцевая',
  clearMatte: 'Прозрачная матовая',
  clearGloss: 'Прозрачная глянцевая',
  perforated: 'Перфорированная',
  color: 'Цветная плёнка',
  metal: 'Металлизированная плёнка',
  lamination: 'Ламинация',
  roundCorners: 'Скругление углов',
  cards: 'Визитки',
  packFactor: 'Сборка стикерпака',
};
const clean = (s) =>
  String(s ?? '')
    .replace(/\bA(?=\d)/g, 'А')
    .replace(/\bSRA3\b/g, 'SRA3')
    .replace(/\s*·\s*Значение/g, '')
    .replace(/\bЧ\/Б\b|^чб$/gi, 'Чёрно-белая')
    .trim();
const strip = (s) =>
  clean(s)
    .replace(/,?\s*₽(?:\s*\/\s*[^·]+)?/g, '')
    .replace(/\s*\(доля от 0 до 1\)/g, '')
    .trim();
const descriptions = {
  Печать: 'Базовые цены печати. Бумага и дополнительные операции настраиваются отдельно.',
  Бумага:
    'Стоимость выбранной бумаги или доплата к базовой печати. В пояснении каждого поля указано, за какой лист берётся цена.',
  'Двусторонняя печать': 'Настройки цены при печати с двух сторон одного листа.',
  Ламинация: 'Цены и множители для покрытия продукции плёнкой.',
  'Фальцовка и сгибы': 'Стоимость складывания чертежей и сгибов полиграфии.',
  'Брошюровка и переплёт': 'Стоимость сборки документов с учётом пружины, формата и тиража.',
  'Скидки и тираж': 'Скидки и множители, которые зависят от объёма заказа.',
  'Минимальная стоимость':
    'Нижняя граница стоимости. Если расчёт дешевле, к оплате применяется этот минимум.',
  'Сроки изготовления':
    'Объём производства в рублях за рабочий день. Он используется для расчёта срока, а не стоимости.',
  'Тираж и раскладка':
    'Количество изделий, страниц и печатных листов. Эти значения указаны в штуках или миллиметрах, а не в рублях.',
  'Настройки расчёта': 'Границы тарифных ступеней и служебные параметры исходного калькулятора.',
  'Материалы и нанесение':
    'Цены и множители для выбранного материала, толщины и способа нанесения.',
  'Обработка и дополнения':
    'Цена дополнительных операций или множитель, применяемый к базовой цене.',
  'Подготовка к печати': 'Стоимость подготовки заказа перед производством.',
};
const order = Object.keys(descriptions);
function get(o, p) {
  return p.reduce((o, k) => o?.[k], o);
}
function cell(cells, ref) {
  const v = cells?.[ref]?.v;
  return typeof v === 'string' && v.startsWith('=') ? null : v;
}
function options(input, cells) {
  const s = input.validation?.f1;
  if (!s) return [];
  if (/^".*"$/.test(s)) return s.slice(1, -1).split(',');
  const range = s.replaceAll('$', '').match(/^([A-Z]+)(\d+):\1(\d+)$/);
  return range
    ? Array.from({ length: +range[3] - +range[2] + 1 }, (_, i) =>
        cell(cells, range[1] + (+range[2] + i)),
      ).filter((v) => v !== null && v !== undefined)
    : [];
}
function contextFor(f, item) {
  if (!f.literal?.context) return '';
  const cells = item.book.sheets[item.schema.sheet].cells,
    names = new Map(),
    domains = new Map();
  for (const i of item.schema.fields) {
    names.set(i.cell, strip(i.label));
    domains.set(i.cell, options(i, cells));
  }
  for (const o of item.schema.outputs) names.set(o.cell, strip(o.label));
  if (item.schema.rows) {
    const r = f.ref.match(/\d+$/)?.[0];
    for (const [i, col] of item.schema.rows.cols.entries()) {
      names.set(col + r, ['Формат', 'Цветность', 'Количество листов'][i] || 'Параметр листов');
      const v = item.book.sheets[item.schema.sheet].validations.find((v) =>
        v.sqref.startsWith(col + item.schema.rows.start),
      );
      if (v) domains.set(col + r, options({ validation: v }, cells));
    }
  }
  for (const part of f.literal.context.matchAll(/\b([A-Z]+\d+)\b/g)) {
    const ref = part[1];
    if (names.has(ref)) continue;
    const [, col, row] = ref.match(/([A-Z]+)(\d+)/);
    const n = cell(cells, (col === 'E' ? 'D' : col === 'B' ? 'A' : col) + row);
    if (typeof n === 'string') names.set(ref, strip(n));
  }
  const conditions = f.literal.context
      .split(' · ')
      .filter((s) => !s.includes('OK') && !/=\s*$/.test(s)),
    byRef = new Map(),
    other = [];
  const atom = (s) => s.match(/^([A-Z]+\d+)\s*(<=|>=|<>|=|<|>)\s*(.+)$/);
  const positives = new Map();
  for (const c of conditions.filter((c) => !c.startsWith('иначе ')))
    for (const a of c.split(' и ')) {
      const m = atom(a);
      if (m && m[2] === '=') positives.set(m[1], m[3]);
    }
  for (let condition of conditions) {
    const negative = condition.startsWith('иначе ');
    if (negative) condition = condition.slice(6);
    // A rejected AND branch is already excluded when a later chosen value differs.
    if (negative && condition.includes(' и ')) {
      const atoms = condition.split(' и ').map(atom);
      if (
        atoms.some((m) => m && m[2] === '=' && positives.has(m[1]) && positives.get(m[1]) !== m[3])
      )
        continue;
      other.push(
        'кроме сочетания: ' +
          condition
            .replace(/\b[A-Z]+\d+\b/g, (r) => names.get(r) || 'параметр')
            .replaceAll(' = ', ': '),
      );
      continue;
    }
    const parts = negative ? [condition] : condition.split(' и ');
    for (const a of parts) {
      const m = atom(a);
      if (!m) continue;
      const [, ref, op, value] = m;
      if (!names.has(ref) || value === '') continue;
      if (negative && op === '=' && positives.has(ref)) continue;
      if (!byRef.has(ref)) byRef.set(ref, []);
      byRef.get(ref).push({
        op: negative
          ? { '=': '<>', '<>': '=', '<=': '>', '>=': '<', '<': '>=', '>': '<=' }[op]
          : op,
        value,
      });
    }
  }
  const labels = [];
  for (const [ref, conditions] of byRef) {
    const name = names.get(ref),
      equal = conditions.find((c) => c.op === '='),
      excludes = conditions.filter((c) => c.op === '<>').map((c) => c.value);
    if (equal) {
      labels.push(name + ': ' + clean(equal.value));
      continue;
    }
    if (excludes.length) {
      const domain = domains.get(ref) || [],
        allowed = domain.filter((v) => !excludes.includes(String(v)));
      if (domain.length && allowed.length) {
        labels.push(name + ': ' + allowed.map(clean).join(' / '));
      } else labels.push(name + ': кроме ' + excludes.map(clean).join(', '));
    }
    const bounds = conditions.filter(
      (c) => c.op !== '=' && c.op !== '<>' && Number.isFinite(+c.value),
    );
    if (bounds.length) {
      const lower = bounds
          .filter((c) => c.op === '>' || c.op === '>=')
          .sort((a, b) => +b.value - +a.value)[0],
        upper = bounds
          .filter((c) => c.op === '<' || c.op === '<=')
          .sort((a, b) => +a.value - +b.value)[0];
      const integer =
        /тираж|колич|прогон|страниц|листов/i.test(name) && !/стоим|цен|база/i.test(name);
      let text;
      if (integer) {
        const lo = lower ? +lower.value + (lower.op === '>' ? 1 : 0) : 1,
          hi = upper ? +upper.value - (upper.op === '<' ? 1 : 0) : null;
        text = hi === null ? 'от ' + lo : lo + '–' + hi;
      } else
        text = [
          lower ? (lower.op === '>' ? 'свыше ' : 'от ') + lower.value : '',
          upper ? (upper.op === '<' ? 'менее ' : 'до ') + upper.value : '',
        ]
          .filter(Boolean)
          .join(' ');
      labels.push(name + ': ' + text);
    }
  }
  return [...labels, ...other].join(' · ');
}
function categoryFor(label, kind) {
  if (kind === 'capacity') return 'Сроки изготовления';
  if (/минимальн.*(?:чек|стоим)|итого к оплате/i.test(label)) return 'Минимальная стоимость';
  if (/скид|тираж.*коэф|коэф.*тираж/i.test(label)) return 'Скидки и тираж';
  if (/двусторон|двух сторон/i.test(label) && /коэф|надбав|двусторонняя печать/i.test(label))
    return 'Двусторонняя печать';
  if (/ламинац/i.test(label)) return 'Ламинация';
  if (/доплата за бумагу|цена.*бумаг|пачк|цена SRA3/i.test(label)) return 'Бумага';
  if (/фальцов|бигов|сгиб/i.test(label)) return 'Фальцовка и сгибы';
  if (/брошюр|пружин|перепл|база 1 альбом|коэффициент проекта/i.test(label))
    return 'Брошюровка и переплёт';
  if (/подготовк/i.test(label)) return 'Подготовка к печати';
  if (
    /кратност|минимальн.*тираж|штук с|расклад|страниц|листов|печатное поле|вылет|ступень|порог/i.test(
      label,
    ) &&
    !/цена|тариф.*стр|печать/i.test(label)
  )
    return 'Тираж и раскладка';
  if (/материал|толщин|нанесен|коэффициент.*плотност/i.test(label)) return 'Материалы и нанесение';
  if (/доп\.|операц|фурнитур|лак|контур|скругл|форма|сложност|коэффициент/i.test(label))
    return 'Обработка и дополнения';
  return 'Печать';
}
function unitFor(label, f) {
  if (/₽\s*\/\s*см²/i.test(label)) return { kind: 'money', unit: '₽ / см²' };
  if (/скид/i.test(label)) return { kind: 'percent', unit: '%', scale: 100 };
  if (f.unit === 'capacity') return { kind: 'capacity', unit: '₽ / рабочий день' };
  if (/коэф|множитель/i.test(label) || f.unit === 'coefficient')
    return { kind: 'coefficient', unit: 'множитель ×' };
  if (/цена|тариф|стоим|₽|база|доплат/i.test(label)) {
    const unit = /₽\s*\/\s*м²|цена за (?:1 )?м²/i.test(label)
      ? '₽ / м²'
      : /пачк/.test(label)
        ? '₽ / пачка'
        : /прогон/.test(label)
          ? '₽ / прогон'
          : /₽\s*\/\s*(?:стр\.|сторон)|цена.*сторон/i.test(label)
            ? '₽ / сторона'
            : /лист|SRA3/.test(label)
              ? '₽ / лист'
              : /шт|экз|брошюр|альбом/.test(label)
                ? '₽ / шт.'
                : '₽';
    return { kind: 'money', unit };
  }
  if (/мм/.test(label)) return { kind: 'dimension', unit: 'мм' };
  if (/см²/.test(label)) return { kind: 'area', unit: 'см²' };
  if (/метраж/.test(label)) return { kind: 'dimension', unit: 'м' };
  if (/колич|тираж|штук|расклад|сторон|кратност|страниц/.test(label))
    return { kind: 'count', unit: 'шт.' };
  return { kind: f.unit, unit: f.unit === 'coefficient' ? 'множитель ×' : '₽' };
}
function helpFor(label, kind, unit) {
  if (kind === 'percent')
    return 'Скидка уменьшает стоимость в указанном диапазоне тиража. Введите процент: например, 20 означает скидку 20%.';
  if (kind === 'capacity')
    return 'Стоимость продукции, которую можно изготовить за один рабочий день. Срок = сумма заказа / это значение, с округлением вверх; минимум один день.';
  if (kind === 'coefficient')
    return 'Базовая стоимость умножается на это число. 1 — без изменения, 1,2 — дороже на 20%, 0,9 — дешевле на 10%.';
  if (/минимальн.*(?:чек|стоим)|итого к оплате/i.test(label))
    return 'Если расчёт по тарифам ниже этого значения, применяется минимальная стоимость. В корзине минимум учитывается для соответствующей группы производства.';
  if (/доплата за бумагу/i.test(label))
    return 'Доплата к стоимости печати за каждый физический лист выбранной бумаги. При печати с двух сторон бумага учитывается один раз на лист.';
  if (kind === 'count')
    return 'Количество в штуках, а не цена. Используется для выбора тиража или расчёта числа изделий на печатном листе.';
  if (kind === 'dimension' || kind === 'area')
    return 'Размер или граница диапазона, а не цена. Калькулятор использует это значение при выборе подходящего тарифа.';
  if (unit === '₽ / прогон')
    return 'Цена одного прохода документа через копир или сканер. Итог = число прогонов × эта цена.';
  if (unit === '₽ / сторона')
    return 'Цена печати одной стороны. Число печатных сторон и доплаты рассчитываются отдельно.';
  if (unit === '₽ / м²' || unit === '₽ / см²')
    return 'Цена за единицу площади. Калькулятор умножает её на площадь продукции с учётом тиража.';
  if (unit === '₽ / лист')
    return 'Цена за один печатный лист в указанных условиях. Количество листов рассчитывается по параметрам заказа.';
  if (unit === '₽ / пачка')
    return 'Стоимость целой пачки бумаги. Калькулятор делит её на количество листов в пачке, чтобы получить цену одного листа.';
  if (/подготовк/i.test(label))
    return 'Стоимость подготовки производства. Применяется по условиям исходного калькулятора дополнительно к печати.';
  return 'Тариф для указанных параметров заказа. Итоговая сумма рассчитывается с учётом количества и выбранных дополнительных операций.';
}
function bookPresentation(f, item) {
  const cells = item.book.sheets[f.path[3]].cells,
    main = item.book.sheets[item.schema.sheet].cells;
  const [, col, rowText] = f.ref.match(/^([A-Z]+)(\d+)$/),
    row = +rowText,
    context = contextFor(f, item);
  let head = f.label.split(' · ')[0],
    label = f.literal ? strip(head) + (context ? ' · ' + context : '') : strip(f.label),
    category,
    kind,
    unit,
    help;
  // Common table layouts have numeric axes without nearby text captions.
  if (['2.1', '2.5'].includes(f.service)) {
    if (/^[LMNOPQ]$/.test(col) && row >= 13 && row <= 32) {
      head = 'Печать одного листа';
      label =
        head +
        ' · ' +
        context +
        ' · База заказа: ' +
        [
          'до 10 000 ₽',
          '10 000–25 000 ₽',
          '25 000–50 000 ₽',
          '50 000–100 000 ₽',
          '100 000–200 000 ₽',
          'свыше 200 000 ₽',
        ]['LMNOPQ'.indexOf(col)];
      category = /Цветность: Ч/.test(context) ? 'Печать — чёрно-белая' : 'Печать — цветная';
      unit = '₽ / лист';
      kind = 'money';
      help =
        'Цена одного листа. Тарифная ступень выбирается по базовой сумме всего заказа, рассчитанной по первой колонке прайса.';
    }
    if (col === 'G' && row >= 13 && row <= 32) {
      head = 'Фальцовка одного листа';
      label = head + ' · ' + context;
      category = 'Фальцовка и сгибы';
      unit = '₽ / лист';
      kind = 'money';
    }
    if (/брошюровки/i.test(f.group)) {
      label = [
        'Пружина: ' + cell(cells, 'A' + row),
        'Формат: ' + cell(cells, 'B' + row),
        'Диаметр: ' + cell(cells, 'C' + row),
        'Тираж: ' + cell(cells, col + '3'),
      ]
        .map(clean)
        .join(' · ');
      category = 'Брошюровка и переплёт';
      unit = '₽ / брошюра';
      kind = 'money';
      help =
        'Базовая цена сборки одной брошюры. Коэффициент проектной документации применяется отдельно.';
    }
    if (/Ценовая ступень/.test(f.label)) {
      label = 'Граница тарифной ступени · ' + context;
      category = 'Настройки расчёта';
      unit = '₽ базового заказа';
      kind = 'threshold';
      help =
        'Граница базовой суммы заказа для перехода к следующей колонке прайса. Это порог выбора тарифа, а не цена листа.';
    }
    if (f.ref === 'E7') {
      label = 'Сборка проектных документов — множитель';
      category = 'Брошюровка и переплёт';
      kind = 'coefficient';
      unit = 'множитель ×';
    }
  }
  if (f.service === '2.7' && /^(AA|AB|AC|AD|AE|AF)$/.test(col)) {
    label =
      'Печать лекал · ' +
      clean(cell(main, 'Z' + row)) +
      ' · База заказа: ' +
      clean(cell(main, col + '1'));
    unit = '₽ / м²';
    kind = 'money';
  }
  if (f.service === '2.7' && f.ref === 'H3') {
    label = 'Первая тарифная ступень · ' + context;
    category = 'Настройки расчёта';
    kind = 'count';
    unit = 'номер ступени';
    help =
      'Номер колонки прайса, используемой для указанной базовой суммы заказа. Это служебная настройка выбора цены.';
  }
  if (f.service === '3.1') {
    if (['Z', 'AA'].includes(col)) {
      label =
        clean(cell(cells, 'X' + row)) +
        ' · ' +
        cell(cells, 'Y' + row) +
        ' шт. · ' +
        (col === 'Z' ? 'Одна сторона' : 'Две стороны');
      category = 'Визитки — печать';
      kind = 'money';
      unit = '₽ / визитка';
    }
    if (f.ref === 'AC2' || f.ref === 'AC3') {
      label =
        f.ref === 'AC2' ? 'Ламинация визиток — множитель' : 'Скругление углов визиток — множитель';
      category = f.ref === 'AC2' ? 'Ламинация' : 'Обработка и дополнения';
      kind = 'coefficient';
      unit = 'множитель ×';
    }
  }
  if (f.service === '3.3' && /^[J-P]$/.test(col) && row >= 10 && row <= 16) {
    const a4 = row <= 12,
      axisRow = a4 ? 10 : 14;
    const qty = cell(main, col + axisRow);
    category = row === axisRow ? 'Тираж и раскладка' : 'Печать';
    label =
      (a4 ? 'А4' : 'А3') +
      ' · ' +
      (row === axisRow
        ? 'Тарифная ступень тиража'
        : row === 11 || row === 15
          ? 'Бумага 120 г/м²'
          : 'Бумага 160 г/м²') +
      (row === axisRow ? '' : ' · ' + qty + ' шт.');
    kind = row === axisRow ? 'count' : 'money';
    unit = kind === 'count' ? 'шт.' : '₽ / буклет';
  }
  if (f.service === '3.3' && f.ref === 'Q3') {
    label = 'Начальная колонка прайса · ' + context;
    category = 'Настройки расчёта';
    kind = 'count';
    unit = 'номер колонки';
    help =
      'Номер тарифной колонки для малого тиража. Используется исходной формулой при выборе цены буклета.';
  }
  if (['3.4', '3.5'].includes(f.service) && /^(Y|Z|AA|AB|AC|AD|AE)$/.test(col) && row <= 16) {
    const a4 = row < 10,
      axisRow = a4 ? 1 : 10;
    category = row === axisRow ? 'Тираж и раскладка' : 'Печать';
    label =
      (a4 ? 'Лист А4' : 'Лист А3') +
      ' · ' +
      (row === axisRow
        ? 'Тарифная ступень тиража'
        : 'Бумага ' + cell(main, 'X' + row) + ' г/м² · ' + cell(main, col + axisRow) + ' листов');
    kind = row === axisRow ? 'count' : 'money';
    unit = kind === 'count' ? 'листов' : '₽ / двусторонний лист';
  }
  if (f.service === '6.2' && /^[N-V]$/.test(col) && row <= 11) {
    category = row === 2 ? 'Тираж и раскладка' : 'Плоттерная резка';
    label =
      row === 2
        ? 'Тарифная ступень тиража № ' + ('NOPQRSTUV'.indexOf(col) + 1)
        : clean(cell(main, 'M' + row)) + ' мм · ' + cell(main, col + '2') + ' шт.';
    kind = row === 2 ? 'count' : 'money';
    unit = row === 2 ? 'шт.' : '₽ / шт.';
  }
  if (['6.1', '6.5'].includes(f.service)) {
    if (col === 'O' && row >= 2 && row <= 13) {
      label = 'Тираж: ' + cell(main, 'N' + row) + ' шт. — множитель';
      category = 'Скидки и тираж';
      kind = 'coefficient';
      unit = 'множитель ×';
    }
    if (f.ref === 'P2') {
      label = 'Материал — множитель · ' + context;
      category = 'Материалы и нанесение';
      kind = 'coefficient';
      unit = 'множитель ×';
    }
    if (f.ref === 'P3') {
      label = 'Белая подложка — множитель · ' + context;
      category = 'Материалы и нанесение';
      kind = 'coefficient';
      unit = 'множитель ×';
    }
  }
  if (['6.6', '6.9'].includes(f.service)) {
    if (col === 'S') {
      label = 'Площадь изделия: ' + cell(main, 'R' + row) + ' см² — множитель';
      category = 'Материалы и нанесение';
      kind = 'coefficient';
      unit = 'множитель ×';
    }
    if (col === 'V') {
      label = 'Тираж: ' + cell(main, 'U' + row) + ' шт. — множитель';
      category = 'Скидки и тираж';
      kind = 'coefficient';
      unit = 'множитель ×';
    }
  }
  if (f.service === '6.3' && ['S', 'T'].includes(col)) {
    label =
      (col === 'S'
        ? 'Общий метраж — граница ступени № '
        : 'Множитель по общему метражу — ступень № ') +
      (row - 1);
    category = 'Скидки и тираж';
    kind = col === 'S' ? 'dimension' : 'coefficient';
    unit = col === 'S' ? 'м' : 'множитель ×';
  }
  if (f.service === '6.4' && ['T', 'U'].includes(col)) {
    label =
      (col === 'T'
        ? 'Общая площадь — граница ступени № '
        : 'Множитель по общей площади — ступень № ') +
      (row - 1);
    category = 'Скидки и тираж';
    kind = col === 'T' ? 'area' : 'coefficient';
    unit = col === 'T' ? 'см²' : 'множитель ×';
  }
  if (f.service === '1.1') {
    if (f.ref === 'I2') {
      label = 'Печать с двух сторон — множитель';
      category = 'Двусторонняя печать';
      kind = 'coefficient';
      unit = 'множитель ×';
      help =
        'Цена печати одного двустороннего листа = цена одной стороны × этот множитель. Доплата за бумагу считается отдельно, один раз на лист.';
    }
    if (/^I[4-7]$/.test(f.ref)) {
      label = 'Цветная печать А4 — тариф № ' + (row - 3);
      category = 'Печать';
      kind = 'money';
      unit = '₽ / сторона';
      help =
        'Один из четырёх тарифов цветной печати А4. Клиент выбирает его в калькуляторе. Цена указана за одну сторону листа; бумага и двусторонняя печать учитываются отдельно.';
    }
    if (f.ref === 'E9') {
      label = 'Доплата за бумагу · ' + context;
      category = 'Бумага';
      kind = 'money';
      unit = '₽ / физический лист';
    }
    if (f.ref === 'E6') {
      category = 'Печать';
      unit = '₽ / сторона';
      kind = 'money';
    }
  }
  if (f.service === '1.9' && f.group === 'Прайс' && ['B', 'C'].includes(col)) {
    label =
      'Печать ' + (col === 'B' ? 'А4' : 'А5') + ' · ' + clean(cell(cells, 'A' + row)) + ' страниц';
    category = 'Печать';
    unit = '₽ / сторона';
    kind = 'money';
  }
  if (f.group === 'Бумага и параметры' && col === 'B') {
    label =
      'Пачка бумаги · Color Copy ' +
      clean(cell(cells, 'A' + row)) +
      ' г/м² · ' +
      cell(cells, 'C' + row) +
      ' листов SRA3';
    category = 'Бумага';
    kind = 'money';
    unit = '₽ / пачка';
  }
  if (f.group === 'Бумага и параметры' && f.ref === 'H4') {
    label = 'Доплата за печать второй стороны';
    category = 'Двусторонняя печать';
    kind = 'percent';
    unit = '% к односторонней цене';
    help =
      'Надбавка к цене односторонней печати. Например, 35% означает: двусторонний лист стоит в 1,35 раза дороже одностороннего.';
  }
  if (f.service === '2.3') {
    label = 'Фальцовка · Формат: ' + clean(cell(cells, 'A' + row));
    category = 'Фальцовка и сгибы';
    kind = 'money';
    unit = '₽ / лист';
  }
  if (/^[B-Z]+\d+$/.test(head) && !context && !category) {
    label = 'Настройка исходного расчёта · ' + f.ref;
    category = 'Настройки расчёта';
    help =
      'Служебное значение из исходного калькулятора. Перед изменением проверьте его назначение по исходной таблице.';
  }
  const inferred = unitFor(f.label, f);
  kind ??= inferred.kind;
  unit ??= inferred.unit;
  category ??= categoryFor(f.literal ? head : f.label, kind);
  if (/Базовая цена 1 шт/.test(head) && ['1.5', '2.2'].includes(f.service)) {
    category = 'Брошюровка и переплёт';
    unit = '₽ / брошюра';
  }
  if (/База 1 альбом|Коэффициент брошюровки/.test(head) && f.service === '2.6')
    category = 'Брошюровка и переплёт';
  if (/Коэффициент, ₽\/см²/.test(head)) {
    label = 'Цена нанесения · ' + context;
    category = 'Материалы и нанесение';
  }
  return {
    label: clean(label),
    category,
    description: help || helpFor(head, kind, unit),
    displayKind: kind,
    displayUnit: unit,
    displayScale: kind === 'percent' ? 100 : 1,
    example:
      f.group === 'Бумага и параметры' && f.ref === 'H4'
        ? 'surcharge'
        : f.service === '1.1' && f.ref === 'E9'
          ? 'paper'
          : kind === 'coefficient'
            ? 'coefficient'
            : kind === 'percent'
              ? 'discount'
              : null,
  };
}
function structuredPresentation(f, modules) {
  const p = f.path,
    d = modules.get(f.file).data,
    rate = p.indexOf('rates');
  let label = strip(f.label),
    category,
    kind,
    unit,
    description;
  if (f.file === 'sticker-pricing.js' || f.file === 'stickerpack-pricing.js') {
    const family =
      f.file === 'stickerpack-pricing.js' ? 'Стикерпаки' : words[p[0]] || 'Обычные стикеры';
    if (rate >= 0) {
      const table = get(d, p.slice(0, rate));
      label =
        family +
        ' · Площадь ' +
        table.areas[p.at(-2)] +
        ' мм² · Тираж ' +
        table.quantities[p.at(-1)] +
        ' шт.';
      category = family + ' — печать';
      unit = '₽ / стикер';
      kind = 'money';
      description =
        'Базовая цена одного стикера для этой площади и тиража. Материал, форма и дополнительные операции учитываются своими множителями.';
    } else if (p.includes('coefficients') || p.includes('packFactor')) {
      label = p
        .filter((k) => !['coefficients', 'flat', 'threeD'].includes(k))
        .map((k) => words[k] || k)
        .join(' · ');
      category = p.includes('packFactor')
        ? 'Обработка и дополнения'
        : family + ' — материал и форма';
      kind = 'coefficient';
      unit = 'множитель ×';
    } else if (p.at(-1) === 'minimum') {
      label = family + ' — минимальная стоимость';
      category = 'Минимальная стоимость';
    }
  }
  if (f.file === 'wide-format-pricing.js') {
    if (p[0] === 'models' && rate >= 0) {
      const model = d.models[p[1]],
        tail = p.slice(rate + 1),
        name = words[p[1]],
        variants = tail
          .slice(0, model.kind === 'area' ? -1 : -2)
          .map((k) => words[k] || (/^[\d.]+$/.test(k) ? k + ' мм' : k));
      category = name;
      label = variants.join(' · ');
      if (model.kind === 'area') {
        label += ' · Заказ ' + model.points[p.at(-1)] + ' м²';
        unit = '₽ / м²';
      } else {
        label +=
          ' · Площадь ' +
          model.areas[p.at(-2)] +
          ' мм² · Тираж ' +
          model.quantities[p.at(-1)] +
          ' шт.';
        unit = '₽ / шт.';
      }
      kind = 'money';
      description =
        'Тариф для указанного материала и объёма. Между соседними значениями калькулятор вычисляет промежуточную цену.';
    } else if (p[0] === 'minimums') {
      label = (words[p[1].replace('wide-', '')] || p[1]) + ' — минимальная стоимость';
      category = 'Минимальная стоимость';
    } else if (p[0] === 'simpleCutFactor') {
      label = 'Простая плоттерная резка — множитель';
      category = 'Обработка и дополнения';
    }
  }
  if (f.file === 'pricing.js') {
    label = label.replace(/^settings · /, '').replace(/paperDiscounts · /, '');
    if (p.includes('paperDiscounts')) {
      category = 'Бумажные наклейки — скидки';
      kind = 'percent';
      unit = '%';
    } else if (/paperPrice|paperCutPrice/.test(p.at(-1))) {
      category = 'Бумажные наклейки — печать';
      unit = '₽ / лист';
      kind = 'money';
    } else if (p.at(-1) === 'uvDtfFactor') {
      label = 'UV-DTF — множитель';
      category = 'UV-DTF';
    } else if (p.at(-1) === 'threeDPackFactor') {
      label = 'Объёмный стикерпак — множитель';
      category = 'Обработка и дополнения';
    }
  }
  const inferred = unitFor(f.label, f);
  kind ??= inferred.kind;
  unit ??= inferred.unit;
  category ??= categoryFor(f.label, kind);
  return {
    label: clean(label),
    category,
    description: description || helpFor(label, kind, unit),
    displayKind: kind,
    displayUnit: unit,
    displayScale: kind === 'percent' ? 100 : 1,
    example: kind === 'coefficient' ? 'coefficient' : kind === 'percent' ? 'discount' : null,
  };
}
export function buildPresentation(fields, services, modules) {
  const metadata = new Map(),
    usages = new Map();
  for (const s of services)
    for (const id of new Set(s.groups.flatMap((g) => g.fields))) {
      if (!usages.has(id)) usages.set(id, []);
      usages.get(id).push(s.name);
    }
  for (const f of fields.values()) {
    const item = f.file.endsWith('-pricing-data.js') ? modules.get(f.file).data[f.service] : null;
    const m = item ? bookPresentation(f, item) : structuredPresentation(f, modules);
    m.searchText = [f.label, f.ref, f.group].filter(Boolean).join(' ');
    const shared = usages.get(f.id) || [];
    m.sharedWith = shared.length > 1 ? shared : [];
    metadata.set(f.id, m);
  }
  const presentedServices = services.map((s) => {
    const groups = new Map();
    for (const id of new Set(s.groups.flatMap((g) => g.fields))) {
      const name = metadata.get(id).category;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(id);
    }
    return {
      ...s,
      groups: [...groups]
        .map(([name, fields]) => ({
          id: name,
          name,
          description:
            descriptions[name] ||
            (/— печать|Печать —/.test(name)
              ? descriptions.Печать
              : /материал и форма/.test(name)
                ? descriptions['Материалы и нанесение']
                : 'Цены для выбранного направления, материала и объёма заказа.'),
          fields,
        }))
        .sort((a, b) => {
          const x = order.indexOf(a.name),
            y = order.indexOf(b.name);
          return (x < 0 ? 0 : x) - (y < 0 ? 0 : y);
        }),
    };
  });
  return { metadata, services: presentedServices };
}
