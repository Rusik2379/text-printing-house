import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createSiteServer } from '../server.mjs';
test('Legacy addresses redirect directly to real pages while existing addresses remain available', async () => {
  const data = JSON.parse(
      await readFile(new URL('../.server/legacy-redirects.json', import.meta.url), 'utf8'),
    ),
    dir = await mkdtemp(path.join(os.tmpdir(), 'text-redirects-')),
    app = await createSiteServer({ dataDir: dir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  try {
    for (const [from, to] of Object.entries(data.routes)) {
      for (const source of [from, from.slice(0, -1)]) {
        const r = await fetch(origin + source + '?utm_source=test', { redirect: 'manual' });
        assert.equal(r.status, 301, source);
        assert.equal(r.headers.get('location'), to + '?utm_source=test');
      }
      const r = await fetch(origin + to, { redirect: 'manual' });
      assert.equal(r.status, 200, to);
    }
    for (const route of [
      '/contacts/',
      '/dostavka-i-oplata/',
      '/company/about/',
      '/company/article/',
      '/company/action/',
      '/company/photo/',
      '/company/request/',
    ])
      assert.equal((await fetch(origin + route, { redirect: 'manual' })).status, 200, route);
    assert.equal(
      (await fetch(origin + '/uslugi/does-not-exist/', { redirect: 'manual' })).status,
      404,
    );
    assert.equal((await fetch(origin + '/.server/legacy-redirects.json')).status, 404);
    const r = await fetch(origin + Object.keys(data.routes)[0], {
      method: 'HEAD',
      redirect: 'manual',
    });
    assert.equal(r.status, 301);
    assert.equal(await r.text(), '');
  } finally {
    await new Promise((r) => app.server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
