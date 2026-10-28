import { useMemo, useState } from 'react';
import Icon from './icons.jsx';

const CATS = [['', 'Todos'], ['popular', 'Populares'], ['multiplayer', 'Multijugador'], ['2d', '2D'], ['3d', '3D'], ['puzzle', 'Puzzle']];

export default function Games({ games, onPlay }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const list = useMemo(() => games.filter((g) => (!cat || g.categories.includes(cat)) && g.name.toLowerCase().includes(q.toLowerCase())), [games, q, cat]);
  return (
    <div className="games-page pp-scroll">
      <header className="games-head pp-in">
        <img src="/sprites/juegos.webp" alt="" width="110" />
        <div>
          <h1>Juegos</h1>
          <p className="muted">{games.length} juegos. Se abren en una pestaña nueva a través del proxy.</p>
        </div>
        <label className="search sm glass">
          <Icon name="search" size={16} />
          <input aria-label="Buscar juego" placeholder="Buscar juego" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </header>
      <div className="chips wrap pp-in d2">
        {CATS.map(([k, l]) => <button key={k} type="button" className={'chip pill' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{l}</button>)}
      </div>
      <div className="games-grid">
        {list.map((g, i) => (
          <button key={g.name} type="button" className={'pp-card game-card pp-in d' + Math.min(8, (i % 8) + 1)} onClick={() => onPlay(g)}>
            <span className="game-img">{g.image ? <img src={g.image} alt="" loading="lazy" /> : <span className="game-glyph">{g.name.charAt(0)}</span>}</span>
            <span className="game-name">{g.name}</span>
          </button>
        ))}
        {list.length === 0 && <p className="muted">No hay juegos con ese nombre.</p>}
      </div>
    </div>
  );
}
