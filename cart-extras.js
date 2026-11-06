/* Cart delivery and designer controls share the header's location state. */
(() => {
  'use strict';
  const esc = (v) =>
    String(v || '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const money = (v) => new Intl.NumberFormat('ru-RU').format(v) + ' ₽';
  const DESIGN = [
    { id: 'design-press', name: 'Предпечатная подготовка', price: 500 },
    { id: 'design-basic', name: 'Базовый дизайн', price: 750 },
    { id: 'design-both', name: 'Подготовка и дизайн', price: 1000 },
  ];
  const CARRIERS = [
    { id: 'ozon', name: 'Ozon' },
    { id: 'cdek', name: 'СДЭК', logo: 'carrier-cdek.svg' },
    { id: 'pek', name: 'ПЭК', logo: 'carrier-pek.svg' },
    { id: 'dellin', name: 'Деловые Линии', logo: 'carrier-delovye-linii.png' },
    { id: 'energy', name: 'Энергия', logo: 'carrier-energia.svg' },
    { id: 'other', name: 'Помогите выбрать' },
  ];
  function render({ productTotal, designId, siteRoot }) {
    const state = window.TEXT_GEO?.get() || {},
      mode = state.fulfillment || 'pickup',
      carrier = CARRIERS.some((x) => x.id === state.carrier) ? state.carrier : 'ozon';
    return `<section class="cart-designer" aria-labelledby="cart-designer-title"><div class="cart-section-heading"><h3 id="cart-designer-title">Нужна помощь с макетом?</h3><span>Одна услуга на заказ</span></div><div class="cart-designer-options">${[{ id: '', name: 'Готовый макет', price: 0 }, ...DESIGN].map((x) => `<label><input type="radio" name="designer" data-design-choice="${x.id}" ${x.id === designId ? 'checked' : ''}><span>${x.name}<strong>${x.price ? money(x.price) : 'Без доплаты'}</strong></span></label>`).join('')}</div></section>
  <section class="cart-fulfillment" aria-labelledby="cart-fulfillment-title"><div class="cart-section-heading"><h3 id="cart-fulfillment-title">Как получить заказ?</h3><a href="${siteRoot}dostavka-i-oplata/">Условия доставки</a></div><div class="cart-fulfillment-choice"><label><input type="radio" name="fulfillment" value="pickup" ${mode === 'pickup' ? 'checked' : ''}><span><strong>Самовывоз</strong><small>Барнаул, пр. Строителей, 11</small></span></label><label><input type="radio" name="fulfillment" value="delivery" ${mode === 'delivery' ? 'checked' : ''}><span><strong>Доставка по России</strong><small>Перевозка оплачивается отдельно</small></span></label></div>
  <div class="cart-shipping-fields" ${mode !== 'delivery' ? 'hidden' : ''}><div class="cart-delivery-minimum" role="status">${productTotal >= 3000 ? 'Заказ подходит для отправки' : `До суммы продукции для отправки осталось <strong>${money(Math.max(0, 3000 - productTotal))}</strong>`}<small>Отправка продукции от 3 000 ₽. ${productTotal >= 3000 ? 'Стоимость перевозки подтвердит менеджер.' : 'Услуги дизайнера в эту сумму не входят.'}</small></div><div class="geo-search-field"><label class="geo-label" for="cart-delivery-town">Город, село или посёлок</label><input class="geo-input" id="cart-delivery-town" type="search" autocomplete="off" placeholder="Начните вводить название" value="${esc(state.residence?.name)}"><div class="geo-results" id="cart-town-results" hidden></div><p class="geo-status" id="cart-town-status" role="status">${esc(state.residence ? window.TEXT_GEO.context(state.residence) : 'Выберите населённый пункт из подсказок.')}</p></div>
  <fieldset class="cart-carriers"><legend>Перевозчик</legend><div class="cart-carrier-options">${CARRIERS.map((x) => `<label><input class="sr-only" type="radio" name="carrier" value="${x.id}" ${carrier === x.id ? 'checked' : ''}><span class="cart-carrier-logo" aria-hidden="true">${x.logo ? `<img src="${siteRoot}assets/${x.logo}" alt="" width="72" height="26">` : x.id === 'ozon' ? '<span class="delivery-ozon-wordmark">ozon</span>' : '<span data-icon="truck"></span>'}</span><span>${x.name}</span></label>`).join('')}</div></fieldset>
  <label class="field cart-pvz-field">Предпочтительный адрес ПВЗ <span class="field-optional">необязательно</span><input id="cart-pvz-address" maxlength="240" value="${esc(state.pvzAddress)}" placeholder="Если уже выбрали пункт, укажите адрес"></label><div class="cart-pickup-info" role="status" aria-live="polite"><span class="delivery-ozon-wordmark" aria-label="Ozon">ozon</span><div><span class="cart-pickup-caption">Место получения</span><strong data-pickup-town></strong><small data-pickup-context></small><p data-pickup-preference hidden><span class="cart-pickup-caption">Предпочтительный ПВЗ</span><span data-pickup-address></span></p><a class="cart-pickup-map-link" data-ozon-map href="https://www.ozon.ru/geo/" target="_blank" rel="noopener noreferrer">Открыть карту ПВЗ Ozon <span aria-hidden="true">↗</span></a><small class="cart-pickup-hint">На карте Ozon найдите свой населённый пункт и выберите удобный ПВЗ.</small></div></div><label class="field cart-other-address" hidden>Адрес или терминал получения <span class="field-optional">необязательно</span><input id="cart-delivery-address" maxlength="400" value="${esc(state.deliveryAddress)}" placeholder="Укажите адрес, если уже выбрали способ получения"></label><p class="cart-shipping-note">Проверим доступность перевозки, стоимость и срок до изготовления заказа.</p></div><p class="cart-shipping-error" role="alert" hidden></p></section>`;
  }
  function mount(panel) {
    const geo = window.TEXT_GEO;
    if (!geo) return;
    const fields = panel.querySelector('.cart-shipping-fields'),
      input = panel.querySelector('#cart-delivery-town'),
      status = panel.querySelector('#cart-town-status'),
      list = panel.querySelector('#cart-town-results'),
      error = panel.querySelector('.cart-shipping-error');
    let chosen = geo.get().residence,
      typed = false;
    geo.createSearch({
      input,
      list,
      status,
      onSelect: () => {
        chosen = geo.get().residence;
        typed = false;
        error.hidden = true;
        sync();
      },
    });
    input.addEventListener('input', () => {
      typed = true;
      error.hidden = true;
      sync();
    });
    const mode = () => panel.querySelector('[name="fulfillment"]:checked')?.value || 'pickup';
    const carrier = () => panel.querySelector('[name="carrier"]:checked')?.value || 'ozon';
    function sync() {
      fields.hidden = mode() !== 'delivery';
      const ozon = carrier() === 'ozon';
      panel.querySelector('.cart-pvz-field').hidden = !ozon;
      panel.querySelector('.cart-pickup-info').hidden = !ozon;
      panel.querySelector('.cart-other-address').hidden = ozon || carrier() === 'other';
      const state = geo.get();
      panel.querySelector('#cart-pvz-address').value = state.pvzAddress || '';
      const place = typed ? null : state.residence;
      panel.querySelector('[data-pickup-town]').textContent =
        place?.name || 'Выберите населённый пункт выше';
      panel.querySelector('[data-pickup-context]').textContent = place ? geo.context(place) : '';
      panel.querySelector('[data-pickup-preference]').hidden = !state.pvzAddress;
      panel.querySelector('[data-pickup-address]').textContent = state.pvzAddress || '';
      geo.updateOzonLinks?.(panel, place);
    }
    panel.querySelectorAll('[name="fulfillment"]').forEach((r) =>
      r.addEventListener('change', () => {
        if (mode() === 'delivery') {
          panel.querySelector('[name="carrier"][value="ozon"]').checked = true;
          geo.save({ fulfillment: 'delivery', carrier: 'ozon' });
        } else geo.save({ fulfillment: 'pickup' });
        error.hidden = true;
        sync();
      }),
    );
    panel.querySelectorAll('[name="carrier"]').forEach((radio) =>
      radio.addEventListener('change', () => {
        geo.save({ carrier: carrier() });
        sync();
      }),
    );
    panel
      .querySelector('#cart-pvz-address')
      .addEventListener('input', (e) => geo.save({ pvzAddress: e.target.value.trim() }));
    panel
      .querySelector('#cart-delivery-address')
      .addEventListener('input', (e) => geo.save({ deliveryAddress: e.target.value.trim() }));
    if (!geo.get().fulfillment || !CARRIERS.some((x) => x.id === geo.get().carrier))
      geo.save({ fulfillment: mode(), carrier: carrier() });
    const changed = () => {
      if (!panel.isConnected) {
        window.removeEventListener('tekst:delivery-change', changed);
        return;
      }
      const place = geo.get().residence;
      if (place?.oktmo !== chosen?.oktmo) {
        chosen = place;
        typed = false;
        input.value = place?.name || '';
        status.textContent = place ? geo.context(place) : 'Выберите населённый пункт из подсказок.';
      }
      sync();
    };
    window.addEventListener('tekst:delivery-change', changed);
    panel.validateDelivery = () => {
      if (mode() === 'pickup') return true;
      if (!chosen || typed) {
        error.textContent = 'Выберите точный населённый пункт из списка — с районом и регионом.';
        error.hidden = false;
        input.focus();
        return false;
      }
      return true;
    };
    sync();
  }
  function summary() {
    const s = window.TEXT_GEO?.get() || {};
    if (s.fulfillment !== 'delivery')
      return 'Получение: самовывоз — Барнаул, проспект Строителей, 11.';
    const names = {
      ozon: 'Ozon',
      cdek: 'СДЭК',
      pek: 'ПЭК',
      dellin: 'Деловые Линии',
      energy: 'Энергия',
      other: 'подобрать со студией',
    };
    return [
      'Получение: доставка по России.',
      s.residence
        ? 'Населённый пункт: ' +
          [s.residence.name, s.residence.district, s.residence.region].filter(Boolean).join(', ')
        : 'Населённый пункт: уточнить.',
      'Перевозчик: ' + (names[s.carrier || 'ozon'] || 'согласовать'),
      s.carrier === 'ozon' || !s.carrier
        ? s.pvzAddress
          ? 'Адрес ПВЗ: ' + s.pvzAddress
          : 'Адрес ПВЗ: согласовать.'
        : s.deliveryAddress
          ? 'Адрес получения: ' + s.deliveryAddress
          : 'Адрес получения: согласовать.',
      'Стоимость и срок перевозки согласуются отдельно.',
    ].join('\n');
  }
  window.TEXT_CART_EXTRAS = { render, mount, summary };
})();
