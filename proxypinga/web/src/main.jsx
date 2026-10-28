import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Browser from './Browser.jsx';
import { api } from './api.js';
import './styles.css';

function Entrada({ onIn, expired }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', display: '', code: '' });
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState('');
  const [canRegister, setCanRegister] = useState(false);
  const [err, setErr] = useState(expired ? 'Tu sesión ha terminado. Vuelve a entrar.' : '');
  const [busy, setBusy] = useState(false);
  const reg = mode === 'register';

  useEffect(() => {
    api.get('/api/notice').then((r) => { setNotice(r.notice); setCanRegister(r.registration); }).catch(() => {});
  }, []);

  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = reg
        ? await api.post('/api/register', { ...f, accepted })
        : await api.post('/api/login', { username: f.username, password: f.password, accepted });
      onIn(r.user);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  const ready = f.username && f.password && accepted && (!reg || f.code);

  return (
    <div className="login pp">
      <form className="login-card pp-card pp-in" onSubmit={submit}>
        <img src="/sprites/bienvenida.webp" alt="" className="login-hero" />
        <h1>{reg ? 'Crear tu cuenta' : 'Entrar en ProxyPinga'}</h1>
        {canRegister && (
          <div className="chips">
            <button type="button" className={'chip' + (!reg ? ' on' : '')} onClick={() => { setMode('login'); setErr(''); }}>Entrar</button>
            <button type="button" className={'chip' + (reg ? ' on' : '')} onClick={() => { setMode('register'); setErr(''); }}>Registrarme</button>
          </div>
        )}
        <label>Usuario<input autoComplete="username" value={f.username} onChange={upd('username')} autoFocus /></label>
        {reg && <label>Nombre visible (opcional)<input value={f.display} onChange={upd('display')} placeholder="Como quieres que te vean" /></label>}
        <label>Contraseña<input type="password" autoComplete={reg ? 'new-password' : 'current-password'} value={f.password} onChange={upd('password')} /></label>
        {reg && <label>Código de clase<input value={f.code} onChange={upd('code')} placeholder="Te lo da Iván" autoCapitalize="characters" /></label>}
        <div className="notice">
          <img src="/sprites/supervisada.webp" alt="" width="54" />
          <p>{notice}</p>
        </div>
        <label className="check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> Lo he leído y acepto</label>
        <button type="submit" className="btn-on" disabled={busy || !ready}>{busy ? 'Un momento…' : reg ? 'Crear cuenta y entrar' : 'Entrar'}</button>
        {err && <span className="err" role="alert">{err}</span>}
      </form>
    </div>
  );
}

function App() {
  const [me, setMe] = useState(undefined);
  const [expired, setExpired] = useState(false);
  useEffect(() => { api.get('/api/me').then((r) => setMe(r.user)).catch(() => setMe(null)); }, []);
  const logout = async (wasExpired) => {
    if (!wasExpired) await api.post('/api/logout').catch(() => {});
    setExpired(!!wasExpired);
    setMe(null);
  };
  if (me === undefined) return null;
  if (!me) return <Entrada expired={expired} onIn={(u) => { setExpired(false); setMe(u); }} />;
  return <Browser me={me} onLogout={logout} />;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
