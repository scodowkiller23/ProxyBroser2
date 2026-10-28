#!/usr/bin/env bash
# Se ejecuta en la máquina de Oracle desde el workflow "Máquina Oracle" (modo desplegar).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
sleep 5
docker compose ps --format '{{.Service}}: {{.Status}}'
docker compose logs --tail 15 app
