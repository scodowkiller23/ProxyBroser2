import { useEffect, useState } from 'react';
import Icon from './icons.jsx';
import { hostOf } from './proxy.js';

const LAYOUT = [
  { cls: 'lay-cristal', clock: 'start', searchW: 500 },
  { cls: 'lay-panel', clock: 'center', searchW: 540 },
  { cls: 'lay-foco', clock: 'center', searchW: 560 },
];

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const glyph = (label) => (label.length <= 2 ? label : label.charAt(0)).toUpperCase();
const favicon = (url) => `https://icons.duckduckgo.com/ip3/${hostOf(url)}.ico`;

function Tile({ sc, onOpen, size }) {
  const [err, setErr] = useState(false);
  return (
    <button type="button" className={'pp-tile tile-' + size} onClick={() => onOpen(sc.url)} title={sc.url}>
      <span className="tile-box pp-t">
        {err ? glyph(sc.label) : <img src={favicon(sc.url)} alt="" onError={() => setErr(true)} />}
      </span>
      <span className="tile-label">{sc.label}</span>
    </button>
  );
}

function AddShortcut({ onAdd, size }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  if (!open) {
    return (
      <button type="button" className={'pp-tile tile-' + size} onClick={() => setOpen(true)}>
        <span className="tile-box pp-t"><Icon name="plus" /></span>
        <span className="tile-label">Añadir</span>
      </button>
    );
  }
  const save = (e) => {
    e.preventDefault();
    let u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//.test(u)) u = 'https://' + u;
    onAdd({ label: label.trim() || hostOf(u), url: u });
    setOpen(false); setLabel(''); setUrl('');
  };
  return (
    <form className="add-sc pp-card" onSubmit={save}>
      <input autoFocus placeholder="Nombre" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input placeholder="web.com" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="row">
        <button type="button" className="chip" onClick={() => setOpen(false)}>Cancelar</button>
        <button type="submit" className="chip on">Guardar</button>
      </div>
    </form>
  );
}

function Shortcuts({ s, set, onOpen, size, edit }) {
  const remove = (i) => set({ shortcuts: s.shortcuts.filter((_, j) => j !== i) });
  return (
    <>
      {s.shortcuts.map((sc, i) => (
        <div key={sc.url + i} className="tile-wrap">
          <Tile sc={sc} onOpen={onOpen} size={size} />
          {edit && <button type="button" className="tile-x" aria-label={'Quitar ' + sc.label} onClick={() => remove(i)}><Icon name="close" size={11} stroke={3} /></button>}
        </div>
      ))}
      {s.shortcuts.length < 15 && <AddShortcut size={size} onAdd={(sc) => set({ shortcuts: [...s.shortcuts, sc] })} />}
    </>
  );
}

function Calendar({ now }) {
  const lead = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const month = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return (
    <section className="pp-card pp-in d6 widget">
      <div className="w-title">{month.charAt(0).toUpperCase() + month.slice(1)}</div>
      <div className="cal">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} className="cal-h">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={'e' + i} />)}
        {Array.from({ length: days }, (_, i) => <span key={i} className={i + 1 === now.getDate() ? 'cal-today' : ''}>{i + 1}</span>)}
      </div>
    </section>
  );
}

function Timer() {
  const [total, setTotal] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) { setRunning(false); try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play(); } catch { /* sin audio */ } return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [running]);
  const pick = (m) => { setTotal(m * 60); setLeft(m * 60); setRunning(false); };
  const C = 2 * Math.PI * 48;
  return (
    <section className="pp-card pp-in d6 widget timer">
      <div className="ring">
        <svg width="104" height="104" viewBox="0 0 112 112" aria-hidden="true">
          <circle cx="56" cy="56" r="48" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle cx="56" cy="56" r="48" fill="none" stroke="var(--on)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="ring-num">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div>
      </div>
      <div className="timer-side">
        <span className="w-title">Temporizador</span>
        <div className="row">{[5, 15, 25].map((m) => <button key={m} type="button" className="chip sm" onClick={() => pick(m)}>{m}′</button>)}</div>
        <button type="button" className="btn-on" onClick={() => (left === 0 ? (setLeft(total), setRunning(true)) : setRunning(!running))}>
          {running ? 'Pausar' : left === 0 ? 'Otra vez' : 'Empezar'}
        </button>
      </div>
    </section>
  );
}

function Notes({ s, set }) {
  return (
    <label className="pp-card pp-in d7 widget notes">
      <span className="w-title">Notas</span>
      <textarea aria-label="Notas" placeholder="Escribe una nota…" value={s.notes} onChange={(e) => set({ notes: e.target.value })} />
    </label>
  );
}

function Tasks({ s, set }) {
  const [text, setText] = useState('');
  const add = (e) => { e.preventDefault(); if (!text.trim()) return; set({ tasks: [...s.tasks, { t: text.trim(), done: false }] }); setText(''); };
  const toggle = (i) => set({ tasks: s.tasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) });
  const remove = (i) => set({ tasks: s.tasks.filter((_, j) => j !== i) });
  return (
    <section className="pp-card pp-in d8 widget tasks">
      <span className="w-title">Tareas</span>
      {s.tasks.map((x, i) => (
        <div key={i} className="task">
          <label><input type="checkbox" checked={x.done} onChange={() => toggle(i)} /><span className={x.done ? 'done' : ''}>{x.t}</span></label>
          <button type="button" className="ghost-x" aria-label="Quitar tarea" onClick={() => remove(i)}><Icon name="close" size={12} /></button>
        </div>
      ))}
      <form onSubmit={add}><input placeholder="Nueva tarea…" value={text} onChange={(e) => setText(e.target.value)} /></form>
    </section>
  );
}

function GamesWidget({ games, onGame, onAll }) {
  return (
    <section className="pp-card pp-in d7 widget span2 games-w">
      <div className="w-head"><span className="w-title">Juegos</span><button type="button" className="link" onClick={onAll}>Ver todos</button></div>
      <div className="games-row">
        {games.slice(0, 4).map((g) => (
          <button key={g.name} type="button" className="pp-tile game-mini" onClick={() => onGame(g)}>
            {g.image && <img src={g.image} alt="" />}
            <span>{g.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function NewTab({ s, set, onOpen, onSearch, games, onGame, onAllGames, editShortcuts }) {
  const now = useNow();
  const [q, setQ] = useState('');
  const L = LAYOUT[s.layout];
  let h = now.getHours();
  const greeting = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const ampm = h < 12 ? 'AM' : 'PM';
  if (s.h12) h = h % 12 || 12;
  const date = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const w = s.widgets;
  const anyWidget = Object.values(w).some(Boolean);
  const showWidgets = s.layout !== 2 && anyWidget;
  const inlineShortcuts = s.layout === 2 || (s.layout === 0 && !w.accesos);

  return (
    <main className={'newtab pp-layout ' + L.cls}>
      <section className={'clockbox align-' + L.clock}>
        <div className="pp-in d2 muted big">{date.charAt(0).toUpperCase() + date.slice(1)}</div>
        <div className="pp-clock pp-in d3">
          {String(h).padStart(2, '0')}<span className="pp-colon">:</span>{String(now.getMinutes()).padStart(2, '0')}
          {s.sec && <span className="clock-sec">{String(now.getSeconds()).padStart(2, '0')}</span>}
          {s.h12 && <span className="clock-ampm">{ampm}</span>}
        </div>
        <div className="pp-in d4 muted big greet">{greeting}{s.name ? <>, <b>{s.name}</b></> : ''}</div>
        <form className="search pp-in d5 pp-t glass" style={{ width: L.searchW }} onSubmit={(e) => { e.preventDefault(); onSearch(q); setQ(''); }}>
          <Icon name="search" />
          <input aria-label="Buscar" placeholder="Busca o escribe una dirección" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {inlineShortcuts && (
          <div className="sc-grid pp-in d6">
            <Shortcuts s={s} set={set} onOpen={onOpen} size="big" edit={editShortcuts} />
          </div>
        )}
      </section>

      {showWidgets && (
        <div className="widgets">
          {w.accesos && (
            <section className="pp-card pp-in d5 widget span2">
              <span className="w-title">Accesos directos</span>
              <div className="sc-mini"><Shortcuts s={s} set={set} onOpen={onOpen} size="small" edit={editShortcuts} /></div>
            </section>
          )}
          {w.calendario && <Calendar now={now} />}
          {w.temporizador && <Timer />}
          {w.juegos && <GamesWidget games={games} onGame={onGame} onAll={onAllGames} />}
          {w.notas && <Notes s={s} set={set} />}
          {w.tareas && <Tasks s={s} set={set} />}
        </div>
      )}
    </main>
  );
}
