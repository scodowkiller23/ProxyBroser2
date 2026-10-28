import { useState } from 'react';
import Icon from './icons.jsx';
import { BG_MODES, ENGINES, FONTS, LAYOUTS, PALETTES, PRESETS, RADII, TAB_STYLES, WEIGHTS, WIDGETS, gradientParams } from './theme.js';

function Chips({ labels, value, onPick, cols }) {
  return (
    <div className="chips" style={cols ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
      {labels.map((l, i) => (
        <button key={l} type="button" className={'chip' + (i === value ? ' on' : '')} onClick={() => onPick(i)}>{l}</button>
      ))}
    </div>
  );
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function Drawer({ s, set, reset, open, onClose, editShortcuts, setEditShortcuts }) {
  const gp = gradientParams(s);
  const setG = (k) => (e) => set({ g: { c1: gp[0], c2: gp[1], c3: gp[2], ...(s.g || {}), [k]: e.target.value } });
  const setC = (k) => (e) => set({ custom: { ...s.custom, [k]: e.target.value }, pal: -1 });
  const onImage = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { set({ img: await shrinkImage(f), bgMode: 3 }); } catch { /* imagen no válida */ }
  };

  return (
    <aside aria-label="Personalización" aria-hidden={!open} className={'drawer pp-scroll' + (open ? ' open' : '')} inert={open ? undefined : ''}>
      <div className="drawer-head">
        <h1>Personalización</h1>
        <button type="button" className="btn-line" onClick={reset}>Restablecer</button>
        <button type="button" className="btn-sq" aria-label="Cerrar ajustes" onClick={onClose}><Icon name="close" size={14} stroke={2.4} /></button>
      </div>

      <section>
        <h2>Distribución</h2>
        <Chips labels={LAYOUTS} value={s.layout} onPick={(i) => set({ layout: i })} />
      </section>

      <section>
        <div className="h2-row"><h2>Paleta</h2><b>{s.pal === -1 ? 'Personalizada' : PALETTES[s.pal].name}</b></div>
        <div className="swatches">
          {PALETTES.map((x, i) => (
            <button key={x.name} type="button" className={'pp-sw' + (i === s.pal ? ' on' : '')} aria-label={'Paleta ' + x.name} title={x.name}
              style={{ background: x.bg }} onClick={() => set({ pal: i, clockColor: '' })}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: x.on }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.surface, border: '1px solid ' + x.on }} />
            </button>
          ))}
          <button type="button" className={'pp-sw custom' + (s.pal === -1 ? ' on' : '')} aria-label="Paleta personalizada"
            style={{ background: s.pal === -1 ? s.custom.bg : 'transparent' }} onClick={() => set({ pal: -1, clockColor: '' })}>+</button>
        </div>
        {s.pal === -1 && (
          <div className="grid3">
            <label className="color">Fondo<input type="color" value={s.custom.bg} onChange={setC('bg')} /></label>
            <label className="color">Superficie<input type="color" value={s.custom.surface} onChange={setC('surface')} /></label>
            <label className="color">Contraste<input type="color" value={s.custom.on} onChange={setC('on')} /></label>
          </div>
        )}
      </section>

      <section>
        <h2>Fondo</h2>
        <Chips labels={BG_MODES} value={s.bgMode} onPick={(i) => set({ bgMode: i })} cols={4} />
        {s.bgMode === 0 && (
          <>
            <div className="chips wrap">
              {Object.keys(PRESETS).map((k) => (
                <button key={k} type="button" className={'chip pill' + (k === s.preset && !s.g ? ' on' : '')} onClick={() => set({ preset: k, g: null })}>{k}</button>
              ))}
            </div>
            <div className="grid3">
              <label className="color">Color 1<input type="color" value={gp[0]} onChange={setG('c1')} /></label>
              <label className="color">Color 2<input type="color" value={gp[1]} onChange={setG('c2')} /></label>
              <label className="color">Color 3<input type="color" value={gp[2]} onChange={setG('c3')} /></label>
            </div>
          </>
        )}
        {s.bgMode === 3 && (
          <label className="upload chip">
            <Icon name="upload" size={16} /> {s.img ? 'Cambiar imagen' : 'Subir imagen'}
            <input type="file" accept="image/*" onChange={onImage} />
          </label>
        )}
        <label className="range">Oscurecer<input type="range" min="0" max="85" value={s.dim} onChange={(e) => set({ dim: Number(e.target.value) })} /></label>
      </section>

      <section>
        <h2>Estilo</h2>
        <div className="switch-row">
          <span>Cristal translúcido</span>
          <button type="button" role="switch" aria-checked={s.glossy} aria-label="Cristal translúcido" className={'switch' + (s.glossy ? ' on' : '')} onClick={() => set({ glossy: !s.glossy })}>
            <span className="pp-knob" />
          </button>
        </div>
        <Chips labels={RADII} value={s.radius} onPick={(i) => set({ radius: i })} />
        <div style={{ height: 8 }} />
        <Chips labels={TAB_STYLES} value={s.tabStyle} onPick={(i) => set({ tabStyle: i })} />
      </section>

      <section>
        <h2>Reloj</h2>
        <label className="range">Tamaño<input type="range" min="72" max="200" value={s.clockPx} onChange={(e) => set({ clockPx: Number(e.target.value) })} /><span className="val">{s.clockPx}px</span></label>
        <div className="chips grid4">
          {FONTS.map((f, i) => (
            <button key={f[0]} type="button" className={'chip' + (i === s.font ? ' on' : '')} style={{ fontFamily: f[1] }} onClick={() => set({ font: i })}>{f[0]}</button>
          ))}
        </div>
        <Chips labels={WEIGHTS.map((x) => x[0])} value={s.weight} onPick={(i) => set({ weight: i })} cols={3} />
        <div className="chips" style={{ marginTop: 8 }}>
          <button type="button" className={'chip' + (s.sec ? ' on' : '')} onClick={() => set({ sec: !s.sec })}>Segundos</button>
          <button type="button" className={'chip' + (s.h12 ? ' on' : '')} onClick={() => set({ h12: !s.h12 })}>Formato 12 h</button>
          <label className="clock-color" title="Color del reloj"><span className="sr">Color del reloj</span>
            <input type="color" value={s.clockColor || '#ffffff'} onChange={(e) => set({ clockColor: e.target.value })} />
          </label>
        </div>
      </section>

      <section>
        <h2>Widgets</h2>
        <div className="chips grid3">
          {WIDGETS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={!!s.widgets[k]} className={'chip' + (s.widgets[k] ? ' on' : '')}
              onClick={() => set({ widgets: { ...s.widgets, [k]: !s.widgets[k] } })}>{label}</button>
          ))}
        </div>
        <button type="button" className={'chip wide' + (editShortcuts ? ' on' : '')} onClick={() => setEditShortcuts(!editShortcuts)}>
          {editShortcuts ? 'Listo' : 'Editar accesos directos'}
        </button>
      </section>

      <section>
        <h2>Buscador</h2>
        <Chips labels={ENGINES.map((e) => e[0])} value={s.engine} onPick={(i) => set({ engine: i })} cols={4} />
      </section>

      <section>
        <label className="name-field">
          <h2>Tu nombre</h2>
          <input value={s.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
      </section>

      <section>
        <h2>Cuenta</h2>
        <p className="muted small">Tu foto, la contraseña y cerrar sesión están en tu icono, arriba a la derecha.</p>
      </section>
    </aside>
  );
}
