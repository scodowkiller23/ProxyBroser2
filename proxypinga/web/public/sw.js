importScripts('/scram/scramjet.all.js');

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// La página de arriba va con Cross-Origin-Embedder-Policy, así que el navegador exige
// que el documento del iframe traiga también esa cabecera o lo bloquea. Firefox corta
// con NS_ERROR_BLOCKED_BY_POLICY ("Blocked Page"); Chromium se lo salta, por eso en
// Opera GX sí funcionaba. Scramjet quita esas cabeceras de la web original, así que
// se las ponemos nosotros a lo que sirve el service worker.
function fixFraming(response, request) {
  if (response.type === 'opaqueredirect' || response.type === 'opaque') return response;
  const frameLoad = request.mode === 'navigate'
    || ['document', 'iframe', 'frame', 'embed', 'object'].includes(request.destination);
  let headers;
  try {
    headers = new Headers(response.headers);
  } catch {
    return response;
  }
  const csp = headers.get('content-security-policy');
  headers.delete('x-frame-options');
  if (csp && /frame-ancestors/i.test(csp)) {
    const clean = csp.replace(/frame-ancestors[^;]*;?/gi, '').trim();
    if (clean) headers.set('content-security-policy', clean);
    else headers.delete('content-security-policy');
  }
  if (frameLoad) {
    headers.set('cross-origin-embedder-policy', 'credentialless');
    headers.set('cross-origin-resource-policy', 'same-origin');
  }
  const redirect = response.status >= 300 && response.status < 400;
  return new Response(redirect ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// WebRTC no pasa por el proxy: sale directo del navegador. Cuando los dos extremos
// están detrás de un cortafuegos no se ven y la conexión muere ("trying reverse
// connection" en Haxball). Metemos nuestro TURN en la configuración de toda página
// que abrimos, que es la pieza estándar para ese caso.
let turn = { cuando: 0, servers: null };

async function iceServers() {
  if (turn.servers && Date.now() - turn.cuando < 60 * 60 * 1000) return turn.servers;
  try {
    const r = await fetch('/api/turn', { credentials: 'include' });
    if (!r.ok) return null;
    const { iceServers: s } = await r.json();
    turn = { cuando: Date.now(), servers: s && s.length ? s : null };
  } catch {
    return null;
  }
  return turn.servers;
}

function guionTurn(servers) {
  return '<script>(function(){try{'
    + 'var extra=' + JSON.stringify(servers) + ';'
    + 'var Orig=self.RTCPeerConnection||self.webkitRTCPeerConnection;if(!Orig)return;'
    + 'function PP(config,constraints){'
    + 'config=config||{};'
    + 'var previos=Array.isArray(config.iceServers)?config.iceServers:[];'
    + 'config=Object.assign({},config,{iceServers:previos.concat(extra)});'
    + 'return new Orig(config,constraints);}'
    + 'PP.prototype=Orig.prototype;'
    + 'PP.generateCertificate=Orig.generateCertificate&&Orig.generateCertificate.bind(Orig);'
    + 'self.RTCPeerConnection=PP;if(self.webkitRTCPeerConnection)self.webkitRTCPeerConnection=PP;'
    + '}catch(e){}})();<\/script>';
}

async function conTurn(response, request) {
  const tipo = response.headers.get('content-type') || '';
  const documento = request.mode === 'navigate'
    || ['document', 'iframe', 'frame'].includes(request.destination);
  if (!documento || !tipo.includes('text/html') || response.status < 200 || response.status >= 300) return response;
  const servers = await iceServers();
  if (!servers) return response;
  let html;
  try {
    html = await response.text();
  } catch {
    return response;
  }
  const guion = guionTurn(servers);
  const cabeza = html.search(/<head[^>]*>/i);
  const salida = cabeza === -1
    ? guion + html
    : html.slice(0, html.indexOf('>', cabeza) + 1) + guion + html.slice(html.indexOf('>', cabeza) + 1);
  const headers = new Headers(response.headers);
  // El tamaño ya no cuadra con el original y el cuerpo va sin comprimir.
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(salida, { status: response.status, statusText: response.statusText, headers });
}

async function handleRequest(event) {
  await scramjet.loadConfig();
  if (scramjet.route(event)) {
    return conTurn(fixFraming(await scramjet.fetch(event), event.request), event.request);
  }
  return fetch(event.request);
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});
