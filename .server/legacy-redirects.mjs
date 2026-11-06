import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
export async function loadLegacyRedirects(root) {
  const data = JSON.parse(
      await readFile(path.join(root, '.server', 'legacy-redirects.json'), 'utf8'),
    ),
    routes = new Map();
  for (const [from, to] of Object.entries(data.routes)) {
    if (!/^\/[a-z0-9_/-]+\/$/.test(from) || !/^\/(?:[a-z0-9_/-]+\/)?$/.test(to) || from === to)
      throw Error('Invalid legacy redirect');
    if (data.routes[to]) throw Error('Legacy redirect chain is not allowed');
    await stat(path.join(root, to, 'index.html'));
    try {
      await stat(path.join(root, from, 'index.html'));
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    routes.set(from, to);
    routes.set(from.slice(0, -1), to);
  }
  return routes;
}
