import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createSiteServer } from '../server.mjs';
import { createQuotation } from '../.server/quotation.mjs';
test('AI discovery: 55 real calculators, validated schemas, current tariffs, private data excluded and llms links', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'text-ai-')),
    app = await createSiteServer({ dataDir: dir, ordersOptions: { gatewayUrl: '' } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const post = (url, data, origin = base) =>
    fetch(base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(data),
    });
  try {
    let r = await fetch(base + '/api/ai/services?limit=55'),
      all = await r.json();
    assert.equal(all.total, 55);
    const pricing = await createQuotation(process.cwd(), app.catalog, app.store);
    for (const s of all.services) {
      assert.ok(s.url.startsWith(base));
      r = await post('/api/ai/parameters', { serviceId: s.id });
      assert.equal(r.status, 200, s.id);
      const p = await r.json();
      assert.ok(p.fields.length > 0, s.id);
      assert.ok(p.inputSchema.properties);
      assert.ok(
        !/"(?:book|sheets|tariffs|credentials|overrides|history)":/.test(JSON.stringify(p)),
        'No private workbook or admin data',
      );
      r = await post('/api/ai/quote', { serviceId: s.id, configuration: p.configuration });
      assert.equal(r.status, 200, s.id);
      const q = await r.json(),
        expected = pricing.quote([
          { key: 'check', id: s.id, configuration: p.configuration, price: null },
        ]);
      assert.equal(q.price, expected.total, s.id);
      assert.equal(q.orderCreated, false);
      assert.ok(q.url.endsWith('#calculator'));
    }
    r = await fetch(base + '/api/ai/services?q=' + encodeURIComponent('листовки'));
    assert.equal((await r.json()).services[0].id, '3.2');
    for (const data of [
      { serviceId: '3.2', configuration: { B10: -1 } },
      { serviceId: '3.2', configuration: { B7: 999 } },
      { serviceId: '3.2', configuration: { price: 1 } },
      { serviceId: '2.1', configuration: { rows: [{ B: 'A1', C: 'Ч/Б', D: -2 }] } },
      { serviceId: '4.1', configuration: { quantity: 0 } },
    ])
      assert.equal((await post('/api/ai/quote', data)).status, 400, JSON.stringify(data));
    assert.equal(
      (await post('/api/ai/quote', { serviceId: '1.1' }, 'https://other.invalid')).status,
      403,
    );
    assert.equal((await post('/api/ai/parameters', { serviceId: '9.9' })).status, 404);
    const before = await (
        await post('/api/ai/quote', { serviceId: '1.1', configuration: { B7: 25 } })
      ).json(),
      field = [...app.catalog.fields.values()].find(
        (f) =>
          f.file === 'copycenter-pricing-data.js' &&
          f.service === '1.1' &&
          f.ref === 'E6' &&
          f.base === 7,
      );
    await app.store.replace(app.store.snapshot().revision, { [field.id]: 9 }, 'Isolated test');
    const after = await (
      await post('/api/ai/quote', { serviceId: '1.1', configuration: { B7: 25 } })
    ).json();
    assert.notEqual(after.price, before.price);
    assert.notEqual(after.revision, before.revision);
    r = await fetch(base + '/llms.txt');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/plain; charset=utf-8/);
    const text = await r.text(),
      links = [...text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => new URL(m[1]));
    assert.ok(links.length >= 94);
    for (const u of links) {
      assert.equal(u.origin, base);
      await stat(path.join(process.cwd(), u.pathname, 'index.html'));
    }
    assert.equal((await fetch(base + '/.well-known/ai-catalog.json')).status, 404);
    assert.equal((await fetch(base + '/api/admin/orders')).status, 401);
  } finally {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
test('WebMCP registers only three read-only tools and delegates to the real HTTP API without touching the page', async () => {
  const source = await readFile(new URL('../webmcp.js', import.meta.url), 'utf8'),
    tools = [],
    requests = [],
    context = {
      URL,
      URLSearchParams,
      Promise,
      JSON,
      document: {
        currentScript: { src: 'https://example.invalid/sub/webmcp.js' },
        modelContext: { registerTool: (tool) => tools.push(tool) },
      },
      navigator: {},
      fetch: async (url, options) => {
        requests.push({ url: String(url), options });
        return { ok: true, json: async () => ({ ok: true }) };
      },
    };
  vm.runInNewContext(source, context);
  assert.deepEqual(
    tools.map((t) => t.name),
    ['search_print_services', 'get_print_service_parameters', 'configure_print_calculation'],
  );
  for (const t of tools) {
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.consequentialHint, false);
  }
  const controller = new AbortController();
  await tools[0].execute({ query: 'листовки' }, { signal: controller.signal });
  await tools[1].execute({ serviceId: '3.2' });
  await tools[2].execute({ serviceId: '3.2', parameters: { B10: 50 } });
  assert.equal(requests[0].options.signal, controller.signal);
  assert.ok(requests[0].url.startsWith('https://example.invalid/sub/api/ai/services?'));
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    serviceId: '3.2',
    configuration: { B10: 50 },
  });
  vm.runInNewContext(source, { document: {}, navigator: {} }); // Unsupported browsers quietly skip initialization.
});
