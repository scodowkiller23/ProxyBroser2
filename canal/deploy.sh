#!/usr/bin/env bash
# Se ejecuta en la máquina de Oracle desde el workflow "Máquina Oracle" (modo desplegar-n8n).
# Requiere N8N_DOMAIN en el entorno. Las claves internas se generan aquí la primera vez y no salen de la máquina.
set -euo pipefail
trap 'echo "deploy.sh: fallo en la línea $LINENO" >&2' ERR
cd "$(dirname "$0")"
: "${N8N_DOMAIN:?falta N8N_DOMAIN}"

docker network inspect web >/dev/null 2>&1 || docker network create web >/dev/null

# .env con secretos propios de la máquina: se crea una vez y se conserva entre despliegues.
umask 077
if [ ! -f .env ]; then
  printf 'POSTGRES_PASSWORD=%s\nN8N_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
  echo "Generado .env nuevo (contraseña de Postgres y clave de cifrado de n8n)."
fi
grep -v '^N8N_DOMAIN=' .env > .env.tmp || true
echo "N8N_DOMAIN=$N8N_DOMAIN" >> .env.tmp
mv .env.tmp .env

# Copia de seguridad diaria a las 04:00 (se guardan 7 días en ~/canal/backups).
mkdir -p backups
CRON="0 4 * * * cd $PWD && docker compose exec -T postgres pg_dumpall -U canal | gzip > backups/\$(date +\\%F).sql.gz && find backups -name '*.sql.gz' -mtime +7 -delete"
# Sin crontab previo, "crontab -l" falla: por eso el "|| true".
EXISTENTE=$(crontab -l 2>/dev/null | grep -v 'pg_dumpall -U canal' || true)
printf '%s\n%s\n' "$EXISTENTE" "$CRON" | sed '/^$/d' | crontab -

docker compose pull -q
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
sleep 10
docker compose ps --format '{{.Service}}: {{.Status}}'
docker compose logs --tail 15 n8n
