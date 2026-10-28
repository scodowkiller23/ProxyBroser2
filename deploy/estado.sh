echo "== $(hostname) $(date -u +%FT%TZ)"
echo "nucleos: $(nproc)  memoria: $(free -h | awk '/Mem/{print $2" total, "$7" libre"}')  disco: $(df -h / | awk 'NR==2{print $4" libre"}')"
docker --version 2>&1 || echo "docker: NO instalado"
sudo iptables -S INPUT | grep -E 'dport (80|443)' || echo "iptables: 80/443 NO abiertos"
docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null
