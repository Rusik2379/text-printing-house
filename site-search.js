/* Shared full-site search, loaded lazily by the header and results page. */
(() => {
  'use strict';
  if (window.TEXT_SITE_SEARCH) return;
  const root = new URL('.', document.currentScript.src);
  const normalize = (v) =>
    String(v || '')
      .toLocaleLowerCase('ru')
      .replaceAll('ё', 'е')
      .replace(/[^а-яa-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  const exceptions = {
    наклеек: 'наклейк',
    наклейки: 'наклейк',
    этикеток: 'этикетк',
    этикетки: 'этикетк',
    чертежей: 'чертеж',
    печать: 'печат',
    печати: 'печат',
    ксерокс: 'копирован',
    ксерокопия: 'копирован',
    флаеры: 'листовк',
    флаеров: 'листовк',
    брошюр: 'брошюр',
    стикеров: 'стикер',
  };
  const stem = (w) =>
    exceptions[w] ||
    w.replace(
      /(?:иями|ями|ами|ого|ему|ому|ими|ыми|иях|ах|ях|ов|ев|ей|ия|ие|ии|ый|ий|ая|ое|ые|ой|ую|юю|ом|ем|ам|ям|ы|и|а|я|у|ю|е|о)$/,
      '',
    );
  const words = (v) =>
    normalize(v)
      .split(' ')
      .filter(Boolean)
      .map((w) => (w.length > 3 ? stem(w) : w));
  const stop = new Set([
    'в',
    'на',
    'из',
    'для',
    'по',
    'и',
    'с',
    'заказать',
    'заказ',
    'город',
    'село',
    'г',
    'рф',
  ]);
  const distance = (a, b) => {
    if (Math.abs(a.length - b.length) > 2) return 3;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++)
        row[j] = Math.min(
          row[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      prev = row;
    }
    return prev[b.length];
  };
  const includes = (set, w, fuzzy = false) =>
    set.some(
      (v) =>
        v === w ||
        (w.length >= 4 && v.startsWith(w)) ||
        (fuzzy && w.length >= 5 && distance(v, w) <= (w.length >= 8 ? 2 : 1)),
    );
  let ready, records;
  function script(name) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL(name, root);
      s.onload = resolve;
      s.onerror = () => {
        s.remove();
        reject(Error('Не удалось загрузить поиск. Попробуйте ещё раз.'));
      };
      document.head.append(s);
    });
  }
  function load() {
    if (ready) return ready;
    ready = Promise.all([
      window.TEXT_SITE_INDEX ? null : script('site-search-index.js?v=7231b0b9c5e6'),
      window.TEXT_SITE_GEOGRAPHY ? null : script('site-search-geography.js?v=84f87b9bf285'),
    ])
      .then(() => {
        records = window.TEXT_SITE_INDEX.map((d) => ({
          d,
          title: words(d.t),
          alias: words(d.a),
          body: words(d.d + ' ' + (d.x || d.s || '')),
        }));
        return records;
      })
      .catch((e) => {
        ready = null;
        throw e;
      });
    return ready;
  }
  function find(query, limit = 60) {
    const q = words(query).filter((w) => !stop.has(w));
    if (!q.length) return [];
    const results = [];
    for (const record of records || []) {
      let score = 0,
        all = true;
      for (const word of q) {
        let part = includes(record.title, word)
          ? 30
          : includes(record.alias, word)
            ? 20
            : includes(record.body, word)
              ? 4
              : includes(record.title, word, true)
                ? 12
                : includes(record.alias, word, true)
                  ? 8
                  : 0;
        if (!part) {
          all = false;
          break;
        }
        score += part;
      }
      if (all)
        results.push({
          ...record.d,
          score: score + (record.d.k === 'Услуга' ? 14 : record.d.k === 'Статья' ? 8 : 0),
        });
    }
    // Geographic intent can be combined with a service, e.g. «наклейки в Калистратихе».
    const geoStop = new Set(
      words(
        'печать наклейки наклеек стикеры этикетки визитки листовки буклеты чертежи проекты документация доставка типография студия',
      ),
    );
    const geoWords = q.filter((w) => !geoStop.has(w));
    if (geoWords.length)
      for (const [name, district, region, url] of window.TEXT_SITE_GEOGRAPHY || []) {
        const title = words(name),
          full = words(name + ' ' + district + ' ' + region);
        if (geoWords.every((w) => includes(full, w))) {
          const exact = geoWords.every((w) => includes(title, w));
          results.push({
            t: name + ' — ' + region,
            d: [district, region].filter(Boolean).join(' · '),
            k: 'Населённый пункт',
            u: url,
            score: exact ? 100 : 25,
          });
          if (results.filter((r) => r.k === 'Населённый пункт').length >= 30) break;
        }
      }
    return results
      .sort((a, b) => b.score - a.score)
      .filter((r, i, a) => a.findIndex((x) => x.u === r.u && x.t === r.t) === i)
      .slice(0, limit);
  }
  window.TEXT_SITE_SEARCH = { find, normalize, ready: load };
  window.TEXT_SITE_SEARCH_READY = load;
})();
