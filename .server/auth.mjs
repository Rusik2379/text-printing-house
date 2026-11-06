import { scrypt as scryptCallback, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { atomicJson, readJson, ApiError } from './storage.mjs';
const scrypt = promisify(scryptCallback),
  options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const digest = (token) => createHash('sha256').update(token).digest('hex');
export async function passwordRecord(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256)
    throw new ApiError(400, 'Пароль должен содержать от 12 до 256 символов.');
  const salt = randomBytes(32).toString('hex'),
    key = await scrypt(password, salt, 32, options);
  return { version: 1, salt, key: key.toString('hex') };
}
export async function verifyPassword(password, record) {
  if (
    typeof password !== 'string' ||
    password.length > 256 ||
    !record ||
    !/^[a-f0-9]{64}$/.test(record.salt) ||
    !/^[a-f0-9]{64}$/.test(record.key)
  )
    return false;
  const key = await scrypt(password, record.salt, 32, options);
  return timingSafeEqual(key, Buffer.from(record.key, 'hex'));
}
export async function createAuth(
  directory,
  { secure = false, now = Date.now, idleMs = 30 * 60 * 1000, maxMs = 8 * 60 * 60 * 1000 } = {},
) {
  const file = path.join(directory, 'credentials.json');
  let record = await readJson(file),
    activeHashes = 0;
  const sessions = new Map(),
    attempts = new Map(),
    cookieName = secure ? '__Host-text-admin' : 'text-admin';
  function clean() {
    const time = now();
    for (const [key, s] of sessions)
      if (time - s.touched > idleMs || time - s.created > maxMs) sessions.delete(key);
    for (const [key, a] of attempts) if (time - a.at > 15 * 60 * 1000) attempts.delete(key);
  }
  function session(req) {
    clean();
    const cookie = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + '='));
    if (!cookie) return null;
    const token = cookie.slice(cookieName.length + 1);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const s = sessions.get(digest(token));
    if (s) s.touched = now();
    return s || null;
  }
  function cookie(token, expire = false) {
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${expire ? 0 : Math.floor(maxMs / 1000)}`;
  }
  async function login(req, password) {
    clean();
    if (!record)
      throw new ApiError(503, 'Вход ещё не настроен. Запустите npm run admin:setup на сервере.');
    const ip = req.clientAddress || req.socket.remoteAddress,
      entry = attempts.get(ip) || { at: now(), count: 0 };
    if (entry.count >= 5 || activeHashes >= 2 || sessions.size >= 100 || attempts.size >= 10000)
      throw new ApiError(429, 'Слишком много попыток входа. Повторите позже.');
    entry.count++;
    attempts.set(ip, entry);
    activeHashes++;
    let ok;
    try {
      ok = await verifyPassword(password, record);
    } finally {
      activeHashes--;
    }
    if (!ok) throw new ApiError(401, 'Неверный пароль.');
    attempts.delete(ip);
    const old = session(req);
    if (old) sessions.delete(old.id);
    const token = randomBytes(32).toString('hex'),
      s = {
        id: digest(token),
        csrf: randomBytes(32).toString('hex'),
        created: now(),
        touched: now(),
      };
    sessions.set(s.id, s);
    return { cookie: cookie(token), csrf: s.csrf };
  }
  async function changePassword(req, current, password) {
    if (activeHashes >= 2) throw new ApiError(429, 'Повторите позже.');
    activeHashes++;
    try {
      if (!(await verifyPassword(current, record)))
        throw new ApiError(401, 'Текущий пароль неверен.');
      const next = await passwordRecord(password);
      await atomicJson(file, next);
      record = next;
      sessions.clear();
      return cookie('', true);
    } finally {
      activeHashes--;
    }
  }
  return {
    session,
    login,
    changePassword,
    ready: () => Boolean(record),
    logout: (req) => {
      const s = session(req);
      if (s) sessions.delete(s.id);
      return cookie('', true);
    },
    csrf: (req, s) => {
      const token = req.headers['x-csrf-token'];
      if (
        typeof token !== 'string' ||
        token.length !== s.csrf.length ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(s.csrf))
      )
        throw new ApiError(403, 'Обновите страницу и повторите действие.');
    },
  };
}
