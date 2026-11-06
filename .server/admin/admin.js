(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let csrf = '',
    catalog = null,
    current = '',
    category = '',
    busy = false,
    noticeTimer;
  const dirty = new Map(),
    invalid = new Set(),
    fields = new Map();
  async function api(endpoint, data) {
    const response = await fetch('/api/admin/' + endpoint, {
      credentials: 'same-origin',
      headers: data ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {},
      ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && endpoint !== 'login' && endpoint !== 'password') showLogin();
      throw Error(result.error || 'Не удалось выполнить запрос.');
    }
    return result;
  }
  function notice(message, error = false) {
    clearTimeout(noticeTimer);
    $('notice').textContent = message;
    $('notice').classList.toggle('error-notice', error);
    $('notice').hidden = false;
    noticeTimer = setTimeout(() => ($('notice').hidden = true), 6500);
  }
  function showLogin() {
    csrf = '';
    catalog = null;
    dirty.clear();
    invalid.clear();
    fields.clear();
    $('login-view').hidden = false;
    $('dashboard').hidden = true;
    $('orders-view').hidden = true;
    $('admin-tabs').hidden = true;
    $('orders-list').replaceChildren();
    $('order-detail').replaceChildren();
    selectedOrder = '';
    ordersOpen = false;
    ratingsOpen = false;
    ratingsState = null;
    ratingsDirty = false;
    $('ratings-view').hidden = true;
    $('ratings-fields').replaceChildren();
    setTabSelection('tariffs');
    $('logout').hidden = true;
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  }
  async function load() {
    catalog = await api('catalog');
    fields.clear();
    catalog.fields.forEach((f) => fields.set(f.id, f));
    dirty.clear();
    invalid.clear();
    if (!catalog.services.some((s) => s.id === current)) current = catalog.services[0].id;
    $('login-view').hidden = true;
    $('dashboard').hidden = ordersOpen || ratingsOpen;
    $('orders-view').hidden = !ordersOpen;
    $('ratings-view').hidden = !ratingsOpen;
    $('admin-tabs').hidden = false;
    $('logout').hidden = false;
    renderNav();
    renderFields();
    status();
  }
  function node(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function renderNav() {
    const q = $('service-search').value.trim().toLocaleLowerCase(),
      fragment = document.createDocumentFragment();
    let section = '';
    for (const s of catalog.services) {
      if (q && !s.name.toLocaleLowerCase().includes(q) && !s.title.toLocaleLowerCase().includes(q))
        continue;
      if (section !== s.section) {
        fragment.append(node('p', 'nav-section', s.title));
        section = s.section;
      }
      const b = node('button', 'nav-item', s.name);
      b.type = 'button';
      b.setAttribute('aria-current', String(s.id === current));
      b.addEventListener('click', () => {
        current = s.id;
        category = '';
        $('field-search').value = '';
        renderNav();
        renderFields();
      });
      fragment.append(b);
    }
    if (!fragment.childNodes.length) fragment.append(node('p', 'muted', 'Услуга не найдена.'));
    $('services').replaceChildren(fragment);
  }
  const format = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 }).format(n);
  function fieldExample(f, value) {
    if (!Number.isFinite(value)) return '';
    if (f.example === 'paper')
      return `Например, 10 листов: +${format(value * 10)} ₽ к стоимости печати.`;
    if (f.example === 'discount')
      return `Например, от 1 000 ₽ после скидки ${format(value * 100)}% останется ${format(1000 * (1 - value))} ₽.`;
    if (f.example === 'surcharge')
      return `Например, односторонний лист за 100 ₽ с надбавкой ${format(value * 100)}%: ${format(100 * (1 + value))} ₽ за двусторонний лист.`;
    if (f.example === 'coefficient')
      return `Например, базовая стоимость 1 000 ₽ × ${format(value)} = ${format(1000 * value)} ₽.`;
    return '';
  }
  function renderCategories(s) {
    const fragment = document.createDocumentFragment();
    for (const g of [
      { id: '', name: 'Все параметры', fields: s.groups.flatMap((g) => g.fields) },
      ...s.groups,
    ]) {
      const b = node('button', 'category-tab');
      b.type = 'button';
      b.dataset.category = g.id;
      b.setAttribute('aria-pressed', String(g.id === category));
      b.append(node('span', '', g.name), node('span', 'category-count', g.fields.length));
      b.addEventListener('click', () => {
        category = g.id;
        renderFields();
      });
      fragment.append(b);
    }
    $('categories').replaceChildren(fragment);
  }
  function renderFields() {
    const s = catalog.services.find((s) => s.id === current);
    if (!s) return;
    $('section-name').textContent = s.title;
    $('service-name').textContent = s.name;
    $('calculator-link').hidden = !s.path;
    if (s.path) $('calculator-link').href = '/' + s.path + '#calculator';
    renderCategories(s);
    const q = $('field-search').value.trim().toLocaleLowerCase(),
      changedOnly = $('changed-only').checked,
      fragment = document.createDocumentFragment();
    let count = 0;
    for (const g of s.groups) {
      if (category && g.id !== category) continue;
      const chosen = g.fields
        .map((id) => fields.get(id))
        .filter(
          (f) =>
            (!q ||
              (f.label + ' ' + f.description + ' ' + f.searchText + ' ' + g.name)
                .toLocaleLowerCase()
                .includes(q)) &&
            (!changedOnly || dirty.has(f.id) || f.value !== f.base),
        );
      if (!chosen.length) continue;
      const section = node('section', 'field-group'),
        heading = node('div', 'group-heading'),
        intro = node('div');
      intro.append(node('h2', '', g.name), node('p', 'group-description', g.description));
      heading.append(intro, node('span', '', chosen.length + ' значений'));
      section.append(heading);
      for (const f of chosen) {
        count++;
        const row = node('div', 'field-row'),
          content = node('div', 'field-content'),
          parts = f.label.split(' · '),
          label = node('label', 'field-label', parts.shift()),
          valueBox = node('div', 'field-value'),
          input = node('input'),
          scale = f.displayScale || 1;
        input.type = 'number';
        input.inputMode = 'decimal';
        input.min = f.min * scale;
        input.max = f.max * scale;
        input.step = scale === 100 ? '0.0001' : '0.000001';
        input.id = 'f-' + f.id;
        const draft = dirty.has(f.id) ? dirty.get(f.id) : f.value;
        input.value = typeof draft === 'number' ? Number((draft * scale).toFixed(6)) : draft;
        input.required = true;
        label.htmlFor = input.id;
        content.append(label);
        const conditions = node('p', 'field-conditions');
        for (const p of parts) conditions.append(node('span', '', p));
        if (parts.length) content.append(conditions);
        const description = node('p', 'field-description', f.description),
          example = node('p', 'field-example');
        description.id = 'help-' + f.id;
        example.id = 'example-' + f.id;
        input.setAttribute('aria-describedby', description.id + ' ' + example.id);
        content.append(description, example);
        if (f.sharedWith.length) {
          content.append(
            node(
              'p',
              'field-shared',
              'Общее поле: ' +
                f.sharedWith.join(', ') +
                '. Сохранение обновит его во всех этих услугах.',
            ),
          );
        }
        const meta = node('p', 'field-meta'),
          reset = node('button', '', 'Вернуть исходное');
        reset.type = 'button';
        reset.setAttribute('aria-label', 'Вернуть исходное значение: ' + f.label);
        reset.addEventListener('click', () => {
          input.value = Number((f.base * scale).toFixed(6));
          change();
        });
        meta.append(
          node('span', '', `Исходное: ${format(f.base * scale)} ${f.displayUnit}`),
          reset,
        );
        content.append(meta);
        valueBox.append(node('span', 'field-unit', f.displayUnit), input);
        function showExample() {
          const number = input.valueAsNumber / scale;
          example.textContent = fieldExample(f, number);
          example.hidden = !example.textContent;
        }
        function change() {
          const number = Number((input.valueAsNumber / scale).toFixed(6)),
            ok = input.validity.valid && Number.isFinite(number);
          if (ok) invalid.delete(f.id);
          else invalid.add(f.id);
          if (ok && number === f.value) dirty.delete(f.id);
          else dirty.set(f.id, ok ? number : input.value);
          row.classList.toggle('changed', dirty.has(f.id));
          input.setAttribute('aria-invalid', String(!ok));
          showExample();
          status();
        }
        input.addEventListener('input', change);
        showExample();
        input.setAttribute('aria-invalid', String(invalid.has(f.id)));
        row.classList.toggle('changed', dirty.has(f.id));
        row.append(content, valueBox);
        section.append(row);
      }
      fragment.append(section);
    }
    $('fields').replaceChildren(fragment);
    $('no-fields').hidden = count > 0;
  }
  function status() {
    const n = dirty.size;
    $('save-status').textContent = busy
      ? 'Сохраняем…'
      : invalid.size
        ? 'Проверьте выделенные значения'
        : n
          ? `Несохранённых изменений: ${n}`
          : 'Все изменения сохранены';
    $('save').disabled = busy || !n || invalid.size > 0;
    $('cancel').disabled = busy || !n;
  }
  async function confirmAction(title, message) {
    const d = $('confirm-dialog');
    $('confirm-title').textContent = title;
    $('confirm-message').textContent = message;
    return new Promise((resolve) => {
      let answer = false;
      const finish = () => {
        d.removeEventListener('close', finish);
        resolve(answer);
      };
      $('confirm-yes').onclick = () => {
        answer = true;
        d.close();
      };
      $('confirm-no').onclick = () => d.close();
      d.addEventListener('close', finish);
      d.showModal();
    });
  }
  async function operation(fn) {
    if (busy) return;
    busy = true;
    status();
    try {
      await fn();
    } catch (e) {
      notice(e.message, true);
    } finally {
      busy = false;
      status();
    }
  }
  $('show-password').addEventListener('click', () => {
    const shown = $('password').type === 'password';
    $('password').type = shown ? 'text' : 'password';
    $('show-password').textContent = shown ? 'Скрыть' : 'Показать';
    $('show-password').setAttribute('aria-pressed', String(shown));
    $('show-password').setAttribute('aria-label', shown ? 'Скрыть пароль' : 'Показать пароль');
  });
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    $('login-error').textContent = '';
    try {
      const s = await api('login', { password: $('password').value });
      csrf = s.csrf;
      $('password').value = '';
      await load();
    } catch (e) {
      $('login-error').textContent = e.message;
    } finally {
      button.disabled = false;
    }
  });
  $('service-search').addEventListener('input', renderNav);
  $('field-search').addEventListener('input', renderFields);
  $('changed-only').addEventListener('change', renderFields);
  $('save').addEventListener('click', () =>
    operation(async () => {
      await api('save', { revision: catalog.revision, changes: Object.fromEntries(dirty) });
      await load();
      notice('Тарифы сохранены. Обновите страницу калькулятора.');
    }),
  );
  $('cancel').addEventListener('click', async () => {
    if (
      await confirmAction(
        'Отменить правки?',
        'Несохранённые значения будут заменены последними сохранёнными тарифами.',
      )
    ) {
      dirty.clear();
      invalid.clear();
      renderFields();
      status();
    }
  });
  $('reset-service').addEventListener('click', async () => {
    if (
      !(await confirmAction(
        'Вернуть исходные тарифы?',
        'Для выбранной услуги будут подготовлены исходные значения. Примените их кнопкой «Сохранить изменения».',
      ))
    )
      return;
    const s = catalog.services.find((s) => s.id === current);
    for (const id of s.groups.flatMap((g) => g.fields)) {
      const f = fields.get(id);
      invalid.delete(id);
      if (f.value === f.base) dirty.delete(id);
      else dirty.set(id, f.base);
    }
    renderFields();
    status();
  });
  $('logout').addEventListener('click', async () => {
    if (
      (dirty.size || ratingsDirty) &&
      !(await confirmAction('Выйти без сохранения?', 'Несохранённые изменения будут потеряны.'))
    )
      return;
    await operation(async () => {
      await api('logout', {});
      showLogin();
    });
  });
  document
    .querySelectorAll('[data-close]')
    .forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('history-open').addEventListener('click', () => {
    const list = $('history-list');
    list.replaceChildren();
    for (const h of catalog.history) {
      const row = node('div', 'history-row'),
        text = node('div');
      text.append(
        node('strong', '', new Date(h.at).toLocaleString('ru-RU')),
        node('p', '', `${h.message} · ${h.changed} изменений`),
      );
      const b = node('button', 'secondary', 'Вернуть эту версию');
      b.addEventListener('click', async () => {
        if (
          await confirmAction(
            'Вернуть тарифы?',
            'Текущие тарифы будут сохранены в истории. Несохранённые правки будут отменены.',
          )
        )
          await operation(async () => {
            await api('rollback', { revision: catalog.revision, id: h.id });
            $('history-dialog').close();
            await load();
            notice('Предыдущие тарифы восстановлены.');
          });
      });
      row.append(text, b);
      list.append(row);
    }
    if (!catalog.history.length)
      list.append(node('p', 'empty muted', 'История появится после первого сохранения.'));
    $('history-dialog').showModal();
  });
  $('backup-download').addEventListener('click', () =>
    operation(async () => {
      const data = await api('export'),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        ),
        a = node('a');
      a.href = url;
      a.download = 'ТЕКСТ-тарифы-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notice('Скачана копия сохранённых тарифов.');
    }),
  );
  $('backup-upload').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', async () => {
    const file = $('backup-file').files[0];
    $('backup-file').value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notice('Резервная копия слишком большая.', true);
      return;
    }
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      notice('Выберите JSON-файл резервной копии тарифов.', true);
      return;
    }
    if (
      await confirmAction(
        'Загрузить резервную копию?',
        'Она заменит сохранённые тарифы. Текущие значения останутся в истории. Несохранённые правки будут отменены.',
      )
    )
      await operation(async () => {
        await api('import', { revision: catalog.revision, backup });
        await load();
        notice('Резервная копия загружена.');
      });
  });
  $('password-open').addEventListener('click', () => {
    $('password-form').reset();
    $('password-error').textContent = '';
    $('password-dialog').showModal();
  });
  $('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get('password') !== f.get('repeat')) {
      $('password-error').textContent = 'Новые пароли не совпадают.';
      return;
    }
    const b = e.submitter;
    b.disabled = true;
    try {
      await api('password', { current: f.get('current'), password: f.get('password') });
      showLogin();
      notice('Пароль изменён. Войдите с новым паролем.');
    } catch (e) {
      $('password-error').textContent = e.message;
    } finally {
      b.disabled = false;
    }
  });
  let ratingsOpen = false,
    ratingsState = null,
    ratingsDirty = false,
    ratingsBusy = false,
    ratingsLoading = null;
  let ordersOpen = false,
    ordersPage = 1,
    selectedOrder = '',
    ordersRequest = 0,
    detailRequest = 0,
    ordersSearchTimer;
  const orderStates = {
    queued: 'В очереди бота',
    retrying: 'Ожидает отправки',
    failed: 'Ошибка уведомления',
    preview: 'Локальный расчёт',
    prepared: 'Подготовлен',
  };
  const money = (n) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽';
  const orderDate = (s) =>
    new Date(s).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const orderPrice = (o) =>
    o.unknownCount === o.itemsCount
      ? 'Нужен расчёт'
      : o.upper > o.total
        ? money(o.total) + ' — ' + money(o.upper)
        : money(o.total);
  function setAdminSection(section) {
    ordersOpen = section === 'orders';
    ratingsOpen = section === 'ratings';
    $('dashboard').hidden = ordersOpen || ratingsOpen;
    $('orders-view').hidden = !ordersOpen;
    $('ratings-view').hidden = !ratingsOpen;
    setTabSelection(section);
    if (ratingsOpen && !ratingsState) loadRatings().catch((e) => notice(e.message, true));
    if (ordersOpen) loadOrders().catch((e) => notice(e.message, true));
  }
  function setTabSelection(section) {
    for (const name of ['tariffs', 'orders', 'ratings'])
      $(name + '-tab').setAttribute('aria-selected', String(name === section));
  }
  const ratingProviders = { yandex: 'Яндекс Карты', gis: '2ГИС', google: 'Google' };
  function ratingDraft() {
    return Object.fromEntries(
      Object.keys(ratingProviders).map((id) => [
        id,
        { rating: $('rating-' + id).valueAsNumber, count: $('count-' + id).valueAsNumber },
      ]),
    );
  }
  function ratingsStatus() {
    const inputs = [...$('ratings-fields').querySelectorAll('input')],
      valid = inputs.every((input) => input.validity.valid);
    ratingsDirty =
      Boolean(ratingsState) &&
      JSON.stringify(ratingDraft()) !== JSON.stringify(ratingsState.ratings);
    $('ratings-save').disabled =
      ratingsBusy || ratingsLoading || !ratingsState || !ratingsDirty || !valid;
    $('ratings-cancel').disabled = ratingsBusy || !ratingsDirty;
    $('ratings-reload').disabled = ratingsBusy || Boolean(ratingsLoading);
    $('ratings-status').textContent = ratingsBusy
      ? 'Сохраняем…'
      : ratingsLoading
        ? 'Загружаем…'
        : !ratingsState
          ? 'Не удалось загрузить оценки. Нажмите «Обновить данные».'
          : !valid
            ? 'Оценка — от 0 до 5. Число отзывов — целое неотрицательное число.'
            : ratingsDirty
              ? 'Есть несохранённые изменения'
              : 'Все оценки сохранены';
    for (const id of Object.keys(ratingProviders)) {
      const rating = $('rating-' + id),
        count = $('count-' + id);
      if (!rating) continue;
      rating.setAttribute('aria-invalid', String(!rating.validity.valid));
      count.setAttribute('aria-invalid', String(!count.validity.valid));
      $('preview-' + id).textContent =
        rating.validity.valid && count.validity.valid
          ? '★ ' + rating.valueAsNumber.toFixed(1).replace('.', ',') + ' · ' + count.valueAsNumber
          : 'Проверьте значения';
    }
  }
  function renderRatings() {
    const fragment = document.createDocumentFragment();
    for (const [id, name] of Object.entries(ratingProviders)) {
      const card = node('section', 'rating-card'),
        preview = node('div', 'rating-preview'),
        values = node('div', 'rating-values');
      card.append(node('h2', '', name));
      preview.append(node('span', '', name));
      const badge = node('strong');
      badge.id = 'preview-' + id;
      preview.append(badge);
      card.append(preview);
      for (const [key, label, max, step] of [
        ['rating', 'Оценка', 5, 0.1],
        ['count', 'Количество отзывов', 10000000, 1],
      ]) {
        const box = node('div'),
          input = node('input'),
          text = node('label', '', label);
        input.id = (key === 'rating' ? 'rating-' : 'count-') + id;
        text.htmlFor = input.id;
        input.type = 'number';
        input.min = '0';
        input.max = String(max);
        input.step = String(step);
        input.inputMode = key === 'rating' ? 'decimal' : 'numeric';
        input.required = true;
        input.value = ratingsState.ratings[id][key];
        input.addEventListener('input', ratingsStatus);
        box.append(text, input);
        values.append(box);
      }
      card.append(values);
      fragment.append(card);
    }
    $('ratings-fields').replaceChildren(fragment);
    ratingsStatus();
  }
  async function loadRatings() {
    if (ratingsLoading) return ratingsLoading;
    const task = api('ratings');
    ratingsLoading = task;
    ratingsStatus();
    try {
      const result = await task;
      if (!csrf) return;
      ratingsState = result;
      renderRatings();
    } finally {
      ratingsLoading = null;
      ratingsStatus();
    }
  }
  $('ratings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ratingsBusy || !ratingsState || !$('ratings-form').reportValidity()) return;
    ratingsBusy = true;
    ratingsStatus();
    for (const input of $('ratings-fields').querySelectorAll('input')) input.disabled = true;
    try {
      const result = await api('ratings', {
        revision: ratingsState.revision,
        ratings: ratingDraft(),
      });
      if (!csrf) return;
      ratingsState = result;
      renderRatings();
      notice('Оценки сохранены. Обновите открытую страницу сайта.');
    } catch (e) {
      notice(e.message, true);
    } finally {
      ratingsBusy = false;
      for (const input of $('ratings-fields').querySelectorAll('input')) input.disabled = false;
      ratingsStatus();
    }
  });
  $('ratings-cancel').addEventListener('click', () => renderRatings());
  $('ratings-reload').addEventListener('click', async () => {
    if (
      ratingsDirty &&
      !(await confirmAction('Обновить оценки?', 'Несохранённые правки оценок будут отменены.'))
    )
      return;
    loadRatings().catch((e) => notice(e.message, true));
  });
  $('ratings-tab').addEventListener('click', () => setAdminSection('ratings'));
  async function loadOrders() {
    const serial = ++ordersRequest;
    $('orders-feedback').textContent = 'Загружаем заказы…';
    $('orders-refresh').disabled = true;
    try {
      const params = new URLSearchParams({
          q: $('orders-search').value,
          status: $('orders-status').value,
          page: String(ordersPage),
        }),
        data = await api('orders?' + params);
      if (serial !== ordersRequest || !csrf) return;
      ordersPage = data.page;
      const stats = document.createDocumentFragment();
      for (const [label, value] of [
        ['Всего заказов', data.summary.orders],
        ['Сумма расчётов', money(data.summary.total)],
        ['Требуют внимания', data.summary.needsAttention],
      ]) {
        const card = node('div', 'order-stat');
        card.append(node('span', 'muted', label), node('strong', '', value));
        stats.append(card);
      }
      $('orders-stats').replaceChildren(stats);
      const list = document.createDocumentFragment();
      for (const o of data.orders) {
        const button = node('button', 'order-list-row');
        button.type = 'button';
        button.dataset.orderId = o.id;
        button.setAttribute('aria-pressed', String(selectedOrder === o.id));
        const head = node('div', 'order-row-head');
        head.append(
          node('strong', '', o.number),
          node('span', 'order-state state-' + o.status, orderStates[o.status] || 'Сохранён'),
        );
        const customer = node('p', 'order-customer', o.contact.name),
          meta = node(
            'p',
            'order-row-meta',
            orderDate(o.created) +
              ' · ' +
              (o.itemsCount ? o.itemsCount + ' поз.' : 'Без расчёта') +
              ' · ' +
              o.filesCount +
              ' файлов',
          ),
          sum = node('strong', 'order-row-total', orderPrice(o));
        button.append(head, customer, meta, sum);
        button.addEventListener('click', () => openAdminOrder(o.id));
        list.append(button);
      }
      if (!data.orders.length) {
        const empty = node('div', 'orders-empty');
        empty.append(
          node('h2', '', data.summary.orders ? 'Ничего не найдено' : 'Заказов пока нет'),
          node(
            'p',
            'muted',
            data.summary.orders
              ? 'Измените поиск или статус.'
              : 'Отправленные из корзины заказы появятся здесь вместе с расчётом и макетами.',
          ),
        );
        list.append(empty);
      }
      $('orders-list').replaceChildren(list);
      $('orders-page').textContent = data.page + ' / ' + data.pages;
      $('orders-prev').disabled = data.page <= 1;
      $('orders-next').disabled = data.page >= data.pages;
      $('orders-feedback').textContent = 'Найдено: ' + data.total;
    } catch (e) {
      if (serial === ordersRequest) $('orders-feedback').textContent = e.message;
      throw e;
    } finally {
      if (serial === ordersRequest) $('orders-refresh').disabled = false;
    }
  }
  async function openAdminOrder(id) {
    selectedOrder = id;
    const serial = ++detailRequest;
    for (const row of $('orders-list').querySelectorAll('[data-order-id]'))
      row.setAttribute('aria-pressed', String(row.dataset.orderId === id));
    $('order-detail').replaceChildren(node('p', 'muted', 'Загружаем заказ…'));
    try {
      const o = await api('orders/' + encodeURIComponent(id));
      if (serial !== detailRequest || !csrf) return;
      const content = document.createDocumentFragment(),
        heading = node('div', 'order-detail-heading');
      heading.append(
        node('h2', '', o.number),
        node('span', 'order-state state-' + o.status, orderStates[o.status] || 'Сохранён'),
      );
      content.append(heading, node('p', 'muted', orderDate(o.created)));
      const customer = node('section', 'order-detail-section');
      customer.append(node('h3', '', 'Клиент'), node('strong', '', o.contact.name));
      const phone = node('a', 'order-contact', o.contact.phone);
      phone.href = 'tel:' + o.contact.phone.replace(/[^+0-9]/g, '');
      customer.append(phone);
      if (o.contact.channel === 'telegram') {
        const telegram = node('a', 'order-contact', 'Telegram ' + o.contact.telegram);
        telegram.href = 'https://t.me/' + encodeURIComponent(o.contact.telegram.replace(/^@/, ''));
        telegram.target = '_blank';
        telegram.rel = 'noopener';
        customer.append(telegram);
      } else customer.append(node('p', 'muted', 'Для связи: MAX по указанному телефону'));
      if (o.contact.email) {
        const email = node('a', 'order-contact', o.contact.email);
        email.href = 'mailto:' + encodeURIComponent(o.contact.email);
        customer.append(email);
      }
      content.append(customer);
      if (o.contact.comment) {
        const comment = node('section', 'order-detail-section');
        comment.append(
          node('h3', '', 'Комментарий'),
          node('p', 'order-comment', o.contact.comment),
        );
        content.append(comment);
      }
      const items = node('section', 'order-detail-section');
      items.append(node('h3', '', 'Состав заказа'));
      if (!o.items.length)
        items.append(
          node(
            'p',
            'muted',
            'Заявка без предварительного расчёта. Макеты и описание задачи приведены в этой карточке.',
          ),
        );
      for (const item of o.items) {
        const row = node('article', 'order-item'),
          head = node('div', 'order-item-head');
        head.append(
          node('strong', '', item.name),
          node('strong', '', item.price === null ? 'Уточним' : money(item.price)),
        );
        row.append(head, node('p', 'muted order-comment', item.description));
        if (item.comment && !item.description.includes(item.comment))
          row.append(node('p', 'order-comment', item.comment));
        if (item.fileName) row.append(node('p', 'order-item-file', 'Макет: ' + item.fileName));
        items.append(row);
      }
      content.append(items);
      const surchargeTotal = Object.values(o.surcharges || {}).reduce((sum, n) => sum + n, 0);
      if (surchargeTotal > 0) {
        const surcharge = node('div', 'order-surcharge');
        surcharge.append(
          node('span', '', 'Доплата до минимальной стоимости заказа'),
          node('strong', '', money(surchargeTotal)),
        );
        content.append(surcharge);
      }
      const total = node('div', 'order-detail-total');
      total.append(node('span', '', 'Предварительный расчёт'), node('strong', '', orderPrice(o)));
      content.append(total);
      if (o.unknownCount)
        content.append(node('p', 'muted', o.unknownCount + ' поз. требуют уточнения стоимости.'));
      const files = node('section', 'order-detail-section');
      files.append(node('h3', '', 'Расчёт и файлы'));
      const exports = node('div', 'order-file-actions');
      for (const [key, label] of [
        ['pdf', 'Расчёт PDF'],
        ['zip', 'Все файлы ZIP'],
      ]) {
        const a = node('a', 'secondary', label);
        a.href = o.links[key];
        exports.append(a);
      }
      files.append(exports);
      for (const f of o.links.files) {
        const a = node('a', 'order-file', f.name);
        a.href = f.url;
        files.append(a);
      }
      files.append(
        node('p', 'muted order-file-expiry', 'Ссылки действуют до ' + orderDate(o.expires)),
      );
      content.append(files);
      $('order-detail').replaceChildren(content);
    } catch (e) {
      if (serial === detailRequest)
        $('order-detail').replaceChildren(node('p', 'error', e.message));
    }
  }
  $('tariffs-tab').addEventListener('click', () => setAdminSection('tariffs'));
  $('orders-tab').addEventListener('click', () => setAdminSection('orders'));
  $('orders-refresh').addEventListener('click', () =>
    loadOrders().catch((e) => notice(e.message, true)),
  );
  $('orders-search').addEventListener('input', () => {
    clearTimeout(ordersSearchTimer);
    ordersSearchTimer = setTimeout(() => {
      ordersPage = 1;
      loadOrders().catch((e) => notice(e.message, true));
    }, 250);
  });
  $('orders-status').addEventListener('change', () => {
    ordersPage = 1;
    loadOrders().catch((e) => notice(e.message, true));
  });
  $('orders-prev').addEventListener('click', () => {
    ordersPage--;
    loadOrders().catch((e) => notice(e.message, true));
  });
  $('orders-next').addEventListener('click', () => {
    ordersPage++;
    loadOrders().catch((e) => notice(e.message, true));
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty.size || ratingsDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  api('session')
    .then(async (s) => {
      if (s.authenticated) {
        csrf = s.csrf;
        await load();
      } else if (!s.configured)
        $('login-error').textContent =
          'Вход ещё не настроен. На сервере выполните npm run admin:setup.';
    })
    .catch((e) => {
      $('login-error').textContent = e.message;
    });
})();
