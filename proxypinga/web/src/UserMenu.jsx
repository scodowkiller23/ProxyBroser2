import { useEffect, useRef, useState } from 'react';
import Icon from './icons.jsx';
import { api } from './api.js';

// Recorta la foto a un cuadrado de 128px para que ocupe poco.
function cropSquare(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function UserMenu({ me, setMe, displayName, onLogout }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  useEffect(() => { if (!open) { setView('menu'); setMsg(''); setCur(''); setNext(''); } }, [open]);

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg('Subiendo…');
    try {
      const r = await api.post('/api/avatar', { avatar: await cropSquare(f) });
      setMe(r.user); setMsg('Foto cambiada');
    } catch (x) { setMsg(x.message); }
  };

  const removePhoto = async () => {
    try { const r = await api.post('/api/avatar', { avatar: null }); setMe(r.user); setMsg('Foto quitada'); }
    catch (x) { setMsg(x.message); }
  };

  const changePass = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/password', { current: cur, next });
      setMsg('Contraseña cambiada'); setCur(''); setNext(''); setView('menu');
    } catch (x) { setMsg(x.message); }
  };

  const initial = (displayName || me.username).charAt(0).toUpperCase();

  return (
    <div className="usermenu" ref={box}>
      <button type="button" className="avatar pp-t" aria-label="Tu cuenta" aria-haspopup="menu" aria-expanded={open}
        title={me.display} onClick={() => setOpen(!open)}>
        {me.avatar ? <img src={me.avatar} alt="" /> : initial}
      </button>

      <div className={'usermenu-pop pp-card' + (open ? ' open' : '')} role="menu" aria-hidden={!open} inert={open ? undefined : ''}>
        <div className="um-head">
          <span className="avatar big">{me.avatar ? <img src={me.avatar} alt="" /> : initial}</span>
          <div className="um-name">
            <b>{me.display}</b>
            <span className="muted small">@{me.username}{me.admin ? ' · administrador' : ''}</span>
          </div>
        </div>

        {view === 'menu' && (
          <>
            <label className="um-item" role="menuitem">
              <Icon name="upload" size={16} /> {me.avatar ? 'Cambiar foto' : 'Poner una foto'}
              <input type="file" accept="image/*" onChange={pickPhoto} />
            </label>
            {me.avatar && (
              <button type="button" className="um-item" role="menuitem" onClick={removePhoto}>
                <Icon name="trash" size={16} /> Quitar la foto
              </button>
            )}
            <button type="button" className="um-item" role="menuitem" onClick={() => { setView('pass'); setMsg(''); }}>
              <Icon name="key" size={16} /> Cambiar contraseña
            </button>
            <button type="button" className="um-item danger" role="menuitem" onClick={onLogout}>
              <Icon name="logout" size={16} /> Cerrar sesión
            </button>
          </>
        )}

        {view === 'pass' && (
          <form className="um-form" onSubmit={changePass}>
            <input type="password" autoComplete="current-password" placeholder="Contraseña actual" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus />
            <input type="password" autoComplete="new-password" placeholder="Nueva (mín. 6)" value={next} onChange={(e) => setNext(e.target.value)} />
            <div className="row">
              <button type="button" className="chip" onClick={() => { setView('menu'); setMsg(''); }}>Volver</button>
              <button type="submit" className="chip on" disabled={!cur || next.length < 6}>Guardar</button>
            </div>
          </form>
        )}

        {msg && <span className="muted small um-msg">{msg}</span>}
      </div>
    </div>
  );
}
