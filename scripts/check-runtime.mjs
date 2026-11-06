import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createSiteServer } from '../server.mjs';

const root = path.resolve(import.meta.dirname, '../.build/site');
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tekst-runtime-'));
const app = await createSiteServer({
  root,
  dataDir,
  publicOrigin: undefined,
  ordersOptions: { gatewayUrl: '' },
});
await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + app.server.address().port;
const request = async (route, body) => {
  const r = await fetch(
    new URL(route, origin),
    body
      ? {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  assert.equal(r.status, 200, route);
  return r;
};
try {
  const catalog = await (await request('/api/ai/services?limit=55')).json();
  assert.equal(catalog.total, 55);
  for (const s of catalog.services) {
    await request(s.url);
    const q = await (await request('/api/ai/quote', { serviceId: s.id })).json();
    assert.ok(Number.isFinite(q.price), s.id);
  }
  const sitemap = await fs.readFile(path.join(root, 'sitemap.xml'), 'utf8');
  const routes = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const route of routes) await request(route);
  for (const route of [
    '/admin/',
    '/favicon.ico',
    '/assets/favicon.svg',
    '/vendor/pdf/pdf-lib-1.17.1.min.js',
  ])
    await request(route);
  for (const filename of await fs.readdir(path.join(root, '.server', 'verifications'))) {
    const r = await request('/' + filename);
    assert.deepEqual(
      Buffer.from(await r.arrayBuffer()),
      await fs.readFile(path.join(root, '.server', 'verifications', filename)),
      'Ownership verification must retain the supplied contents',
    );
    assert.equal((await fetch(origin + '/.server/verifications/' + filename)).status, 404);
  }
  for (const file of [
    'node_modules',
    'scripts',
    'docs',
    '.env',
    'tests',
    'company-content.json',
    'package-lock.json',
  ]) {
    await assert.rejects(fs.stat(path.join(root, file)), { code: 'ENOENT' });
  }
  assert.equal((await fetch(origin + '/api/admin/orders')).status, 401);
  console.log(
    `Built runtime: ${catalog.total} calculators, ${routes.length} sitemap pages, ownership verification, PDF assets, favicon and protected admin passed; no orders sent.`,
  );
} finally {
  app.server.closeAllConnections();
  await new Promise((resolve) => app.server.close(resolve));
  // This is the unique temporary directory returned by mkdtemp above.
  await fs.rm(dataDir, { recursive: true, force: true });
}
