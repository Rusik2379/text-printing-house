import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, stat, statfs, open, rename, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { ApiError, atomicJson, readJson } from './storage.mjs';
import { createQuotation } from './quotation.mjs';
import { createOrderPdf } from './order-pdf.mjs';
import { createZip } from './zip.mjs';

const MB = 1024 * 1024,
  uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  hex = /^[a-f0-9]{64}$/;
const hash = (s) => createHash('sha256').update(s).digest('hex'),
  token = () => randomBytes(32).toString('hex');
const text = (v, n) =>
  typeof v === 'string'
    ? v
        .replace(/[\x00-\x1f\x7f]/g, ' ')
        .trim()
        .slice(0, n)
    : '';
const filename = (v) =>
  text(v, 160)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim();
const fileHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};
export async function createOrders({
  root,
  dataDir,
  catalog,
  store,
  publicOrigin,
  gatewayUrl,
  fetchGateway = fetch,
  now = Date.now,
  retentionDays = 30,
  maxStorageBytes = 10 * 1024 * MB,
} = {}) {
  const config = (await readJson(path.join(dataDir, 'orders-config.json'))) || {};
  gatewayUrl = gatewayUrl ?? process.env.ORDERS_GATEWAY_URL ?? config.gatewayUrl;
  if (gatewayUrl) {
    const u = new URL(gatewayUrl);
    if (
      u.protocol !== 'https:' ||
      u.hostname !== 'gateway.sibsoft-it.ru' ||
      !/^\/api\/v1\/leads\/site_[a-zA-Z0-9]+$/.test(u.pathname) ||
      u.search ||
      u.hash
    )
      throw Error('Некорректный адрес шлюза заказов.');
  }
  const live = Boolean(publicOrigin && gatewayUrl),
    directory = path.join(dataDir, 'orders'),
    records = new Map(),
    notificationChecks = new Map(),
    locks = new Set(),
    limits = new Map();
  retentionDays = Number(process.env.ORDERS_RETENTION_DAYS || retentionDays);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 90)
    throw Error('Хранение заказов: от 1 до 90 дней.');
  if (process.env.ORDERS_STORAGE_MB) {
    const size = Number(process.env.ORDERS_STORAGE_MB);
    if (!Number.isInteger(size) || size < 256 || size > 1048576)
      throw Error('Некорректный лимит хранилища заказов.');
    maxStorageBytes = size * MB;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const pricing = await createQuotation(root, catalog, store);
  let pdf,
    closing = false;
  const folder = (id) => {
    if (!uuid.test(id)) throw new ApiError(404, 'Заказ не найден.');
    return path.join(directory, id);
  };
  const save = (o) => atomicJson(path.join(folder(o.id), 'order.json'), o);
  function expiry(o) {
    return o.status === 'draft' ? o.created + 60 * 60 * 1000 : o.expires;
  }
  function rate(req) {
    const ip = req.clientAddress || req.socket.remoteAddress,
      t = now();
    for (const [key, v] of limits) if (t - v.at > 3600000) limits.delete(key);
    const r = limits.get(ip) || { at: t, count: 0 };
    if (r.count >= 15 || limits.size >= 10000)
      throw new ApiError(429, 'Слишком много заказов. Повторите через час.');
    r.count++;
    limits.set(ip, r);
  }
  function authorized(id, req) {
    const o = records.get(id),
      key = req.headers['x-order-token'];
    if (
      !o ||
      expiry(o) <= now() ||
      !hex.test(key || '') ||
      !timingSafeEqual(Buffer.from(hash(key), 'hex'), Buffer.from(o.uploadHash, 'hex'))
    )
      throw new ApiError(404, 'Заказ не найден или срок ссылки истёк.');
    return o;
  }
  function links(o) {
    const base = publicOrigin || o.localOrigin;
    return {
      pdf: base + `/order-files/${o.downloadToken}/quote`,
      zip: base + `/order-files/${o.downloadToken}/archive`,
      files: o.files.map((f) => ({
        name: f.name,
        url: base + `/order-files/${o.downloadToken}/${f.id}`,
      })),
    };
  }
  function response(o) {
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      preview: !live,
      total: o.quote.total,
      upper: o.quote.upper,
      unknownCount: o.quote.rows.filter((r) => r.price === null).length,
      expires: new Date(o.expires).toISOString(),
      ...(['queued', 'preview', 'retrying', 'failed'].includes(o.status)
        ? { links: links(o) }
        : {}),
    };
  }
  async function cleanup() {
    for (const o of records.values())
      if (!locks.has(o.id) && expiry(o) <= now()) {
        await rm(folder(o.id), { recursive: true, force: true });
        records.delete(o.id);
        notificationChecks.delete(o.id);
      }
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !uuid.test(entry.name)) continue;
    const o = await readJson(path.join(folder(entry.name), 'order.json'));
    if (o?.id === entry.name && hex.test(o.uploadHash) && hex.test(o.downloadToken))
      records.set(o.id, o);
    else await rm(folder(entry.name), { recursive: true, force: true });
  }
  await cleanup();
  function payload(o) {
    const l = links(o),
      services = o.quote.rows.map((r) => o.names[r.id]);
    if (!services.length) services.push('Передача макета без расчёта');
    const details = o.quote.rows
      .map(
        (r, i) =>
          `${i + 1}. ${o.names[r.id]} — ${r.price === null ? 'требуется расчёт' : r.price + ' ₽'}\n${r.description}`,
      )
      .join('\n\n');
    const fields = {
      'Номер заказа': o.number,
      'Расчёт PDF': l.pdf,
      'Все файлы ZIP': l.zip,
      'Ссылки действуют до': new Date(o.expires).toISOString(),
      'Согласие на обработку данных': o.consent.version + ' · ' + o.consent.at,
    };
    fields['Связаться с клиентом'] =
      o.contact.channel === 'telegram'
        ? 'Telegram: ' + o.contact.telegram
        : 'MAX: ' + o.contact.phone;
    l.files.forEach((f, i) => {
      fields[`Макет ${i + 1}: ${f.name.slice(0, 70)}`] = f.url;
    });
    if (o.quote.upper > o.quote.total) fields['Верхняя граница расчёта'] = o.quote.upper + ' ₽';
    if (o.quote.rows.some((r) => r.price === null))
      fields['Позиций к уточнению'] = o.quote.rows.filter((r) => r.price === null).length;
    const priced = o.quote.rows.some((r) => r.price !== null);
    return {
      name: o.contact.name,
      phone: o.contact.phone,
      ...(o.contact.channel === 'telegram' ? { telegram: o.contact.telegram } : {}),
      ...(o.contact.email ? { email: o.contact.email } : {}),
      subject: (o.kind === 'request' ? 'Заявка ' : 'Заказ ') + o.number + ' — ТЕКСТ',
      service: [...new Set(services)].join(', ').slice(0, 300),
      budget: priced
        ? o.quote.total + ' ₽' + (o.quote.upper > o.quote.total ? ' — ' + o.quote.upper + ' ₽' : '')
        : 'Требуется расчёт',
      city: 'Барнаул',
      description: (
        details +
        '\n\nКомментарий: ' +
        o.contact.comment +
        '\nРасчёт предварительный. Итог подтвердим после проверки макетов.'
      ).slice(0, 3000),
      source: o.kind === 'request' ? 'Форма заявки сайта ТЕКСТ' : 'Корзина сайта ТЕКСТ',
      page_url: o.pageUrl,
      ...o.utm,
      fields,
    };
  }
  async function deliver(o) {
    if (!live) {
      o.status = 'preview';
      await save(o);
      return;
    }
    o.attempts = (o.attempts || 0) + 1;
    o.status = 'retrying';
    o.nextAttempt = now() + Math.min(3600000, 30000 * 2 ** Math.min(o.attempts - 1, 7));
    await save(o);
    try {
      const r = await fetchGateway(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'text-order-' + o.id },
        body: JSON.stringify(payload(o)),
        signal: AbortSignal.timeout(15000),
      });
      if (r.status !== 202) {
        if (r.status >= 400 && r.status < 500 && ![408, 429].includes(r.status))
          o.status = 'failed';
        throw Error('Шлюз временно недоступен');
      }
      const data = await r.json();
      if (
        !['queued', 'sending', 'retry', 'sent', 'failed'].includes(data.status) ||
        !Number.isSafeInteger(data.delivery_id) ||
        data.delivery_id < 1
      )
        throw Error('Некорректный ответ шлюза');
      o.status = 'queued';
      o.deliveryId = data.delivery_id;
      delete o.nextAttempt;
    } catch {
      if (o.attempts >= 10) o.status = 'failed';
    }
    await save(o);
  }
  async function notificationStatus(o) {
    if (!live || o.status === 'preview') return 'preview';
    if (o.status === 'draft') throw new ApiError(409, 'Заказ ещё не отправлен.');
    if (!o.deliveryId) return o.status === 'failed' ? 'failed' : 'pending';
    const previous = notificationChecks.get(o.id);
    if (previous && previous.expires > now()) return previous.result;
    const result = (async () => {
      try {
        const r = await fetchGateway(gatewayUrl + '/deliveries/' + o.deliveryId, {
          method: 'GET',
          headers: { 'Idempotency-Key': 'text-order-' + o.id },
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) return 'unknown';
        const data = await r.json();
        return data.status === 'sent'
          ? 'delivered'
          : data.status === 'failed'
            ? 'failed'
            : ['queued', 'sending', 'retry'].includes(data.status)
              ? 'pending'
              : 'unknown';
      } catch {
        return 'unknown';
      }
    })();
    const entry = { result, expires: now() + 10000 };
    notificationChecks.set(o.id, entry);
    const status = await result;
    if (['delivered', 'failed'].includes(status)) entry.expires = o.expires;
    return status;
  }
  async function tick() {
    if (closing) return;
    await cleanup();
    for (const o of records.values())
      if (
        (o.status === 'prepared' || (o.status === 'retrying' && o.nextAttempt <= now())) &&
        !locks.has(o.id)
      ) {
        locks.add(o.id);
        try {
          await deliver(o);
        } finally {
          locks.delete(o.id);
        }
      }
  }
  const timer = setInterval(
    () => tick().catch(() => console.error('Не удалось обработать очередь заказов')),
    15000,
  );
  timer.unref();
  async function route(req, res, pathname, { json, body, sameOrigin }) {
    if (pathname.startsWith('/order-files/')) {
      if (!['GET', 'HEAD'].includes(req.method))
        throw new ApiError(405, 'Метод не поддерживается.');
      const match = pathname.match(/^\/order-files\/([a-f0-9]{64})\/(quote|archive|[a-f0-9]{24})$/),
        o = match && [...records.values()].find((o) => o.downloadToken === match[1]);
      if (!o || expiry(o) <= now() || o.status === 'draft')
        throw new ApiError(404, 'Ссылка не найдена или срок действия истёк.');
      const id = match[2],
        f =
          id === 'quote'
            ? { stored: 'quote.pdf', name: 'ТЕКСТ-' + o.number + '.pdf', type: 'application/pdf' }
            : id === 'archive'
              ? { stored: 'files.zip', name: 'ТЕКСТ-' + o.number + '.zip', type: 'application/zip' }
              : o.files.find((f) => f.id === id);
      if (!f) throw new ApiError(404, 'Файл не найден.');
      const location = path.join(folder(o.id), f.stored),
        info = await stat(location);
      res.writeHead(200, {
        'Content-Type': f.type || 'application/octet-stream',
        'Content-Length': info.size,
        'Content-Disposition': `attachment; filename="download${path.extname(f.name)}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        ...fileHeaders,
      });
      if (req.method === 'HEAD') res.end();
      else await pipeline(createReadStream(location), res);
      return true;
    }
    if (!pathname.startsWith('/api/orders/')) return false;
    if (pathname === '/api/orders/config' && req.method === 'GET') {
      json(res, 200, {
        enabled: true,
        mode: live ? 'live' : 'preview',
        maxFileBytes: 100 * MB,
        maxTotalBytes: 500 * MB,
        maxFiles: 20,
        retentionDays,
      });
      return true;
    }
    const notification = pathname.match(/^\/api\/orders\/([a-f0-9-]{36})\/notification$/);
    if (notification && req.method === 'GET') {
      const o = authorized(notification[1], req);
      json(res, 200, { notification: await notificationStatus(o) });
      return true;
    }
    if (!['POST', 'PUT'].includes(req.method)) throw new ApiError(405, 'Метод не поддерживается.');
    sameOrigin(req);
    if (pathname === '/api/orders/draft' && req.method === 'POST') {
      const b = await body(req);
      if (!uuid.test(b.requestId || ''))
        throw new ApiError(400, 'Некорректный идентификатор заказа.');
      const fingerprint = hash(JSON.stringify(b)),
        old = records.get(b.requestId);
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new ApiError(409, 'Для изменённого заказа создайте новый запрос.');
        const retryKey = req.headers['x-order-token'];
        if (!hex.test(retryKey || '') || hash(retryKey) !== old.uploadHash)
          throw new ApiError(409, 'Заказ уже существует. Продолжите его из исходного окна.');
        json(res, 200, { ...response(old), files: old.files, changed: old.quote.changed });
        return true;
      }
      rate(req);
      await cleanup();
      if (records.size >= 1000) throw new ApiError(503, 'Сервис занят. Свяжитесь со студией.');
      const contact = {
        name: text(b.contact?.name, 100),
        phone: text(b.contact?.phone, 30),
        email: text(b.contact?.email, 320),
        comment: text(b.contact?.comment, 5000),
      };
      if (!contact.name || contact.phone.replace(/\D/g, '').length < 6)
        throw new ApiError(400, 'Укажите имя и телефон.');
      contact.channel = b.contact?.channel ?? 'max';
      if (!['max', 'telegram'].includes(contact.channel))
        throw new ApiError(400, 'Выберите MAX или Telegram для связи.');
      if (contact.channel === 'telegram') {
        const username =
          typeof b.contact?.telegram === 'string'
            ? b.contact.telegram.trim().replace(/^@/, '')
            : '';
        if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username))
          throw new ApiError(
            400,
            'Укажите имя пользователя Telegram: 5–32 символа, латинские буквы, цифры и подчёркивание.',
          );
        contact.telegram = '@' + username;
      }
      if (b.consent !== '2026-10-07')
        throw new ApiError(400, 'Подтвердите согласие на обработку персональных данных.');
      if (!Array.isArray(b.files) || b.files.length > 20)
        throw new ApiError(400, 'Можно прикрепить до 20 файлов.');
      const kind = b.kind ?? 'cart';
      if (!['cart', 'request'].includes(kind)) throw new ApiError(400, 'Некорректный тип заявки.');
      const withoutCalculation =
        kind === 'request' && Array.isArray(b.items) && b.items.length === 0;
      if (withoutCalculation && !b.files.length && !contact.comment)
        throw new ApiError(400, 'Прикрепите макет или опишите задачу.');
      const quote = withoutCalculation
          ? {
              rows: [],
              breakdown: { total: 0, surcharges: {} },
              total: 0,
              upper: 0,
              changed: false,
              catalog: [],
              revision: store.snapshot().revision,
            }
          : pricing.quote(b.items),
        manifest = b.files.map((f) => {
          const name = filename(f.name);
          if (
            !name ||
            !/\.(pdf|jpe?g|png|tiff?|svg|ai|eps|cdr|psd|docx?|zip)$/i.test(name) ||
            !Number.isSafeInteger(f.size) ||
            f.size < 1 ||
            f.size > 100 * MB
          )
            throw new ApiError(
              400,
              'Проверьте файл: PDF, изображение, исходник или ZIP, до 100 МБ.',
            );
          if (f.itemKey != null && !quote.rows.some((r) => r.key === f.itemKey))
            throw new ApiError(400, 'Файл не связан с позицией заказа.');
          const id = randomBytes(12).toString('hex');
          return {
            id,
            name,
            size: f.size,
            itemKey: f.itemKey || null,
            stored: id + '.bin',
            uploaded: false,
          };
        });
      for (const row of quote.rows) {
        const names = manifest.filter((f) => f.itemKey === row.key).map((f) => f.name);
        if (names.length) row.fileName = names.join(', ');
      }
      const bytes = manifest.reduce((sum, f) => sum + f.size, 0);
      if (
        bytes > 500 * MB ||
        2 * bytes + 6 * MB + [...records.values()].reduce((sum, o) => sum + o.reserved, 0) >
          maxStorageBytes
      )
        throw new ApiError(413, 'Слишком большой объём файлов. Свяжитесь со студией.');
      const disk = await statfs(directory);
      if (disk.bavail * disk.bsize < 2 * bytes + 6 * MB + 512 * MB)
        throw new ApiError(503, 'Недостаточно места для макетов. Свяжитесь со студией.');
      const uploadToken = hex.test(req.headers['x-order-token'] || '')
          ? req.headers['x-order-token']
          : token(),
        downloadToken = token(),
        created = now(),
        id = b.requestId,
        number =
          'TXT-' +
          new Date(created).toISOString().slice(0, 10).replaceAll('-', '') +
          '-' +
          id.slice(0, 8).toUpperCase();
      const pageUrl = new URL(
        text(b.pageUrl, 2000) || '/',
        publicOrigin || 'http://' + req.headers.host,
      );
      if (pageUrl.origin !== (publicOrigin || 'http://' + req.headers.host))
        throw new ApiError(400, 'Некорректная страница заказа.');
      const utm = Object.fromEntries(
        ['utm_source', 'utm_medium', 'utm_campaign']
          .filter((k) => text(b.utm?.[k], 300))
          .map((k) => [k, text(b.utm[k], 300)]),
      );
      const o = {
        id,
        number,
        kind,
        created,
        expires: created + retentionDays * 86400000,
        status: 'draft',
        contact,
        consent: { version: b.consent, at: new Date(created).toISOString() },
        quote: { ...quote, catalog: undefined },
        names: Object.fromEntries(quote.catalog.map((s) => [s.id, s.name])),
        files: manifest,
        reserved: 2 * bytes + 6 * MB,
        uploadHash: hash(uploadToken),
        downloadToken,
        fingerprint,
        pageUrl: pageUrl.href,
        utm,
        localOrigin: 'http://' + req.headers.host,
      };
      await mkdir(folder(id), { mode: 0o700 });
      await save(o);
      records.set(id, o);
      json(res, 201, { ...response(o), uploadToken, files: manifest, changed: quote.changed });
      return true;
    }
    const match = pathname.match(
      /^\/api\/orders\/([a-f0-9-]{36})\/(submit|files\/([a-f0-9]{24}))$/,
    );
    if (!match) throw new ApiError(404, 'Страница не найдена.');
    const o = authorized(match[1], req);
    if (locks.has(o.id)) throw new ApiError(409, 'Заказ обрабатывается. Повторите чуть позже.');
    locks.add(o.id);
    try {
      if (match[3] && req.method === 'PUT') {
        const f = o.files.find((f) => f.id === match[3]);
        if (!f || o.status !== 'draft') throw new ApiError(409, 'Загрузка недоступна.');
        if (req.headers['content-type'] !== 'application/octet-stream')
          throw new ApiError(415, 'Ожидается файл.');
        if (req.headers['content-length'] && Number(req.headers['content-length']) !== f.size)
          throw new ApiError(400, 'Размер файла изменился.');
        if (f.uploaded) {
          req.resume();
          json(res, 200, { ok: true });
          return true;
        }
        const tmp = path.join(folder(o.id), f.stored + '.tmp');
        let handle,
          size = 0;
        try {
          handle = await open(tmp, 'wx', 0o600);
          for await (const chunk of req) {
            size += chunk.length;
            if (size > f.size) throw new ApiError(413, 'Файл больше заявленного размера.');
            await handle.writeFile(chunk);
          }
          if (size !== f.size) throw new ApiError(400, 'Загрузка файла прервана.');
          await handle.sync();
          await handle.close();
          handle = null;
          await rename(tmp, path.join(folder(o.id), f.stored));
          f.uploaded = true;
          await save(o);
        } finally {
          await handle?.close();
          await rm(tmp, { force: true });
        }
        json(res, 200, { ok: true });
        return true;
      }
      if (match[2] === 'submit' && req.method === 'POST') {
        const b = await body(req);
        if (o.quote.changed && b.acceptRecalculation !== true)
          throw new ApiError(409, 'Подтвердите обновлённый расчёт.');
        if (o.files.some((f) => !f.uploaded))
          throw new ApiError(409, 'Дождитесь загрузки всех макетов.');
        if (o.status === 'draft') {
          // Keep an interrupted generation retryable: a ZIP is published only after completion.
          pdf ??= await createOrderPdf(root);
          const doc = await pdf(
            o,
            Object.entries(o.names).map(([id, name]) => ({ id, name })),
          );
          await writeFile(path.join(folder(o.id), 'quote.pdf'), doc, { mode: 0o600 });
          const zipTemp = path.join(folder(o.id), 'files.zip.tmp');
          await rm(zipTemp, { force: true });
          await createZip(zipTemp, [
            { name: 'Расчёт-' + o.number + '.pdf', path: path.join(folder(o.id), 'quote.pdf') },
            ...o.files.map((f, i) => ({
              name: String(i + 1).padStart(2, '0') + '-' + f.name,
              path: path.join(folder(o.id), f.stored),
            })),
          ]);
          await rename(zipTemp, path.join(folder(o.id), 'files.zip'));
          o.reserved = 2 * o.files.reduce((sum, f) => sum + f.size, 0) + doc.length * 2;
          o.status = 'prepared';
          await save(o);
        }
        if (['prepared', 'retrying', 'failed'].includes(o.status)) await deliver(o);
        json(res, 200, response(o));
        return true;
      }
      throw new ApiError(405, 'Метод не поддерживается.');
    } finally {
      locks.delete(o.id);
    }
  }
  const adminSummary = (o) => ({
    id: o.id,
    number: o.number,
    kind: o.kind || 'cart',
    created: new Date(o.created).toISOString(),
    expires: new Date(o.expires).toISOString(),
    status: o.status,
    contact: {
      name: o.contact.name,
      phone: o.contact.phone,
      channel: o.contact.channel || 'max',
      telegram: o.contact.telegram,
    },
    total: o.quote.total,
    upper: o.quote.upper,
    unknownCount: o.quote.rows.filter((r) => r.price === null).length,
    itemsCount: o.quote.rows.length,
    filesCount: o.files.length,
  });
  function adminList({ query = '', status = '', page = 1 } = {}) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
      throw new ApiError(400, 'Некорректная страница списка.');
    if (status && !['queued', 'preview', 'retrying', 'failed', 'prepared'].includes(status))
      throw new ApiError(400, 'Некорректный статус заказа.');
    const all = [...records.values()]
      .filter((o) => o.status !== 'draft' && expiry(o) > now())
      .sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
    const q = text(query, 150).toLocaleLowerCase('ru-RU');
    const filtered = all.filter(
      (o) =>
        (!status || o.status === status) &&
        (!q ||
          [o.number, o.contact.name, o.contact.phone, o.contact.telegram, ...Object.values(o.names)]
            .join(' ')
            .toLocaleLowerCase('ru-RU')
            .includes(q)),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / 20)),
      currentPage = Math.min(page, pages);
    return {
      orders: filtered.slice((currentPage - 1) * 20, currentPage * 20).map(adminSummary),
      total: filtered.length,
      page: currentPage,
      pages,
      summary: {
        orders: all.length,
        total: all.reduce((n, o) => n + o.quote.total, 0),
        needsAttention: all.filter((o) => ['failed', 'retrying'].includes(o.status)).length,
      },
    };
  }
  function adminDetail(id) {
    const o = records.get(id);
    if (!o || o.status === 'draft' || expiry(o) <= now())
      throw new ApiError(404, 'Заказ не найден или срок хранения истёк.');
    return {
      ...adminSummary(o),
      contact: { ...o.contact, channel: o.contact.channel || 'max' },
      items: o.quote.rows.map((r) => ({ ...r, name: o.names[r.id] })),
      surcharges: o.quote.breakdown.surcharges,
      links: links(o),
      pageUrl: o.pageUrl,
      consent: o.consent,
    };
  }
  return {
    route,
    adminList,
    adminDetail,
    close: () => {
      closing = true;
      clearInterval(timer);
    },
    tick,
    cleanup,
  };
}
