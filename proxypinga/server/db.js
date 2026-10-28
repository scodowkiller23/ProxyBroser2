import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const DB_PATH = process.env.DB_PATH || './data/proxypinga.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display TEXT NOT NULL,
    pass TEXT NOT NULL,
    admin INTEGER NOT NULL DEFAULT 0,
    banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT,
    created_at INTEGER NOT NULL,
    last_seen INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    host TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS visits_user_at ON visits(user_id, at DESC);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('block', 'redirect')),
    pattern TEXT NOT NULL,
    target TEXT,
    created_at INTEGER NOT NULL
  );
`);

// La base de datos ya está creada en la máquina, así que las columnas nuevas se añaden aquí.
const columns = db.prepare('SELECT name FROM pragma_table_info(?)');
if (!columns.all('users').some((c) => c.name === 'avatar')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
}

const SESSION_DAYS = 14;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function checkPassword(password, stored) {
  const [, salt, key] = stored.split('$');
  const expected = Buffer.from(key, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

const publicUser = (u) => u && {
  id: u.id,
  username: u.username,
  display: u.display,
  admin: !!u.admin,
  avatar: u.avatar || null,
  banned: !!u.banned,
  banReason: u.ban_reason,
  createdAt: u.created_at,
  lastSeen: u.last_seen,
};

export const users = {
  count: () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
  byName: (username) => db.prepare('SELECT * FROM users WHERE username = ?').get(username),
  byId: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  list: () => db.prepare('SELECT * FROM users ORDER BY admin DESC, username').all().map(publicUser),
  create({ username, display, password, admin = false }) {
    const r = db.prepare('INSERT INTO users (username, display, pass, admin, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(username, display || username, hashPassword(password), admin ? 1 : 0, Date.now());
    return publicUser(users.byId(r.lastInsertRowid));
  },
  update(id, { display, password, banned, banReason, admin, avatar }) {
    if (display !== undefined) db.prepare('UPDATE users SET display = ? WHERE id = ?').run(display, id);
    if (avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar || null, id);
    if (password) db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPassword(password), id);
    if (admin !== undefined) db.prepare('UPDATE users SET admin = ? WHERE id = ?').run(admin ? 1 : 0, id);
    if (banned !== undefined) {
      db.prepare('UPDATE users SET banned = ?, ban_reason = ? WHERE id = ?').run(banned ? 1 : 0, banned ? banReason || null : null, id);
      if (banned) sessions.dropUser(id);
    }
    if (password) sessions.dropUser(id);
    return publicUser(users.byId(id));
  },
  remove: (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id),
  touch: (id) => db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(Date.now(), id),
  public: publicUser,
};

export const sessions = {
  create(userId) {
    const token = randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)')
      .run(token, userId, Date.now() + SESSION_DAYS * 864e5);
    return token;
  },
  user(token) {
    if (!token) return null;
    const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires > ? AND u.banned = 0`).get(token, Date.now());
    return row || null;
  },
  drop: (token) => db.prepare('DELETE FROM sessions WHERE token = ?').run(token),
  dropUser: (userId) => db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId),
  purge: () => db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now()),
};

export const visits = {
  add(userId, url, title) {
    const u = new URL(url);
    // Solo origen y ruta: la parte ?query suele llevar lo que el usuario escribe (búsquedas).
    const clean = u.origin + u.pathname;
    const last = db.prepare('SELECT url FROM visits WHERE user_id = ? ORDER BY at DESC LIMIT 1').get(userId);
    if (last && last.url === clean) return;
    db.prepare('INSERT INTO visits (user_id, host, url, title, at) VALUES (?, ?, ?, ?, ?)')
      .run(userId, u.hostname, clean, (title || '').slice(0, 200), Date.now());
  },
  list({ userId, limit = 200 }) {
    const q = `SELECT v.id, v.host, v.url, v.title, v.at, u.username, u.display FROM visits v
      JOIN users u ON u.id = v.user_id ${userId ? 'WHERE v.user_id = ?' : ''} ORDER BY v.at DESC LIMIT ?`;
    return userId ? db.prepare(q).all(userId, limit) : db.prepare(q).all(limit);
  },
  purge: (days) => db.prepare('DELETE FROM visits WHERE at < ?').run(Date.now() - days * 864e5),
};

export const rules = {
  list: () => db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all(),
  add: (kind, pattern, target) => db.prepare('INSERT INTO rules (kind, pattern, target, created_at) VALUES (?, ?, ?, ?)')
    .run(kind, pattern, target || null, Date.now()),
  remove: (id) => db.prepare('DELETE FROM rules WHERE id = ?').run(id),
};

export const settings = {
  get: (key, fallback = null) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? fallback,
  set: (key, value) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value)),
};

export const inviteCode = () => randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
