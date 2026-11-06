import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.build', 'site');
const publicFolders = [
  'assets',
  'company',
  'contacts',
  'cities',
  'poisk',
  'dostavka-i-oplata',
  'equipment',
  'fonts',
  'for-business',
  'guide',
  'kak-oformit-zakaz',
  'kopitsentr',
  'listovaya-poligrafiya',
  'materials',
  'nakleyki-i-stikery',
  'podbor-uslugi',
  'proektnaya-dokumentatsiya',
  'requirements',
  'shirokiy-format',
  'technologies',
  'uv-pechat-i-rezka',
  'vendor',
];
const entryFiles = [
  'server.mjs',
  'index.html',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
];

// The only recursively replaced path is our generated directory, never source or /data.
await fs.mkdir(path.dirname(output), { recursive: true });
const parent = await fs.realpath(path.dirname(output));
if (parent !== path.join(await fs.realpath(root), '.build'))
  throw Error('Unexpected build directory');
const info = await fs.lstat(output).catch(() => null);
if (info?.isSymbolicLink()) throw Error('Build output must not be a symbolic link');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output);

for (const name of [...publicFolders, '.server']) {
  await fs.cp(path.join(root, name), path.join(output, name), {
    recursive: true,
    filter: (file) => !file.endsWith('.md'),
  });
}
for (const entry of await fs.readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && (/\.(js|css)$/.test(entry.name) || entryFiles.includes(entry.name))) {
    await fs.copyFile(path.join(root, entry.name), path.join(output, entry.name));
  }
}
await fs.writeFile(
  path.join(output, 'package.json'),
  JSON.stringify(
    { name: 'tekst-site', private: true, type: 'module', engines: { node: '>=24' } },
    null,
    2,
  ) + '\n',
);
await fs.writeFile(
  path.join(output, '.build-info.json'),
  JSON.stringify(
    { builtAt: new Date().toISOString(), runtime: 'Node.js 24', dependencies: [] },
    null,
    2,
  ) + '\n',
);
await fs.mkdir(path.join(output, 'tools'));
await fs.copyFile(
  path.join(root, 'scripts/admin-setup.mjs'),
  path.join(output, 'tools/admin-setup.mjs'),
);
console.log(
  'Production runtime ready: .build/site (public site + server; no development dependencies or private configuration).',
);
