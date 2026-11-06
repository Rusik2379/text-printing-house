/* Branded workbook export, using the reviewed customer template on demand. */
(() => {
  'use strict';
  const assetRoot =
    typeof document !== 'undefined' ? new URL('.', document.currentScript.src).href : '';
  const clean = (value) =>
    String(value ?? '')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\r\n?/g, '\n');
  const categories = {
    1: 'Копицентр',
    2: 'Проектная документация',
    3: 'Листовая полиграфия',
    4: 'Наклейки и стикеры',
    5: 'Широкий формат',
    6: 'UV-печать и резка',
  };
  const quantities = {
    2.5: ['B7', 'прогон'],
    1.1: ['B7', 'стр.'],
    1.2: ['B7', 'прогон'],
    1.3: ['B8', 'шт.'],
    1.4: ['B6', 'шт.'],
    1.5: ['B8', 'шт.'],
    1.6: ['B11', 'экз.'],
    1.7: ['B7', 'прогон'],
    1.8: ['B7', 'шт.'],
    1.9: ['B8', 'экз.'],
    2.2: ['B8', 'шт.'],
    2.3: ['B5', 'л.'],
    2.4: ['B7', 'прогон'],
    2.7: ['B7', 'шт.'],
    3.1: ['B6', 'шт.'],
    3.2: ['B10', 'шт.'],
    3.3: ['B8', 'шт.'],
    3.4: ['B8', 'шт.'],
    3.5: ['B8', 'шт.'],
    3.6: ['B10', 'шт.'],
    3.7: ['B10', 'шт.'],
    3.8: ['B10', 'шт.'],
    3.9: ['B10', 'шт.'],
    '3.10': ['B9', 'шт.'],
    6.1: ['B9', 'шт.'],
    6.2: ['B7', 'поле'],
    6.3: ['B9', 'шт.'],
    6.4: ['B10', 'шт.'],
    6.5: ['B9', 'шт.'],
    6.6: ['B10', 'шт.'],
    6.7: ['B8', 'шт.'],
    6.8: ['B8', 'шт.'],
    6.9: ['B10', 'шт.'],
  };
  function quantity(item) {
    const c = item.configuration || {};
    if (
      (item.id?.startsWith('4.') || item.id?.startsWith('5.')) &&
      Number.isSafeInteger(c.quantity) &&
      c.quantity > 0
    )
      return { quantity: c.quantity, unit: ['4.4', '4.11'].includes(item.id) ? 'набор' : 'шт.' };
    const info = quantities[item.id],
      number = info ? Number(c[info[0]]) : NaN;
    // A grouped project calculation includes different formats/operations as one service.
    return Number.isSafeInteger(number) && number > 0
      ? { quantity: number, unit: info[1] }
      : { quantity: 1, unit: 'усл.' };
  }
  function model(items, catalog, breakdown, date = new Date(), values = {}) {
    const pdf = globalThis.TEXT_CART_PDF.model(items, catalog, breakdown, date);
    const cart = pdf.rows.flatMap((row, i) => {
      const details = [
        row.description,
        row.fileName ? 'Макет: ' + row.fileName : '',
        row.upper > row.price ? 'Предварительная стоимость: ' + row.priceText : '',
        row.price === null ? 'Стоимость: требуется расчёт' : '',
      ]
        .filter(Boolean)
        .join('\n');
      const item = items[i],
        base = {
          id: clean(item.id),
          category: clean(
            catalog.find((s) => s.id === item.id)?.category ||
              categories[item.id?.split('.')[0]] ||
              'Услуги',
          ),
          name: clean(row.name),
        };
      if (
        ['2.1', '2.5', '2.6'].includes(item.id) &&
        item.configuration?.rows?.length &&
        item.configuration.rows.every((r) => r.B && (r.C || r.D))
      ) {
        const valid = validLines(item),
          lines = valid
            ? item.exportLines
            : item.configuration.rows.map((r) => ({
                label: ['Печать', r.B, r.C, item.id === '2.6' ? r.D : '']
                  .filter(Boolean)
                  .join(' · '),
                quantity: r[item.id === '2.6' ? 'E' : 'D'],
                unit: 'л.',
                price: null,
              }));
        const note = [
          item.comment ? 'Комментарий: ' + item.comment : '',
          row.fileName ? 'Макет: ' + row.fileName : '',
        ]
          .filter(Boolean)
          .join('\n');
        const result = lines.map((line, n) => ({
          ...base,
          description: clean(line.label + (n === 0 && note ? '\n' + note : '')),
          price: line.price,
          quantity: line.quantity,
          unit: line.unit,
        }));
        if (!valid)
          result.push({
            ...base,
            description:
              'Стоимость комплекта по сохранённому расчёту. Разбивка стоимости по операциям требует уточнения.',
            price: row.price,
            quantity: 1,
            unit: 'компл.',
          });
        return result;
      }
      return [{ ...base, description: clean(details), price: row.price, ...quantity(item) }];
    });
    for (const row of pdf.surcharges)
      cart.push({
        id: '',
        category: row.group?.startsWith('wide-')
          ? categories['5']
          : row.group?.startsWith('uv-')
            ? categories['6']
            : ['stickers', 'stickers3d', 'uvdtf', 'paper'].includes(row.group)
              ? categories['4']
              : 'Доплаты',
        name: clean(row.name),
        description: 'Доплата до минимального чека',
        price: row.amount,
        quantity: 1,
        unit: 'усл.',
      });
    if (!Number.isFinite(pdf.lower) || pdf.lower > 999999999999.99)
      throw Error('Для этой суммы нужен отдельный документ');
    const note = [
      pdf.unknownCount
        ? 'Часть позиций требует расчёта. Итог указан только за рассчитанные позиции.'
        : '',
      pdf.upper > pdf.lower
        ? 'Стоимость предварительная: ' +
          pdf.totalText +
          '. Точную цену подтвердим после проверки макета.'
        : '',
      values.comment,
    ]
      .filter(Boolean)
      .join('\n');
    return {
      cart,
      date,
      values: {
        number: clean(values.number),
        name: clean(values.name),
        contact: clean(values.contact),
        basis: clean(values.basis || 'Заказ с сайта text-print.ru'),
        comment: clean(note),
      },
      lower: pdf.lower,
      upper: pdf.upper,
      unknownCount: pdf.unknownCount,
    };
  }
  function validLines(item) {
    return (
      Number.isFinite(item.price) &&
      Array.isArray(item.exportLines) &&
      item.exportLines.length > 0 &&
      item.exportLines.every(
        (l) =>
          typeof l.label === 'string' &&
          Number.isSafeInteger(l.quantity) &&
          l.quantity > 0 &&
          Number.isFinite(l.price) &&
          l.price >= 0,
      ) &&
      Math.abs(
        item.exportLines.reduce((n, l) => n + Math.round(l.price * 100), 0) -
          Math.round(item.price * 100),
      ) === 0
    );
  }
  async function prepare(items) {
    return Promise.all(
      items.map(async (item) => {
        if (
          !['2.1', '2.5', '2.6'].includes(item.id) ||
          !item.configuration?.rows?.length ||
          validLines(item)
        )
          return item;
        try {
          const response = await fetch(new URL('api/ai/quote', assetRoot), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceId: item.id, configuration: item.configuration }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) return item;
          const result = await response.json(),
            candidate = { ...item, exportLines: result.lines };
          return validLines(candidate) ? candidate : item;
        } catch {
          return item;
        }
      }),
    );
  }
  let loading;
  function loadTemplate() {
    if (typeof globalThis.TEKST_XLSX === 'function') return Promise.resolve();
    if (!loading)
      loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('vendor/xlsx/order-template.js?v=e5175a57aeef', assetRoot).href;
        script.onload = () => {
          if (typeof globalThis.TEKST_XLSX === 'function') resolve();
          else {
            script.remove();
            reject(Error('XLSX module unavailable'));
          }
        };
        script.onerror = () => {
          script.remove();
          reject(Error('XLSX module failed to load'));
        };
        document.head.append(script);
      }).catch((error) => {
        loading = undefined;
        throw error;
      });
    return loading;
  }
  async function download(data) {
    await loadTemplate();
    const bytes = globalThis.TEKST_XLSX(data),
      url = URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ТЕКСТ — товарный чек и акт.xlsx';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  globalThis.TEXT_CART_XLSX = { model, prepare, download };
})();
