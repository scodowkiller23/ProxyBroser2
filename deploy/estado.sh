echo "== $(hostname) $(date -u +%FT%TZ)"
echo "nucleos: $(nproc)  memoria: $(free -h | awk '/Mem/{print $2" total, "$7" libre"}')  disco: $(df -h / | awk 'NR==2{print $4" libre"}')"
docker --version 2>&1 || echo "docker: NO instalado"
sudo iptables -S INPUT | grep -E 'dport (80|443)' || echo "iptables: 80/443 NO abiertos"
docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null
D=143-47-39-212.sslip.io
echo "https: $(curl -s -o /dev/null -w '%{http_code} cert_ok=%{ssl_verify_result}' --resolve $D:443:127.0.0.1 https://$D/api/notice)"
cd ~/proxypinga 2>/dev/null && docker compose logs caddy 2>&1 | grep -iE 'certificate obtained|error' | tail -5
echo "-- DNS"
for s in 1.1.1.3 1.1.1.1; do
  echo "$s -> duckduckgo.com: $(getent ahostsv4 duckduckgo.com 2>/dev/null | head -1 | cut -d' ' -f1) (sistema)"
  python3 - "$s" <<'PY' 2>/dev/null || echo "  $s: sin python/dns"
import socket, struct, sys, random
srv = sys.argv[1]
q = struct.pack('>HHHHHH', random.randint(0, 65535), 0x0100, 1, 0, 0, 0)
for part in b'duckduckgo.com'.split(b'.'): q += bytes([len(part)]) + part
q += b'\x00' + struct.pack('>HH', 1, 1)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(5)
s.sendto(q, (srv, 53))
d = s.recvfrom(512)[0]
i = d.index(b'\x00', 12) + 5
ips = []
while i < len(d) - 12:
    i += 2
    t, _, _, dl = struct.unpack('>HHIH', d[i:i+10]); i += 10
    if t == 1 and dl == 4: ips.append('.'.join(str(b) for b in d[i:i+4]))
    i += dl
print(f'  {srv}: {ips}')
PY
done
