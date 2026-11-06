import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { passwordRecord } from '../.server/auth.mjs';
import { atomicJson, readJson, outsideRoot } from '../.server/storage.mjs';
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
let directory = outsideRoot(
  root,
  process.env.ADMIN_DATA_DIR || path.resolve(root, '..', '.text-admin'),
);
await mkdir(directory, { recursive: true, mode: 0o700 });
directory = outsideRoot(root, await realpath(directory));
const file = path.join(directory, 'credentials.json');
if (await readJson(file)) {
  console.log('Вход уже настроен. Пароль можно сменить в админке.');
  process.exit(0);
}
const password = randomBytes(24).toString('base64url');
await mkdir(directory, { recursive: true, mode: 0o700 });
await atomicJson(file, await passwordRecord(password));
await writeFile(
  path.join(directory, 'access.txt'),
  `Админка ТЕКСТ\nАдрес локально: http://127.0.0.1:4173/admin/\nПароль: ${password}\n\nФайл находится вне сайта. Храните его только на своём компьютере.\nПосле смены пароля в админке этот первоначальный пароль перестанет действовать.\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Вход настроен. Пароль сохранён в ' +
    path.join(directory, 'access.txt') +
    '. Перезапустите сервер.',
);
