import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { users, sessions, visits, rules, settings, inviteCode, checkPassword as checkPass } from './db.js';

const require = createRequire(import.meta.url);
const { libcurlPath } = require('@mercuryworkshop/libcurl-transport');
const webDist = fileURLToPath(new URL('../web/dist/', import.meta.url));

const PORT = Number(process.env.PORT || 8080);
const COOKIE = 'pp_sess';
const SECURE = process.env.INSECURE_COOKIES !== '1';
const VISIT_DAYS = Number(process.env.VISIT_DAYS || 30);

// Aviso que todos ven al entrar y que tienen que aceptar.
const NOTICE = 'ProxyPinga es una red supervisada. El administrador puede ver qué webs visitas, '
  + 'qué pestañas tienes abiertas y enviarte mensajes. Cuando te esté mirando en directo lo verás en pantalla. '
  + 'Nunca se guarda lo que escribes (contraseñas, mensajes ni búsquedas).';

// ---------- arranque: primer administrador ----------
if (users.count() === 0) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) {
    console.error('No hay usuarios y falta ADMIN_PASSWORD: no se crea el administrador.');
  } else {
    users.create({
      username: process.env.ADMIN_USER || 'ivan',
      display: process.env.ADMIN_DISPLAY || '(DIOS) Ivan',
      password: pass,
      admin: true,
    });
    console.log('Administrador creado.');
  }
}

// Registro abierto solo con el código de clase (si no, cualquiera de Internet podría usar el proxy).
if (settings.get('reg_code') === null) {
  settings.set('reg_enabled', '1');
  settings.set('reg_code', inviteCode());
}
const registration = () => ({ enabled: settings.get('reg_enabled') === '1', code: settings.get('reg_code') });

// ---------- estado en directo (memoria) ----------
const live = new Map(); // userId -> { tabs, active, at }
const watchers = new Map(); // userId -> caduca (ms) mientras el admin mira
const inbox = new Map(); // userId -> [{ text, from, at }]
const commands = new Map(); // userId -> [{ type, url }]
const sockets = new Map(); // userId -> Set(socket) de wisp

const push = (map, id, item) => { if (!map.has(id)) map.set(id, []); map.get(id).push(item); };
const take = (map, id) => { const v = map.get(id) || []; map.delete(id); return v; };

function hostPattern(p) {
  const h = p.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, '');
  return new RegExp('(^|\\.)' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
}

function applyRules() {
  const blocked = rules.list().filter((r) => r.kind === 'block').map((r) => hostPattern(r.pattern));
  wisp.options.hostname_blacklist = blocked.length ? blocked : null;
}

// Dejamos los avisos de wisp en el log del contenedor para poder diagnosticar fallos.
logging.set_level(logging.WARN);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  // wisp solo mira dns_servers si el metodo es "resolve"; con el de por defecto ("lookup")
  // usaba el DNS del sistema, que puede venir filtrado y devolver paginas de bloqueo.
  dns_method: 'resolve',
  dns_servers: ['1.1.1.1', '8.8.8.8'],
  dns_result_order: 'ipv4first',
});
applyRules();

function kick(userId) {
  for (const s of sockets.get(userId) || []) s.destroy();
  sockets.delete(userId);
  live.delete(userId);
}

function cookieToken(header = '') {
  const m = header.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

// ---------- servidor ----------
const app = Fastify({
  trustProxy: true,
  bodyLimit: 64 * 1024,
  serverFactory: (handler) => createServer()
    .on('request', (req, res) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      handler(req, res);
    })
    .on('upgrade', (req, socket, head) => {
      if (!req.url.startsWith('/wisp/')) return socket.destroy();
      const user = sessions.user(cookieToken(req.headers.cookie));
      if (!user) return socket.destroy();
      if (!sockets.has(user.id)) sockets.set(user.id, new Set());
      sockets.get(user.id).add(socket);
      socket.on('close', () => sockets.get(user.id)?.delete(socket));
      wisp.routeRequest(req, socket, head);
    }),
});

await app.register(fastifyCookie);
app.register(fastifyStatic, { root: scramjetPath, prefix: '/scram/', decorateReply: false });
app.register(fastifyStatic, { root: baremuxPath, prefix: '/baremux/', decorateReply: false });
app.register(fastifyStatic, { root: libcurlPath, prefix: '/libcurl/', decorateReply: false });
if (existsSync(webDist)) app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false });

function auth(req, reply, done) {
  const user = sessions.user(req.cookies[COOKIE]);
  if (!user) return reply.code(401).send({ error: 'Sesión caducada' });
  req.user = user;
  done();
}

function admin(req, reply, done) {
  auth(req, reply, () => {
    if (!req.user.admin) return reply.code(403).send({ error: 'Solo administradores' });
    done();
  });
}

// Freno simple contra adivinar contraseñas: 8 intentos por IP cada 10 minutos.
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60e3);
  attempts.set(ip, list);
  return list.length >= 8;
}

app.post('/api/login', async (req, reply) => {
  const { username, password } = req.body || {};
  if (tooMany(req.ip)) return reply.code(429).send({ error: 'Demasiados intentos. Espera unos minutos.' });
  const user = username && users.byName(String(username).trim());
  if (!user || !password || !checkPass(String(password), user.pass)) {
    attempts.get(req.ip).push(Date.now());
    return reply.code(401).send({ error: 'Usuario o contraseña incorrectos' });
  }
  if (user.banned) return reply.code(403).send({ error: 'Cuenta bloqueada' + (user.ban_reason ? ': ' + user.ban_reason : '') });
  const token = sessions.create(user.id);
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: SECURE, maxAge: 14 * 86400 });
  return { user: users.public(user) };
});

app.post('/api/logout', async (req, reply) => {
  sessions.drop(req.cookies[COOKIE]);
  reply.clearCookie(COOKIE, { path: '/' });
  return { ok: true };
});

app.get('/api/notice', async () => ({ notice: NOTICE, registration: registration().enabled }));

app.post('/api/register', async (req, reply) => {
  const { username, display, password, code, accepted } = req.body || {};
  if (tooMany(req.ip)) return reply.code(429).send({ error: 'Demasiados intentos. Espera unos minutos.' });
  const reg = registration();
  if (!reg.enabled) return reply.code(403).send({ error: 'El registro está cerrado. Pide una cuenta al administrador.' });
  if (String(code || '').trim().toUpperCase() !== reg.code) {
    attempts.get(req.ip).push(Date.now());
    return reply.code(403).send({ error: 'Código de clase incorrecto' });
  }
  if (!/^[a-z0-9._-]{2,24}$/i.test(username || '')) return reply.code(400).send({ error: 'Usuario: 2-24 letras, números, punto o guion (sin espacios)' });
  if (!password || String(password).length < 6) return reply.code(400).send({ error: 'Contraseña: mínimo 6 caracteres' });
  if (!accepted) return reply.code(400).send({ error: 'Tienes que aceptar el aviso de supervisión' });
  if (users.byName(username)) return reply.code(409).send({ error: 'Ese usuario ya existe' });
  const name = String(display || '').trim().slice(0, 32).replace(/^\(DIOS\)/i, '').trim() || username;
  const user = users.create({ username, display: name, password: String(password) });
  const token = sessions.create(user.id);
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: SECURE, maxAge: 14 * 86400 });
  return { user };
});

app.get('/api/me', { preHandler: auth }, async (req) => ({ user: users.public(req.user), notice: NOTICE }));

// Foto de perfil: el navegador la recorta a 128px y la manda como data URL.
app.post('/api/avatar', { preHandler: auth, bodyLimit: 256 * 1024 }, async (req, reply) => {
  const { avatar } = req.body || {};
  if (avatar === null || avatar === '') {
    users.update(req.user.id, { avatar: null });
    return { user: users.public(users.byId(req.user.id)) };
  }
  if (typeof avatar !== 'string' || !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(avatar)) {
    return reply.code(400).send({ error: 'Imagen no válida' });
  }
  if (avatar.length > 180 * 1024) return reply.code(413).send({ error: 'La imagen pesa demasiado' });
  users.update(req.user.id, { avatar });
  return { user: users.public(users.byId(req.user.id)) };
});

app.post('/api/password', { preHandler: auth }, async (req, reply) => {
  const { current, next } = req.body || {};
  if (!next || String(next).length < 6) return reply.code(400).send({ error: 'Mínimo 6 caracteres' });
  if (!checkPass(String(current || ''), req.user.pass)) return reply.code(400).send({ error: 'La contraseña actual no es correcta' });
  users.update(req.user.id, { password: String(next) });
  const token = sessions.create(req.user.id);
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: SECURE, maxAge: 14 * 86400 });
  return { ok: true };
});

// El navegador manda aquí cada pocos segundos sus pestañas y recoge mensajes, órdenes y reglas.
app.post('/api/presence', { preHandler: auth }, async (req) => {
  const { tabs = [], active = 0 } = req.body || {};
  const clean = tabs.slice(0, 30).map((t) => ({ url: String(t.url || '').slice(0, 300), title: String(t.title || '').slice(0, 120) }));
  live.set(req.user.id, { tabs: clean, active, at: Date.now() });
  users.touch(req.user.id);
  return {
    watching: (watchers.get(req.user.id) || 0) > Date.now(),
    messages: take(inbox, req.user.id),
    commands: take(commands, req.user.id),
    rules: rules.list().map(({ kind, pattern, target }) => ({ kind, pattern, target })),
  };
});

app.post('/api/visit', { preHandler: auth }, async (req, reply) => {
  const { url, title } = req.body || {};
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return { ok: true };
    visits.add(req.user.id, u.href, title);
  } catch {
    return reply.code(400).send({ error: 'URL no válida' });
  }
  return { ok: true };
});

// ---------- administración ----------
app.get('/api/admin/overview', { preHandler: admin }, async () => {
  const now = Date.now();
  return {
    users: users.list().map((u) => {
      const l = live.get(u.id);
      return { ...u, online: !!l && now - l.at < 15e3, tabs: l?.tabs || [], active: l?.active || 0, watched: (watchers.get(u.id) || 0) > now };
    }),
    rules: rules.list(),
  };
});

app.get('/api/admin/registration', { preHandler: admin }, async () => registration());

app.post('/api/admin/registration', { preHandler: admin }, async (req) => {
  const { enabled, newCode } = req.body || {};
  if (enabled !== undefined) settings.set('reg_enabled', enabled ? '1' : '0');
  if (newCode) settings.set('reg_code', inviteCode());
  return registration();
});

app.post('/api/admin/users', { preHandler: admin }, async (req, reply) => {
  const { username, display, password, admin: isAdmin } = req.body || {};
  if (!/^[a-z0-9._-]{2,24}$/i.test(username || '')) return reply.code(400).send({ error: 'Usuario: 2-24 letras, números, punto o guion' });
  if (!password || String(password).length < 6) return reply.code(400).send({ error: 'Contraseña: mínimo 6 caracteres' });
  if (users.byName(username)) return reply.code(409).send({ error: 'Ese usuario ya existe' });
  return { user: users.create({ username, display: (display || '').trim() || username, password: String(password), admin: !!isAdmin }) };
});

app.patch('/api/admin/users/:id', { preHandler: admin }, async (req, reply) => {
  const id = Number(req.params.id);
  const target = users.byId(id);
  if (!target) return reply.code(404).send({ error: 'No existe' });
  const { display, password, banned, banReason, admin: isAdmin } = req.body || {};
  if (id === req.user.id && (banned || isAdmin === false)) return reply.code(400).send({ error: 'No puedes bloquearte ni quitarte el admin a ti mismo' });
  if (password !== undefined && String(password).length < 6) return reply.code(400).send({ error: 'Contraseña: mínimo 6 caracteres' });
  const user = users.update(id, { display, password: password && String(password), banned, banReason, admin: isAdmin });
  if (banned || password) kick(id);
  return { user };
});

app.delete('/api/admin/users/:id', { preHandler: admin }, async (req, reply) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return reply.code(400).send({ error: 'No puedes borrarte a ti mismo' });
  kick(id);
  users.remove(id);
  return { ok: true };
});

app.get('/api/admin/visits', { preHandler: admin }, async (req) => ({
  visits: visits.list({ userId: Number(req.query.user) || null, limit: Math.min(Number(req.query.limit) || 200, 1000) }),
}));

app.post('/api/admin/rules', { preHandler: admin }, async (req, reply) => {
  const { kind, pattern, target } = req.body || {};
  if (!['block', 'redirect'].includes(kind) || !pattern) return reply.code(400).send({ error: 'Regla incompleta' });
  if (kind === 'redirect') {
    try { new URL(target); } catch { return reply.code(400).send({ error: 'Destino: pon una URL completa (https://...)' }); }
  }
  rules.add(kind, String(pattern).trim().toLowerCase(), target);
  applyRules();
  return { rules: rules.list() };
});

app.delete('/api/admin/rules/:id', { preHandler: admin }, async (req) => {
  rules.remove(Number(req.params.id));
  applyRules();
  return { rules: rules.list() };
});

app.post('/api/admin/message', { preHandler: admin }, async (req, reply) => {
  const { userId, text } = req.body || {};
  if (!text) return reply.code(400).send({ error: 'Mensaje vacío' });
  const msg = { text: String(text).slice(0, 500), from: req.user.display, at: Date.now() };
  const targets = userId ? [Number(userId)] : users.list().map((u) => u.id);
  targets.forEach((id) => push(inbox, id, msg));
  return { ok: true, sent: targets.length };
});

app.post('/api/admin/command', { preHandler: admin }, async (req, reply) => {
  const { userId, url } = req.body || {};
  try { new URL(url); } catch { return reply.code(400).send({ error: 'Pon una URL completa (https://...)' }); }
  push(commands, Number(userId), { type: 'open', url, from: req.user.display });
  return { ok: true };
});

// El panel renueva esto mientras tienes abierta la vista en directo de alguien; el usuario lo ve en pantalla.
app.post('/api/admin/watch', { preHandler: admin }, async (req) => {
  const { userId, on } = req.body || {};
  if (on) watchers.set(Number(userId), Date.now() + 12e3);
  else watchers.delete(Number(userId));
  return { ok: true };
});

// SPA: cualquier otra ruta sirve la app.
app.setNotFoundHandler((req, reply) => {
  if (req.method !== 'GET' || req.url.startsWith('/api/') || !existsSync(join(webDist, 'index.html'))) {
    return reply.code(404).send({ error: 'No encontrado' });
  }
  return reply.type('text/html').sendFile('index.html', webDist);
});

setInterval(() => { sessions.purge(); visits.purge(VISIT_DAYS); }, 3600e3).unref();

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`ProxyPinga escuchando en el puerto ${PORT}`);
