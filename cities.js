(() => {
  'use strict';
  const SERVICES = [
    [
      'Чертежи и проекты',
      [
        ['Печать чертежей · инженерная печать', '/proektnaya-dokumentatsiya/inzhenernaya-pechat/'],
        [
          'Печать проектов и комплектов документации',
          '/proektnaya-dokumentatsiya/inzhenernaya-pechat/',
        ],
        ['Комплектация проектной документации', '/proektnaya-dokumentatsiya/'],
        [
          'Брошюровка проектной документации',
          '/proektnaya-dokumentatsiya/broshyurovka-proektnoy-dokumentatsii/',
        ],
      ],
    ],
    [
      'Дипломы и авторефераты',
      [
        ['Печать дипломных работ', '/kopitsentr/pechat-dokumentov/'],
        ['Твёрдый переплёт дипломов и ВКР', '/kopitsentr/tverdyy-pereplet-diplomov/'],
        ['Печать авторефератов', '/kopitsentr/pechat-avtoreferatov/'],
      ],
    ],
    [
      'Листовки, визитки, буклеты',
      [
        ['Печать визиток', '/listovaya-poligrafiya/vizitki/'],
        ['Печать листовок и флаеров', '/listovaya-poligrafiya/listovki/'],
        ['Печать рекламных буклетов', '/listovaya-poligrafiya/buklety/'],
      ],
    ],
    [
      'Наклейки и стикеры',
      [
        ['Печать наклеек и стикеров', '/nakleyki-i-stikery/'],
        ['Печать этикеток на плёнке', '/nakleyki-i-stikery/etiketki/'],
        ['Печать стикерпаков', '/nakleyki-i-stikery/stikerpaki/'],
      ],
    ],
    ['Шильды и шильдики', [['Изготовление металлических шильдиков', '/uv-pechat-i-rezka/shildy/']]],
  ];
  const norm = (s) =>
    String(s || '')
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .trim();
  const mk = (tag, cls, text) => {
    let el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  const root = new URL('.', document.currentScript.src);
  function targetURL(path) {
    return new URL(path.replace(/^\//, ''), root).href;
  }
  function serviceList(onChoose) {
    const list = mk('ul', 'tc-services');
    list.setAttribute('aria-label', 'Услуги с доставкой');
    for (const [, links] of SERVICES) {
      for (const [label, path] of links) {
        const item = mk('li'),
          link = mk('a', '', label);
        link.href = targetURL(path);
        link.addEventListener('click', onChoose);
        item.append(link);
        list.append(item);
      }
    }
    return list;
  }
  function saveTown(el) {
    const place = {
      name: el.dataset.name,
      region: el.dataset.region,
      district: el.dataset.district || '',
      oktmo: el.dataset.id || '',
    };
    window.TEXT_GEO.choose(place);
    window.TEXT_GEO.save({ fulfillment: 'delivery' });
  }
  function renderTown(el) {
    const content = el.querySelector('.tc-town-detail');
    if (!content || content.dataset.done) return;
    content.dataset.done = '1';
    const p = mk(
      'p',
      '',
      `Производство в Барнауле. Выберите услугу для населённого пункта «${el.dataset.name}»; стоимость и возможность доставки подтвердим до изготовления.`,
    );
    content.append(p);
    const alert = mk(
      'div',
      'tc-minimum',
      'Доставка заказов от 3 000 ₽. Стоимость перевозки — отдельно.',
    );
    content.append(alert);
    content.append(mk('h4', '', 'Что хотите напечатать?'));
    content.append(serviceList(() => saveTown(el)));
    const deepLink = mk('a', 'tc-town-deep-link', 'Открыть прямую ссылку на населённый пункт');
    const shareUrl = new URL(location.href);
    shareUrl.hash = el.id;
    deepLink.href = shareUrl.href;
    deepLink.title = 'Скопируйте ссылку для открытия именно этого населённого пункта';
    content.append(deepLink);
    const actions = mk('div', 'tc-town-actions');
    const mapQuery = [el.dataset.name, el.dataset.district, el.dataset.region]
      .filter(Boolean)
      .join(', ');
    const map = window.TEXT_GEO.ozonMap({
      name: el.dataset.name,
      region: el.dataset.region,
      district: el.dataset.district,
    });
    const links = [
      ['Карта пунктов выдачи Ozon', map.url],
      ['Населённый пункт на карте', 'https://yandex.ru/maps/?text=' + encodeURIComponent(mapQuery)],
      ['Подробнее о доставке', targetURL('/dostavka-i-oplata/')],
      ['Написать в Telegram', 'https://t.me/tekkkstos'],
      [
        'Написать в MAX',
        'https://max.ru/u/f9LHodD0cOII3pfsxMqRJ6CzaCIs8OuOO5zmsR3qDGblmxnJwlsxM4WiGoY',
      ],
    ];
    for (const [name, url] of links) {
      const a = mk('a', '', name);
      a.href = url;
      if (url.startsWith('https://')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      a.addEventListener('click', () => saveTown(el));
      actions.append(a);
    }
    content.append(actions);
  }
  document.querySelectorAll('.tc-town').forEach((el) =>
    el.addEventListener('toggle', () => {
      if (el.open) renderTown(el);
    }),
  );
  function goToTownFragment() {
    let hash;
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target || !target.classList.contains('tc-town')) return;
    const district = target.closest('.tc-district');
    if (district) district.open = true;
    target.open = true;
    renderTown(target);
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  window.addEventListener('hashchange', goToTownFragment);
  goToTownFragment();
  document.querySelectorAll('[data-town-filter]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const q = norm(inp.value);
      const all = document.querySelectorAll('.tc-town');
      all.forEach((el) => {
        const ok =
          !q ||
          norm([el.dataset.name, el.dataset.district, el.dataset.region].join(' ')).includes(q);
        el.classList.toggle('tc-hidden', !ok);
        if (q && ok) {
          const d = el.closest('.tc-district');
          if (d) d.open = true;
        }
      });
      document
        .querySelectorAll('.tc-district')
        .forEach((d) =>
          d.classList.toggle('tc-hidden', !d.querySelector('.tc-town:not(.tc-hidden)')),
        );
    }),
  );
  const filter = document.getElementById('tc-region-filter');
  if (filter)
    filter.addEventListener('input', () => {
      const q = norm(filter.value);
      document
        .querySelectorAll('.tc-region-link')
        .forEach((a) =>
          a.classList.toggle('tc-hidden', !!q && !norm(a.dataset.region).includes(q)),
        );
    });
})();
