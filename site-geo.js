/* Shared delivery location. Coordinates are matched locally against the supplied directory. */
(() => {
  'use strict';
  if (window.TEXT_GEO) return;
  const root = new URL('.', document.currentScript.src);
  const key = 'text-print-delivery-v1';
  const changeEvent = 'tekst:delivery-change';
  const clean = (value, length = 200) =>
    typeof value === 'string' ? value.trim().slice(0, length) : '';
  const normalize = (value) =>
    clean(value).toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
  const placeName = (value) =>
    normalize(value).replace(
      /^(?:г\.?|город|село|деревня|поселок|пос\.?|пгт|рп\.?|станица|хутор|д\.)\s+/,
      '',
    );
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const icon = (name) => {
    if (window.TEXT_ICONS?.render) {
      const wrapper = make('span');
      wrapper.innerHTML = window.TEXT_ICONS.render(name);
      return wrapper.firstElementChild;
    }
    return make('span', 'geo-icon-fallback', name === 'close' ? '×' : '⌖');
  };
  function sanitizePlace(value) {
    if (!value || typeof value !== 'object' || !clean(value.name) || !clean(value.region))
      return null;
    return {
      name: clean(value.name),
      region: clean(value.region),
      district: clean(value.district),
      oktmo: clean(value.oktmo || value.id, 80),
    };
  }
  let memory = {};
  function get() {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const value = JSON.parse(raw);
        if (value && typeof value === 'object' && !Array.isArray(value)) memory = value;
      }
    } catch {
      // Keep the current tab usable when storage is unavailable.
    }
    return { ...memory, residence: sanitizePlace(memory.residence) };
  }
  const identity = (place) =>
    place ? [place.oktmo, placeName(place.name), place.region, place.district].join('|') : '';
  function save(patch) {
    const previous = get();
    const next = { ...previous, ...patch, updatedAt: Date.now() };
    next.residence = sanitizePlace(next.residence);
    if (identity(previous.residence) !== identity(next.residence)) {
      next.pickup = null;
      next.pvzAddress = '';
      next.deliveryAddress = '';
    }
    memory = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The in-memory choice still works for this page.
    }
    window.dispatchEvent(new CustomEvent(changeEvent, { detail: { previous, state: get() } }));
    return get();
  }
  function choose(place, source = 'manual') {
    const residence = sanitizePlace(place);
    if (!residence) throw Error('Выберите населённый пункт из списка.');
    return save({ residence, geoSource: source });
  }
  let datasetPromise;
  let names;
  function load() {
    if (datasetPromise) return datasetPromise;
    datasetPromise = new Promise((resolve, reject) => {
      const finish = () => {
        const data = window.TEKST_GEODATA;
        if (!Array.isArray(data?.rows) || !Array.isArray(data?.regions)) {
          reject(Error('Справочник недоступен. Попробуйте ещё раз.'));
          return;
        }
        names = data.rows.map((row) => placeName(row[0]));
        resolve(data);
      };
      if (window.TEKST_GEODATA) return finish();
      const script = document.createElement('script');
      script.src = new URL('delivery-settlements.js', root).href;
      script.async = true;
      script.dataset.geoDirectory = '';
      script.onload = finish;
      script.onerror = () => {
        script.remove();
        reject(Error('Не удалось загрузить справочник. Проверьте соединение и повторите поиск.'));
      };
      document.head.append(script);
    }).catch((error) => {
      datasetPromise = undefined;
      throw error;
    });
    return datasetPromise;
  }
  const fromRow = (row, data) => ({
    name: row[0],
    region: data.regions[row[1]] || '',
    district: row[2] >= 0 ? data.districts[row[2]] || '' : '',
    oktmo: row[7] || '',
  });
  const context = (place) => [place.district, place.region].filter(Boolean).join(' · ');
  // Keep pickup links on Ozon; its public map lets the visitor find the address.
  function ozonMap(place = get().residence) {
    if (place && (placeName(place.name) === 'барнаул' || placeName(place.district) === 'барнаул'))
      return { url: 'https://www.ozon.ru/geo/barnaul/', provider: 'Ozon', town: 'Барнаул' };
    return {
      url: 'https://www.ozon.ru/geo/',
      provider: 'Ozon',
      town: place?.name || '',
    };
  }
  function updateOzonLinks(scope = document, place = get().residence) {
    const map = ozonMap(place);
    for (const link of scope.querySelectorAll('[data-ozon-map]')) {
      link.href = map.url;
      link.title = 'Открыть карту пунктов выдачи Ozon';
      const label = link.querySelector('[data-ozon-place]');
      if (label)
        label.textContent = map.town
          ? 'Место получения: ' + map.town
          : 'Выберите пункт на карте Ozon';
    }
  }
  async function search(value, limit = 12) {
    const query = placeName(value);
    if (query.length < 2) return [];
    const data = await load();
    const words = query.split(/[\s,]+/).filter(Boolean);
    const matches = [];
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const name = names[i];
      let score = name === query ? 4 : name.startsWith(query) ? 3 : name.includes(query) ? 2 : 0;
      if (!score && words.length > 1) {
        const full = name + ' ' + normalize(context(fromRow(row, data)));
        if (words.every((word) => full.includes(word))) score = 1;
      }
      if (!score) continue;
      const candidate = { row, score, population: Number(row[3]) || 0 };
      const position = matches.findIndex(
        (other) =>
          score > other.score || (score === other.score && candidate.population > other.population),
      );
      if (position < 0) {
        if (matches.length < limit) matches.push(candidate);
      } else matches.splice(position, 0, candidate);
      if (matches.length > limit) matches.pop();
    }
    return matches.map(({ row }) => fromRow(row, data));
  }
  const radians = (value) => (value * Math.PI) / 180;
  function distance(latitude, longitude, row) {
    const a =
      Math.sin(radians(row[4] - latitude) / 2) ** 2 +
      Math.cos(radians(latitude)) *
        Math.cos(radians(row[4])) *
        Math.sin(radians(row[5] - longitude) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  async function nearby(place) {
    const data = await load();
    const reference = data.rows.find((row) => identity(fromRow(row, data)) === identity(place));
    if (!reference) return [];
    return data.rows
      .filter(
        (row) =>
          row !== reference &&
          row[3] >= 1000 &&
          Math.abs(row[4] - reference[4]) < 1 &&
          Math.abs(row[5] - reference[5]) < 2,
      )
      .map((row) => ({
        ...fromRow(row, data),
        distance: distance(reference[4], reference[5], row),
      }))
      .filter((place) => place.distance <= 100)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
  }
  async function detect() {
    if (!window.isSecureContext || !navigator.geolocation)
      throw Error('Определение местоположения недоступно. Выберите город вручную.');
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          reject(
            Error(
              error.code === 1
                ? 'Доступ к местоположению не предоставлен. Введите город или село вручную.'
                : 'Не удалось определить местоположение. Введите город или село вручную.',
            ),
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      );
    });
    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || accuracy > 20000)
      throw Error('Местоположение определено неточно. Выберите населённый пункт вручную.');
    const data = await load();
    let nearest = null;
    let best = 25;
    for (const row of data.rows) {
      if (
        !Number.isFinite(row[4]) ||
        !Number.isFinite(row[5]) ||
        Math.abs(row[4] - latitude) > 0.3 ||
        Math.abs(row[5] - longitude) > 1
      )
        continue;
      const km = distance(latitude, longitude, row);
      if (km < best) {
        best = km;
        nearest = row;
      }
    }
    if (!nearest)
      throw Error('Рядом не найден населённый пункт из справочника. Введите название вручную.');
    return { place: fromRow(nearest, data), distance: best, accuracy };
  }
  let controllerCount = 0;
  function createSearch({ input, list, status, onSelect }) {
    let timer;
    let generation = 0;
    let active = -1;
    let choices = [];
    const prefix = 'geo-option-' + ++controllerCount + '-';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-expanded', 'false');
    list.setAttribute('role', 'listbox');
    function hide() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function select(place) {
      ++generation;
      clearTimeout(timer);
      choose(place);
      input.value = place.name;
      hide();
      status.textContent = context(place);
      onSelect?.(place);
    }
    async function suggest() {
      const request = ++generation;
      if (placeName(input.value).length < 2) {
        hide();
        status.textContent = 'Введите минимум две буквы названия.';
        return;
      }
      status.textContent = 'Ищем в справочнике…';
      try {
        const found = await search(input.value);
        if (request !== generation) return;
        choices = found;
        active = -1;
        list.replaceChildren();
        for (const [index, place] of found.entries()) {
          const button = make('button', 'geo-result');
          button.type = 'button';
          button.id = prefix + index;
          button.setAttribute('role', 'option');
          button.setAttribute('aria-selected', 'false');
          button.tabIndex = -1;
          button.append(make('strong', '', place.name), make('small', '', context(place)));
          button.addEventListener('pointerdown', (event) => event.preventDefault());
          button.addEventListener('click', () => select(place));
          list.append(button);
        }
        list.hidden = !found.length;
        input.setAttribute('aria-expanded', String(Boolean(found.length)));
        status.textContent = found.length
          ? 'Выберите вариант с нужным районом и регионом.'
          : 'Ничего не найдено. Попробуйте другое название или добавьте регион.';
      } catch (error) {
        if (request !== generation) return;
        hide();
        status.textContent = error.message;
      }
    }
    input.addEventListener('input', () => {
      ++generation;
      clearTimeout(timer);
      hide();
      timer = setTimeout(suggest, 160);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        ++generation;
        clearTimeout(timer);
        hide();
        return;
      }
      if (list.hidden || !choices.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        active =
          active < 0
            ? event.key === 'ArrowDown'
              ? 0
              : choices.length - 1
            : (active + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
        [...list.children].forEach((item, index) =>
          item.setAttribute('aria-selected', String(index === active)),
        );
        input.setAttribute('aria-activedescendant', list.children[active].id);
        list.children[active].scrollIntoView?.({ block: 'nearest' });
      } else if (event.key === 'Enter' && active >= 0) {
        event.preventDefault();
        select(choices[active]);
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (event.target !== input && !list.contains(event.target)) hide();
    });
    return {
      hide,
      select,
      suggest,
      cancel() {
        ++generation;
        clearTimeout(timer);
        hide();
      },
    };
  }
  let modal;
  let modalInput;
  let modalStatus;
  let modalCandidate;
  let modalSearch;
  let opener;
  let modalRequest = 0;
  function candidate(container, detected, onChoose, onOther) {
    container.replaceChildren();
    container.hidden = false;
    container.append(
      make('span', 'geo-candidate-caption', 'Верно определили ваше местоположение?'),
      make('strong', '', detected.place.name),
      make('small', '', context(detected.place)),
    );
    const actions = make('div', 'geo-candidate-actions');
    const button = make('button', 'button button-primary', 'Да, всё верно');
    button.type = 'button';
    button.addEventListener('click', () => {
      choose(detected.place, 'geolocation');
      onChoose?.(detected.place);
    });
    const other = make('button', 'button button-outline', 'Выбрать другой');
    other.type = 'button';
    other.addEventListener('click', () => {
      container.hidden = true;
      if (onOther) onOther();
      else modalInput?.focus();
    });
    actions.append(button, other);
    container.append(actions);
  }
  function closeDialog() {
    modalRequest++;
    modalSearch?.cancel();
    modal?.close();
  }
  function createDialog() {
    modal = make('dialog', 'geo-dialog');
    modal.id = 'geo-dialog';
    modal.setAttribute('aria-labelledby', 'geo-dialog-title');
    const header = make('div', 'geo-dialog-header');
    const title = make('h2', '', 'Куда доставить заказ?');
    title.id = 'geo-dialog-title';
    const close = make('button', 'geo-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть выбор города');
    close.append(icon('close'));
    close.addEventListener('click', closeDialog);
    header.append(title, close);
    const intro = make(
      'p',
      'geo-intro',
      'Выберите город, село или посёлок. Производство находится в Барнауле.',
    );
    const detectButton = make('button', 'geo-detect');
    detectButton.type = 'button';
    detectButton.append(icon('pin'), make('span', '', 'Определить автоматически'));
    const label = make('label', 'geo-label', 'Населённый пункт');
    label.htmlFor = 'geo-town-search';
    modalInput = make('input', 'geo-input');
    modalInput.id = 'geo-town-search';
    modalInput.type = 'search';
    modalInput.autocomplete = 'off';
    modalInput.placeholder = 'Например, Барнаул или Калистратиха';
    const list = make('div', 'geo-results');
    list.id = 'geo-town-results';
    list.hidden = true;
    modalStatus = make('p', 'geo-status');
    modalStatus.setAttribute('role', 'status');
    modalCandidate = make('div', 'geo-candidate');
    modalCandidate.hidden = true;
    modalSearch = createSearch({
      input: modalInput,
      list,
      status: modalStatus,
      onSelect: closeDialog,
    });
    const field = make('div', 'geo-search-field');
    field.append(label, modalInput, list);
    const popular = make('div', 'geo-popular');
    for (const name of ['Барнаул', 'Бийск', 'Новосибирск', 'Москва', 'Санкт-Петербург']) {
      const button = make('button', '', name);
      button.type = 'button';
      button.addEventListener('click', async () => {
        modalInput.value = name;
        modalCandidate.hidden = true;
        modalInput.focus();
        await modalSearch.suggest();
      });
      popular.append(button);
    }
    const footer = make('a', 'geo-delivery-link', 'Условия доставки по России');
    footer.href = new URL('dostavka-i-oplata/', root).href;
    const cities = make('a', 'geo-delivery-link', 'Все города и регионы');
    cities.href = new URL('cities/', root).href;
    const footerLinks = make('div', 'geo-footer-links');
    footerLinks.append(footer, cities);
    modal.append(
      header,
      intro,
      detectButton,
      field,
      modalStatus,
      modalCandidate,
      popular,
      footerLinks,
    );
    document.body.append(modal);
    modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      const box = modal.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        closeDialog();
    });
    modal.addEventListener('close', () => {
      document.body.classList.remove('geo-modal-open');
      refreshHeader();
      modalSearch.cancel();
      opener?.focus();
    });
    detectButton.addEventListener('click', async () => {
      const request = ++modalRequest;
      modalSearch.cancel();
      detectButton.disabled = true;
      detectButton.setAttribute('aria-busy', 'true');
      detectButton.querySelector('span').textContent = 'Определяем город…';
      modalStatus.textContent = 'Запрашиваем местоположение у браузера…';
      modalCandidate.hidden = true;
      try {
        const detected = await detect();
        if (request !== modalRequest || !modal.open) return;
        candidate(modalCandidate, detected, closeDialog);
        modalStatus.textContent =
          'Проверьте найденный населённый пункт или введите другой вручную.';
      } catch (error) {
        if (request === modalRequest && modal.open) modalStatus.textContent = error.message;
      } finally {
        detectButton.disabled = false;
        detectButton.removeAttribute('aria-busy');
        detectButton.querySelector('span').textContent = 'Определить автоматически';
      }
    });
  }
  function openDialog(trigger = document.activeElement) {
    if (!modal) createDialog();
    if (modal.open) return;
    opener = trigger instanceof HTMLElement ? trigger : null;
    modalInput.value = get().residence?.name || '';
    modalStatus.textContent = get().residence
      ? context(get().residence)
      : 'Введите минимум две буквы названия.';
    modalCandidate.hidden = true;
    document.body.classList.add('geo-modal-open');
    modal.showModal();
    modalInput.focus();
  }
  function refreshHeader() {
    const place = get().residence;
    const button = document.getElementById('geo-header-button');
    if (!button) return;
    button.querySelector('[data-geo-label]').textContent = place?.name || 'Ваш город';
    button.title = place
      ? [place.name, place.district, place.region].filter(Boolean).join(', ')
      : 'Выбрать город доставки';
    button.setAttribute(
      'aria-label',
      place ? `Изменить город доставки: ${place.name}` : 'Выбрать город доставки',
    );
  }
  function boot() {
    const actions = document.querySelector('#header .header-actions');
    if (actions && !document.getElementById('geo-header-button')) {
      const button = make('button', 'geo-header-button');
      button.type = 'button';
      button.id = 'geo-header-button';
      button.setAttribute('aria-haspopup', 'dialog');
      const label = make('span', '');
      label.dataset.geoLabel = '';
      button.append(icon('pin'), label, icon('chevron'));
      button.addEventListener('click', () => openDialog(button));
      actions.insertBefore(button, actions.querySelector('.cart-button'));
      refreshHeader();
    }
    window.dispatchEvent(new CustomEvent('tekst:geo-ready'));
    // Use an existing permission silently; first-time permission is requested only by a button.
    if (!get().residence && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(async (permission) => {
          if (permission.state !== 'granted' || get().residence) return;
          try {
            const detected = await detect();
            if (!get().residence && detected.distance <= 3 && detected.accuracy <= 5000) {
              openDialog(document.getElementById('geo-header-button'));
              candidate(modalCandidate, detected, closeDialog);
              modalStatus.textContent = 'Подтвердите населённый пункт или выберите другой.';
              const label = document.querySelector('[data-geo-label]');
              if (label) label.textContent = detected.place.name;
            }
          } catch {
            /* Manual search remains available. */
          }
        })
        .catch(() => {});
    }
  }
  window.TEXT_GEO = {
    get,
    save,
    choose,
    search,
    nearby,
    detect,
    createSearch,
    candidate,
    context,
    ozonMap,
    updateOzonLinks,
    open: openDialog,
  };
  window.TEXT_DELIVERY_PREFS = { get, save };
  window.addEventListener(changeEvent, () => {
    refreshHeader();
    updateOzonLinks();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== key && event.key !== null) return;
    memory = {};
    refreshHeader();
    window.dispatchEvent(new CustomEvent(changeEvent, { detail: { state: get() } }));
  });
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
