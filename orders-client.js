(() => {
  'use strict';
  const bytes = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
  function trackOrder(result, readNotification) {
    const analytics = window.TEXT_ANALYTICS;
    if (
      result.preview ||
      !['queued', 'retrying', 'failed'].includes(result.status) ||
      !analytics?.allowed?.()
    )
      return;
    // Saved on this server is distinct from delivery to every studio recipient.
    analytics.track('order_accepted');
    let stopped = false,
      timer,
      attempts = 0;
    const controller = new AbortController();
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener('text:analytics-consent', consentChanged);
      window.removeEventListener('pagehide', stop);
    };
    const consentChanged = (event) => {
      if (!event.detail.allowed) stop();
    };
    const finish = (status) => {
      if (!analytics.allowed() || stopped) return stop();
      if (status === 'delivered') analytics.track('order_sent');
      else if (status === 'failed') analytics.track('order_notification_failed');
      else return false;
      stop();
      return true;
    };
    const check = async () => {
      if (!analytics.allowed() || stopped) return stop();
      attempts++;
      try {
        const status = await readNotification(controller.signal);
        if (stopped || finish(status.notification)) return;
      } catch {
        // A lost status response is not proof of failed messenger delivery.
      }
      if (!stopped && attempts < 30) timer = setTimeout(check, 10000);
      else stop();
    };
    document.addEventListener('text:analytics-consent', consentChanged);
    window.addEventListener('pagehide', stop, { once: true });
    if (!finish(result.status)) void check();
  }
  function showConfirmation(form, result, kind, message, disclosure) {
    if (!form.isConnected) return;
    const container = form.closest('.dialog-body') || form.parentElement,
      dialog = container.closest('dialog'),
      request = kind === 'request',
      accepted = result.status === 'queued',
      preview = result.status === 'preview';
    const element = (tag, className, text) => {
      const node = document.createElement(tag);
      node.className = className;
      if (text) node.textContent = text;
      return node;
    };
    const mark = element('span', 'order-confirmation-mark');
    mark.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    path.setAttribute('d', accepted || preview ? 'm5 12 4 4L19 6' : 'M12 5v9m0 4v1');
    svg.append(path);
    mark.append(svg);
    const title = element(
      'h2',
      '',
      accepted
        ? request
          ? 'Ваша заявка принята'
          : 'Ваш заказ принят'
        : preview
          ? request
            ? 'Заявка подготовлена'
            : 'Заказ подготовлен'
          : request
            ? 'Ваша заявка сохранена'
            : 'Ваш заказ сохранён',
    );
    title.id = 'order-confirmation-title';
    title.tabIndex = -1;
    const number = element(
        'p',
        'order-confirmation-number',
        (request ? 'Заявка ' : 'Заказ ') + result.number,
      ),
      status = element('p', 'order-confirmation-status', message),
      downloads = element('div', 'order-confirmation-downloads');
    status.setAttribute('role', 'status');
    for (const [key, text] of [
      ['pdf', 'Скачать PDF'],
      ['zip', 'Скачать ZIP'],
    ]) {
      const link = element('a', 'button button-outline', text);
      link.href = result.links[key];
      link.setAttribute('download', '');
      link.classList.add('ym-disable-tracklink');
      downloads.append(link);
    }
    const close = element('button', 'button button-primary', 'Закрыть');
    close.type = 'button';
    close.hidden = !dialog;
    close.addEventListener('click', () => dialog.close());
    container.classList.remove('request-form');
    container.classList.add('order-confirmation');
    container.classList.add('ym-hide-content');
    container.replaceChildren(mark, title, number, status, downloads, disclosure, close);
    if (dialog) {
      dialog.classList.add('is-order-confirmation');
      dialog.setAttribute('aria-labelledby', title.id);
      dialog.scrollTop = 0;
    }
    title.focus({ preventScroll: true });
  }
  async function mount({ form, siteRoot, getItems, getFile, notify, kind = 'cart' }) {
    if (form.dataset.checkoutMounted) return;
    form.classList.add('ym-hide-content');
    form.dataset.checkoutMounted = 'true';
    const submit = form.querySelector('[type="submit"]'),
      intro = form.parentElement.querySelector('.dialog-intro'),
      feedback = form.querySelector('#file-feedback'),
      disclosure = form.querySelector('.form-disclosure');
    const label = kind === 'request' ? 'Заявка' : 'Заказ',
      action = kind === 'request' ? 'Отправить заявку' : 'Отправить заказ';
    const status = document.createElement('p');
    status.className = 'form-disclosure';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.querySelector('.form-actions').after(status);
    let settings,
      busy = false,
      requestId,
      uploadToken,
      draft,
      fingerprint,
      confirmed = false,
      completed = false,
      fileRevision = 0;
    async function connect() {
      form.dataset.orderCheckout = 'loading';
      submit.disabled = true;
      status.textContent = 'Подключаемся к серверу…';
      try {
        const r = await fetch(new URL('api/orders/config', siteRoot), {
          signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) throw Error();
        settings = await r.json();
        if (!settings.enabled) throw Error();
        if (!form.isConnected) return false;
        form.dataset.orderCheckout = 'ready';
        submit.textContent =
          settings.mode === 'preview'
            ? 'Подготовить ' + (kind === 'request' ? 'заявку' : 'заказ')
            : action;
        intro.textContent =
          kind === 'request'
            ? 'Передадим макет и описание задачи в студию. Готовый расчёт для этого не нужен.'
            : 'Отправим состав заказа и макеты в студию. PDF с расчётом будет доступен по ссылке.';
        disclosure.textContent =
          'Макеты и документы хранятся ' +
          settings.retentionDays +
          ' дней. Стоимость и срок подтвердим после проверки файлов.';
        if (settings.mode === 'preview')
          disclosure.textContent =
            'Локальная проверка: файлы сохранятся на этом компьютере. В студию и бот заявка не отправляется.';
        feedback.textContent = getFile()
          ? 'Макет прикреплён: ' + getFile().name
          : kind === 'cart'
            ? 'Файлы из корзины передадутся при отправке заказа. Здесь можно прикрепить дополнительный макет.'
            : 'Прикрепите макет или опишите задачу. Файл передастся после нажатия «Отправить заявку».';
        status.textContent = '';
        return true;
      } catch {
        settings = null;
        form.dataset.orderCheckout = 'unavailable';
        submit.textContent = 'Повторить отправку';
        status.textContent =
          'Нет подключения к серверу. Заявка и файлы не переданы. Повторите отправку или свяжитесь со студией через контакты.';
        return false;
      } finally {
        if (form.isConnected) submit.disabled = false;
      }
    }
    form.querySelector('#file-input').addEventListener('change', () => {
      fileRevision++;
      const f = getFile();
      if (f) feedback.textContent = 'Макет прикреплён: ' + f.name;
    });
    const api = async (path, options = {}) => {
      const r = await fetch(new URL('api/orders/' + path, siteRoot), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(uploadToken ? { 'X-Order-Token': uploadToken } : {}),
          ...options.headers,
        },
        signal: AbortSignal.timeout(options.method === 'PUT' ? 10 * 60 * 1000 : 60000),
      });
      let data;
      try {
        data = await r.json();
      } catch {
        throw Error('Сервер не ответил. Повторите отправку.');
      }
      if (!r.ok) throw Error(data.error || 'Не удалось отправить заявку.');
      return data;
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy || completed || !form.reportValidity()) return;
      busy = true;
      try {
        if (!settings && !(await connect())) return;
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        const data = new FormData(form),
          items = getItems();
        if (kind === 'cart' && !items.length)
          throw Error('Корзина пуста. Добавьте услуги перед отправкой.');
        status.textContent = 'Проверяем файлы и параметры…';
        const files = [];
        for (const item of items)
          if (item.fileName) {
            const file = await window.TEXT_FILES.get(item.key);
            if (!file)
              throw Error(
                'Макет «' +
                  item.fileName +
                  '» не найден в этом браузере. Прикрепите его снова в корзине.',
              );
            files.push({ file, itemKey: item.key });
          }
        if (getFile()) files.push({ file: getFile(), itemKey: null });
        for (const { file } of files) {
          const error = window.TEXT_FILES.validate(file);
          if (error) throw Error(error);
        }
        if (
          kind === 'request' &&
          !items.length &&
          !files.length &&
          !String(data.get('comment') || '').trim()
        )
          throw Error('Прикрепите макет или опишите, что нужно напечатать.');
        if (
          files.length > settings.maxFiles ||
          files.reduce((n, f) => n + f.file.size, 0) > settings.maxTotalBytes
        )
          throw Error(
            'Можно отправить до ' + settings.maxFiles + ' файлов общим объёмом до 500 МБ.',
          );
        const utm = Object.fromEntries(
          ['utm_source', 'utm_medium', 'utm_campaign']
            .filter((k) => new URL(location.href).searchParams.has(k))
            .map((k) => [k, new URL(location.href).searchParams.get(k)]),
        );
        const channel = data.get('contactChannel') || 'max';
        const body = {
          kind,
          contact: {
            name: data.get('name'),
            phone: data.get('phone'),
            comment: data.get('comment'),
            channel,
            ...(channel === 'telegram'
              ? { telegram: String(data.get('telegram') || '').trim() }
              : {}),
          },
          consent: data.get('personalDataConsent'),
          items,
          files: files.map((f) => ({ name: f.file.name, size: f.file.size, itemKey: f.itemKey })),
          pageUrl: location.href,
          utm,
        };
        const signature = JSON.stringify([
          body,
          fileRevision,
          files.map((f) => f.file.lastModified),
        ]);
        if (fingerprint !== signature) {
          requestId = crypto.randomUUID();
          uploadToken = bytes();
          draft = null;
          fingerprint = signature;
          confirmed = false;
        }
        if (!draft) {
          draft = await api('draft', {
            method: 'POST',
            body: JSON.stringify({ ...body, requestId }),
          });
          uploadToken = draft.uploadToken || uploadToken;
        }
        if (draft.changed && !confirmed) {
          status.textContent =
            'Тарифы или параметры изменились. Сервер пересчитал заказ: ' +
            draft.total.toLocaleString('ru-RU') +
            ' ₽' +
            (draft.upper > draft.total ? ' — ' + draft.upper.toLocaleString('ru-RU') + ' ₽' : '') +
            '. Подтвердите обновлённый расчёт повторным нажатием. Стоимость и срок уточним после проверки макета.';
          submit.textContent = 'Подтвердить расчёт и отправить';
          confirmed = true;
          return;
        }
        for (let i = 0; i < files.length; i++) {
          if (draft.files[i].uploaded) continue;
          status.textContent = 'Загружаем макет ' + (i + 1) + ' из ' + files.length + '…';
          await api(draft.id + '/files/' + draft.files[i].id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: files[i].file,
          });
          draft.files[i].uploaded = true;
        }
        status.textContent = 'Сохраняем документы и передаём заявку…';
        const result = await api(draft.id + '/submit', {
          method: 'POST',
          body: JSON.stringify({ acceptRecalculation: confirmed }),
        });
        trackOrder(result, async (signal) => {
          const r = await fetch(new URL('api/orders/' + draft.id + '/notification', siteRoot), {
            headers: { 'X-Order-Token': uploadToken },
            cache: 'no-store',
            signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
          });
          if (!r.ok) throw Error('Статус уведомления недоступен');
          return r.json();
        });
        const messages = {
          queued: 'Уведомление поставлено в очередь отправки студии.',
          retrying: 'Уведомление отправим автоматически, когда связь восстановится.',
          preview: 'Документы подготовлены локально. В студию и бот ничего не отправлялось.',
          failed: 'Шлюз не принял уведомление. Свяжитесь со студией и передайте номер заявки.',
        };
        const message = messages[result.status] || 'Документы сохранены на сервере.';
        completed = true;
        submit.dataset.done = 'true';
        showConfirmation(form, result, kind, message, disclosure);
        notify(label + ' ' + result.number + '. ' + message);
      } catch (e) {
        status.textContent =
          e.message || 'Не удалось отправить заявку. Файлы сохранены в форме. Повторите отправку.';
      } finally {
        busy = false;
        submit.disabled = submit.dataset.done === 'true';
        submit.removeAttribute('aria-busy');
      }
    });
    await connect();
  }
  window.TEXT_ORDER_CHECKOUT = { mount };
})();
