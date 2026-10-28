import { useEffect, useState } from 'react';

export const PALETTES = [
  { name: 'Ónix', bg: '#000000', surface: '#111111', on: '#f2f2f2', text: '#f2f2f2', muted: '#a8a8a8', border: '#262626' },
  { name: 'Grafito', bg: '#121212', surface: '#1e1e1e', on: '#e8e8e8', text: '#ededed', muted: '#a8a8a8', border: '#303030' },
  { name: 'Medianoche', bg: '#05070d', surface: '#0f1526', on: '#dbe6ff', text: '#e8eeff', muted: '#a3afcc', border: '#1d2742' },
  { name: 'Bosque', bg: '#050a07', surface: '#0e1912', on: '#d9f2e3', text: '#e6f7ec', muted: '#9fbcaa', border: '#1a2c21' },
  { name: 'Vino', bg: '#0d0507', surface: '#1c0d12', on: '#f5dbe1', text: '#fae8ec', muted: '#c4a0a9', border: '#331a21' },
  { name: 'Ámbar', bg: '#0c0904', surface: '#1a140b', on: '#f7e7c8', text: '#faefd9', muted: '#c4b08c', border: '#33271a' },
  { name: 'Océano', bg: '#03090c', surface: '#0b1a22', on: '#cdeefa', text: '#e0f5fc', muted: '#94b8c6', border: '#16303d' },
  { name: 'Lavanda', bg: '#08060d', surface: '#161021', on: '#e6dcff', text: '#efe9ff', muted: '#ab9fcc', border: '#2a2140' },
  { name: 'Ceniza', bg: '#1a1a1a', surface: '#262626', on: '#ffffff', text: '#ffffff', muted: '#b0b0b0', border: '#383838' },
  { name: 'Carbón rojo', bg: '#0a0a0a', surface: '#181111', on: '#ff8a7a', text: '#f5f5f5', muted: '#b3a3a1', border: '#2e2020' },
  { name: 'Papel', bg: '#f4f3ef', surface: '#e9e7e1', on: '#111111', text: '#111111', muted: '#55524c', border: '#d6d3cb', light: true },
];

// [color1, color2, color3, rotación, proporción, escala, velocidad, distorsión, remolino, iteraciones, suavidad, offset, forma, escalaForma]
export const PRESETS = {
  Ghost: ['#0a0a0a', '#1c1c1c', '#a3a3a3', 45, 50, 0.3, 8, 10, 30, 5, 100, 0, 0, 60],
  Vortex: ['#000000', '#FFFFFF', '#000000', 50, 41, 0.4, 20, 0, 100, 3, 5, -744, 1, 80],
  Aurora: ['#0a001a', '#1a0b2e', '#f20089', -45, 60, 0.6, 15, 40, 80, 10, 100, 200, 2, 50],
  Oceanic: ['#000814', '#001d3d', '#00b4d8', 0, 70, 0.4, 10, 15, 50, 12, 80, 150, 0, 30],
  Amber: ['#140c00', '#4a2500', '#f57c00', 120, 80, 0.8, 20, 25, 60, 8, 90, 500, 1, 40],
  Toxic: ['#050d05', '#0a240a', '#39ff14', -90, 55, 0.5, 25, 60, 100, 15, 70, -100, 2, 20],
  Prism: ['#050505', '#66B3FF', '#FFFFFF', -50, 1, 0.01, 30, 0, 50, 16, 47, -299, 0, 45],
  Plasma: ['#B566FF', '#000000', '#000000', 0, 63, 0.75, 30, 5, 61, 5, 100, -168, 0, 28],
  Mist: ['#050505', '#FF66B8', '#050505', 0, 33, 0.48, 39, 4, 65, 5, 100, -235, 2, 48],
  Lava: ['#FF9F21', '#FF0303', '#000000', 114, 100, 0.52, 30, 7, 18, 20, 100, 717, 2, 12],
  Pulse: ['#66FF85', '#000000', '#000000', -167, 92, 0, 20, 54, 75, 3, 28, -813, 0, 79],
};

export const FONTS = [['Nunito', "'Nunito', sans-serif"], ['Quicksand', "'Quicksand', sans-serif"], ['Varela', "'Varela Round', sans-serif"], ['Fredoka', "'Fredoka', sans-serif"]];
export const WEIGHTS = [['Fina', 200], ['Normal', 600], ['Gruesa', 900]];
export const LAYOUTS = ['Cristal', 'Panel', 'Foco'];
export const BG_MODES = ['Degradado', 'Olas', 'Sólido', 'Imagen'];
export const RADII = ['Suave', 'Medio', 'Máximo'];
export const TAB_STYLES = ['Ola', 'Píldora', 'Clásica'];
export const WIDGETS = [['accesos', 'Accesos'], ['calendario', 'Calendario'], ['temporizador', 'Temporizador'], ['juegos', 'Juegos'], ['notas', 'Notas'], ['tareas', 'Tareas']];
export const ENGINES = [
  ['DuckDuckGo', 'https://duckduckgo.com/?q=%s'],
  ['Google', 'https://www.google.com/search?q=%s'],
  ['Bing', 'https://www.bing.com/search?q=%s'],
  ['Brave', 'https://search.brave.com/search?q=%s'],
];

export const DEFAULT_SHORTCUTS = [
  { label: 'YouTube', url: 'https://www.youtube.com' },
  { label: 'Google', url: 'https://www.google.com' },
  { label: 'Wikipedia', url: 'https://es.wikipedia.org' },
  { label: 'Spotify', url: 'https://open.spotify.com' },
  { label: 'Discord', url: 'https://discord.com/app' },
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'Twitch', url: 'https://www.twitch.tv' },
  { label: 'Reddit', url: 'https://www.reddit.com' },
];

export function defaults(name = '') {
  return {
    layout: 0, pal: 0, custom: { bg: '#0b0b0f', surface: '#17171f', on: '#e9e4ff' },
    bgMode: 0, preset: 'Ghost', g: null, dim: 30, img: '', glossy: true, radius: 1, tabStyle: 0,
    clockPx: 140, font: 0, weight: 2, sec: false, h12: false, clockColor: '',
    widgets: { accesos: true, calendario: true, temporizador: true, juegos: true, notas: true, tareas: false },
    name, engine: 0, shortcuts: DEFAULT_SHORTCUTS, notes: '', tasks: [],
  };
}

const keyFor = (user) => 'pp:ajustes:' + user;

function load(user, name) {
  try {
    const raw = localStorage.getItem(keyFor(user));
    if (raw) return { ...defaults(name), ...JSON.parse(raw) };
  } catch { /* sin almacenamiento: usamos los valores por defecto */ }
  return defaults(name);
}

export function useSettings(user, name) {
  const [s, setS] = useState(() => load(user, name));
  useEffect(() => {
    try { localStorage.setItem(keyFor(user), JSON.stringify(s)); } catch { /* lleno o bloqueado */ }
  }, [user, s]);
  const set = (patch) => setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  const reset = () => setS(defaults(name));
  return [s, set, reset];
}

export function palette(s) {
  if (s.pal === -1) {
    const c = s.custom;
    return { name: 'Personalizada', ...c, text: c.on, muted: c.on + 'b3', border: c.on + '33' };
  }
  return PALETTES[s.pal] || PALETTES[0];
}

export function gradientParams(s) {
  const p = (PRESETS[s.preset] || PRESETS.Ghost).slice();
  if (s.g) { p[0] = s.g.c1; p[1] = s.g.c2; p[2] = s.g.c3; }
  return p;
}

// Variables CSS que usa toda la interfaz.
export function cssVars(s) {
  const p = palette(s);
  const R = [[10, 14, 18], [14, 18, 24], [18, 26, 34]][s.radius];
  const light = !!p.light;
  const card = s.glossy ? (light ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.07)') : p.surface;
  const tab = [
    { onBg: p.on, onColor: p.bg, barBg: p.on, barColor: p.bg, barBorder: 'transparent', addrBg: p.bg, addrColor: p.text },
    { onBg: p.on, onColor: p.bg, barBg: p.bg, barColor: p.text, barBorder: p.border, addrBg: p.surface, addrColor: p.text },
    { onBg: p.surface, onColor: p.text, barBg: p.surface, barColor: p.text, barBorder: p.border, addrBg: p.bg, addrColor: p.text },
  ][s.tabStyle];
  return {
    '--bg': p.bg, '--surface': p.surface, '--on': p.on, '--text': p.text, '--muted': p.muted, '--border': p.border,
    '--card': card,
    '--r1': R[0] + 'px', '--r2': R[1] + 'px', '--r3': R[2] + 'px',
    '--glass': s.glossy ? 'blur(28px) saturate(45%)' : 'none',
    '--glass-shadow': s.glossy ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.35)' : 'none',
    '--drawer': s.glossy ? (light ? 'rgba(244,243,239,0.75)' : 'rgba(10,10,10,0.55)') : p.surface,
    '--tab-on-bg': tab.onBg, '--tab-on-color': tab.onColor,
    '--bar-bg': tab.barBg, '--bar-color': tab.barColor, '--bar-border': tab.barBorder,
    '--addr-bg': tab.addrBg, '--addr-color': tab.addrColor,
    '--clock-font': FONTS[s.font][1], '--clock-weight': WEIGHTS[s.weight][1],
    '--clock-color': s.clockColor || p.text, '--clock-px': s.clockPx + 'px',
  };
}
