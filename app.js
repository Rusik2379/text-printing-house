(() => {
  'use strict';
  // Resolve from app.js so both domain roots and GitHub Pages subdirectories work.
  const siteRoot = new URL('.', document.currentScript.src).href;
  // Ordinary browsers do not download or initialize experimental agent tools.
  if ((document.modelContext || navigator.modelContext)?.registerTool) {
    const script = document.createElement('script');
    script.src = new URL('webmcp.js', siteRoot).href;
    script.defer = true;
    document.head.append(script);
  }
  const servicePages = {
    ...window.TEXT_STICKER_SERVICES,
    ...window.TEXT_COPYCENTER_SERVICES,
    ...window.TEXT_PROJECT_SERVICES,
    ...window.TEXT_LEAFLET_SERVICES,
    ...window.TEXT_UV_SERVICES,
    ...window.TEXT_WIDE_SERVICES,
  };
  const serviceUrl = (id) => (servicePages[id] ? siteRoot + servicePages[id].path : null);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    );
  const currency = (value) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) + ' ₽';
  const priceRange = (lower, upper = lower) =>
    upper > lower ? currency(lower).replace(' ₽', '') + '–' + currency(upper) : currency(lower);
  const cartUpper = (rows, lower) =>
    lower +
    rows.reduce(
      (sum, row) =>
        sum +
        (Number.isFinite(row.priceUpper) && row.priceUpper > row.price
          ? row.priceUpper - row.price
          : 0),
      0,
    );
  const icons = {
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    star: '<path d="m12 2 3 6.5 7 1-5 5 1 7-6-3.5L6 21l1-6.5-5-5 7-1L12 2Z"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    zap: '<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
    shield: '<path d="m12 2 8 4v6c0 6-8 10-8 10S4 18 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',
    heart:
      '<path d="M20.5 4.5a5 5 0 0 0-7 0L12 6l-1.5-1.5a5 5 0 0 0-7 7L12 20l8.5-8.5a5 5 0 0 0 0-7Z"/>',
    gear: '<path d="m9 3 1-2h4l1 2 3 2 2 1v4l-1 2 1 3v3l-3 1-2 2h-4l-2-2-3-1v-3l1-3-1-2V6l2-1 1-2Z"/><circle cx="12" cy="11" r="3"/>',
    palette:
      '<path d="M21 12a9 9 0 1 0-9 9h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a3 3 0 0 0 3-1Z"/><circle cx="7" cy="8" r=".8"/><circle cx="12" cy="5" r=".8"/><circle cx="17" cy="8" r=".8"/><circle cx="6" cy="13" r=".8"/>',
    truck:
      '<path d="M2 5h12v12H2V5Zm12 5h5l3 4v3h-8"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/>',
    message:
      '<path d="M21 11a9 9 0 0 1-13 8l-6 3 2-6a9 9 0 1 1 17-5Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/>',

    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 4 12 8-12 8V4Z"/>',
    pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
    search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    bag: '<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    spark: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
    printer: '<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 13h10v8H7Z"/><path d="M17 10h1"/>',
    document: '<path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h4M9 12h6M9 16h6"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    sticker:
      '<path d="M21 13V8a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h5l8-8Z"/><path d="M13 21v-4a4 4 0 0 1 4-4h4M8 8h.01M15 8h.01M8 12c1.5 2 4.5 2 6 0"/>',
    wide: '<path d="M3 5h18v14H3zM7 2v20M17 2v20M10 9h4M10 13h4"/>',
    scissors:
      '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4M12 12l3 3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calculator:
      '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h2M14 18h2"/>',
    target:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 11v1l2 1"/>',
    phone:
      '<path d="M4 3h4l2 5-3 2c2 4 4 6 8 7l2-3 5 2v4c0 2-3 3-6 2C8 20 4 16 2 8 1 5 2 3 4 3Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  };
  function icon(name) {
    return (
      window.TEXT_ICONS?.render(name) ||
      `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.document}</svg>`
    );
  }
  function hydrateIcons(root = document) {
    $$('[data-icon]', root).forEach((el) =>
      el.replaceWith(
        Object.assign(document.createElement('span'), { innerHTML: icon(el.dataset.icon) })
          .firstChild,
      ),
    );
  }
  const catalog = window.TEXT_CATALOG;
  const DESIGN_OPTIONS = [
    {
      id: 'design-press',
      name: 'Предпечатная подготовка',
      price: 500,
      category: 'Услуги дизайнера',
    },
    { id: 'design-basic', name: 'Базовый дизайн', price: 750, category: 'Услуги дизайнера' },
    {
      id: 'design-both',
      name: 'Предпечатная подготовка + Дизайн',
      price: 1000,
      category: 'Услуги дизайнера',
    },
  ];
  const cartService = (id) =>
    catalog.find((s) => s.id === id) || DESIGN_OPTIONS.find((s) => s.id === id);
  const isDesign = (id) => DESIGN_OPTIONS.some((s) => s.id === id);

  window.TEXT_CONTACTS = {
    telegram: 'https://t.me/tekkkstos',
    max: 'https://max.ru/u/f9LHodD0cOII3pfsxMqRJ6CzaCIs8OuOO5zmsR3qDGblmxnJwlsxM4WiGoY',
  };
  $$('[data-social]').forEach((link) => {
    link.href = window.TEXT_CONTACTS[link.dataset.social];
  });
  const categories = [
    {
      name: 'Копицентр',
      short: 'Копицентр',
      filter: 'Документы',
      image: 'category-copycenter-banner',
      icon: 'printer',
      description: 'Документы, фотографии, переплёт',
    },
    {
      name: 'Проектная документация',
      short: 'Проектная печать',
      filter: 'Проектная печать',
      image: 'project-category-banner',
      icon: 'document',
      description: 'Чертежи, проекты, готовые альбомы',
    },
    {
      name: 'Листовая полиграфия',
      short: 'Полиграфия',
      filter: 'Полиграфия',
      image: 'category-leaflet-banner',
      icon: 'layers',
      description: 'Визитки, листовки, буклеты',
    },
    {
      name: 'Наклейки и стикеры',
      short: 'Наклейки и стикеры',
      filter: 'Наклейки',
      image: 'category-stickers-banner',
      icon: 'sticker',
      description: 'Любые формы для ваших идей',
    },
    {
      name: 'Широкий формат',
      short: 'Широкий формат',
      filter: 'Широкий формат',
      image: 'category-wide-banner',
      icon: 'wide',
      description: 'Баннеры, постеры, печать на плёнке',
    },
    {
      name: 'UV-печать и резка',
      short: 'UV-печать и резка',
      filter: 'UV и резка',
      image: 'category-uv-banner',
      icon: 'scissors',
      description: 'Таблички, изделия, лазерная резка',
    },
  ];
  const companyPages = [
    ['О нас', 'company/about/'],
    ['Контакты', 'contacts/'],
    ['Клиентский центр', 'company/clients/'],
    ['Для бизнеса', 'for-business/'],
    ['Подбор услуги', 'podbor-uslugi/'],
    ['Справочник печати', 'guide/'],
    ['Как мы производим', 'company/production/'],
    ['Факты о ТЕКСТ', 'company/facts/'],
    ['Оборудование', 'equipment/'],
    ['Материалы', 'materials/'],
    ['Технологии', 'technologies/'],
    ['Подготовка макета', 'company/file-preparation/'],
    ['Гарантия качества', 'company/quality/'],
    ['Доставка по России', 'dostavka-i-oplata/'],
    ['Технические требования', 'requirements/'],
    ['Памятки и схемы', 'company/templates/'],
    ['Статьи', 'company/article/'],
    ['Как заказать', 'kak-oformit-zakaz/'],
    ['Оплата', 'company/payment/'],
    ['Вопросы и ответы', 'company/vopros-otvet/'],
    ['Акции', 'company/action/'],
    ['Примеры работ', 'company/photo/'],
    ['Отзывы', 'company/request/'],
  ];
  const categoryRoutes = {
    Копицентр: 'kopitsentr/',
    'Проектная документация': 'proektnaya-dokumentatsiya/',
    'Листовая полиграфия': 'listovaya-poligrafiya/',
    'Наклейки и стикеры': 'nakleyki-i-stikery/',
    'UV-печать и резка': 'uv-pechat-i-rezka/',
    'Широкий формат': 'shirokiy-format/',
  };
  const companyLinks = () =>
    companyPages
      .map(
        ([label, path]) =>
          `<a href="${siteRoot}${path}" data-close-menu${new URL(path, siteRoot).pathname === location.pathname.replace(/index\.html$/, '') ? ' aria-current="page"' : ''}>${label}</a>`,
      )
      .join('');
  $$('[data-company-links]').forEach((element) => {
    element.innerHTML = element.closest('footer')
      ? companyPages
          .filter(([, path]) =>
            [
              'company/about/',
              'contacts/',
              'company/clients/',
              'for-business/',
              'guide/',
              'equipment/',
              'dostavka-i-oplata/',
              'requirements/',
              'company/article/',
              'kak-oformit-zakaz/',
            ].includes(path),
          )
          .map(([label, path]) => `<a href="${siteRoot}${path}">${label}</a>`)
          .join('')
      : companyLinks();
  });
  const popular = [
    {
      id: '2.1',
      name: 'Инженерная печать',
      asset: 'инженерная печать',
      description: 'Чертежи и схемы. От А4 до А0.',
      unit: '10 листов А2 + фальцовка',
      badge: 'Для проектировщиков',
    },
    {
      id: '1.1',
      name: 'Печать документов',
      asset: 'печать документов',
      description: 'Чёрно-белая и цветная. А4 и А3.',
      unit: '10 страниц А4, ч/б',
    },
    {
      id: '2.6',
      name: 'Печать дизайн-проектов',
      asset: 'печать дизайн проектов',
      description: 'Цветные альбомы для ваших проектов.',
      unit: '45 листов, без брошюровки',
    },
    {
      id: '1.6',
      name: 'Твёрдый переплёт дипломов',
      asset: 'твердый переплет дипломов',
      description: 'Печать и аккуратная сборка работы.',
      unit: '50 ч/б + 10 цветных страниц',
    },
    {
      id: '3.1',
      name: 'Визитки',
      asset: 'визитки',
      description: 'Плотная бумага. Впечатление надолго.',
      unit: '100 шт., Color Copy 350 г',
      badge: 'Онлайн-калькулятор',
    },
    {
      id: '3.2',
      name: 'Листовки',
      asset: 'листовки',
      description: 'Для акций, событий и продвижения.',
      unit: '50 шт., А6, 120 г',
    },
    {
      id: '6.5',
      name: 'Таблички',
      asset: 'таблички',
      description: 'Для офиса, навигации и вашего бренда.',
      unit: '10 шт., ПВХ 3 мм, 200 × 100 мм',
    },
    {
      id: '4.1',
      name: 'Фигурные стикеры',
      asset: 'фигурные стикеры',
      description: 'Любой контур. Яркий характер.',
      unit: '100 шт., 50 × 50 мм',
      badge: 'Для ваших идей',
    },
    {
      id: '4.4',
      name: 'Стикерпаки',
      asset: 'стикерпаки',
      description: 'Соберите свои идеи в один набор.',
      unit: '50 наборов, 100 × 150 мм',
    },
    {
      id: '4.9',
      name: 'Круглые 3D-стикеры',
      asset: 'круглые 3д стикеры',
      description: 'Объёмные наклейки с прозрачной смолой.',
      unit: '100 шт., 50 × 50 мм',
    },
    {
      id: '5.8',
      name: 'Накатка на ПВХ',
      asset: 'накатка на пвх',
      description: 'Изображения на жёстком пластике.',
      unit: '10 шт., ПВХ 3 мм, 500 × 500 мм',
    },
    {
      id: '6.1',
      name: 'Прямая UV-печать',
      asset: 'прямая уф печать',
      description: 'Печать на пластике, акриле и других материалах.',
      unit: '10 шт., ПВХ 3 мм, 100 × 100 мм',
    },
  ].map((p) => ({ ...p, record: catalog.find((r) => r.id === p.id) }));
  const getCategory = (record) => categories.find((c) => c.name === record.category);
  const serviceArtwork = {
    1.1: 'assets/copycenter-pechat-dokumentov.webp',
    1.2: 'assets/copycenter-kopirovanie-dokumentov.webp',
    1.3: 'assets/copycenter-pechat-fotografiy.webp',
    1.4: 'assets/copycenter-paketnoe-laminirovanie.webp',
    1.5: 'assets/copycenter-broshyurovka-na-pruzhinu.webp',
    1.6: 'assets/copycenter-tverdyy-pereplet-diplomov.webp',
    1.7: 'assets/copycenter-skanirovanie-dokumentov.webp',
    1.8: 'assets/copycenter-termonakleyki.webp',
    1.9: 'assets/copycenter-pechat-avtoreferatov.webp',
    2.1: 'assets/project-inzhenernaya-pechat.webp',
    2.2: 'assets/project-broshyurovka-proektnoy-dokumentatsii.webp',
    2.3: 'assets/project-falcovka-chertezhey.webp',
    2.4: 'assets/project-scanning-banner.webp',
    2.5: 'assets/project-kopirovanie-chertezhey.webp',
    2.6: 'assets/project-pechat-dizayn-proektov.webp',
    2.7: 'assets/project-pechat-lekal-i-vykroek.webp',
    3.1: 'assets/leaflet-vizitki.webp',
    3.2: 'assets/leaflet-listovki.webp',
    3.3: 'assets/leaflet-buklety.webp',
    3.4: 'assets/leaflet-broshyury.webp',
    3.5: 'assets/leaflet-katalogi.webp',
    3.6: 'assets/leaflet-otkrytki.webp',
    3.7: 'assets/leaflet-gramoty-i-diplomy.webp',
    3.8: 'assets/leaflet-sertifikaty.webp',
    3.9: 'assets/leaflet-afishi.webp',
    '3.10': 'assets/leaflet-birki.webp',
    4.1: 'assets/sticker-hero-flat-figure.webp',
    4.2: 'assets/sticker-hero-flat-round.webp',
    4.3: 'assets/sticker-hero-flat-rectangle.webp',
    4.4: 'assets/stickerpack-robot-transparent.webp',
    4.5: 'assets/sticker-hero-labels-brand.webp',
    4.6: 'assets/sticker-hero-uv-dtf.webp',
    4.7: 'assets/sticker-hero-paper.webp',
    4.8: 'assets/sticker-hero-3d-figure.webp',
    4.9: 'assets/sticker-hero-3d-round.webp',
    '4.10': 'assets/sticker-hero-3d-rectangle.webp',
    4.11: 'assets/sticker-hero-3d-pack.webp',
    5.1: 'assets/wide-hero-bannery.webp',
    5.2: 'assets/wide-hero-postery.webp',
    5.3: 'assets/wide-hero-plakaty.webp',
    5.4: 'assets/wide-hero-pechat-na-holste.webp',
    5.5: 'assets/wide-hero-samokleyashchayasya-plenka.webp',
    5.6: 'assets/wide-hero-nakleyki-na-avto.webp',
    5.7: 'assets/wide-hero-nakleyki-na-steklo.webp',
    5.8: 'assets/wide-hero-nakatka-na-pvh.webp',
    5.9: 'assets/wide-hero-nakatka-na-penokarton.webp',
    6.1: 'assets/uv-pryamaya-uv-pechat.webp',
    6.2: 'assets/uv-plotternaya-rezka.webp',
    6.3: 'assets/uv-lazernaya-rezka.webp',
    6.4: 'assets/uv-gravirovka-co2.webp',
    6.5: 'assets/uv-tablichki.webp',
    6.6: 'assets/uv-breloki.webp',
    6.7: 'assets/uv-shildy.webp',
    6.8: 'assets/uv-pechat-na-metalle.webp',
    6.9: 'assets/uv-garderobnye-nomerki.webp',
  };
  const imageFor = (record) => {
    if (serviceArtwork[record.id]) return siteRoot + serviceArtwork[record.id];
    if (window.TEXT_WIDE_SERVICES?.[record.id])
      return siteRoot + 'assets/' + window.TEXT_WIDE_SERVICES[record.id].hero;
    if (record.id === '1.5') return siteRoot + 'assets/service-binding.webp';
    const item = popular.find((p) => p.id === record.id);
    return item
      ? `${siteRoot}assets/popular-art-${encodeURI(item.asset)}.webp`
      : `${siteRoot}assets/${getCategory(record)?.image || 'company-about'}.webp`;
  };
  const examplesFor = (record) =>
    record.examples
      .split('•')
      .map((s) => s.trim())
      .filter(Boolean);
  let activeMenu = null;
  let selectedFile = null;
  let calcSelection = null;
  let cart = [];
  let checkoutDraft = null;
  function readCart() {
    try {
      const stored = JSON.parse(localStorage.getItem('text-print-cart-v1') || '[]');
      return Array.isArray(stored)
        ? stored.filter(
            (x) =>
              x &&
              typeof x.key === 'string' &&
              Boolean(cartService(x.id)) &&
              typeof x.description === 'string' &&
              (x.price === null || (Number.isFinite(x.price) && x.price >= 0)) &&
              (x.priceUpper === undefined ||
                (x.price !== null && Number.isFinite(x.priceUpper) && x.priceUpper >= x.price)),
          )
        : [];
    } catch {
      return [];
    }
  }
  cart = readCart();
  const dialog = $('#dialog');
  const dialogContent = $('#dialog-content');
  function saveCart() {
    try {
      localStorage.setItem('text-print-cart-v1', JSON.stringify(cart));
    } catch {}
    updateCartCount();
  }
  function updateCartCount() {
    for (const id of ['#cart-count', '#mobile-cart-count']) {
      const badge = $(id);
      if (badge) {
        badge.textContent = cart.length;
        badge.classList.toggle('has-items', cart.length > 0);
      }
    }
  }
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
  }
  function openDialog(html) {
    closeMenu();
    $('#navigation').classList.remove('mobile-open');
    $('#mobile-menu-button').setAttribute('aria-expanded', 'false');
    dialog.classList.remove('is-cart', 'is-cart-empty', 'is-order-confirmation');
    dialog.removeAttribute('aria-labelledby');
    dialogContent.innerHTML = html;
    document.body.classList.add('modal-open');
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    hydrateIcons(dialog);
  }
  function closeDialog() {
    dialog.close();
  }
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
  $('#dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        closeDialog();
    }
  });

  let menuCloseTimer;
  const menuMotion = matchMedia('(prefers-reduced-motion:reduce)');
  const menu = $('#mega-menu');
  let menuAnimation = null;
  function cancelMenuAnimation() {
    menuAnimation?.cancel();
    menuAnimation = null;
  }
  function closeMenu() {
    clearTimeout(menuCloseTimer);
    activeMenu = null;
    $$('.nav-item').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    menu.inert = true;
    const motionStyle = getComputedStyle(menu);
    const opacity = Number.parseFloat(motionStyle.opacity);
    const translate = motionStyle.translate === 'none' ? '0 0' : motionStyle.translate;
    const height = `${menu.getBoundingClientRect().height}px`;
    cancelMenuAnimation();
    const finish = () => {
      menu.hidden = true;
      $('#header').append(menu);
    };
    if (menu.hidden || menuMotion.matches || typeof menu.animate !== 'function') {
      finish();
      return;
    }
    const current = menu.animate(
      [
        { opacity, translate, height },
        { opacity: 0, translate: '0 -6px', height },
      ],
      { duration: 320, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' },
    );
    menuAnimation = current;
    current.onfinish = () => {
      if (menuAnimation !== current) return;
      finish();
      cancelMenuAnimation();
    };
  }
  function openMenu(name) {
    clearTimeout(menuCloseTimer);
    if (activeMenu === name) return;
    const wasVisible = !menu.hidden;
    const fromHeight = wasVisible ? menu.getBoundingClientRect().height : 0;
    const fromOpacity = wasVisible ? Number.parseFloat(getComputedStyle(menu).opacity) : 0;
    const translate = getComputedStyle(menu).translate;
    const fromTranslate = translate === 'none' ? '0 0' : translate;
    cancelMenuAnimation();
    activeMenu = name;
    $$('.nav-item').forEach((b) =>
      b.setAttribute('aria-expanded', String(b.dataset.menu === name)),
    );
    const company = name === 'Компания';
    const records = catalog.filter((r) => r.category === name);
    const links = company
      ? companyLinks()
      : records
          .map((r) =>
            serviceUrl(r.id)
              ? `<a href="${serviceUrl(r.id)}">${escape(r.name)}</a>`
              : `<button data-service="${r.id}">${escape(r.name)}</button>`,
          )
          .join('');
    $('#mega-menu').innerHTML =
      `<div class="mega-layout"><div class="mega-links" aria-label="${escape(name)}">${links}</div></div>`;
    const menuLinks = $('.mega-links', $('#mega-menu'));
    menuLinks.style.setProperty('--menu-rows', Math.ceil(menuLinks.children.length / 3));
    $('#mega-menu').hidden = false;
    menu.inert = false;
    if (matchMedia('(max-width:1100px)').matches) {
      const trigger = $$('.nav-item').find((b) => b.dataset.menu === name);
      (trigger.closest('.nav-group') || trigger).insertAdjacentElement('afterend', $('#mega-menu'));
    } else {
      $('#header').append($('#mega-menu'));
    }
    if (!menuMotion.matches && typeof menu.animate === 'function') {
      const height = menu.getBoundingClientRect().height;
      const current = menu.animate(
        [
          {
            opacity: fromOpacity,
            translate: wasVisible ? fromTranslate : '0 -10px',
            height: `${wasVisible ? fromHeight : height}px`,
          },
          { opacity: 1, translate: '0 0', height: `${height}px` },
        ],
        { duration: 440, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' },
      );
      menuAnimation = current;
      current.onfinish = () => {
        if (menuAnimation === current) cancelMenuAnimation();
      };
    }
    clearTimeout(menuCloseTimer);
  }
  menuMotion.addEventListener('change', () => {
    if (menuMotion.matches) {
      cancelMenuAnimation();
      if (!activeMenu) {
        menu.hidden = true;
        $('#header').append(menu);
      }
    }
  });
  matchMedia('(max-width:1100px)').addEventListener('change', closeMenu);
  function toggleMenu(name) {
    if (activeMenu === name) closeMenu();
    else openMenu(name);
  }
  if (!$('#navigation').querySelector('.nav-group'))
    $('#navigation').innerHTML = ['Компания', ...categories.map((c) => c.name)]
      .map(
        (name) =>
          `<div class="nav-group"><a class="nav-category-link" href="${siteRoot}${name === 'Компания' ? 'company/' : categoryRoutes[name]}">${escape(name)}</a><button class="nav-item" data-menu="${escape(name)}" aria-label="Подразделы: ${escape(name)}" aria-expanded="false" aria-controls="mega-menu">${icon('chevron')}</button></div>`,
      )
      .join('');
  $$('.nav-item').forEach((button) => {
    (button.closest('.nav-group') || button).addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse' && matchMedia('(min-width:1101px)').matches && !dialog.open)
        openMenu(button.dataset.menu);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu(button.dataset.menu);
        $('.mega-links button,.mega-links a', $('#mega-menu'))?.focus();
      }
    });
  });
  $('#header').addEventListener('pointerenter', () => clearTimeout(menuCloseTimer));
  $('#header').addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && matchMedia('(min-width:1101px)').matches)
      menuCloseTimer = setTimeout(() => {
        if (!$('#mega-menu').contains(document.activeElement)) closeMenu();
      }, 220);
  });
  $('#header').addEventListener('focusin', () => clearTimeout(menuCloseTimer));
  $('#header').addEventListener('focusout', (event) => {
    if (!$('#header').contains(event.relatedTarget)) menuCloseTimer = setTimeout(closeMenu, 220);
  });
  $('#footer-services').innerHTML = categories
    .map((c) =>
      categoryRoutes[c.name]
        ? `<a href="${siteRoot}${categoryRoutes[c.name]}">${escape(c.name)}</a>`
        : `<button data-action="catalog" data-category="${escape(c.name)}">${escape(c.name)}</button>`,
    )
    .join('');
  $('#footer-services').insertAdjacentHTML(
    'beforeend',
    `<a class="footer-cities-link" href="${siteRoot}cities/">Города доставки <span aria-hidden="true">↗</span></a>`,
  );
  function renderPopular() {
    if (!$('#popular-grid')) return;
    if (
      $('#popular-grid').querySelectorAll('.featured-art img[srcset]').length ===
      popular.filter((p) => p.record).length
    )
      return;
    $('#popular-grid').innerHTML = popular
      .filter((p) => p.record)
      .map(
        (p) =>
          `<${serviceUrl(p.id) ? `a href="${serviceUrl(p.id)}"` : 'button'} class="featured-card" ${serviceUrl(p.id) ? '' : `data-service="${p.id}"`} aria-label="${escape(p.name)}"><span class="featured-copy"><span class="featured-name">${p.name
            .split(/\s+/)
            .map((word) => `<span class="featured-word">${escape(word)}</span>`)
            .join(
              ' ',
            )}</span></span><span class="featured-art"><img src="${imageFor(p.record)}" alt="${escape(p.name)} — иллюстрация студии ТЕКСТ" width="720" height="720" loading="lazy"></span></${serviceUrl(p.id) ? 'a' : 'button'}>`,
      )
      .join('');
  }
  function renderCatalogList(query = '', category = '', calculators = false) {
    const normalized = query.toLowerCase().replaceAll('ё', 'е').trim();
    const found = catalog.filter(
      (r) =>
        (!category || r.category === category) &&
        `${r.name} ${r.category} ${r.materials}`
          .toLowerCase()
          .replaceAll('ё', 'е')
          .includes(normalized),
    );
    $('#catalog-results').innerHTML = found.length
      ? categories
          .filter((c) => found.some((r) => r.category === c.name))
          .map((c) => {
            const records = found.filter((r) => r.category === c.name);
            const items = records
              .map((r) => {
                const url = serviceUrl(r.id),
                  tag = url ? 'a' : 'button';
                const attrs = url
                  ? `href="${url}${calculators ? '#calculator' : ''}"`
                  : `data-service="${r.id}"`;
                return `<${tag} ${attrs}><span>${escape(r.name)}</span>${calculators && (url || r.id === '3.1') ? '<span class="catalog-online">Онлайн</span>' : ''}</${tag}>`;
              })
              .join('');
            return `<section class="catalog-group">${category ? '' : `<div class="mega-title"><h3>${escape(c.name)}</h3></div>`}<div class="catalog-group-list mega-links" style="--menu-rows:${Math.ceil(records.length / 2)}">${items}</div></section>`;
          })
          .join('')
      : `<div class="empty-state">${icon('search')}<h3>Пока не нашли такую услугу</h3><p>Попробуйте другое название или расскажите нам о своей задаче.</p><button class="button button-primary" data-action="request">Обсудить заказ</button></div>`;
  }
  function openCatalog(category = '', search = false, query = '', calculators = false) {
    openDialog(
      `<div class="dialog-body catalog-dialog"><h2>${escape(category || (calculators ? 'Калькуляторы и расчёт услуг' : 'Все услуги'))}</h2>${calculators ? '<p class="calculator-directory-intro">Выберите услугу с отметкой «Онлайн» для мгновенного расчёта. По другим услугам подготовим расчёт со студией.</p>' : ''}<label class="catalog-search">${icon('search')}<input id="catalog-search" aria-label="Поиск услуги" placeholder="Название услуги, материал или задача…" autocomplete="off"></label><div id="catalog-results"></div>${category ? '<button class="text-button" data-action="catalog">← Все услуги</button>' : ''}</div>`,
    );
    $('#catalog-search').value = query;
    renderCatalogList(query, category, calculators);
    $('#catalog-search').addEventListener('input', (event) =>
      renderCatalogList(event.target.value, category, calculators),
    );
    if (search) $('#catalog-search').focus();
  }
  function openService(id) {
    if (serviceUrl(id)) {
      location.href = serviceUrl(id);
      return;
    }
    const record = catalog.find((r) => r.id === id);
    if (!record) return;
    if (id === '3.1') {
      openCalculator();
      return;
    }
    const examples = examplesFor(record);
    const p = popular.find((p) => p.id === id);
    openDialog(
      `<div class="dialog-body"><div class="service-summary"><div class="service-summary-copy"><div class="eyebrow muted">${escape(record.category)}</div><h2>${escape(p?.name || record.name)}</h2><p class="dialog-intro">${escape(p?.description || record.materials)}</p></div><img class="service-dialog-image" src="${imageFor(record)}" alt="${escape(record.name)}"></div><h3 class="service-subheading">Варианты и материалы</h3><p class="service-details">${escape(record.materials)}</p>${
        examples.length
          ? `<h3 class="service-subheading">Примеры стоимости</h3><div class="price-examples">${examples
              .map((s) => {
                const i = s.lastIndexOf('—');
                return i >= 0
                  ? `<div class="price-example"><span>${escape(s.slice(0, i))}</span><strong>${escape(s.slice(i + 1))}</strong></div>`
                  : `<div class="price-example"><span>${escape(s)}</span></div>`;
              })
              .join(
                '',
              )}</div><p class="service-sla">Примеры для указанных параметров. Ваш заказ рассчитывается по размеру, материалу и тиражу.</p>`
          : ''
      }<h3 class="service-subheading">Требования к макету</h3><p class="service-details">${escape(record.requirements)}</p><p class="service-sla">${escape(record.sla)}</p><div class="service-dialog-actions"><button class="button button-primary" data-action="request" data-record="${id}">Получить расчёт ${icon('arrow')}</button><button class="button button-outline" data-add-request="${id}">${icon('bag')} Добавить в запрос</button></div></div>`,
    );
  }
  const calculateCards = window.TEXT_CALCULATE_CARDS;
  function openCalculators() {
    openCatalog('', false, '', true);
  }
  function openCalculator() {
    const rules = window.TEXT_PRICING.cards;
    const papers = [...new Set(rules.rates.map((r) => r.paper))];
    const quantities = [...new Set(rules.rates.map((r) => r.quantity))];
    openDialog(
      `<div class="dialog-body"><div class="eyebrow muted">ЛИСТОВАЯ ПОЛИГРАФИЯ</div><h2>Рассчитать визитки</h2><p class="dialog-intro">Выберите бумагу, тираж и отделку. Стоимость пересчитывается сразу.</p><div class="calc-layout"><form class="form-fields" id="cards-form"><label class="field">Бумага<select name="paper">${papers.map((p) => `<option>${escape(p)}</option>`).join('')}</select></label><label class="field">Печать<select name="sides"><option value="1">Односторонняя</option><option value="2">Двусторонняя</option></select></label><label class="field">Тираж, шт.<select name="quantity">${quantities.map((q) => `<option value="${q}">${q}</option>`).join('')}</select></label><label class="field-checkbox"><input type="checkbox" name="lamination"> Ламинация</label><label class="field-checkbox"><input type="checkbox" name="corners"> Скругление углов</label></form><div class="calc-result" aria-live="polite"><small>СТОИМОСТЬ ТИРАЖА</small><div id="calc-total" class="calc-total"></div><div id="calc-unit" class="calc-unit"></div><div id="calc-selected" class="calc-selected"></div><button class="button button-primary" id="add-cards">${icon('bag')} Добавить в корзину</button><button class="text-button calculator-download" id="download-cards">${icon('download')} Скачать расчёт</button><p id="calc-deadline"></p></div></div><h3 class="service-subheading">Подготовьте макет</h3><p class="service-details">${escape(catalog.find((r) => r.id === '3.1').requirements)}</p></div>`,
    );
    const form = $('#cards-form');
    function update() {
      const paper = form.elements.paper.value,
        quantity = Number(form.elements.quantity.value),
        sides = form.elements.sides.value,
        lamination = form.elements.lamination.checked,
        corners = form.elements.corners.checked;
      const result = calculateCards(paper, quantity, sides, lamination, corners);
      const description = `${paper}; ${sides === '2' ? 'двусторонняя' : 'односторонняя'} печать; ${quantity} шт.; ламинация: ${lamination ? 'да' : 'нет'}; скругление: ${corners ? 'да' : 'нет'}`;
      calcSelection = { ...result, description, quantity };
      $('#calc-total').textContent = currency(result.total);
      $('#calc-unit').textContent = `${currency(result.unit)} за штуку`;
      $('#calc-selected').textContent = description;
      const word = result.days === 1 ? 'рабочего дня' : 'рабочих дней';
      $('#calc-deadline').textContent =
        `Срок: от ${result.days} ${word} после полного согласования макета. Получение и доставку согласуем при подтверждении заказа.`;
    }
    form.addEventListener('change', update);
    update();
    $('#add-cards').addEventListener('click', () => {
      cart = readCart();
      cart.push({
        key: crypto.randomUUID(),
        id: '3.1',
        description: calcSelection.description,
        price: calcSelection.total,
      });
      saveCart();
      toast('Визитки добавлены в корзину');
    });
    $('#download-cards').addEventListener('click', () => {
      const content = [
        'СТУДИЯ ПЕЧАТИ ТЕКСТ',
        'Расчёт визиток',
        `Дата: ${new Date().toLocaleDateString('ru-RU')}`,
        '',
        calcSelection.description,
        `За штуку: ${currency(calcSelection.unit)}`,
        `Стоимость тиража: ${currency(calcSelection.total)}`,
        $('#calc-deadline').textContent,
        '',
        'Барнаул, проспект Строителей, 11',
        '+7 (923) 654-78-96',
        'tekkkst@yandex.ru',
      ].join('\n');
      const url = URL.createObjectURL(
        new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ТЕКСТ — расчёт визиток.txt';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Расчёт визиток скачан');
    });
  }
  function addRequest(id) {
    const record = catalog.find((r) => r.id === id);
    if (!record) return;
    cart = readCart();
    cart.push({
      key: crypto.randomUUID(),
      id,
      description: 'Параметры и тираж — уточнить при расчёте',
      price: null,
    });
    saveCart();
    toast('Услуга добавлена в ваш запрос');
  }
  function updateCartSelection() {
    const boxes = $$('[data-cart-select]', dialog),
      selected = boxes.filter((box) => box.checked);
    const all = $('[data-cart-select-all]', dialog),
      count = $('[data-cart-selected-count]', dialog),
      remove = $('[data-cart-remove-selected]', dialog);
    if (all) {
      all.checked = boxes.length > 0 && selected.length === boxes.length;
      all.indeterminate = selected.length > 0 && selected.length < boxes.length;
    }
    if (count) count.textContent = `Выбрано: ${selected.length}`;
    if (remove) remove.disabled = !selected.length;
    boxes.forEach((box) => box.closest('.cart-row').classList.toggle('is-selected', box.checked));
  }
  function removeCartItems(keys) {
    const selected = new Set(keys);
    cart = readCart();
    const removed = cart.filter((row) => selected.has(row.key));
    if (!removed.length) return;
    cart = cart.filter((row) => !selected.has(row.key));
    saveCart();
    removed.forEach((row) => window.TEXT_FILES.remove(row.key).catch(() => {}));
    openCart();
    const heading = $('.cart-panel h2', dialog);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    toast(`Удалено позиций: ${removed.length}`);
  }
  function openCart() {
    cart = readCart();
    updateCartCount();
    if (!cart.length) {
      openDialog(
        `<div class="dialog-body cart-panel"><div class="cart-heading"><h2>Корзина</h2><span class="cart-count-label">0 позиций</span></div><div class="cart-empty"><span class="cart-empty-icon">${icon('bag')}</span><h3>Корзина пока пуста</h3><p>Выберите услугу и рассчитайте стоимость.<br>Все ваши расчёты соберём здесь.</p><button class="button button-primary" data-action="catalog">Выбрать услугу ${icon('arrow')}</button></div></div>`,
      );
      dialog.classList.add('is-cart', 'is-cart-empty');
      return;
    }
    const priced = cart.filter((r) => r.price !== null),
      cartTotals = window.TEXT_STICKER_CART_BREAKDOWN(cart),
      total = cartTotals.total;
    openDialog(
      `<div class="dialog-body cart-panel"><h2>Корзина <small>· ${cart.length}</small></h2><p class="dialog-intro">Параметры сохранены в этом браузере. Отправьте запрос в студию, чтобы согласовать макеты и получение.</p><div class="cart-bulk-controls"><label class="cart-select-all"><input type="checkbox" data-cart-select-all><span>Выбрать все</span></label><span class="cart-selected-count" data-cart-selected-count role="status" aria-live="polite">Выбрано: 0</span><div class="cart-bulk-actions"><button type="button" data-cart-remove-selected disabled>Очистить выбранное</button><button type="button" data-cart-remove-all data-clear-cart>Очистить всё</button></div></div><ol class="cart-list">${cart.map((r) => `<li class="cart-row"><label class="cart-row-select"><input type="checkbox" data-cart-select="${escape(r.key)}" aria-label="Выбрать ${escape(cartService(r.id).name)}"><span class="sr-only">Выбрать позицию</span></label><div class="cart-item-content"><h3>${escape(cartService(r.id).name)}</h3><p>${escape(r.description)}</p>${serviceUrl(r.id) && r.configuration ? `<a class="cart-edit-link" href="${serviceUrl(r.id)}?edit=${encodeURIComponent(r.key)}">Изменить параметры</a>` : ''}<div class="cart-file-actions">${r.fileName ? `<button data-download-cart-file="${escape(r.key)}">Макет: ${escape(r.fileName)} ↓</button>` : ''}<label>${r.fileName ? 'Заменить макет' : 'Прикрепить макет'}<input type="file" data-cart-file="${escape(r.key)}" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.zip"></label></div></div><div class="cart-row-right"><span class="cart-row-price">${r.price === null ? 'Уточним' : priceRange(r.price, r.priceUpper)}</span><button class="icon-button" data-remove="${escape(r.key)}" aria-label="Удалить ${escape(cartService(r.id).name)}">${icon('trash')}</button></div></li>`).join('')}</ol>${
        cartTotals.surcharge
          ? `<p class="cart-minimum-note">${Object.entries(cartTotals.surcharges)
              .filter(([, amount]) => amount > 0)
              .map(
                ([group, amount]) =>
                  `Доплата до минимального чека ${{ stickers3d: '3D-стикеров и наборов', stickers: 'наклеек и стикерпаков', uvdtf: 'UV-DTF наклеек', paper: 'бумажных стикеров', 'wide-banner': 'баннеров', 'wide-poster': 'постеров и плакатов', 'wide-canvas': 'холстов', 'wide-film': 'печати на плёнке', 'wide-cut': 'плоттерной резки', 'wide-pvc': 'накатки на ПВХ', 'wide-foam': 'накатки на пенокартон', 'uv-direct': 'прямой UV-печати и табличек', 'uv-laser': 'лазерной резки', 'uv-engraving': 'гравировки', 'uv-keychains': 'брелоков и номерков', 'uv-shields': 'шильдов и печати на металле' }[group]}: ${currency(amount)}.`,
              )
              .join(' ')}</p>`
          : ''
      }${priced.length ? `<div class="cart-summary"><span>${priced.length === cart.length ? (cart.some((r) => isDesign(r.id)) ? 'Итого за заказ' : 'Итого за продукцию') : 'Рассчитанная часть заказа'}</span><strong>${priceRange(total, cartUpper(cart, total))}</strong></div>` : ''}${priced.length !== cart.length ? '<p class="service-sla">Стоимость остальных позиций уточняется после выбора параметров. Доставка рассчитывается отдельно.</p>' : '<p class="service-sla">Доставка рассчитывается отдельно.</p>'}${window.TEXT_CART_EXTRAS?.render({ productTotal: total - cart.filter((r) => isDesign(r.id)).reduce((sum, r) => sum + r.price, 0), designId: cart.find((r) => isDesign(r.id))?.id || '', siteRoot }) || ''}<div class="cart-export"><div><strong>Скачайте документы заказа</strong><p>PDF — общий расчёт с параметрами и ценами.<br>Excel — фирменный товарный чек и акт. Номер документа и данные покупателя можно заполнить в Excel.</p></div><div class="cart-export-actions"><button class="button button-primary" type="button" id="download-cart-pdf">${icon('download')} Скачать PDF</button><button class="button button-outline" type="button" id="download-cart-xlsx">${icon('document')} Скачать Excel</button></div></div><p class="cart-pdf-status" id="cart-pdf-status" role="status" aria-live="polite"></p><p class="cart-pdf-status" id="cart-xlsx-status" role="status" aria-live="polite"></p><div class="form-actions"><button class="button button-outline" data-action="request" data-cart="true">Оформить заказ ${icon('arrow')}</button><button class="button button-outline" data-action="catalog">Добавить услугу</button></div></div>`,
    );
    dialog.classList.add('is-cart');
    window.TEXT_CART_EXTRAS?.mount(dialog.querySelector('.cart-panel'));
  }
  function openCartClearConfirmation() {
    if (!readCart().length) {
      openCart();
      return;
    }
    openDialog(
      `<div class="dialog-body cart-panel"><h2>Очистить корзину?</h2><p class="dialog-intro">Все позиции и прикреплённые макеты будут удалены из корзины. Это действие нельзя отменить.</p><div class="form-actions"><button class="button button-outline" type="button" data-cancel-cart-clear>Отмена</button><button class="button button-primary" type="button" data-confirm-cart-clear>${icon('trash')} Очистить</button></div></div>`,
    );
    dialog.classList.add('is-cart', 'is-cart-empty');
    $('[data-cancel-cart-clear]', dialog).focus();
  }
  // Capture the displayed cart: an in-progress export is unaffected by later edits.
  async function downloadCartPDF(button) {
    if (button.disabled) return;
    const rows = readCart(),
      status = $('#cart-pdf-status'),
      original = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Готовим PDF…';
    if (status) status.textContent = 'Собираем услуги, параметры и цены в один документ.';
    try {
      const data = window.TEXT_CART_PDF.model(
        rows,
        [...catalog, ...DESIGN_OPTIONS],
        window.TEXT_STICKER_CART_BREAKDOWN(rows),
      );
      await window.TEXT_CART_PDF.download(data);
      window.TEXT_ANALYTICS?.track('pdf_download');
      if (status) status.textContent = 'PDF скачан. Его можно отправить клиенту или в студию.';
      toast('Расчёт заказа скачан в PDF');
    } catch {
      if (status)
        status.textContent = 'Не удалось создать PDF. Проверьте подключение и попробуйте ещё раз.';
      toast('Не удалось скачать PDF. Попробуйте ещё раз.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = original;
    }
  }
  async function downloadCartExcel(button) {
    if (button.disabled) return;
    const rows = readCart(),
      status = $('#cart-xlsx-status'),
      original = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Готовим Excel…';
    if (status) status.textContent = 'Собираем товарный чек и акт из позиций корзины.';
    try {
      const prepared =
        window.TEXT_CART_XLSX.prepare &&
        rows.some(
          (item) => ['2.1', '2.5', '2.6'].includes(item.id) && item.configuration?.rows?.length,
        )
          ? await window.TEXT_CART_XLSX.prepare(rows)
          : rows;
      const data = window.TEXT_CART_XLSX.model(
        prepared,
        [...catalog, ...DESIGN_OPTIONS],
        window.TEXT_STICKER_CART_BREAKDOWN(rows),
      );
      await window.TEXT_CART_XLSX.download(data);
      window.TEXT_ANALYTICS?.track('xlsx_download');
      if (status)
        status.textContent =
          'Excel скачан. Заполните реквизиты на листе «Товарный чек» — они появятся в акте.';
      toast('Товарный чек и акт скачаны в Excel');
    } catch {
      if (status) status.textContent = 'Не удалось создать Excel. Попробуйте ещё раз.';
      toast('Не удалось скачать Excel. Попробуйте ещё раз.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = original;
    }
  }
  function requestText(form, record, includeCart) {
    const data = new FormData(form);
    let lines = [
      'Заявка на печать в студии ТЕКСТ.',
      `Имя: ${data.get('name')}`,
      `Телефон: ${data.get('phone')}`,
    ];
    if (includeCart) {
      const channel = data.get('contactChannel') || 'max';
      lines.push(
        channel === 'telegram'
          ? `Связаться в Telegram: @${String(data.get('telegram') || '')
              .trim()
              .replace(/^@/, '')}`
          : `Связаться в MAX: ${data.get('phone')}`,
      );
    }
    if (record) lines.push(`Услуга: ${record.name}`);
    if (includeCart)
      cart.forEach((r, i) =>
        lines.push(
          `\n${i + 1}. ${cartService(r.id).name}\n${r.description}\n${r.price === null ? 'Стоимость: требуется расчёт' : `Стоимость: ${priceRange(r.price, r.priceUpper)}`}`,
        ),
      );
    if (includeCart) {
      const totals = window.TEXT_STICKER_CART_BREAKDOWN(cart);
      cart
        .filter((r) => r.fileName)
        .forEach((r) =>
          lines.push(
            `Макет для ${cartService(r.id).name}: ${r.fileName} (передастся при отправке заявки)`,
          ),
        );
      for (const [group, amount] of Object.entries(totals.surcharges))
        if (amount > 0)
          lines.push(
            `Доплата до минимального чека ${{ stickers3d: '3D-стикеров и наборов', stickers: 'наклеек и стикерпаков', uvdtf: 'UV-DTF наклеек', paper: 'бумажных стикеров', 'wide-banner': 'баннеров', 'wide-poster': 'постеров и плакатов', 'wide-canvas': 'холстов', 'wide-film': 'печати на плёнке', 'wide-cut': 'плоттерной резки', 'wide-pvc': 'накатки на ПВХ', 'wide-foam': 'накатки на пенокартон', 'uv-direct': 'прямой UV-печати и табличек', 'uv-laser': 'лазерной резки', 'uv-engraving': 'гравировки', 'uv-keychains': 'брелоков и номерков', 'uv-shields': 'шильдов и печати на металле' }[group]}: ${currency(amount)}`,
          );
      lines.push(
        `Итого за рассчитанные позиции: ${priceRange(totals.total, cartUpper(cart, totals.total))}`,
      );
    }
    const comment = String(data.get('comment') || '').trim();
    if (comment) lines.push(`\nЗадача: ${comment}`);
    if (selectedFile) lines.push(`\nМакет: ${selectedFile.name} (передастся при отправке заявки)`);
    if (data.get('personalDataConsent') === '2026-10-07')
      lines.push(
        `\nСогласие на обработку персональных данных: подтверждено (редакция 07.10.2026).\nДокумент: ${siteRoot}company/personal-data-consent/\nВремя подтверждения: ${new Date().toISOString()}`,
      );
    return lines.join('\n');
  }
  function openRequest(record = null, includeCart = false, upload = false, prefill = null) {
    if (includeCart && !prefill && checkoutDraft) prefill = checkoutDraft;
    if (prefill) selectedFile = prefill.file || null;
    else if (!upload) selectedFile = null;
    const contactControl = `<fieldset class="checkout-contact"><legend>Как с вами связаться?</legend><div class="checkout-channel-options"><label class="checkout-channel-option"><input type="radio" name="contactChannel" value="max" checked><img src="${siteRoot}assets/max.svg" alt="" width="22" height="22"><span>MAX</span></label><label class="checkout-channel-option"><input type="radio" name="contactChannel" value="telegram"><img src="${siteRoot}assets/telegram.svg" alt="" width="22" height="22"><span>Telegram</span></label></div><p class="checkout-contact-hint" id="checkout-contact-hint" aria-live="polite">Напишем в MAX на указанный выше телефон.</p><label class="field checkout-telegram-field" hidden>Имя пользователя в Telegram<input name="telegram" placeholder="@username" maxlength="33" pattern="@?[a-zA-Z][a-zA-Z0-9_]{4,31}" title="5–32 символа: латинские буквы, цифры и подчёркивание. Начинается с буквы." autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="checkout-contact-hint" disabled></label></fieldset>`;
    const consentControl = `<label class="request-consent"><input type="checkbox" name="personalDataConsent" value="2026-10-07" required aria-describedby="request-consent-help"><span>Даю отдельное <a href="${siteRoot}company/personal-data-consent/" target="_blank" rel="noopener">согласие на обработку персональных данных</a> для обращения и заказа. <a href="${siteRoot}company/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a></span></label><p id="request-consent-help" class="request-consent-help">Согласие не включает рекламу и не связано с выбором аналитики cookies.</p>`;
    openDialog(
      `<div class="dialog-body request-form">${includeCart ? '<button class="checkout-back" type="button" data-checkout-back>← Назад в корзину</button>' : ''}<div class="eyebrow muted">ПОМОЖЕМ С ВАШЕЙ ЗАДАЧЕЙ</div><h2>${upload ? 'Передать макет' : record ? escape(record.name) : 'Обсудить заказ'}</h2><p class="dialog-intro">${includeCart ? 'Передадим состав заказа и макеты в студию.' : 'Прикрепите макет и расскажите, что нужно напечатать.'}</p><form id="request-form" class="form-fields"><div class="form-row"><label class="field">Ваше имя<input name="name" required maxlength="100" autocomplete="name" placeholder="Как к вам обращаться"></label><label class="field">Телефон<input name="phone" type="tel" required minlength="6" maxlength="30" autocomplete="tel" placeholder="+7 (___) ___-__-__"></label></div>${contactControl}<label class="field" for="request-comment">Что нужно напечатать?<textarea id="request-comment" name="comment" aria-label="Что нужно напечатать?" maxlength="5000" placeholder="Размер, материал, количество и желаемый срок…">${record ? escape(record.name) + ': ' : ''}</textarea></label><label class="upload-zone">${icon('upload')}Прикрепите макет<input type="file" id="file-input" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.svg,.ai,.eps,.cdr,.psd,.doc,.docx,.zip"><small>PDF, изображения, исходники или архив · до 100 МБ</small></label><p id="file-feedback" class="file-feedback">Макет передастся в студию после отправки заявки. Предпочтительный формат для документов — PDF.</p>${consentControl}<div class="form-actions"><button class="button button-primary" type="submit" disabled>Подключаемся к серверу…</button><button class="button button-outline" type="button" id="download-request">${icon('download')} Скачать запрос</button></div><p class="form-disclosure">После приёма сервером вы увидите номер заявки и статус уведомления студии. <a href="${siteRoot}contacts/">Контакты студии</a></p></form></div>`,
    );
    const form = $('#request-form');
    if (includeCart) {
      const summary = document.createElement('div');
      summary.className = 'checkout-delivery-summary';
      summary.textContent = window.TEXT_CART_EXTRAS?.summary() || '';
      form.before(summary);
      const saveDraft = () => {
        checkoutDraft = {
          file: selectedFile,
          comment: form.elements.comment.value,
          fields: Object.fromEntries(new FormData(form).entries()),
        };
      };
      form.addEventListener('input', saveDraft);
      dialog.querySelector('[data-checkout-back]').addEventListener('click', () => {
        saveDraft();
        openCart();
      });
      for (const [name, value] of Object.entries(prefill?.fields || {})) {
        const control = form.elements[name];
        if (!control || name === 'personalDataConsent') continue;
        if (name === 'contactChannel') {
          for (const radio of form.querySelectorAll('[name="contactChannel"]'))
            radio.checked = radio.value === value;
        } else if (typeof value === 'string') control.value = value;
      }
    }

    {
      const telegramField = form.querySelector('.checkout-telegram-field'),
        telegramInput = form.elements.telegram;
      const syncContact = () => {
        const useTelegram = form.elements.contactChannel.value === 'telegram';
        telegramField.hidden = !useTelegram;
        telegramInput.disabled = !useTelegram;
        telegramInput.required = useTelegram;
        $('#checkout-contact-hint').textContent = useTelegram
          ? 'Укажите username из настроек Telegram, например @ivan_print.'
          : 'Напишем в MAX на указанный выше телефон.';
      };
      for (const option of form.querySelectorAll('[name="contactChannel"]'))
        option.addEventListener('change', syncContact);
      telegramInput.addEventListener('change', () => {
        telegramInput.value = telegramInput.value.trim();
      });
      syncContact();
    }
    if (prefill?.comment) $('#request-comment').value = prefill.comment;
    if (selectedFile)
      $('#file-feedback').textContent =
        `Макет прикреплён: ${selectedFile.name} · ${(selectedFile.size / 1024 / 1024).toFixed(2)} МБ. Передастся после отправки заявки.`;
    $('#file-input').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) {
        selectedFile = null;
        $('#file-feedback').textContent = 'Прикрепите макет или опишите задачу.';
        return;
      }
      const error = window.TEXT_FILES.validate(file);
      if (error) {
        event.target.value = '';
        selectedFile = null;
        $('#file-feedback').textContent = error;
        return;
      }
      selectedFile = file;
      $('#file-feedback').textContent =
        `Макет прикреплён: ${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} МБ. Передастся после отправки заявки.`;
    });
    const requestItems = record
      ? [{ key: crypto.randomUUID(), id: record.id, price: null, description: record.name }]
      : [];
    const connect = () => {
      form.dataset.orderCheckout = 'loading';
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const mount = () =>
        window.TEXT_ORDER_CHECKOUT.mount({
          form,
          siteRoot,
          kind: includeCart ? 'cart' : 'request',
          getItems: () => (includeCart ? readCart().map((r) => ({ ...r })) : requestItems),
          getFile: () => selectedFile,
          notify: toast,
        });
      if (window.TEXT_ORDER_CHECKOUT) mount();
      else {
        const script = document.createElement('script');
        script.src = new URL('orders-client.js', siteRoot).href;
        script.onload = mount;
        script.onerror = () => {
          script.remove();
          form.dataset.orderCheckout = 'script-error';
          submit.disabled = false;
          submit.textContent = 'Повторить подключение';
          form.querySelector('.form-disclosure').textContent =
            'Не удалось подключить отправку. Заявка и файлы не переданы. Повторите подключение или откройте контакты студии.';
        };
        document.head.append(script);
      }
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (form.dataset.orderCheckout === 'script-error') connect();
    });
    if (includeCart || window.TEXT_GEO?.get().fulfillment)
      form.addEventListener(
        'submit',
        () => {
          const marker = '\n\n[ПОЛУЧЕНИЕ ЗАКАЗА]\n';
          const base = form.elements.comment.value.split(marker)[0];
          const receiving = (window.TEXT_CART_EXTRAS?.summary() || '').slice(0, 1500);
          form.elements.comment.value =
            base.slice(0, 5000 - marker.length - receiving.length) + marker + receiving;
        },
        true,
      );
    connect();
    $('#download-request').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const blob = new Blob([requestText(form, record, includeCart)], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Запрос на печать — ТЕКСТ.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Запрос подготовлен для отправки в студию');
    });
  }
  function openContacts() {
    openDialog(
      `<div class="dialog-body"><div class="eyebrow muted">СТУДИЯ ПЕЧАТИ ТЕКСТ</div><h2>Будем на связи</h2><p class="dialog-intro">Пн–пт 09:00–18:00. Барнаул, проспект Строителей, 11.</p><div class="contact-options"><a class="contact-option" href="tel:+79236547896">${icon('phone')}<strong>Позвонить</strong><span>+7 (923) 654-78-96</span></a><a class="contact-option" href="mailto:tekkkst@yandex.ru">${icon('mail')}<strong>Написать на почту</strong><span>tekkkst@yandex.ru</span></a><a class="contact-option" href="https://t.me/textprint" target="_blank" rel="noopener" id="telegram-link">${icon('send')}<strong>Telegram</strong><span>Отправить вопрос или макет</span></a><a class="contact-option" href="https://2gis.ru/barnaul/firm/70000001043200458" target="_blank" rel="noopener" id="max-link">${icon('send')}<strong>MAX</strong><span>Открыть контакты студии в 2ГИС</span></a></div><div class="form-actions"><button class="button button-outline" data-action="request">Подготовить запрос ${icon('arrow')}</button></div></div>`,
    );
    $('#telegram-link').href =
      window.TEXT_CONTACTS?.telegram || 'https://2gis.ru/barnaul/firm/70000001043200458';
    $('#max-link').href =
      window.TEXT_CONTACTS?.max || 'https://2gis.ru/barnaul/firm/70000001043200458';
    if (window.TEXT_CONTACTS?.max) $('#max-link span').textContent = 'Отправить вопрос или макет';
  }
  function openOrderGuide() {
    const steps = [
      [
        'Выберите услугу',
        'Укажите размер, материал и тираж. Если есть онлайн-калькулятор, сохраните расчёт.',
      ],
      ['Соберите запрос', 'Соберите позиции в корзине и укажите контакты.'],
      [
        'Отправьте макеты',
        'Оформите заказ из корзины или передайте макет через форму заявки. После приёма сервером вы увидите номер заявки и статус уведомления студии.',
      ],
      ['Подтвердите заказ', 'Согласуем макет, итоговую стоимость, оплату и получение заказа.'],
    ];
    openDialog(
      `<div class="dialog-body order-guide-dialog"><h2>Как оформить заказ</h2><ol class="order-guide-steps" role="list">${steps.map(([title, text], index) => `<li><span class="order-guide-number" aria-hidden="true">0${index + 1}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol><p class="order-guide-note">Скачивание расчёта или запроса не отправляет заказ. Дождитесь подтверждения студии.</p><div class="form-actions"><a class="button button-primary" href="${siteRoot}kak-oformit-zakaz/">Подробная инструкция ${icon('arrow')}</a></div></div>`,
    );
  }
  function openRequirements() {
    openDialog(
      `<div class="dialog-body"><div class="eyebrow muted">ПЕРЕД ПЕЧАТЬЮ</div><h2>Требования к макетам</h2><p class="dialog-intro">Точные требования зависят от продукта. В карточке выбранной услуги есть подсказки по подготовке файла.</p><div class="requirements-list"><div class="requirements-item"><h3>Документы, чертежи и проекты</h3><p>Предпочтительно PDF. Проверьте формат и ориентацию страниц, порядок листов, нумерацию, таблицы и цветные вставки. Сохраните Word в PDF, чтобы шрифты и страницы оставались на месте.</p></div><div class="requirements-item"><h3>Полиграфия</h3><p>Готовьте макет под конечный размер продукта. Учтите вылеты под обрезку и безопасные поля. Важные элементы не должны находиться вплотную к линии реза.</p></div><div class="requirements-item"><h3>Наклейки и изделия с резкой</h3><p>Для фигурных наклеек нужен отдельный контур резки. Для прозрачных и голографических материалов заранее согласуйте белую подложку. Между элементами стикерпака оставьте технологические расстояния.</p></div></div><div class="form-actions"><button class="button button-primary" data-action="upload">${icon('upload')} Подготовить макет к отправке</button></div></div>`,
    );
  }
  const deliveryContent = {
    pickup:
      '<strong>Проспект Строителей, 11</strong><p>Пн–пт 09:00–18:00. Самовывоз — бесплатно.</p>',
    city: '<strong>Курьером по Барнаулу — от 300 ₽</strong><p>В течение одного дня после готовности. Для малогабаритных заказов от 5 000 ₽ — бесплатно. Стоимость зависит от размера заказа.</p>',
    country:
      '<strong>СДЭК, ПЭК, Деловые Линии</strong><p>Доставка в любой город России. Срок и стоимость зависят от города и размера заказа; согласуем их перед отправкой.</p>',
  };
  function selectDelivery(name) {
    $$('[data-delivery]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.delivery === name));
      b.tabIndex = b.dataset.delivery === name ? 0 : -1;
    });
    $('#delivery-details').innerHTML = deliveryContent[name];
    $('#delivery-details').setAttribute('aria-labelledby', 'tab-' + name);
  }
  document.addEventListener('click', (event) => {
    const checkout = event.target.closest('[data-action="request"][data-cart="true"]');
    if (checkout && dialog.querySelector('.cart-panel')?.validateDelivery?.() === false) {
      event.preventDefault();
      return;
    }
    const designer = event.target.closest('[data-design-choice]');
    if (designer) {
      const scrollTop = dialog.scrollTop;
      const designerTop = $('.cart-designer', dialog)?.getBoundingClientRect().top;
      const choice = designer.dataset.designChoice;
      cart = readCart().filter((row) => !isDesign(row.id));
      const selected = DESIGN_OPTIONS.find((x) => x.id === choice);
      if (selected)
        cart.push({
          key: crypto.randomUUID(),
          id: selected.id,
          description:
            'Услуга дизайнера · стоимость за 1 заказ. Состав работ согласуем до исполнения.',
          price: selected.price,
        });
      saveCart();
      openCart();
      const nextDesignerTop = $('.cart-designer', dialog)?.getBoundingClientRect().top;
      dialog.scrollTop =
        designerTop !== undefined && nextDesignerTop !== undefined
          ? dialog.scrollTop + nextDesignerTop - designerTop
          : scrollTop;
      $$('[data-design-choice]', dialog)
        .find((input) => input.dataset.designChoice === choice)
        ?.focus({ preventScroll: true });
      return;
    }
    const pdfButton = event.target.closest('#download-cart-pdf');
    if (pdfButton) {
      downloadCartPDF(pdfButton);
      return;
    }
    const excelButton = event.target.closest('#download-cart-xlsx');
    if (excelButton) {
      downloadCartExcel(excelButton);
      return;
    }
    const calculatorLink = event.target.closest('[data-action="calculators"]');
    if (calculatorLink) {
      openCalculators();
      return;
    }
    const menu = event.target.closest('[data-menu]');
    if (menu) {
      if (event.detail > 0 && matchMedia('(min-width:1101px) and (hover:hover)').matches)
        openMenu(menu.dataset.menu);
      else toggleMenu(menu.dataset.menu);
      return;
    }
    const close = event.target.closest('[data-close-menu]');
    if (close) {
      closeMenu();
      $('#navigation').classList.remove('mobile-open');
      $('#mobile-menu-button').setAttribute('aria-expanded', 'false');
    }
    const service = event.target.closest('[data-service]');
    if (service) {
      openService(service.dataset.service);
      return;
    }
    const add = event.target.closest('[data-add-request]');
    if (add) {
      addRequest(add.dataset.addRequest);
      return;
    }
    const removeSelected = event.target.closest('[data-cart-remove-selected]');
    if (removeSelected) {
      removeCartItems(
        $$('[data-cart-select]:checked', dialog).map((input) => input.dataset.cartSelect),
      );
      return;
    }
    if (event.target.closest('[data-cart-remove-all]')) {
      openCartClearConfirmation();
      return;
    }
    if (event.target.closest('[data-cancel-cart-clear]')) {
      openCart();
      $('[data-clear-cart]', dialog)?.focus();
      return;
    }
    if (event.target.closest('[data-confirm-cart-clear]')) {
      removeCartItems(readCart().map((row) => row.key));
      $('.cart-empty button', dialog)?.focus();
      return;
    }
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      removeCartItems([remove.dataset.remove]);
      return;
    }
    const delivery = event.target.closest('[data-delivery]');
    if (delivery) {
      selectDelivery(delivery.dataset.delivery);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) {
      switch (action.dataset.action) {
        case 'catalog':
          event.preventDefault();
          openCatalog(action.dataset.category || '');
          break;
        case 'search':
          openCatalog('', true);
          break;
        case 'request':
          openRequest(
            action.dataset.record ? catalog.find((r) => r.id === action.dataset.record) : null,
            action.dataset.cart === 'true',
          );
          break;
        case 'upload':
          selectedFile = null;
          openRequest(null, false, true);
          break;
        case 'cart':
          openCart();
          break;
        case 'contacts':
          openContacts();
          break;
        case 'order-guide':
          event.preventDefault();
          openOrderGuide();
          break;
        case 'requirements':
          openRequirements();
          break;
      }
      return;
    }
    if (!event.target.closest('.site-header')) closeMenu();
  });
  $('#mobile-menu-button').addEventListener('click', () => {
    closeMenu();
    const expanded = $('#navigation').classList.toggle('mobile-open');
    $('#mobile-menu-button').setAttribute('aria-expanded', String(expanded));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const mobileOpen = $('#navigation').classList.contains('mobile-open');
      const menuTrigger = $$('.nav-item').find((button) => button.dataset.menu === activeMenu);
      closeMenu();
      $('#navigation').classList.remove('mobile-open');
      $('#mobile-menu-button').setAttribute('aria-expanded', 'false');
      (mobileOpen ? $('#mobile-menu-button') : menuTrigger)?.focus();
    }
    if (
      event.key === '/' &&
      !dialog.open &&
      !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
    ) {
      event.preventDefault();
      openCatalog('', true);
    }
  });
  $('.delivery-tabs')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$('[data-delivery]');
    const index = tabs.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectDelivery(tabs[next].dataset.delivery);
    tabs[next].focus();
  });
  $('#home-search').addEventListener('submit', (event) => {
    event.preventDefault();
    openCatalog('', true, $('#home-search-input').value.trim());
  });
  window.TEXT_CLIENT_CAROUSEL?.mount(document.getElementById('client-logos'));
  window.addEventListener(
    'resize',
    () => {
      if (activeMenu) closeMenu();
    },
    { passive: true },
  );
  const staticSchemaTypes = new Set(
    [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
      try {
        const schema = JSON.parse(script.textContent);
        return [schema, ...(schema['@graph'] || [])].map((entity) => entity['@type']);
      } catch {
        return [];
      }
    }),
  );
  const hasStaticFaq = staticSchemaTypes.has('FAQPage');
  const seoSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      ...(!staticSchemaTypes.has('LocalBusiness')
        ? [
            {
              '@type': 'LocalBusiness',
              name: 'Студия печати ТЕКСТ',
              url: 'https://text-print.ru/',
              telephone: '+79236547896',
              email: 'tekkkst@yandex.ru',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'проспект Строителей, 11',
                addressLocality: 'Барнаул',
                addressCountry: 'RU',
              },
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                  opens: '09:00',
                  closes: '18:00',
                },
              ],
            },
          ]
        : []),
      ...(!hasStaticFaq && $$('.faq-list details').length
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: $$('.faq-list details').map((d) => ({
                '@type': 'Question',
                name: $('summary', d).textContent.trim(),
                acceptedAnswer: { '@type': 'Answer', text: $('p', d).textContent.trim() },
              })),
            },
          ]
        : []),
    ],
  };
  if (seoSchema['@graph'].length) {
    const schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.textContent = JSON.stringify(seoSchema);
    document.head.append(schemaScript);
  }
  window.TEXT_APP = {
    notify: toast,
    openCart,
    prepareServiceRequest({ id, comment, file = null }) {
      const record = catalog.find((r) => r.id === id);
      if (!record) return;
      if (file) {
        const error = window.TEXT_FILES.validate(file);
        if (error) {
          toast(error);
          return;
        }
      }
      openRequest(record, false, false, { comment, file });
    },

    getCart: () => readCart().map((item) => ({ ...item })),
    upsertCalculatedItem(item) {
      cart = readCart();
      const index = cart.findIndex((r) => r.key === item.key);
      if (index < 0) cart.push(item);
      else cart[index] = item;
      saveCart();
    },
  };
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-download-cart-file]');
    if (!button) return;
    const item = cart.find((r) => r.key === button.dataset.downloadCartFile);
    if (!item) return;
    try {
      await window.TEXT_FILES.download(item.key, item.fileName);
    } catch (error) {
      toast(error.message);
    }
  });
  document.addEventListener('change', async (event) => {
    if (event.target.matches('[data-cart-select-all]')) {
      $$('[data-cart-select]', dialog).forEach((box) => (box.checked = event.target.checked));
      updateCartSelection();
      return;
    }
    if (event.target.matches('[data-cart-select]')) {
      updateCartSelection();
      return;
    }
    const input = event.target.closest('[data-cart-file]');
    if (!input || !input.files[0]) return;
    const item = cart.find((r) => r.key === input.dataset.cartFile);
    if (!item) return;
    const file = input.files[0],
      error = window.TEXT_FILES.validate(file);
    if (error) {
      toast(error);
      input.value = '';
      return;
    }
    try {
      await window.TEXT_FILES.save(item.key, file);
      cart = readCart();
      const current = cart.find((r) => r.key === item.key);
      if (!current) {
        await window.TEXT_FILES.remove(item.key);
        return;
      }
      current.fileName = file.name;
      current.fileSize = file.size;
      saveCart();
      openCart();
      toast('Макет прикреплён. Передастся в студию при отправке заказа.');
    } catch {
      toast('Не удалось сохранить макет. Попробуйте ещё раз.');
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'text-print-cart-v1' || event.key === null) {
      cart = readCart();
      updateCartCount();
    }
  });
  window.addEventListener('pageshow', () => {
    cart = readCart();
    updateCartCount();
  });
  renderPopular();
  updateCartCount();
  hydrateIcons();
  const requestedCategory = new URLSearchParams(location.search).get('category');
  const requestedService = new URLSearchParams(location.search).get('service');
  if (requestedService && catalog.some((record) => record.id === requestedService))
    openService(requestedService);
  else if (requestedCategory && categories.some((category) => category.name === requestedCategory))
    openCatalog(requestedCategory);
  else if (new URLSearchParams(location.search).get('catalog') === '1') openCatalog();
})();
