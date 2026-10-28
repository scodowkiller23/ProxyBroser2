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

async function handleRequest(event) {
  await scramjet.loadConfig();
  if (scramjet.route(event)) return fixFraming(await scramjet.fetch(event), event.request);
  return fetch(event.request);
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});
