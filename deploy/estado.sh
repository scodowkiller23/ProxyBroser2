echo "== $(hostname) $(date -u +%FT%TZ)"
echo "nucleos: $(nproc)  memoria: $(free -h | awk '/Mem/{print $2" total, "$7" libre"}')  disco: $(df -h / | awk 'NR==2{print $4" libre"}')"
docker --version 2>&1 || echo "docker: NO instalado"
sudo iptables -S INPUT | grep -E 'dport (80|443)' || echo "iptables: 80/443 NO abiertos"
docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null
D=143-47-39-212.sslip.io
echo "https: $(curl -s -o /dev/null -w '%{http_code} cert_ok=%{ssl_verify_result}' --resolve $D:443:127.0.0.1 https://$D/api/notice)"
cd ~/proxypinga 2>/dev/null && docker compose logs caddy 2>&1 | grep -iE 'certificate obtained|error' | tail -5
