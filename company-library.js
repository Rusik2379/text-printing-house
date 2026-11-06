(() => {
  'use strict';
  const groups = {
    docs: ['1.1', '2.1', '2.2', '2.3', '1.5'],
    poly: ['3.1', '3.2', '3.3', '3.4', '3.5'],
    stick: ['4.1', '4.4', '4.5', '4.6', '4.11'],
    wide: ['5.1', '5.2', '5.4', '5.5'],
    rigid: ['6.1', '6.5', '6.7', '6.8'],
    cut: ['6.2', '6.3', '6.4', '6.6'],
  };
  const registry = {
    ...window.TEXT_COPYCENTER_SERVICES,
    ...window.TEXT_PROJECT_SERVICES,
    ...window.TEXT_LEAFLET_SERVICES,
    ...window.TEXT_STICKER_SERVICES,
    ...window.TEXT_UV_SERVICES,
    ...window.TEXT_WIDE_SERVICES,
  };
  const script = [...document.scripts].find((s) => s.src.includes('company-library.js')),
    root = new URL('.', script.src);
  function choose(button) {
    const output = document.getElementById('selector-results-v6');
    if (!output) return;
    for (const b of document.querySelectorAll('[data-pick]')) {
      const selected = b === button;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    }
    const fragment = document.createDocumentFragment();
    for (const id of groups[button.dataset.pick] || []) {
      const service = registry[id];
      if (!service) continue;
      const a = document.createElement('a'),
        name = document.createElement('b'),
        label = document.createElement('span');
      a.href = new URL(service.path, root).href;
      name.textContent = service.name;
      label.textContent = 'Рассчитать стоимость →';
      a.append(name, label);
      fragment.append(a);
    }
    output.replaceChildren(fragment);
  }
  for (const b of document.querySelectorAll('[data-pick]'))
    b.addEventListener('click', () => choose(b));
  const first =
    document.querySelector('[data-pick].active') || document.querySelector('[data-pick]');
  if (first) choose(first);
  for (const img of document.querySelectorAll('.equipment-photo-stage img')) {
    const fallback = () => {
      const caption = document.createElement('p');
      caption.className = 'muted';
      caption.textContent = img.alt.replace(' — фото оборудования', '');
      img.replaceWith(caption);
    };
    if (img.complete && !img.naturalWidth) fallback();
    else img.addEventListener('error', fallback, { once: true });
  }
})();
