echo "== $(hostname) $(date -u +%FT%TZ)"
echo "nucleos: $(nproc)  memoria: $(free -h | awk '/Mem/{print $2" total, "$7" libre"}')  disco: $(df -h / | awk 'NR==2{print $4" libre"}')"
docker --version 2>&1 || echo "docker: NO instalado"
sudo iptables -S INPUT | grep -E 'dport (80|443)' || echo "iptables: 80/443 NO abiertos"
docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null
D=143-47-39-212.sslip.io
echo "https: $(curl -s -o /dev/null -w '%{http_code} cert_ok=%{ssl_verify_result}' --resolve $D:443:127.0.0.1 https://$D/api/notice)"
cd ~/proxypinga 2>/dev/null && docker compose logs caddy 2>&1 | grep -iE 'certificate obtained|error' | tail -5
echo "-- salida a Internet desde la maquina"
echo "ip publica: $(curl -s -m 10 https://api.ipify.org)"
for u in https://duckduckgo.com/ https://search.brave.com/ https://es.wikipedia.org/ https://example.com/; do
  r=$(curl -s -m 15 -o /tmp/pp-body -w '%{http_code}' -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' "$u")
  echo "$u -> $r $(grep -ciE 'blocked|your organization' /tmp/pp-body 2>/dev/null | sed 's/^0$/ok/;s/^[1-9].*/BLOQUEO-EN-EL-HTML/')"
done
