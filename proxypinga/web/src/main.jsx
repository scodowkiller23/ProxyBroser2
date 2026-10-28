import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Browser from './Browser.jsx';
import { api } from './api.js';
import './styles.css';

function Login({ onIn, expired }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState(expired ? 'Tu sesión ha terminado. Vuelve a entrar.' : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/api/notice').then((r) => setNotice(r.notice)).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.post('/api/login', { username, password, accepted });
      onIn(r.user);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="login pp">
      <form className="login-card pp-card pp-in" onSubmit={submit}>
        <img src="/sprites/bienvenida.webp" alt="" className="login-hero" />
        <h1>Entrar en ProxyPinga</h1>
        <label>Usuario<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <div className="notice">
          <img src="/sprites/supervisada.webp" alt="" width="54" />
          <p>{notice}</p>
        </div>
        <label className="check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> Lo he leído y acepto</label>
        <button type="submit" className="btn-on" disabled={busy || !accepted || !username || !password}>{busy ? 'Entrando…' : 'Entrar'}</button>
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
  if (!me) return <Login expired={expired} onIn={(u) => { setExpired(false); setMe(u); }} />;
  return <Browser me={me} onLogout={logout} />;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
