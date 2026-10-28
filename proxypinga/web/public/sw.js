importScripts('/scram/scramjet.all.js');

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Firefox aplica X-Frame-Options tambien a las respuestas de redireccion
// (bug 1593321 de Mozilla), y como todo se ve dentro de un iframe corta la pestana
// con NS_ERROR_BLOCKED_BY_POLICY. Chromium no lo hace, por eso en Opera si iba.
// Quitamos la cabecera (y el frame-ancestors del CSP) de todo lo que devolvemos.
function allowFraming(response) {
  if (response.type === 'opaqueredirect' || response.type === 'opaque') return response;
  let csp;
  try {
    csp = response.headers.get('content-security-policy');
    if (!response.headers.has('x-frame-options') && !(csp && /frame-ancestors/i.test(csp))) return response;
  } catch {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete('x-frame-options');
  if (csp) {
    const clean = csp.replace(/frame-ancestors[^;]*;?/gi, '').trim();
    if (clean) headers.set('content-security-policy', clean);
    else headers.delete('content-security-policy');
  }
  const redirect = response.status >= 300 && response.status < 400;
  return new Response(redirect ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleRequest(event) {
  await scramjet.loadConfig();
  if (scramjet.route(event)) return allowFraming(await scramjet.fetch(event));
  return fetch(event.request);
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});
