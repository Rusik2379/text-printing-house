import http from 'node:http';
import { readFile, stat, realpath, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { loadCatalog } from './.server/catalog.mjs';
import { createStore, outsideRoot, ApiError } from './.server/storage.mjs';
import { createAuth } from './.server/auth.mjs';
import { createOrders } from './.server/orders.mjs';
import { loadLegacyRedirects } from './.server/legacy-redirects.mjs';
import { createContentPrices } from './.server/content-prices.mjs';
import { createRatings } from './.server/site-ratings.mjs';
import { createPublicAi } from './.server/public-ai.mjs';
import { publicResponses } from './.server/public-response.mjs';

const siteRoot = fileURLToPath(new URL('.', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const adminHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'",
};
function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...adminHeaders,
    ...headers,
  });
  res.end(JSON.stringify(data));
}
async function body(req, maximum = 2 * 1024 * 1024) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    throw new ApiError(415, 'Ожидается JSON.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maximum) throw new ApiError(413, 'Слишком большой запрос.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch {
    throw new ApiError(400, 'Некорректный запрос.');
  }
}
export async function createSiteServer({
  root = siteRoot,
  dataDir = process.env.ADMIN_DATA_DIR || path.resolve(root, '..', '.text-admin'),
  publicOrigin = process.env.PUBLIC_ORIGIN,
  authOptions = {},
  ordersOptions = {},
  trustProxy = process.env.TRUST_PROXY === '1',
} = {}) {
  root = await realpath(root);
  dataDir = outsideRoot(root, dataDir);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  dataDir = outsideRoot(root, await realpath(dataDir));
  const origin = publicOrigin ? new URL(publicOrigin) : null;
  if (
    origin &&
    (origin.protocol !== 'https:' ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash ||
      origin.username ||
      origin.password)
  )
    throw Error('PUBLIC_ORIGIN должен быть HTTPS-адресом сайта без пути.');
  if (process.env.NODE_ENV === 'production' && !origin)
    throw Error('Для production задайте PUBLIC_ORIGIN=https://ваш-домен.');
  const catalog = await loadCatalog(root),
    store = await createStore(dataDir, catalog),
    auth = await createAuth(dataDir, { ...authOptions, secure: Boolean(origin) }),
    cache = new Map();
  const orders = await createOrders({
    root,
    dataDir,
    catalog,
    store,
    publicOrigin: origin?.origin,
    ...ordersOptions,
  });
  const contentPrices = await createContentPrices({ root, catalog, store });
  const ratings = await createRatings(dataDir);
  const publicAi = await createPublicAi({ root, catalog, store });
  const sendPublic = publicResponses();
  const redirects = await loadLegacyRedirects(root);
  function validHost(req) {
    const host = req.headers.host;
    if (origin) return host === origin.host;
    const port = server.address()?.port;
    return host === `127.0.0.1:${port}` || host === `localhost:${port}` || host === `[::1]:${port}`;
  }
  function sameOrigin(req) {
    if (
      !validHost(req) ||
      req.headers.origin !== (origin?.origin || 'http://' + req.headers.host) ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new ApiError(403, 'Запрос с другого сайта запрещён.');
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (!validHost(req)) throw new ApiError(400, 'Недопустимый адрес сервера.');
      const url = new URL(req.url, 'http://localhost'),
        pathname = decodeURIComponent(url.pathname);
      if (trustProxy) {
        const forwarded = req.headers['x-real-ip'];
        if (typeof forwarded === 'string' && /^[a-fA-F0-9:.]{3,50}$/.test(forwarded))
          req.clientAddress = forwarded;
      }
      if (pathname === '/healthz' && req.method === 'GET') {
        json(res, 200, { ok: true });
        return;
      }
      if (pathname.startsWith('/api/ai/')) {
        const base = (origin?.origin || 'http://' + req.headers.host) + '/';
        if (pathname === '/api/ai/services' && req.method === 'GET') {
          json(res, 200, publicAi.search(url.searchParams, base));
          return;
        }
        if (['/api/ai/parameters', '/api/ai/quote'].includes(pathname) && req.method === 'POST') {
          sameOrigin(req);
          const data = await body(req, 32768);
          json(
            res,
            200,
            publicAi[pathname.endsWith('/quote') ? 'calculate' : 'parameters'](data, base),
          );
          return;
        }
        throw new ApiError(404, 'Инструмент не найден.');
      }
      if (await orders.route(req, res, pathname, { json, body, sameOrigin })) return;
      if (pathname.startsWith('/api/admin/')) {
        if (!['GET', 'POST'].includes(req.method))
          throw new ApiError(405, 'Метод не поддерживается.');
        if (pathname === '/api/admin/login' && req.method === 'POST') {
          sameOrigin(req);
          const b = await body(req),
            result = await auth.login(req, b.password);
          json(res, 200, { csrf: result.csrf }, { 'Set-Cookie': result.cookie });
          return;
        }
        if (pathname === '/api/admin/session' && req.method === 'GET') {
          const s = auth.session(req);
          json(res, 200, { authenticated: Boolean(s), configured: auth.ready(), csrf: s?.csrf });
          return;
        }
        const s = auth.session(req);
        if (!s) throw new ApiError(401, 'Войдите в админку.');
        if (req.method === 'POST') {
          sameOrigin(req);
          auth.csrf(req, s);
        }
        if (pathname === '/api/admin/logout' && req.method === 'POST') {
          json(res, 200, { ok: true }, { 'Set-Cookie': auth.logout(req) });
          return;
        }
        if (pathname === '/api/admin/password' && req.method === 'POST') {
          const b = await body(req);
          json(
            res,
            200,
            { ok: true },
            { 'Set-Cookie': await auth.changePassword(req, b.current, b.password) },
          );
          return;
        }
        if (pathname === '/api/admin/orders' && req.method === 'GET') {
          json(
            res,
            200,
            orders.adminList({
              query: url.searchParams.get('q') || '',
              status: url.searchParams.get('status') || '',
              page: Number(url.searchParams.get('page') || 1),
            }),
          );
          return;
        }
        if (pathname.startsWith('/api/admin/orders/') && req.method === 'GET') {
          json(res, 200, orders.adminDetail(pathname.slice('/api/admin/orders/'.length)));
          return;
        }
        if (pathname === '/api/admin/catalog' && req.method === 'GET') {
          json(res, 200, { ...catalog.view(store.overrides()), ...store.snapshot() });
          return;
        }
        if (pathname === '/api/admin/ratings' && req.method === 'GET') {
          json(res, 200, ratings.snapshot());
          return;
        }
        if (pathname === '/api/admin/ratings' && req.method === 'POST') {
          const b = await body(req);
          const result = await ratings.replace(b.revision, b.ratings);
          cache.clear();
          json(res, 200, result);
          return;
        }
        if (pathname === '/api/admin/export' && req.method === 'GET') {
          json(res, 200, store.export(), {
            'Content-Disposition': 'attachment; filename="text-tariffs.json"',
          });
          return;
        }
        if (pathname === '/api/admin/save' && req.method === 'POST') {
          const b = await body(req);
          if (!b.changes || typeof b.changes !== 'object' || Array.isArray(b.changes))
            throw new ApiError(400, 'Укажите изменения.');
          try {
            catalog.validate(b.changes);
          } catch (e) {
            throw new ApiError(400, e.message);
          }
          const result = await store.replace(
            b.revision,
            { ...store.overrides(), ...b.changes },
            'Изменение тарифов',
          );
          cache.clear();
          json(res, 200, result);
          return;
        }
        if (pathname === '/api/admin/import' && req.method === 'POST') {
          const b = await body(req);
          if (b.backup?.version !== 1 || b.backup.sourceRevision !== catalog.sourceRevision)
            throw new ApiError(400, 'Резервная копия относится к другой версии тарифов.');
          try {
            catalog.validate(b.backup.overrides);
          } catch (e) {
            throw new ApiError(400, e.message);
          }
          const result = await store.replace(
            b.revision,
            b.backup.overrides,
            'Импорт резервной копии',
          );
          cache.clear();
          json(res, 200, result);
          return;
        }
        if (pathname === '/api/admin/rollback' && req.method === 'POST') {
          const b = await body(req);
          const result = await store.rollback(b.revision, b.id);
          cache.clear();
          json(res, 200, result);
          return;
        }
        throw new ApiError(404, 'Страница не найдена.');
      }
      if (!['GET', 'HEAD'].includes(req.method))
        throw new ApiError(405, 'Метод не поддерживается.');
      if (pathname === '/admin') {
        res.writeHead(308, { Location: '/admin/', ...adminHeaders });
        res.end();
        return;
      }
      if (
        ['/admin/', '/admin/admin.js', '/admin/admin.css', '/admin/orders.css'].includes(pathname)
      ) {
        const filename = pathname === '/admin/' ? 'index.html' : path.basename(pathname),
          data = await readFile(path.join(root, '.server', 'admin', filename));
        res.writeHead(200, { 'Content-Type': types[path.extname(filename)], ...adminHeaders });
        res.end(req.method === 'HEAD' ? undefined : data);
        return;
      }
      // Ownership files keep their original contents and public root URLs.
      // Store them outside the page generators so they are never given SEO markup.
      if (/^\/(?:yandex_[a-f0-9]{16}|google[a-f0-9]{16})\.html$/.test(pathname)) {
        const data = await readFile(path.join(root, '.server', 'verifications', pathname.slice(1)));
        await sendPublic(req, res, data, types['.html']);
        return;
      }
      const parts = pathname.split('/').filter(Boolean);
      if (
        parts.some(
          (p) =>
            p.startsWith('.') ||
            ['node_modules', 'scripts', 'tests', 'docs', 'deploy', 'preview', 'tools'].includes(p),
        ) ||
        /[\\\x00-\x1f]/.test(pathname)
      )
        throw new ApiError(404, 'Страница не найдена.');
      if (redirects.has(pathname)) {
        res.writeHead(301, {
          Location: redirects.get(pathname) + url.search,
          'Cache-Control': 'no-cache',
        });
        res.end();
        return;
      }
      let file = path.resolve(root, '.' + pathname);
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative))
        throw new ApiError(404, 'Страница не найдена.');
      if ((await stat(file)).isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(308, { Location: pathname + '/' + url.search });
          res.end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      file = await realpath(file);
      const actual = path.relative(root, file);
      if (
        actual.startsWith('..') ||
        path.isAbsolute(actual) ||
        actual
          .split(path.sep)
          .some(
            (p) =>
              p.startsWith('.') ||
              ['node_modules', 'scripts', 'tests', 'docs', 'preview', 'tools'].includes(p),
          ) ||
        !types[path.extname(file)]
      )
        throw new ApiError(404, 'Страница не найдена.');
      const filename = path.relative(root, file);
      let data;
      if (catalog.modules.has(filename)) {
        if (!cache.has(filename)) cache.set(filename, catalog.render(filename, store.overrides()));
        data = cache.get(filename);
      } else if (path.extname(file) === '.html') {
        if (!cache.has(filename))
          cache.set(filename, ratings.render(contentPrices.render(await readFile(file, 'utf8'))));
        data = cache.get(filename);
      } else if (filename === 'llms.txt') {
        data = (await readFile(file, 'utf8')).replaceAll(
          'https://text-print.ru',
          origin?.origin || 'http://' + req.headers.host,
        );
      } else data = await readFile(file);
      await sendPublic(
        req,
        res,
        data,
        types[path.extname(file)],
        /^assets[\\/]optimized[\\/].*-[a-f0-9]{12}-\d+\.webp$/.test(filename),
      );
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status =
        e instanceof ApiError
          ? e.status
          : e.code === 'ENOENT'
            ? 404
            : e instanceof URIError
              ? 400
              : 500;
      if (status >= 500) console.error('Ошибка сервера:', e.message);
      json(
        res,
        status,
        e instanceof ApiError
          ? { error: e.message }
          : { error: status === 404 ? 'Страница не найдена.' : 'Не удалось выполнить запрос.' },
        status === 429 ? { 'Retry-After': '900' } : {},
      );
    }
  });
  server.requestTimeout = 10 * 60 * 1000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.on('close', orders.close);
  return { server, catalog, store, auth, orders };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4173),
    host = process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.PUBLIC_ORIGIN)
    throw Error('Для внешнего доступа настройте PUBLIC_ORIGIN и HTTPS proxy.');
  const { server } = await createSiteServer();
  server.listen(port, host, () => console.log(`ТЕКСТ: http://${host}:${port}/ · Админка: /admin/`));
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 15000).unref();
    });
}
