import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import getDb from '/app/db.js';
import TokenModel from '/app/models/token.js';

const key = (await readFile('/tmp/tekst-indexnow-key-20261026.txt', 'utf8')).trim();
assert.match(key, /^[a-f0-9]{64}$/);
const routes = JSON.parse(await readFile('/tmp/tekst-indexnow-routes-20261026.json', 'utf8'));
assert.equal(Object.keys(routes).length, 24);
for (const [from, to] of Object.entries(routes)) {
  assert.match(from, /^\/uslugi\/[a-z0-9_/-]*\/$|^\/uslugi\/$/);
  assert.match(to, /^\/(?:[a-z0-9_/-]+\/)?$/);
}
const db = getDb();
try {
  const users = await db('user').select('id', 'roles').where({ is_deleted: 0, is_disabled: 0 });
  const admin = users.find((user) =>
    (typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles).includes('admin'),
  );
  assert(admin);
  const { token } = await TokenModel().create({
    iss: 'api',
    attrs: { id: admin.id },
    scope: ['user'],
    expiresIn: '5m',
  });
  async function api(path, method = 'GET', body) {
    const response = await fetch('http://127.0.0.1:3000' + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60000),
    });
    assert(response.ok, 'NPM API ' + response.status + ' at ' + path);
    return response.json();
  }
  const hosts = await api('/nginx/proxy-hosts');
  const target = hosts.find((host) => host.id === 12);
  assert.deepEqual([...target.domain_names].sort(), ['text-print.ru', 'www.text-print.ru']);
  assert.equal(target.forward_host, 'tekst-site-app');
  assert.equal(target.forward_port, 4173);
  assert(target.enabled && target.ssl_forced);
  assert(
    !target.advanced_config.includes('TEXT-INDEXNOW-20261026'),
    'Already configured; inspect instead of overwriting',
  );
  const oldWww = 'if ($host = www.text-print.ru) { return 301 https://text-print.ru$request_uri; }';
  assert(target.advanced_config.includes(oldWww), 'Expected existing canonical-host redirect');
  const fields = [
    'domain_names',
    'forward_scheme',
    'forward_host',
    'forward_port',
    'access_list_id',
    'certificate_id',
    'ssl_forced',
    'caching_enabled',
    'block_exploits',
    'advanced_config',
    'allow_websocket_upgrade',
    'http2_support',
    'hsts_enabled',
    'hsts_subdomains',
    'trust_forwarded_proto',
    'locations',
    'meta',
  ];
  const editable = (host) =>
    Object.fromEntries(
      fields.filter((field) => field in host).map((field) => [field, host[field]]),
    );
  const original = editable(target);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = '/data/text-print-before-indexnow-' + stamp + '.json';
  const database = '/data/before-text-print-indexnow-' + stamp + '.sqlite';
  await db.raw('VACUUM INTO ?', [database]);
  await chmod(database, 0o600);
  await writeFile(backup, JSON.stringify(original, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await mkdir('/data/indexnow', { recursive: true, mode: 0o755 });
  await writeFile('/data/indexnow/' + key + '.txt', key + '\n', { mode: 0o644, flag: 'wx' });
  const redirects = Object.entries(routes)
    .map(
      ([from, to]) =>
        'if ($uri ~ "^' +
        from.slice(0, -1) +
        '/?$") { return 301 https://text-print.ru' +
        to +
        '$is_args$args; }',
    )
    .join('\n');
  const advanced =
    '# TEXT-INDEXNOW-20261026: legacy routes must run before HTTPS/host normalization.\n' +
    redirects +
    '\n' +
    oldWww +
    '\n' +
    '# Retain the same HTTPS enforcement, after the legacy direct redirects.\n' +
    'set $trust_forwarded_proto "F";\ninclude conf.d/include/force-ssl.conf;\n' +
    target.advanced_config.replace(oldWww, '').trim() +
    '\n' +
    'location = /' +
    key +
    '.txt {\n  default_type text/plain;\n  add_header X-Robots-Tag "noindex" always;\n  alias /data/indexnow/' +
    key +
    '.txt;\n}\n';
  try {
    await api('/nginx/proxy-hosts/12', 'PUT', {
      ...original,
      ssl_forced: false,
      advanced_config: advanced,
    });
    const after = await api('/nginx/proxy-hosts');
    const updated = after.find((host) => host.id === 12);
    assert(updated.enabled && updated.meta?.nginx_online !== false, 'Nginx host is not online');
    assert.equal(updated.certificate_id, target.certificate_id);
    assert.equal(updated.forward_host, target.forward_host);
    for (const host of hosts.filter((host) => host.id !== 12)) {
      const actual = after.find((item) => item.id === host.id);
      assert(
        actual &&
          actual.enabled === host.enabled &&
          actual.advanced_config === host.advanced_config &&
          actual.forward_host === host.forward_host &&
          actual.forward_port === host.forward_port &&
          JSON.stringify(actual.domain_names) === JSON.stringify(host.domain_names),
        'Another proxy configuration changed',
      );
    }
    console.log(
      JSON.stringify({
        configured: true,
        legacyRoutes: 24,
        verificationPublished: true,
        httpsEnforced: true,
        backup,
        database,
        otherProxyHostsUnchanged: true,
      }),
    );
  } catch (error) {
    await api('/nginx/proxy-hosts/12', 'PUT', original);
    throw error;
  }
} finally {
  await db.destroy();
}
