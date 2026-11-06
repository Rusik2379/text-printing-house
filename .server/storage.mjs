import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function outsideRoot(root, directory) {
  const relative = path.relative(path.resolve(root), path.resolve(directory));
  if (
    !relative ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  )
    throw Error('ADMIN_DATA_DIR должен находиться вне папки сайта.');
  return path.resolve(directory);
}
export async function atomicJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(data, null, 2) + '\n');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
export async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
export async function createStore(directory, catalog) {
  const file = path.join(directory, 'tariffs.json');
  let state = await readJson(file);
  if (state) {
    if (state.version !== 1 || !Array.isArray(state.history))
      throw Error('Некорректное хранилище тарифов.');
    catalog.validate(state.overrides);
    if (state.sourceRevision !== catalog.sourceRevision && Object.keys(state.overrides).length)
      throw Error(
        'Исходные тарифы изменились. Сначала согласуйте сохранённые правки с новой версией сайта (docs/admin.md).',
      );
  }
  if (!state || state.sourceRevision !== catalog.sourceRevision)
    state = {
      version: 1,
      sourceRevision: catalog.sourceRevision,
      revision: randomUUID(),
      overrides: {},
      history: [],
    };
  let pending = Promise.resolve();
  const snapshot = () => ({
    revision: state.revision,
    sourceRevision: state.sourceRevision,
    overrides: { ...state.overrides },
    history: state.history.map(({ overrides, ...h }) => h),
  });
  async function transaction(fn) {
    const result = pending.then(fn);
    pending = result.catch(() => {});
    return result;
  }
  async function replace(revision, values, message) {
    return transaction(async () => {
      if (revision !== state.revision)
        throw new ApiError(
          409,
          'Тарифы уже изменены в другой вкладке. Обновите данные перед сохранением.',
        );
      catalog.validate(values);
      const overrides = Object.fromEntries(
        Object.entries(values).filter(([id, v]) => v !== catalog.fields.get(id).base),
      );
      if (
        JSON.stringify(Object.entries(overrides).sort()) ===
        JSON.stringify(Object.entries(state.overrides).sort())
      )
        return snapshot();
      const changed = [
        ...new Set([...Object.keys(overrides), ...Object.keys(state.overrides)]),
      ].filter(
        (id) =>
          (overrides[id] ?? catalog.fields.get(id).base) !==
          (state.overrides[id] ?? catalog.fields.get(id).base),
      ).length;
      const entry = {
        id: state.revision,
        at: new Date().toISOString(),
        message,
        changed,
        overrides: state.overrides,
      };
      const next = {
        version: 1,
        sourceRevision: catalog.sourceRevision,
        revision: randomUUID(),
        overrides,
        history: [entry, ...state.history].slice(0, 30),
      };
      await atomicJson(file, next);
      state = next;
      return snapshot();
    });
  }
  return {
    snapshot,
    overrides: () => state.overrides,
    replace,
    rollback: (revision, id) => {
      const entry = state.history.find((h) => h.id === id);
      if (!entry) throw new ApiError(404, 'Версия не найдена.');
      return replace(revision, entry.overrides, 'Возврат к версии ' + entry.at);
    },
    export: () => ({
      version: 1,
      sourceRevision: catalog.sourceRevision,
      exportedAt: new Date().toISOString(),
      overrides: state.overrides,
    }),
  };
}
