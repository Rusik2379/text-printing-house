/* Local, browser-only quotation export. Libraries and fonts load on demand. */
(() => {
  'use strict';
  const assetRoot = typeof document !== 'undefined' ? new URL('.', document.currentScript.src).href : '';
  const groups = {
    stickers: 'Наклейки и стикерпаки (минимальный чек 600 ₽)',
    stickers3d: '3D-стикеры и наборы (минимальный чек 1 000 ₽)',
    uvdtf: 'UV-DTF наклейки (минимальный чек 800 ₽)',
    paper: 'Бумажные стикеры (минимальный чек 150 ₽)'
  };
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const money = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(value).replace(/\u00a0|\u202f/g, ' ') + ' ₽';
  const range = (lower, upper) => upper > lower ? money(lower).replace(' ₽', '') + ' - ' + money(upper) : money(lower);
  const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u00ad]/g, '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\r\n?/g, '\n').replace(/[\u00a0\u202f]/g, ' ').trim();

  function model(items, catalog, breakdown, date = new Date()) {
    if (!Array.isArray(items) || !items.length) throw new Error('Корзина пуста');
    const rows = items.map((item, index) => {
      const price = Number.isFinite(item.price) && item.price >= 0 ? item.price : null;
      const upper = price !== null && Number.isFinite(item.priceUpper) && item.priceUpper > price ? item.priceUpper : price;
      return {number: index + 1, name: clean(catalog.find(record => record.id === item.id)?.name || 'Услуга'),
        description: clean(item.description), fileName: clean(item.fileName), price, upper,
        priceText: price === null ? 'Требуется расчёт' : range(price, upper)};
    });
    const surcharges = Object.entries(breakdown.surcharges || {}).filter(([, value]) => Number.isFinite(value) && value > 0)
      .map(([group, amount]) => ({name: groups[group] || 'Доплата до минимального чека', amount, priceText: money(amount)}));
    const pricedCount = rows.filter(row => row.price !== null).length;
    const lower = round(rows.reduce((sum, row) => sum + (row.price || 0), 0) + surcharges.reduce((sum, row) => sum + row.amount, 0));
    const upper = round(lower + rows.reduce((sum, row) => sum + (row.price === null ? 0 : row.upper - row.price), 0));
    return {rows, surcharges, pricedCount, unknownCount: rows.length - pricedCount, lower, upper,
      totalText: pricedCount ? range(lower, upper) : 'Требуется расчёт',
      date: new Intl.DateTimeFormat('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric'}).format(date),
      filename: 'ТЕКСТ-расчёт-заказа-' + [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-') + '.pdf'};
  }

  async function create(data, {PDFLib, fontkit, regularBytes, boldBytes}) {
    const {PDFDocument, rgb} = PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const regular = await doc.embedFont(regularBytes, {subset: true});
    const bold = await doc.embedFont(boldBytes, {subset: true});
    doc.setTitle('ТЕКСТ - расчёт заказа');
    doc.setAuthor('Студия печати ТЕКСТ');
    doc.setSubject('Услуги, параметры и предварительная стоимость заказа');
    const supported = new Set(regular.getCharacterSet());
    const printable = value => Array.from(clean(value)).map(char => char === '\n' || supported.has(char.codePointAt(0)) ? char : '?').join('');
    const red = rgb(.96, .055, .12), ink = rgb(.10, .12, .13), muted = rgb(.39, .43, .47), line = rgb(.88, .90, .92), pale = rgb(.97, .97, .98);
    const width = 595.28, height = 841.89, left = 44, right = width - left, bottom = 64;
    let page, y;
    function text(value, x, baseline, size = 10, font = regular, color = ink) {
      page.drawText(printable(value), {x, y: baseline, size, font, color});
    }
    function wrap(value, font, size, maxWidth) {
      const output = [];
      for (const paragraph of printable(value).split('\n')) {
        if (!paragraph.trim()) { output.push(''); continue; }
        let current = '';
        for (const word of paragraph.trim().split(/\s+/)) {
          const candidate = current ? current + ' ' + word : word;
          if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue; }
          if (current) { output.push(current); current = ''; }
          for (const character of word) {
            if (current && font.widthOfTextAtSize(current + character, size) > maxWidth) { output.push(current); current = ''; }
            current += character;
          }
        }
        if (current) output.push(current);
      }
      return output;
    }
    function rule(at) { page.drawLine({start: {x: left, y: at}, end: {x: right, y: at}, thickness: .6, color: line}); }
    function newPage(first = false, table = false) {
      page = doc.addPage([width, height]);
      page.drawRectangle({x: 0, y: height - 5, width, height: 5, color: red});
      const logoY = height - 63, logoSize = first ? 32 : 25;
      text('ТЕ', left, logoY, logoSize, bold, red);
      text('КСТ', left + bold.widthOfTextAtSize('ТЕ', logoSize) - 1, logoY, logoSize, bold);
      text('СТУДИЯ ПЕЧАТИ', left, logoY - 17, 8.5, regular, muted);
      text('+7 (923) 654-78-96', 332, height - 43, 10, bold);
      text('tekkkst@yandex.ru  •  text-print.ru', 332, height - 59, 8.5, regular, muted);
      text('Барнаул, пр. Строителей, 11', 332, height - 75, 8.5, regular, muted);
      rule(height - 98);
      y = height - 126;
      if (first) {
        text('Расчёт заказа', left, y - 8, 25, bold); y -= 34;
        text('Дата: ' + data.date + '    /    Позиций: ' + data.rows.length, left, y - 8, 10, regular, muted); y -= 39;
      } else {
        text('Расчёт заказа / ' + data.date, left, y, 11, bold); y -= 23;
      }
      if (table) tableHead();
    }
    function tableHead() {
      page.drawRectangle({x: left, y: y - 28, width: right - left, height: 28, color: pale});
      text('№', left + 9, y - 18, 9, bold, muted);
      text('Услуга и параметры', left + 35, y - 18, 9, bold, muted);
      text('Стоимость', right - 107, y - 18, 9, bold, muted); y -= 38;
    }
    newPage(true, true);
    for (const row of data.rows) {
      const names = wrap(row.name, bold, 11, 323);
      const details = wrap([row.description, row.fileName ? 'Макет: ' + row.fileName : ''].filter(Boolean).join('\n'), regular, 9.5, 323);
      let lines = [...names.map(value => ({value, font: bold, size: 11, color: ink})), ...details.map(value => ({value, font: regular, size: 9.5, color: muted}))];
      let priceSize = 10;
      while (bold.widthOfTextAtSize(printable(row.priceText), priceSize) > 108 && priceSize > 8.5) priceSize -= .5;
      // Keep the currency beside the amount even when a large range needs two lines.
      const priceValue = row.price !== null && row.upper > row.price && bold.widthOfTextAtSize(printable(row.priceText), priceSize) > 108
        ? money(row.price) + '\n- ' + money(row.upper) : row.priceText;
      const prices = wrap(priceValue, bold, priceSize, 108);
      let continued = false;
      while (lines.length) {
        const minimum = 24 + Math.max(Math.min(lines.length, names.length + 1), prices.length) * 14;
        if (y - minimum < bottom) newPage(false, true);
        if (continued) { text(row.number + ' / продолжение', left + 35, y - 10, 8, regular, muted); y -= 22; }
        const take = Math.max(1, Math.floor((y - bottom - 24) / 14));
        const chunk = lines.splice(0, take);
        if (!continued) {
          text(String(row.number).padStart(2, '0'), left + 8, y - 12, 9, regular, muted);
          prices.forEach((value, index) => text(value, right - 107, y - 12 - index * 14, priceSize, bold, row.price === null ? muted : ink));
        }
        chunk.forEach((entry, index) => text(entry.value, left + 35, y - 12 - index * 14, entry.size, entry.font, entry.color));
        y -= Math.max(chunk.length, continued ? 0 : prices.length) * 14 + 24;
        rule(y + 8); continued = true;
        if (lines.length) newPage(false, true);
      }
    }
    const surchargeLines = data.surcharges.map(row => ({...row, lines: wrap(row.name, regular, 9.5, 350)}));
    for (const row of surchargeLines) {
      const space = row.lines.length * 14 + 18;
      if (y - space < bottom) newPage();
      row.lines.forEach((value, index) => text(value, left + 8, y - 12 - index * 14, 9.5, regular, muted));
      text(row.priceText, right - bold.widthOfTextAtSize(printable(row.priceText), 10) - 8, y - 12, 10, bold);
      y -= space;
    }
    if (y - 150 < bottom) newPage();
    const totalLabel = data.unknownCount ? 'Рассчитанная часть заказа' : 'Итого за продукцию';
    page.drawRectangle({x: left, y: y - 62, width: right - left, height: 62, color: pale});
    text(data.pricedCount ? totalLabel : 'Стоимость заказа', left + 14, y - 26, 10, bold);
    if (data.unknownCount) text('Позиций к уточнению: ' + data.unknownCount, left + 14, y - 44, 9, regular, muted);
    let totalSize = 20;
    while (bold.widthOfTextAtSize(printable(data.totalText), totalSize) > 222 && totalSize > 10) totalSize -= .5;
    text(data.totalText, right - 14 - bold.widthOfTextAtSize(printable(data.totalText), totalSize), y - 36, totalSize, bold, red);
    y -= 84;
    const notes = ['Расчёт предварительный. Стоимость и срок подтвердим после проверки макета.',
      'Доставка и подготовка макета согласуются отдельно.',
      ...(data.upper > data.lower ? ['Диапазон цены зависит от заполнения страниц при цветной печати.'] : []),
      ...(data.unknownCount ? ['Услуги без цены не включены в рассчитанную сумму.'] : [])];
    for (const note of notes) for (const value of wrap(note, regular, 9, right - left)) {
      if (y - 14 < bottom) newPage();
      text(value, left, y, 9, regular, muted); y -= 14;
    }
    doc.getPages().forEach((current, index, pages) => {
      page = current; rule(43);
      text('ТЕКСТ / Сохраните расчёт и отправьте его вместе с макетами', left, 27, 8, regular, muted);
      const number = (index + 1) + ' / ' + pages.length;
      text(number, right - regular.widthOfTextAtSize(number, 8), 27, 8, regular, muted);
    });
    return doc.save();
  }

  let resources;
  function loadScript(path, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = assetRoot + path;
      script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error('PDF library unavailable'));
      script.onerror = () => { script.remove(); reject(new Error('PDF library failed to load')); };
      document.head.append(script);
    });
  }
  async function dependencies() {
    if (!resources) resources = Promise.all([
      loadScript('vendor/pdf/pdf-lib-1.17.1.min.js', 'PDFLib'), loadScript('vendor/pdf/fontkit-1.1.1.min.js', 'fontkit'),
      ...['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map(async file => {
        const response = await fetch(assetRoot + 'assets/fonts/' + file);
        if (!response.ok) throw new Error('PDF font unavailable');
        return new Uint8Array(await response.arrayBuffer());
      })
    ]).then(([PDFLib, fontkit, regularBytes, boldBytes]) => ({PDFLib, fontkit, regularBytes, boldBytes})).catch(error => {resources = null; throw error;});
    return resources;
  }
  async function download(data) {
    const bytes = await create(data, await dependencies());
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    const link = document.createElement('a'); link.href = url; link.download = data.filename;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.TEXT_CART_PDF = {model, create, download};
})();
