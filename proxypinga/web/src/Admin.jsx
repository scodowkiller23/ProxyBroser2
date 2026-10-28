import { useCallback, useEffect, useState } from 'react';
import Icon from './icons.jsx';
import { api } from './api.js';
import { hostOf } from './proxy.js';

const ago = (t) => {
  if (!t) return 'nunca';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(t).toLocaleDateString('es-ES');
};
const time = (t) => new Date(t).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function NewUser({ onDone }) {
  const [f, setF] = useState({ username: '', display: '', password: '', admin: false });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/users', f);
      setF({ username: '', display: '', password: '', admin: false }); setErr('');
      onDone();
    } catch (x) { setErr(x.message); }
  };
  return (
    <form className="pp-card admin-form" onSubmit={submit}>
      <span className="w-title">Nuevo usuario</span>
      <input placeholder="usuario (para entrar)" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
      <input placeholder="Nombre visible" value={f.display} onChange={(e) => setF({ ...f, display: e.target.value })} />
      <input placeholder="Contraseña (mín. 6)" type="text" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <label className="check"><input type="checkbox" checked={f.admin} onChange={(e) => setF({ ...f, admin: e.target.checked })} /> Administrador</label>
      <button type="submit" className="btn-on">Crear</button>
      {err && <span className="err">{err}</span>}
    </form>
  );
}

function UserDetail({ u, me, reload, onOpen }) {
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState('');
  const [pass, setPass] = useState('');
  const [reason, setReason] = useState('');
  const [watch, setWatch] = useState(false);
  const [visits, setVisits] = useState([]);
  const [note, setNote] = useState('');

  const loadVisits = useCallback(() => api.get('/api/admin/visits?limit=100&user=' + u.id).then((r) => setVisits(r.visits)).catch(() => {}), [u.id]);
  useEffect(() => { loadVisits(); setWatch(false); }, [loadVisits]);

  // Mientras "Ver en directo" está activo, el usuario ve un aviso en su pantalla.
  useEffect(() => {
    if (!watch) return undefined;
    const ping = () => api.post('/api/admin/watch', { userId: u.id, on: true }).catch(() => {});
    ping();
    const t = setInterval(() => { ping(); reload(); }, 4000);
    return () => { clearInterval(t); api.post('/api/admin/watch', { userId: u.id, on: false }).catch(() => {}); };
  }, [watch, u.id, reload]);

  const act = async (fn, ok) => {
    try { await fn(); setNote(ok); reload(); } catch (e) { setNote(e.message); }
  };
  const fixUrl = (x) => (/^https?:\/\//.test(x) ? x : 'https://' + x);

  return (
    <div className="pp-card user-detail pp-in">
      <div className="w-head">
        <div>
          <span className="w-title">{u.display}</span>
          <span className="muted small"> @{u.username} · {u.online ? 'en línea' : 'visto ' + ago(u.lastSeen)}{u.banned ? ' · BLOQUEADO' : ''}</span>
        </div>
        {u.id !== me.id && (
          <button type="button" className={'chip' + (watch ? ' on live-chip' : '')} onClick={() => setWatch(!watch)}>
            <Icon name="eye" size={14} /> {watch ? 'Viendo en directo (lo sabe)' : 'Ver en directo'}
          </button>
        )}
      </div>

      <div className="detail-grid">
        <section>
          <h3>Pestañas abiertas</h3>
          {!u.online && <p className="muted small">No está conectado.</p>}
          {u.online && u.tabs.map((t, i) => (
            <div key={i} className={'live-tab' + (i === u.active ? ' on' : '')}>
              <b>{t.title || 'Pestaña'}</b>
              {t.url && <button type="button" className="link" onClick={() => onOpen(t.url)}>{hostOf(t.url)}</button>}
            </div>
          ))}
        </section>

        <section className="actions">
          <h3>Acciones</h3>
          <form onSubmit={(e) => { e.preventDefault(); if (msg) act(() => api.post('/api/admin/message', { userId: u.id, text: msg }), 'Mensaje enviado').then(() => setMsg('')); }}>
            <input placeholder="Mandar un mensaje…" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <button type="submit" className="chip" aria-label="Enviar mensaje"><Icon name="message" size={15} /></button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); if (url) act(() => api.post('/api/admin/command', { userId: u.id, url: fixUrl(url) }), 'Le he abierto la web').then(() => setUrl('')); }}>
            <input placeholder="Abrirle una web (redirigir)…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="submit" className="chip" aria-label="Abrir web"><Icon name="arrow" size={15} /></button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); if (pass) act(() => api.patch('/api/admin/users/' + u.id, { password: pass }), 'Contraseña cambiada').then(() => setPass('')); }}>
            <input placeholder="Nueva contraseña…" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} />
            <button type="submit" className="chip" aria-label="Cambiar contraseña"><Icon name="key" size={15} /></button>
          </form>
          {u.id !== me.id && (
            <div className="row">
              {u.banned
                ? <button type="button" className="chip" onClick={() => act(() => api.patch('/api/admin/users/' + u.id, { banned: false }), 'Desbloqueado')}>Desbloquear</button>
                : <>
                  <input placeholder="Motivo del bloqueo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button type="button" className="chip danger" onClick={() => act(() => api.patch('/api/admin/users/' + u.id, { banned: true, banReason: reason }), 'Bloqueado y expulsado')}><Icon name="ban" size={14} /> Bloquear</button>
                </>}
              <button type="button" className="chip danger" onClick={() => window.confirm('¿Borrar a ' + u.display + ' y su historial?') && act(() => api.del('/api/admin/users/' + u.id), 'Borrado')}><Icon name="trash" size={14} /></button>
            </div>
          )}
          {note && <span className="muted small">{note}</span>}
        </section>
      </div>

      <section>
        <div className="w-head"><h3>Webs visitadas</h3><button type="button" className="link" onClick={loadVisits}>Actualizar</button></div>
        <div className="visits pp-scroll">
          {visits.length === 0 && <p className="muted small">Sin visitas registradas.</p>}
          {visits.map((v) => (
            <div key={v.id} className="visit"><span className="muted">{time(v.at)}</span><b>{v.title || v.host}</b><span className="muted">{v.url}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Rules({ rules, reload }) {
  const [kind, setKind] = useState('block');
  const [pattern, setPattern] = useState('');
  const [target, setTarget] = useState('');
  const [err, setErr] = useState('');
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/rules', { kind, pattern, target: kind === 'redirect' ? (/^https?:\/\//.test(target) ? target : 'https://' + target) : undefined });
      setPattern(''); setTarget(''); setErr(''); reload();
    } catch (x) { setErr(x.message); }
  };
  return (
    <div className="pp-card">
      <span className="w-title">Bloqueos y redirecciones (para todos)</span>
      <form className="rule-form" onSubmit={add}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de regla">
          <option value="block">Bloquear</option>
          <option value="redirect">Redirigir</option>
        </select>
        <input placeholder="web (ej. tiktok.com)" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        {kind === 'redirect' && <input placeholder="a (ej. es.wikipedia.org)" value={target} onChange={(e) => setTarget(e.target.value)} />}
        <button type="submit" className="btn-on">Añadir</button>
      </form>
      {err && <span className="err">{err}</span>}
      {rules.map((r) => (
        <div key={r.id} className="rule">
          <span className={'tag ' + r.kind}>{r.kind === 'block' ? 'Bloqueada' : 'Redirige'}</span>
          <b>{r.pattern}</b>{r.target && <span className="muted">→ {r.target}</span>}
          <button type="button" className="ghost-x" aria-label="Quitar regla" onClick={() => api.del('/api/admin/rules/' + r.id).then(reload)}><Icon name="trash" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function Broadcast() {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const send = async (e) => {
    e.preventDefault();
    if (!text) return;
    const r = await api.post('/api/admin/message', { text });
    setText(''); setNote(`Enviado a ${r.sent} usuarios`);
  };
  return (
    <form className="pp-card admin-form" onSubmit={send}>
      <span className="w-title">Mensaje para todos</span>
      <textarea placeholder="Les sale en pantalla al momento…" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn-on">Enviar</button>
      {note && <span className="muted small">{note}</span>}
    </form>
  );
}

export default function Admin({ me, onOpen }) {
  const [data, setData] = useState({ users: [], rules: [] });
  const [sel, setSel] = useState(null);
  const reload = useCallback(() => api.get('/api/admin/overview').then(setData).catch(() => {}), []);
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);
  const online = data.users.filter((u) => u.online).length;
  const selected = data.users.find((u) => u.id === sel);

  return (
    <div className="admin pp-scroll">
      <header className="admin-head pp-in">
        <img src="/sprites/admin.webp" alt="" width="84" />
        <div>
          <h1>Panel de control</h1>
          <p className="muted">{online} en línea de {data.users.length} usuarios. Todos ven el aviso de supervisión al entrar y un indicador cuando los miras en directo.</p>
        </div>
      </header>
      <div className="admin-grid">
        <div className="col">
          <div className="pp-card">
            <span className="w-title">Usuarios</span>
            <div className="user-list">
              {data.users.map((u) => (
                <button key={u.id} type="button" className={'user-row' + (u.id === sel ? ' on' : '')} onClick={() => setSel(u.id)}>
                  <span className={'dot' + (u.online ? ' online' : '') + (u.banned ? ' banned' : '')} />
                  <span className="user-name"><b>{u.display}</b><span className="muted small">@{u.username}{u.admin ? ' · admin' : ''}</span></span>
                  <span className="muted small">{u.online ? (u.tabs[u.active]?.title || hostOf(u.tabs[u.active]?.url || '') || 'en línea') : ago(u.lastSeen)}</span>
                </button>
              ))}
            </div>
          </div>
          <NewUser onDone={reload} />
        </div>
        <div className="col wide">
          {selected ? <UserDetail key={selected.id} u={selected} me={me} reload={reload} onOpen={onOpen} /> : (
            <div className="pp-card center-card"><Icon name="users" size={28} /><p className="muted">Elige un usuario para ver qué está haciendo.</p></div>
          )}
          <Rules rules={data.rules} reload={reload} />
          <Broadcast />
        </div>
      </div>
    </div>
  );
}
