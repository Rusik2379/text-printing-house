/* Search, responsive chrome and printable service checklists. */
(() => {
  'use strict';
  const header = document.querySelector('#header'),
    form = document.querySelector('#home-search'),
    input = document.querySelector('[data-header-search]'),
    results = document.querySelector('#header-search-results'),
    nav = document.querySelector('#navigation'),
    toggle = document.querySelector('[data-header-search-toggle]');
  const root = new URL('.', document.currentScript.src),
    escape = (value) =>
      String(value).replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
  let selected = -1,
    searchGeneration = 0,
    enginePromise;
  const groups = [
    ['Услуга', 'Услуги'],
    ['Статья', 'Статьи'],
    ['Вопросы и ответы', 'Вопросы и ответы'],
    ['Справочник', 'Справочник'],
    ['Информация', 'Информация'],
    ['Населённый пункт', 'Города и сёла'],
  ];
  function loadSearch() {
    if (window.TEXT_SITE_SEARCH) return window.TEXT_SITE_SEARCH.ready();
    if (!enginePromise)
      enginePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('site-search.js?v=156a1b128d3b', root).href;
        script.onload = () => window.TEXT_SITE_SEARCH.ready().then(resolve, reject);
        script.onerror = () => reject(Error('Не удалось загрузить поиск. Повторите запрос.'));
        document.head.append(script);
      }).catch((e) => {
        enginePromise = null;
        throw e;
      });
    return enginePromise;
  }
  function hideSearch() {
    if (!results) return;
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    selected = -1;
  }
  function closeMobileSearch(restoreFocus = false) {
    const wasOpen = header?.classList.contains('search-open');
    header?.classList.remove('search-open');
    toggle?.setAttribute('aria-expanded', 'false');
    hideSearch();
    if (wasOpen && restoreFocus) toggle?.focus();
  }
  async function search() {
    const generation = ++searchGeneration,
      query = input.value.trim();
    selected = -1;
    input.removeAttribute('aria-activedescendant');
    if (!query) {
      hideSearch();
      return;
    }
    results.hidden = false;
    results.innerHTML = '<p role="status">Ищем по сайту…</p>';
    input.setAttribute('aria-expanded', 'true');
    try {
      await loadSearch();
      if (generation !== searchGeneration) return;
      const matches = window.TEXT_SITE_SEARCH.find(query, 100),
        sections = [];
      let count = 0;
      for (const [kind, label] of groups) {
        const found = matches.filter((x) => x.k === kind).slice(0, kind === 'Услуга' ? 3 : 2);
        if (!found.length) continue;
        sections.push(
          `<div class="header-search-group" role="group" aria-label="${label}"><div class="header-search-group-title">${label}</div>${found.map((s) => `<a id="header-result-${count++}" role="option" aria-selected="false" href="${new URL(s.u, root).href}"><span>${escape(s.t)}</span></a>`).join('')}</div>`,
        );
      }
      results.innerHTML =
        (sections.join('') ||
          '<p>Совпадений не найдено. Попробуйте другое слово или уточните запрос.</p>') +
        `<a id="header-result-${count}" role="option" aria-selected="false" class="header-search-all" href="${new URL('poisk/?q=' + encodeURIComponent(query), root).href}">Все результаты поиска →</a>`;
    } catch (error) {
      if (generation === searchGeneration)
        results.innerHTML = '<p role="status">' + escape(error.message) + '</p>';
    }
  }
  if (input && results) {
    input.placeholder = 'Услуга, статья или вопрос';
    input.setAttribute('aria-label', 'Поиск по всему сайту');
    input.addEventListener('input', search);
    input.addEventListener('focus', () => {
      if (input.value) search();
    });
    input.addEventListener('keydown', (event) => {
      const links = [...results.querySelectorAll('a[role="option"]')];
      if (['ArrowDown', 'ArrowUp'].includes(event.key) && links.length) {
        event.preventDefault();
        selected =
          selected < 0
            ? event.key === 'ArrowDown'
              ? 0
              : links.length - 1
            : (selected + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach((n, i) => n.setAttribute('aria-selected', String(i === selected)));
        input.setAttribute('aria-activedescendant', links[selected].id);
        links[selected].scrollIntoView?.({ block: 'nearest' });
      }
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeMobileSearch(true);
      }
      if (event.key === 'Enter' && selected >= 0 && links[selected]) {
        event.preventDefault();
        location.assign(links[selected].href);
      }
    });
    form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const link = selected >= 0 ? results.querySelectorAll('a[role="option"]')[selected] : null;
        location.assign(
          link?.href || new URL('poisk/?q=' + encodeURIComponent(input.value.trim()), root).href,
        );
      },
      true,
    );
    document.addEventListener('click', (event) => {
      if (!form.contains(event.target) && !event.target.closest('[data-header-search-toggle]'))
        closeMobileSearch();
    });
  }
  toggle?.addEventListener('click', () => {
    const open = header.classList.toggle('search-open');
    toggle.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
    else hideSearch();
  });
  document
    .querySelector('[data-header-search-close]')
    ?.addEventListener('click', () => closeMobileSearch(true));
  matchMedia('(max-width:700px)').addEventListener('change', () => closeMobileSearch());
  function syncHeader() {
    if (!header) return;
    header.style.setProperty(
      '--header-bottom',
      Math.max(0, header.getBoundingClientRect().bottom) + 'px',
    );
    const mobile = matchMedia('(max-width:1100px)').matches;
    document.body.classList.toggle(
      'mobile-navigation-open',
      mobile && nav.classList.contains('mobile-open'),
    );
    if (!mobile && nav.classList.contains('mobile-open')) {
      nav.classList.remove('mobile-open');
      document.querySelector('#mobile-menu-button').setAttribute('aria-expanded', 'false');
    }
  }
  new ResizeObserver(syncHeader).observe(header);
  new MutationObserver(syncHeader).observe(nav, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', syncHeader);
  addEventListener('scroll', syncHeader, { passive: true });
  syncHeader();
  for (const link of document.querySelectorAll('.nav-category-link'))
    if (location.pathname.startsWith(new URL(link.href).pathname))
      link.setAttribute('aria-current', 'true');
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target) && nav.classList.contains('mobile-open')) {
      nav.classList.remove('mobile-open');
      document.querySelector('#mobile-menu-button').setAttribute('aria-expanded', 'false');
    }
  });

  const top = document.createElement('button');
  top.type = 'button';
  top.className = 'back-to-top';
  top.title = 'Наверх';
  top.setAttribute('aria-label', 'Вернуться наверх');
  top.setAttribute('aria-hidden', 'true');
  top.tabIndex = -1;
  top.inert = true;
  top.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>';
  document.body.append(top);
  const dialog = document.querySelector('#dialog'),
    cookie = document.querySelector('#cookie-banner');
  const bottomPanels = [
    cookie,
    ...document.querySelectorAll('.mobile-bottom,.sp-mobile-total'),
  ].filter(Boolean);
  function updateTop() {
    const visible = scrollY >= 500 && !dialog?.open && !nav.classList.contains('mobile-open');
    top.classList.toggle('is-visible', visible);
    top.setAttribute('aria-hidden', String(!visible));
    top.tabIndex = visible ? 0 : -1;
    top.inert = !visible;
    let bottom = 24;
    for (const n of bottomPanels) {
      if (!n || n.hidden || getComputedStyle(n).display === 'none') continue;
      const r = n.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight && getComputedStyle(n).position === 'fixed')
        bottom = Math.max(bottom, innerHeight - r.top + 12);
    }
    top.style.bottom = bottom + 'px';
  }
  top.addEventListener('click', () => {
    const main = document.querySelector('#main');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth',
    });
  });
  addEventListener('scroll', updateTop, { passive: true });
  addEventListener('resize', updateTop);
  addEventListener('pageshow', updateTop);
  const observer = new MutationObserver(updateTop);
  for (const node of [dialog, nav, ...bottomPanels])
    if (node)
      observer.observe(node, { attributes: true, attributeFilter: ['open', 'hidden', 'class'] });
  const bottomResize = new ResizeObserver(updateTop);
  for (const panel of bottomPanels) bottomResize.observe(panel);
  updateTop();

  let printTrigger = null;
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-print-requirements]');
    if (!button) return;
    printTrigger = button;
    document.body.classList.add('is-printing-requirements');
    window.print();
  });
  addEventListener('afterprint', () => {
    document.body.classList.remove('is-printing-requirements');
    printTrigger?.focus({ preventScroll: true });
    printTrigger = null;
  });
})();

/* Main banner artwork: float in view and follow the pointer with a small tilt. */
(() => {
  'use strict';
  const images = [
    ...document.querySelectorAll(
      '#main .hero-art>img,#main .cc-hero .cc-art>img,#main .project-visual-art>img,#main .sp-hero-art>img,#main .company-hero .company-art>img',
    ),
  ];
  const panels = [...document.querySelectorAll('.requirements-hero-animation')];
  if (!images.length && !panels.length) return;
  const reduced = matchMedia('(prefers-reduced-motion:reduce)'),
    fine = matchMedia('(hover:hover) and (pointer:fine)'),
    resets = [];
  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries)
              entry.target.classList.toggle('hero-motion-active', entry.isIntersecting);
          },
          { threshold: 0 },
        )
      : null;
  for (const image of images) {
    const base = getComputedStyle(image).transform;
    image.style.setProperty(
      '--hero-base-transform',
      base === 'none' || !base ? 'translateZ(0)' : base,
    );
    image.classList.add('hero-motion-image');
    if (observer) observer.observe(image);
    else image.classList.add('hero-motion-active');
    const area = image.parentElement;
    let frame = 0,
      clientX = 0,
      clientY = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      image.style.setProperty('--hero-tilt-x', '0deg');
      image.style.setProperty('--hero-tilt-y', '0deg');
    };
    resets.push(reset);
    area.addEventListener(
      'pointermove',
      (event) => {
        if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
        clientX = event.clientX;
        clientY = event.clientY;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const rect = area.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const x = Math.max(-0.5, Math.min(0.5, (clientX - rect.left) / rect.width - 0.5)),
            y = Math.max(-0.5, Math.min(0.5, (clientY - rect.top) / rect.height - 0.5));
          image.style.setProperty('--hero-tilt-x', (-y * 5).toFixed(2) + 'deg');
          image.style.setProperty('--hero-tilt-y', (x * 6).toFixed(2) + 'deg');
        });
      },
      { passive: true },
    );
    area.addEventListener('pointerleave', reset);
    area.addEventListener('pointercancel', reset);
  }
  for (const panel of panels) {
    if (observer) observer.observe(panel);
    else panel.classList.add('hero-motion-active');
  }
  const resetAll = () => resets.forEach((reset) => reset());
  reduced.addEventListener('change', resetAll);
  fine.addEventListener('change', resetAll);
  const syncVisibility = () => {
    document.documentElement.classList.toggle('hero-motion-paused', document.hidden);
    if (document.hidden) resetAll();
  };
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
})();
