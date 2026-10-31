# n8n + Postgres del canal de YouTube

Automatización del canal (repo `scodowkiller23/CanalYoutube`) corriendo en la máquina Oracle Always Free, junto al proxy de `../proxypinga`.

```
Internet ──443──> Caddy (proxypinga) ──red "web"──> n8n:5678 ──red interna──> postgres:5432
                   ├─ proxypinga.duckdns.org      -> app del proxy (sin cambios)
                   └─ n8n.proxypinga.duckdns.org  -> n8n
```

- **Postgres 16**, sin puertos abiertos. Dos bases: `n8n` (interna de n8n) y `canal` (métricas, `schema.sql`, que se aplica sola la primera vez).
- **n8n**, servido por HTTPS por el mismo Caddy del proxy. Certificado automático de Let's Encrypt.
- Copia de seguridad diaria de las dos bases a las 04:00 en `~/canal/backups` (7 días).

## Desplegar

Actions → **Máquina Oracle** → Run workflow → `desplegar-n8n`. Luego `estado` o `logs-n8n` para comprobar.

La primera vez se genera en la máquina `~/canal/.env` con la contraseña de Postgres y la clave de cifrado de n8n. No sale de la máquina ni está en el repo; si se pierde, n8n no puede descifrar las credenciales guardadas, así que conviene guardar una copia (`cat ~/canal/.env` por SSH) en un gestor de contraseñas.

Tras el primer despliegue, abre `https://n8n.proxypinga.duckdns.org` enseguida y crea la cuenta de propietario: hasta entonces cualquiera que llegue a la URL podría crearla.

## Configuración desde GitHub (opcional)

Variables (Settings → Secrets and variables → Actions → Variables): `N8N_DOMAIN` (por defecto `n8n.proxypinga.duckdns.org`), `YOUTUBE_CHANNEL_ID`, `CANAL_REPO`, `CLAUDE_MODEL`, `CLAUDE_MODEL_FAST`, `WORKER_URL`.

Secrets: `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, `TELEGRAM_CHAT_ID`, `WORKER_SHARED_SECRET`. Se escriben en `~/canal/app.env` y los workflows los leen con `$env.*`. Las credenciales con OAuth (YouTube, Telegram, Postgres) se crean dentro de n8n.

Credencial Postgres en n8n para los workflows: host `postgres`, puerto `5432`, base `canal`, usuario `canal`, contraseña la de `~/canal/.env`.
