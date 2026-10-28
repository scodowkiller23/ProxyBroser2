// Arranque de Scramjet: service worker + transporte libcurl sobre wisp (solo funciona con sesión iniciada).
let ready = null;

export function initProxy() {
  if (ready) return ready;
  ready = (async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Tu navegador no soporta service workers.');
    const { ScramjetController } = window.$scramjetLoadController();
    const scramjet = new ScramjetController({
      files: { wasm: '/scram/scramjet.wasm.wasm', all: '/scram/scramjet.all.js', sync: '/scram/scramjet.sync.js' },
    });
    await scramjet.init();
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    // Si acaba de entrar un service worker nuevo, la página sigue con el viejo hasta que
    // se recarga, y entonces parece que el cambio no ha llegado. Recargamos una sola vez.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('pp-sw-reload')) return;
      try { sessionStorage.setItem('pp-sw-reload', '1'); } catch { /* sin almacenamiento */ }
      location.reload();
    });
    reg.update().catch(() => {});
    const connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
    const wispUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/wisp/';
    if ((await connection.getTransport()) !== '/libcurl/index.mjs') {
      await connection.setTransport('/libcurl/index.mjs', [{ websocket: wispUrl }]);
    }
    return scramjet;
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

export function toUrl(input, engine) {
  const q = input.trim();
  if (!q) return null;
  if (/^https?:\/\//i.test(q)) return q;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(q) && !q.includes(' ')) return 'https://' + q;
  return engine.replace('%s', encodeURIComponent(q));
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function matchRule(rules, url) {
  const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
  if (!host) return null;
  return rules.find((r) => {
    const h = r.pattern.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, '');
    return host === h || host.endsWith('.' + h);
  }) || null;
}
