import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './icons.jsx';
import Background from './Background.jsx';
import NewTab from './NewTab.jsx';
import Drawer from './Drawer.jsx';
import Games from './Games.jsx';
import Admin from './Admin.jsx';
import UserMenu from './UserMenu.jsx';
import { api } from './api.js';
import { initProxy, toUrl, hostOf, matchRule } from './proxy.js';
import { ENGINES, cssVars, useSettings } from './theme.js';

let nextId = 1;
const newTab = (kind = 'new', url = '') => ({ id: nextId++, kind, url, title: '' });
const TITLES = { new: 'Nueva pestaña', games: 'Juegos', admin: 'Panel de control', blocked: 'Web bloqueada' };

function Loader({ text }) {
  const [f, setF] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setF((x) => (x % 6) + 1), 120);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="loader pp-fade">
      <img src={`/sprites/carga/${f}.webp`} alt="" width="120" />
      <span>{text}</span>
    </div>
  );
}

function WebView({ tab, active, scramjet, register, onUrl, onTitle }) {
  const box = useRef(null);
  useEffect(() => {
    if (!scramjet) return undefined;
    const frame = scramjet.createFrame();
    frame.frame.className = 'webframe';
    frame.frame.setAttribute('allow', 'fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture');
    box.current.appendChild(frame.frame);
    const decode = (u) => { try { return u.includes('/scramjet/') ? scramjet.decodeUrl(u) : u; } catch { return u; } };
    frame.addEventListener('urlchange', (e) => onUrl(tab.id, decode(e.url)));
    // Firefox sustituye el documento inicial del iframe en cuanto se añade al DOM, así que
    // si navegamos en el mismo instante se pierde la navegación y el marco se queda en blanco.
    // Vamos a lo primero que ocurra: su "load" inicial o un respiro de 50 ms.
    let started = false;
    const start = () => { if (!started) { started = true; frame.go(tab.url); } };
    frame.frame.addEventListener('load', start, { once: true });
    const startTimer = setTimeout(start, 50);
    register(tab.id, frame);
    const titleTimer = setInterval(() => {
      try {
        const t = frame.frame.contentDocument?.title;
        if (t) onTitle(tab.id, t);
      } catch { /* aún cargando */ }
    }, 1200);
    return () => { clearTimeout(startTimer); clearInterval(titleTimer); register(tab.id, null); frame.frame.remove(); };
    // El frame se crea una vez por pestaña; las navegaciones van por frame.go().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramjet]);
  return <div ref={box} className="webview" style={{ display: active ? 'block' : 'none' }} />;
}

function Blocked({ url }) {
  return (
    <div className="center-page pp-fade">
      <img src="/sprites/bloqueada.webp" alt="" width="220" />
      <h2>Esta web está bloqueada</h2>
      <p className="muted">{hostOf(url)} no está permitida en ProxyPinga.</p>
    </div>
  );
}

export default function Browser({ me, setMe, onLogout }) {
  const [s, set, reset] = useSettings(me.username, me.display.replace(/^\(DIOS\)\s*/, ''));
  const [tabs, setTabs] = useState(() => [newTab()]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [scramjet, setScramjet] = useState(null);
  const [proxyErr, setProxyErr] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editShortcuts, setEditShortcuts] = useState(false);
  const [address, setAddress] = useState('');
  const [games, setGames] = useState([]);
  const [rules, setRules] = useState([]);
  const [watching, setWatching] = useState(false);
  const [messages, setMessages] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const frames = useRef(new Map());
  const addrRef = useRef(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const active = tabs.find((t) => t.id === activeId) || tabs[0];
  const engine = ENGINES[s.engine]?.[1] || ENGINES[0][1];

  useEffect(() => {
    initProxy().then(setScramjet).catch((e) => setProxyErr(e.message || String(e)));
    fetch('/games/games.json').then((r) => r.json()).then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    setAddress(active.kind === 'web' || active.kind === 'blocked' ? active.url : '');
  }, [active.id, active.url, active.kind]);

  const patchTab = useCallback((id, patch) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);

  const history = useCallback((url, title) => {
    try {
      const k = 'pp:historial:' + me.username;
      const list = JSON.parse(localStorage.getItem(k) || '[]').filter((h) => h.url !== url);
      list.unshift({ url, title, at: Date.now() });
      localStorage.setItem(k, JSON.stringify(list.slice(0, 100)));
    } catch { /* sin almacenamiento */ }
  }, [me.username]);

  // Aplica bloqueos y redirecciones antes de cargar una web.
  const resolve = useCallback((url) => {
    const r = matchRule(rulesRef.current, url);
    if (r?.kind === 'block') return { kind: 'blocked', url };
    if (r?.kind === 'redirect' && r.target) return { kind: 'web', url: r.target };
    return { kind: 'web', url };
  }, []);

  const navigate = useCallback((tabId, rawUrl) => {
    const { kind, url } = resolve(rawUrl);
    const tab = tabsRef.current.find((t) => t.id === tabId);
    const frame = frames.current.get(tabId);
    if (kind === 'web' && tab?.kind === 'web' && frame) {
      frame.go(url);
      patchTab(tabId, { url });
    } else {
      patchTab(tabId, { kind, url, title: '' });
    }
  }, [resolve, patchTab]);

  const openNew = useCallback((url, focus = true) => {
    const { kind, url: u } = url ? resolve(url) : { kind: 'new', url: '' };
    const t = newTab(kind, u);
    setTabs((ts) => [...ts, t]);
    if (focus) setActiveId(t.id);
    return t;
  }, [resolve]);

  const openKind = (kind) => {
    const existing = tabsRef.current.find((t) => t.kind === kind);
    if (existing) return setActiveId(existing.id);
    const t = newTab(kind);
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };

  const closeTab = (id) => {
    setTabs((ts) => {
      const i = ts.findIndex((t) => t.id === id);
      const rest = ts.filter((t) => t.id !== id);
      if (!rest.length) { const t = newTab(); setActiveId(t.id); return [t]; }
      if (id === activeId) setActiveId(rest[Math.max(0, i - 1)].id);
      return rest;
    });
  };

  const go = (input) => {
    const url = toUrl(input, engine);
    if (!url) return;
    navigate(active.id, url);
  };

  const onUrl = useCallback((id, url) => {
    const r = matchRule(rulesRef.current, url);
    if (r?.kind === 'block') { patchTab(id, { kind: 'blocked', url }); return; }
    if (r?.kind === 'redirect' && r.target && hostOf(url) !== hostOf(r.target)) { frames.current.get(id)?.go(r.target); return; }
    patchTab(id, { url });
    const t = tabsRef.current.find((x) => x.id === id);
    api.post('/api/visit', { url, title: t?.title || '' }).catch(() => {});
    history(url, t?.title || '');
  }, [patchTab, history]);

  const onTitle = useCallback((id, title) => {
    const t = tabsRef.current.find((x) => x.id === id);
    if (t && t.title !== title) patchTab(id, { title });
  }, [patchTab]);

  const register = useCallback((id, frame) => {
    if (frame) frames.current.set(id, frame); else frames.current.delete(id);
  }, []);

  // Presencia: cada 4 s manda las pestañas y recoge mensajes, órdenes y reglas.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const ts = tabsRef.current;
        const r = await api.post('/api/presence', {
          tabs: ts.map((t) => ({ url: t.kind === 'web' ? t.url : '', title: t.title || TITLES[t.kind] || '' })),
          active: ts.findIndex((t) => t.id === activeIdRef.current),
        });
        if (stop) return;
        setWatching(r.watching);
        setRules(r.rules);
        if (r.messages.length) setMessages((m) => [...m, ...r.messages]);
        r.commands.forEach((c) => { if (c.type === 'open') openNew(c.url); });
      } catch (e) {
        if (e.status === 401) onLogout(true);
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [openNew, onLogout]);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === 't') { e.preventDefault(); openNew(); }
      else if (k === 'w') { e.preventDefault(); closeTab(activeIdRef.current); }
      else if (k === 'l') { e.preventDefault(); addrRef.current?.focus(); addrRef.current?.select(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const frame = frames.current.get(active.id);
  const isWeb = active.kind === 'web';
  const bookmark = () => {
    if (!isWeb || s.shortcuts.some((x) => x.url === active.url)) return;
    set({ shortcuts: [...s.shortcuts, { label: (active.title || hostOf(active.url)).slice(0, 14), url: active.url }].slice(0, 15) });
  };
  const hist = (() => { try { return JSON.parse(localStorage.getItem('pp:historial:' + me.username) || '[]'); } catch { return []; } })();
  const tabLabel = (t) => t.title || TITLES[t.kind] || hostOf(t.url) || 'Cargando…';

  return (
    <div className={'pp pp-t tabstyle-' + s.tabStyle + (s.glossy ? ' glossy' : '')} style={cssVars(s)}>
      <div className="tabbar pp-top">
        <div className="brand">
          <img src="/sprites/icono.webp" alt="" width="26" height="26" />
          <span>ProxyPinga</span>
        </div>
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <div key={t.id} role="tab" aria-selected={t.id === active.id} tabIndex={0}
              className={'tab pp-t' + (t.id === active.id ? ' on pp-on' : '')}
              onClick={() => setActiveId(t.id)} onKeyDown={(e) => e.key === 'Enter' && setActiveId(t.id)}
              onAuxClick={(e) => e.button === 1 && closeTab(t.id)}>
              <span className="tab-ico pp-t">
                {t.kind === 'web' ? <img src={`https://icons.duckduckgo.com/ip3/${hostOf(t.url)}.ico`} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : 'P'}
              </span>
              <span className="tab-title">{tabLabel(t)}</span>
              <button type="button" className="tab-x" aria-label="Cerrar pestaña" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}>
                <Icon name="close" size={13} stroke={2.2} />
              </button>
            </div>
          ))}
          <button type="button" className="pp-ic new-tab" aria-label="Nueva pestaña" onClick={() => openNew()}><Icon name="plus" size={16} stroke={2.2} /></button>
        </div>
      </div>

      <div className="addrbar pp-top d1 pp-t">
        <button type="button" className="nav-btn" aria-label="Atrás" disabled={!isWeb} onClick={() => frame?.back()}><Icon name="back" /></button>
        <button type="button" className="nav-btn" aria-label="Adelante" disabled={!isWeb} onClick={() => frame?.forward()}><Icon name="fwd" /></button>
        <button type="button" className="nav-btn" aria-label="Recargar" disabled={!isWeb} onClick={() => frame?.reload()}><Icon name="reload" size={17} /></button>
        <form className="addr pp-t" onSubmit={(e) => { e.preventDefault(); go(address); addrRef.current?.blur(); }}>
          <Icon name={isWeb ? 'lock' : 'search'} size={15} />
          <input ref={addrRef} aria-label="Dirección o búsqueda" placeholder="Busca en la web o escribe una dirección"
            value={address} onChange={(e) => setAddress(e.target.value)} onFocus={(e) => e.target.select()} />
          {isWeb && <button type="button" className="star" aria-label="Añadir a accesos directos" onClick={bookmark}><Icon name="star" size={16} /></button>}
        </form>
        <UserMenu me={me} setMe={setMe} displayName={s.name} onLogout={() => onLogout(false)} />
      </div>

      <div className="body">
        {active.kind === 'new' && <Background s={s} />}
        <nav aria-label="Barra lateral" className="sidebar pp-top d2 pp-t glass">
          <button type="button" className={'pp-ic side' + (active.kind === 'new' ? ' on' : '')} aria-label="Inicio" title="Inicio" onClick={() => openKind('new')}><Icon name="home" size={20} stroke={1.9} /></button>
          <button type="button" className={'pp-ic side' + (historyOpen ? ' on' : '')} aria-label="Historial" title="Historial" onClick={() => setHistoryOpen(!historyOpen)}><Icon name="history" size={20} stroke={1.9} /></button>
          <button type="button" className="pp-ic side" aria-label="Guardar en accesos directos" title="Guardar en accesos directos" onClick={bookmark} disabled={!isWeb}><Icon name="bookmark" size={20} stroke={1.9} /></button>
          <button type="button" className={'pp-ic side' + (active.kind === 'games' ? ' on' : '')} aria-label="Juegos" title="Juegos" onClick={() => openKind('games')}><Icon name="games" size={21} stroke={1.9} /></button>
          <div style={{ flex: 1 }} />
          {me.admin && <button type="button" className={'pp-ic side' + (active.kind === 'admin' ? ' on' : '')} aria-label="Panel de administración" title="Panel de administración" onClick={() => openKind('admin')}><Icon name="shield" size={20} stroke={1.9} /></button>}
          <button type="button" className={'pp-ic side' + (drawer ? ' on' : '')} aria-label="Ajustes" title="Ajustes" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}><Icon name="gear" size={20} stroke={1.9} /></button>
        </nav>

        <div className="content">
          {tabs.filter((t) => t.kind === 'web').map((t) => (
            <WebView key={t.id} tab={t} active={t.id === active.id} scramjet={scramjet} register={register} onUrl={onUrl} onTitle={onTitle} />
          ))}
          {isWeb && !scramjet && (proxyErr ? <div className="center-page"><h2>No se pudo arrancar el proxy</h2><p className="muted">{proxyErr}</p></div> : <Loader text="Preparando el proxy…" />)}
          {active.kind === 'new' && (
            <NewTab s={s} set={set} onOpen={(u) => navigate(active.id, u)} onSearch={go} games={games}
              onGame={(g) => navigate(active.id, g.link)} onAllGames={() => openKind('games')} editShortcuts={editShortcuts} />
          )}
          {active.kind === 'games' && <Games games={games} onPlay={(g) => openNew(g.link)} />}
          {active.kind === 'admin' && me.admin && <Admin me={me} onOpen={(u) => openNew(u)} />}
          {active.kind === 'blocked' && <Blocked url={active.url} />}

          {active.kind !== 'web' && (
            <div className={'supervised pp-in d8 pp-t glass' + (watching ? ' live' : '')}>
              <Icon name="eye" size={14} /> {watching ? 'El administrador está viendo tu actividad ahora' : 'Sesión supervisada'}
            </div>
          )}
        </div>

        {watching && active.kind === 'web' && (
          <div className="supervised live floating"><Icon name="eye" size={14} /> El administrador está viendo tu actividad ahora</div>
        )}

        {historyOpen && (
          <div className="history pp-card glass pp-in">
            <div className="w-head"><span className="w-title">Historial</span><button type="button" className="ghost-x" aria-label="Cerrar historial" onClick={() => setHistoryOpen(false)}><Icon name="close" size={14} /></button></div>
            <div className="history-list pp-scroll">
              {hist.length === 0 && <p className="muted small">Aún no has visitado nada.</p>}
              {hist.map((h) => (
                <button key={h.url + h.at} type="button" className="history-item" onClick={() => { openNew(h.url); setHistoryOpen(false); }}>
                  <b>{h.title || hostOf(h.url)}</b><span className="muted">{hostOf(h.url)} · {new Date(h.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Drawer s={s} set={set} reset={reset} open={drawer} onClose={() => setDrawer(false)}
          editShortcuts={editShortcuts} setEditShortcuts={setEditShortcuts} />
      </div>

      {messages.length > 0 && (
        <div className="modal-back" role="dialog" aria-modal="true" aria-label="Mensaje del administrador">
          <div className="modal pp-card pp-in">
            <img src="/sprites/admin.webp" alt="" width="90" />
            <span className="muted small">Mensaje de {messages[0].from}</span>
            <p className="modal-text">{messages[0].text}</p>
            <button type="button" className="btn-on" autoFocus onClick={() => setMessages((m) => m.slice(1))}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}
