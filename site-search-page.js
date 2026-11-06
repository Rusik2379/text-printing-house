(() => {
  'use strict';
  const root = new URL('.', document.currentScript.src),
    form = document.querySelector('#ts-search-form'),
    input = document.querySelector('#ts-search-q'),
    area = document.querySelector('#ts-search-results'),
    summary = document.querySelector('#ts-search-summary'),
    filters = document.querySelector('#ts-search-filters'),
    more = document.querySelector('#ts-search-more');
  if (!form) return;
  const labels = {
    Услуга: 'Услуги',
    Статья: 'Статьи',
    'Вопросы и ответы': 'Вопросы и ответы',
    Справочник: 'Справочник',
    Информация: 'Информация',
    'Населённый пункт': 'Города и сёла',
  };
  let records = [],
    kind = 'Все',
    shown = 0,
    generation = 0;
  const element = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  input.value = new URL(location.href).searchParams.get('q') || '';
  function render() {
    const found = kind === 'Все' ? records : records.filter((r) => r.k === kind);
    shown = Math.min(shown + 30, found.length);
    area.replaceChildren();
    for (const [type, label] of Object.entries(labels)) {
      const group = found.slice(0, shown).filter((r) => r.k === type);
      if (!group.length) continue;
      const section = element('section', 'ts-result-group');
      section.append(element('h2', '', label));
      for (const record of group) {
        const link = element('a', 'ts-search-result');
        link.href = new URL(record.u, root);
        link.append(element('strong', '', record.t), element('p', '', record.d || record.s || ''));
        section.append(link);
      }
      area.append(section);
    }
    summary.textContent = found.length
      ? 'Найдено: ' + found.length + ' · показано: ' + shown
      : 'Совпадений не найдено. Попробуйте другое слово или уточните запрос.';
    more.hidden = shown >= found.length;
  }
  async function ready() {
    if (!window.TEXT_SITE_SEARCH)
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('site-search.js?v=156a1b128d3b', root);
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    await window.TEXT_SITE_SEARCH.ready();
  }
  async function run() {
    const current = ++generation;
    const query = input.value.trim();
    area.replaceChildren();
    filters.replaceChildren();
    more.hidden = true;
    if (!query) {
      summary.textContent = 'Введите название услуги, тему статьи или населённый пункт.';
      return;
    }
    summary.textContent = 'Ищем по сайту…';
    try {
      await ready();
      if (current !== generation) return;
      records = window.TEXT_SITE_SEARCH.find(query, 3000);
      kind = 'Все';
      shown = 0;
      for (const [type, label] of [['Все', 'Все'], ...Object.entries(labels)]) {
        const count = type === 'Все' ? records.length : records.filter((r) => r.k === type).length;
        if (!count && type !== 'Все') continue;
        const b = element('button', 'ts-filter', label + ' · ' + count);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(type === 'Все'));
        b.addEventListener('click', () => {
          kind = type;
          shown = 0;
          filters
            .querySelectorAll('button')
            .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          render();
        });
        filters.append(b);
      }
      render();
    } catch {
      summary.textContent = 'Не удалось загрузить поиск. Проверьте соединение и повторите запрос.';
    }
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    history.replaceState(null, '', '?q=' + encodeURIComponent(input.value.trim()));
    run();
  });
  more.addEventListener('click', render);
  document.querySelectorAll('[data-search-example]').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.searchExample;
      form.requestSubmit();
    }),
  );
  run();
})();
