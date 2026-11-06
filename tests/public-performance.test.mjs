import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { createSiteServer } from '../server.mjs';
import { JSDOM } from 'jsdom';
test('Public compression and ETags; private responses remain uncached', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'text-performance-')),
    app = await createSiteServer({ dataDir: dir, ordersOptions: { gatewayUrl: '' } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const port = app.server.address().port;
  const request = (url, headers = {}, method = 'GET') =>
    new Promise((resolve, reject) => {
      http
        .request({ hostname: '127.0.0.1', port, path: url, headers, method }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }),
          );
        })
        .on('error', reject)
        .end();
    });
  try {
    const plain = await request('/app.js'),
      gz = await request('/app.js', { 'Accept-Encoding': 'gzip' }),
      br = await request('/app.js', { 'Accept-Encoding': 'br' });
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.equal(br.headers['content-encoding'], 'br');
    assert.deepEqual(gunzipSync(gz.body), plain.body);
    assert.deepEqual(brotliDecompressSync(br.body), plain.body);
    assert.ok(gz.body.length < plain.body.length * 0.4);
    assert.match(br.headers.vary, /Accept-Encoding/);
    const notModified = await request('/app.js', { 'If-None-Match': plain.headers.etag });
    assert.equal(notModified.status, 304);
    assert.equal(notModified.body.length, 0);
    const refused = await request('/app.js', { 'Accept-Encoding': 'br;q=0,gzip;q=0' });
    assert.equal(refused.headers['content-encoding'], undefined);
    assert.deepEqual(refused.body, plain.body);
    const head = await request('/app.js', {}, 'HEAD');
    assert.equal(head.body.length, 0);
    assert.equal(Number(head.headers['content-length']), plain.body.length);
    const privateResponse = await request('/api/admin/session');
    assert.equal(privateResponse.headers['cache-control'], 'no-store');
    assert.equal(privateResponse.headers.etag, undefined);
  } finally {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
test('Responsive image copies and markup preserve source dimensions, lazy loading and hero priority', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../scripts/image-variants.json', import.meta.url), 'utf8'),
  );
  let oldBytes = 0,
    smallBytes = 0;
  for (const [source, info] of Object.entries(manifest)) {
    const original = await stat(new URL('../' + source, import.meta.url));
    oldBytes += original.size;
    smallBytes += info.variants[0].bytes;
    assert.ok(info.variants.length >= 2);
    for (const v of info.variants) {
      assert.equal((await stat(new URL('../' + v.path, import.meta.url))).size, v.bytes);
      assert.ok(v.width <= info.width);
    }
  }
  assert.ok(smallBytes < oldBytes * 0.3);
  for (const file of [
    'index.html',
    'nakleyki-i-stikery/index.html',
    'equipment/index.html',
    'proektnaya-dokumentatsiya/inzhenernaya-pechat/index.html',
  ]) {
    const dom = new JSDOM(await readFile(new URL('../' + file, import.meta.url), 'utf8')),
      d = dom.window.document;
    assert.ok(d.querySelectorAll('img[srcset]').length > 0, file);
    for (const i of d.querySelectorAll('img[srcset]')) {
      assert.ok(i.getAttribute('sizes'));
      assert.equal(i.getAttribute('decoding'), 'async');
      assert.ok(i.getAttribute('width') && i.getAttribute('height'));
    }
    const hero = d.querySelector('[fetchpriority="high"]');
    if (hero) assert.notEqual(hero.getAttribute('loading'), 'lazy');
    dom.window.close();
  }
});
