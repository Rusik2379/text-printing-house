/* Shared studio icons: quiet controls and paper, metal and red accents for content. */
(() => {
  'use strict';
  const red = '#ed1622',
    paper = '#fafbfc',
    side = '#dfe4e8',
    ink = '#343c43',
    pink = '#ffe5e9';
  const shadow =
    '<ellipse cx="12" cy="21" rx="8" ry="1.3" fill="#24313c" opacity=".1" stroke="none"/>';
  const illustrated = {
    document: `${shadow}<path d="M5 4h12v17H5z" fill="${side}" stroke="none"/><path d="M7 2h8l4 4v14H7z" fill="${paper}"/><path d="M15 2v5h4" fill="${side}"/><path d="M10 10h6M10 13h6M13 16h3"/><rect x="10" y="15" width="2" height="3" rx=".5" fill="${red}" stroke="none"/>`,
    layers: `${shadow}<path d="m3 16 9 5 9-5-9-5z" fill="${side}"/><path d="m3 12 9 5 9-5-9-5z" fill="${paper}"/><path d="m3 8 9 5 9-5-9-5z" fill="${paper}"/><ellipse cx="12" cy="8" rx="4" ry="2.1" fill="${red}" stroke="none"/>`,
    printer: `${shadow}<path d="M6 3h12v7H6z" fill="${paper}"/><rect x="3" y="8" width="18" height="10" rx="2" fill="${side}"/><path d="M6 8h12" stroke="${red}" stroke-width="2"/><path d="M7 14h10v7H7z" fill="${paper}"/><path d="M10 17h4M10 19h4"/><circle cx="18" cy="11" r=".9" fill="${red}" stroke="none"/>`,
    shield: `${shadow}<path d="m12 2 8 3v6c0 5-8 10-8 10S4 16 4 11V5z" fill="${side}" stroke="none"/><path d="m12 2 7 3v6c0 4-7 9-7 9s-7-5-7-9V5z" fill="${paper}"/><path d="m8 11 3 3 5-6" stroke="${red}" stroke-width="2"/>`,
    calculator: `${shadow}<rect x="5" y="2" width="14" height="19" rx="2" fill="${paper}"/><rect x="8" y="5" width="8" height="3" rx=".6" fill="${pink}" stroke="${red}"/><path d="M8 11h2M14 11h2M8 14h2M14 14h2M8 17h2"/><rect x="13" y="16" width="4" height="3" rx=".6" fill="${red}" stroke="none"/>`,
    target: `${shadow}<circle cx="11" cy="12" r="8" fill="${paper}"/><circle cx="11" cy="12" r="5" fill="${pink}" stroke="${red}"/><circle cx="11" cy="12" r="2" fill="${red}" stroke="none"/><path d="m11 12 9-9M17 3h3v3"/>`,
    heart: `${shadow}<path d="M20 5a5 5 0 0 0-7 0l-1 1-1-1a5 5 0 0 0-7 7l8 8 8-8a5 5 0 0 0 0-7z" fill="${pink}" stroke="${red}"/><path d="M6 8a2 2 0 0 1 3-1" stroke="#fff" stroke-width="2"/>`,
    zap: `${shadow}<path d="m13 2-9 12h7l-1 8L20 9h-8z" fill="${red}" stroke="none"/><path d="m13 5-6 8h5" stroke="#fff" opacity=".65"/>`,
    gear: `${shadow}<path d="m9 3 1-2h4l1 2 3 2 2 1v4l-1 2 1 3v3l-3 1-2 2h-4l-2-2-3-1v-3l1-3-1-2V6l2-1z" fill="${side}"/><circle cx="12" cy="11" r="4" fill="${paper}"/><circle cx="12" cy="11" r="2" fill="${red}" stroke="none"/>`,
    palette: `${shadow}<path d="M21 12a9 9 0 1 0-9 9h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a3 3 0 0 0 3-1z" fill="${paper}"/><circle cx="7" cy="8" r="1.4" fill="${red}" stroke="none"/><circle cx="12" cy="5" r="1.4" fill="${pink}" stroke="none"/><circle cx="17" cy="8" r="1.4" fill="${ink}" stroke="none"/><circle cx="6" cy="13" r="1.4" fill="${side}" stroke="none"/>`,
    truck: `${shadow}<path d="M2 5h12v12H2z" fill="${paper}"/><path d="M14 9h5l3 5v3h-8z" fill="${red}" stroke="none"/><path d="M16 10h2l2 3h-4z" fill="${paper}" stroke="none"/><path d="M5 8h6M5 11h6" stroke="${red}"/><circle cx="6" cy="18" r="2" fill="${ink}" stroke="none"/><circle cx="18" cy="18" r="2" fill="${ink}" stroke="none"/>`,
    sticker: `${shadow}<path d="M20 13V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h6z" fill="${paper}"/><path d="M13 20v-4a3 3 0 0 1 3-3h4" fill="${pink}" stroke="${red}"/><path d="M7 8h7M7 11h4"/>`,
    wide: `${shadow}<path d="M4 3v17M20 3v17M2 21h4M18 21h4"/><path d="M5 5h14v12H5z" fill="${paper}"/><path d="M5 6c5 0 7 6 14 1v5c-6 4-9-2-14 3z" fill="${red}" stroke="none"/>`,
    scissors: `${shadow}<path d="m8 8 12 12M8 16 20 4" stroke-width="2"/><circle cx="6" cy="6" r="3" fill="${pink}" stroke="${red}"/><circle cx="6" cy="18" r="3" fill="${pink}" stroke="${red}"/><circle cx="12" cy="12" r="1" fill="${side}" stroke="none"/>`,
    bag: `${shadow}<path d="M5 7h14l2 14H3z" fill="${pink}" stroke="${red}"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="m9 14 2 2 4-4" stroke="${red}"/>`,
  };
  const controls = {
    arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
    'arrow-up': '<path d="M12 20V4m-6 6 6-6 6 6"/>',
    chevron: '<path d="m7 9 5 5 5-5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    menu: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M15 8V4H4v11h4"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    cart: '<path d="M3 4h3l3 12h10l2-9H7"/><circle cx="10" cy="20" r="1" fill="currentColor"/><circle cx="18" cy="20" r="1" fill="currentColor"/>',
    phone:
      '<path d="M5 3h3l2 5-3 2c2 4 4 6 8 7l2-3 4 2v4c0 2-3 2-5 1C8 19 5 16 3 9 2 6 3 3 5 3z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2.4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    message: '<path d="M21 11a9 9 0 0 1-13 8l-5 2 1-5a9 9 0 1 1 17-5z"/><path d="M8 10h8M8 14h5"/>',
    send: '<path d="m21 3-6 18-4-8-8-4zM11 13 21 3"/>',
    trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7" r=".8" fill="currentColor" stroke="none"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
    play: '<path d="m8 4 12 8-12 8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
  };
  const names = Object.freeze([...Object.keys(illustrated), ...Object.keys(controls)]);
  function render(request) {
    const name = names.includes(request) ? request : 'document',
      art = illustrated[name];
    return `<svg class="icon${art ? ' icon--illustrated' : ''}" data-text-icon="${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="${art ? ink : 'currentColor'}" stroke-width="${art ? 1.25 : 1.75}" stroke-linecap="round" stroke-linejoin="round">${art || controls[name]}</g></svg>`;
  }
  function svg(name) {
    const span = document.createElement('span');
    span.innerHTML = render(name);
    return span.firstElementChild;
  }
  function hydrate(root = document) {
    const placeholders = root.matches?.('[data-icon]') ? [root] : [];
    placeholders.push(...(root.querySelectorAll?.('[data-icon]') || []));
    for (const el of placeholders) el.replaceWith(svg(el.dataset.icon));
    const old = root.matches?.('svg.icon:not([data-text-icon])') ? [root] : [];
    old.push(...(root.querySelectorAll?.('svg.icon:not([data-text-icon])') || []));
    for (const el of old) {
      const d = el.querySelector('path')?.getAttribute('d'),
        name =
          d === 'M2 3h3l3 13h11l3-10H6'
            ? 'cart'
            : d === 'M12 19V5m-6 6 6-6 6 6'
              ? 'arrow-up'
              : null;
      if (!name) continue;
      const next = svg(name);
      for (const c of el.classList) next.classList.add(c);
      el.replaceWith(next);
    }
  }
  window.TEXT_ICONS = { render, hydrate, names };
  hydrate();
  new MutationObserver((records) => {
    for (const r of records)
      for (const node of r.addedNodes) if (node.nodeType === 1) hydrate(node);
  }).observe(document.body, { subtree: true, childList: true });
})();
