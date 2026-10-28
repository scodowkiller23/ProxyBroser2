echo "== $(hostname) $(date -u +%FT%TZ)"
echo "nucleos: $(nproc)  memoria: $(free -h | awk '/Mem/{print $2" total, "$7" libre"}')  disco: $(df -h / | awk 'NR==2{print $4" libre"}')"
docker --version 2>&1 || echo "docker: NO instalado"
sudo iptables -S INPUT | grep -E 'dport (80|443)' || echo "iptables: 80/443 NO abiertos"
docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null
D=143-47-39-212.sslip.io
echo "https: $(curl -s -o /dev/null -w '%{http_code} cert_ok=%{ssl_verify_result}' --resolve $D:443:127.0.0.1 https://$D/api/notice)"
cd ~/proxypinga 2>/dev/null && docker compose logs caddy 2>&1 | grep -iE 'certificate obtained|error' | tail -5
echo "-- salida a Internet"
echo "ip publica (maquina): $(curl -s -m 10 https://api.ipify.org)"
C=$(cd ~/proxypinga && docker compose ps -q app 2>/dev/null)
if [ -n "$C" ]; then
  echo "resolv.conf del contenedor: $(docker exec "$C" cat /etc/resolv.conf 2>&1 | tr '\n' ' ')"
  echo "ip publica (contenedor): $(docker exec "$C" node -e 'fetch("https://api.ipify.org").then(r=>r.text()).then(t=>console.log(t.trim()))' 2>&1 | tail -1)"
  docker exec "$C" node -e '
    const hosts = ["www.youtube.com", "www.google.com", "duckduckgo.com"];
    const dns = require("node:dns");
    (async () => {
      for (const h of hosts) {
        let sys = "?", cf = "?";
        try { sys = (await dns.promises.lookup(h)).address; } catch (e) { sys = "error " + e.code; }
        const r = new dns.Resolver(); r.setServers(["1.1.1.1"]);
        try { cf = (await r.resolve4(h))[0]; } catch (e) { cf = "error " + e.code; }
        let title = "?";
        try {
          const res = await fetch("https://" + h + "/", { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36" } });
          const body = await res.text();
          title = res.status + " titulo=" + ((body.match(/<title[^>]*>([^<]{0,70})/i) || [,"(sin titulo)"])[1]);
        } catch (e) { title = "error " + e.message; }
        console.log(h + " | dns sistema=" + sys + " | dns 1.1.1.1=" + cf + " | " + title);
      }
    })();
  ' 2>&1 | tail -6
else
  echo "contenedor app: no encontrado"
fi
echo "-- version servida"
D2=143-47-39-212.sslip.io
IDX=$(curl -s -m 15 --resolve $D2:443:127.0.0.1 https://$D2/)
for A in $(echo "$IDX" | grep -o 'assets/index-[A-Za-z0-9_-]*\.\(js\|css\)'); do
  B=$(curl -s -m 20 --resolve $D2:443:127.0.0.1 "https://$D2/$A")
  echo "$A -> $(echo "$B" | wc -c) bytes | olas=$(echo "$B" | grep -c 'getTotalLength\|pp-dash') bienvenida=$(echo "$B" | grep -c 'welcome-pinga\|welcome-ring') usermenu=$(echo "$B" | grep -c 'usermenu')"
done
