/* Delivery page uses the same selected location as the shared header. */
(() => {
  'use strict';
  const input = document.getElementById('delivery-town');
  if (!input) return;
  let initialized = false;
  function boot() {
    if (initialized || !window.TEXT_GEO) return;
    initialized = true;
    const geo = window.TEXT_GEO;
    const status = document.getElementById('delivery-town-status');
    const list = document.getElementById('delivery-town-results');
    const selected = document.getElementById('delivery-selected');
    const nearby = document.getElementById('delivery-nearby');
    const candidate = document.getElementById('delivery-geo-candidate');
    const detectButton = document.getElementById('delivery-detect');
    const major = document.getElementById('delivery-major-places');
    const numbers = new Intl.NumberFormat('ru-RU');
    const plural = new Intl.PluralRules('ru-RU');
    function rowFor(place, data) {
      return data.rows.find((row) =>
        place.oktmo
          ? String(row[7]) === place.oktmo
          : row[0] === place.name &&
            data.regions[row[1]] === place.region &&
            (data.districts[row[2]] || '') === place.district,
      );
    }
    function around(place, closest) {
      // TEXT_GEO.nearby has already loaded the directory on demand.
      const data = window.TEKST_GEODATA;
      if (!data?.rows) return { closest, largest: [] };
      const reference = rowFor(place, data);
      const enriched = closest.map((town) => ({
        ...town,
        population: Number(rowFor(town, data)?.[3]) || 0,
      }));
      if (!reference || !Number.isFinite(reference[4]) || !Number.isFinite(reference[5]))
        return { closest: enriched, largest: [] };
      const radians = (degrees) => (degrees * Math.PI) / 180;
      const largest = [];
      for (const row of data.rows) {
        if (
          row === reference ||
          !(row[3] > 0) ||
          !Number.isFinite(row[4]) ||
          !Number.isFinite(row[5]) ||
          Math.abs(row[4] - reference[4]) > 1.8
        )
          continue;
        const a =
          Math.sin(radians(row[4] - reference[4]) / 2) ** 2 +
          Math.cos(radians(reference[4])) *
            Math.cos(radians(row[4])) *
            Math.sin(radians(row[5] - reference[5]) / 2) ** 2;
        const distance = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
        if (distance > 200) continue;
        largest.push({
          name: row[0],
          region: data.regions[row[1]] || '',
          district: data.districts[row[2]] || '',
          oktmo: String(row[7] || ''),
          population: Number(row[3]),
          distance,
        });
      }
      largest.sort((a, b) => b.population - a.population || a.distance - b.distance);
      return { closest: enriched, largest: largest.slice(0, 12) };
    }
    function placeCard(town, large = false) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'delivery-place-card' + (large ? ' delivery-place-card--large' : '');
      button.title = [town.name, geo.context(town)].filter(Boolean).join(' · ');
      const name = document.createElement('strong');
      name.textContent = town.name;
      const stats = document.createElement('span');
      stats.className = 'delivery-place-stats';
      const distance = document.createElement('span');
      distance.className = 'delivery-place-distance';
      distance.title = 'Примерное расстояние по прямой';
      distance.textContent =
        town.distance < 1 ? 'Менее 1 км' : numbers.format(Math.round(town.distance)) + '\u00a0км';
      stats.append(distance);
      if (town.population > 0) {
        const population = document.createElement('span');
        population.className = 'delivery-place-population';
        population.textContent =
          numbers.format(town.population) +
          ' ' +
          { one: 'житель', few: 'жителя', many: 'жителей', other: 'жителя' }[
            plural.select(town.population)
          ];
        stats.append(population);
      }
      button.append(name, stats);
      button.setAttribute(
        'aria-label',
        button.title + '. ' + Array.from(stats.children, (item) => item.textContent).join(', '),
      );
      button.addEventListener('click', () => geo.choose(town));
      return button;
    }
    let version = 0;
    let geoRequest = 0;
    const search = geo.createSearch({
      input,
      list,
      status,
      onSelect: () => {
        candidate.hidden = true;
      },
    });
    function refresh() {
      const place = geo.get().residence;
      geo.updateOzonLinks(document);
      input.value = place?.name || '';
      status.textContent = place
        ? geo.context(place)
        : 'Начните вводить название и выберите район и регион из подсказки.';
      selected.querySelector('strong').textContent = place?.name || 'Ваш населённый пункт';
      selected.querySelector('[data-selected-context]').textContent = place
        ? geo.context(place)
        : 'Пока не выбран. Можно указать даже небольшое село или посёлок.';
      selected.classList.toggle('has-location', Boolean(place));
      document.querySelectorAll('[data-delivery-destination]').forEach((element) => {
        element.textContent = place
          ? 'Получение: ' + place.name
          : 'В пункт выдачи выбранного города';
      });
      const current = ++version;
      nearby.hidden = true;
      nearby.querySelector('[data-nearby-items]').replaceChildren();
      nearby.querySelector('[data-closest-group]').hidden = true;
      major.hidden = true;
      major.querySelector('[data-major-items]').replaceChildren();
      if (!place) return;
      geo
        .nearby(place)
        .then((places) => {
          if (current !== version) return;
          const result = around(place, places);
          nearby.hidden = !result.closest.length && !result.largest.length;
          nearby.querySelector('[data-closest-group]').hidden = !result.closest.length;
          for (const town of result.closest)
            nearby.querySelector('[data-nearby-items]').append(placeCard(town));
          major.hidden = !result.largest.length;
          for (const town of result.largest)
            major.querySelector('[data-major-items]').append(placeCard(town, true));
        })
        .catch(() => {
          /* The selected town stays valid if nearby suggestions cannot load. */
        });
    }
    window.addEventListener('tekst:delivery-change', () => {
      ++geoRequest;
      search.cancel();
      candidate.hidden = true;
      refresh();
    });
    document.querySelectorAll('[data-delivery-popular]').forEach((button) => {
      button.addEventListener('click', () => {
        input.value = button.dataset.deliveryPopular;
        input.focus();
        candidate.hidden = true;
        search.suggest();
      });
    });
    document.querySelectorAll('[data-geo-open]').forEach((button) => {
      button.addEventListener('click', () => geo.open(button));
    });
    document
      .querySelectorAll('.delivery-steps-actions [data-action="request"]')
      .forEach((button) => {
        button.addEventListener('click', () => geo.save({ fulfillment: 'delivery' }));
      });
    detectButton.addEventListener('click', async () => {
      const request = ++geoRequest;
      detectButton.disabled = true;
      detectButton.setAttribute('aria-busy', 'true');
      const buttonLabel = detectButton.querySelector('[data-detect-label]');
      if (buttonLabel) buttonLabel.textContent = 'Определяем город…';
      search.cancel();
      candidate.hidden = true;
      status.textContent = 'Запрашиваем местоположение у браузера…';
      try {
        const result = await geo.detect();
        if (request !== geoRequest) return;
        geo.candidate(candidate, result, undefined, () => input.focus());
        status.textContent = 'Проверьте найденный населённый пункт перед выбором.';
      } catch (error) {
        if (request === geoRequest) status.textContent = error.message;
      } finally {
        detectButton.disabled = false;
        detectButton.removeAttribute('aria-busy');
        if (buttonLabel) buttonLabel.textContent = 'Определить автоматически';
      }
    });
    refresh();
  }
  window.addEventListener('tekst:geo-ready', boot, { once: true });
  boot();
})();
