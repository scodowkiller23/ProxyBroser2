#!/usr/bin/env bash
# Se ejecuta en la máquina de Oracle desde el workflow "Máquina Oracle" (modo desplegar).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data

# Secreto del TURN: se genera una vez en la maquina y no sale de aqui.
[ -f .turn-secret ] || { (openssl rand -hex 32 || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n') > .turn-secret; chmod 600 .turn-secret; }
grep -q '^TURN_SECRET=' .env 2>/dev/null || printf 'TURN_SECRET=%s\n' "$(cat .turn-secret)" >> .env
# Puertos del TURN en el cortafuegos de la maquina. En Oracle hay que abrirlos
# tambien en la Security List de la VCN, eso no se puede hacer desde aqui.
abrir() {
  sudo iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 1 -p "$1" --dport "$2" -j ACCEPT
}
abrir udp 3478 || true
abrir tcp 3478 || true
abrir udp 49160:49200 || true

docker network inspect web >/dev/null 2>&1 || docker network create web >/dev/null
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
sleep 5
docker compose ps --format '{{.Service}}: {{.Status}}'
docker compose logs --tail 15 app
