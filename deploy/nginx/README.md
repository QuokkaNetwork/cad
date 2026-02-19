# NGINX + TLS Deployment

This repo includes a ready reverse-proxy setup for:

- Domain: `cad.quokkanetworks.net`
- CAD backend: `http://127.0.0.1:3031`

## Quick Setup (Ubuntu/Debian VPS)

From the repo root:

```bash
chmod +x deploy/scripts/setup-nginx-certbot.sh
sudo bash deploy/scripts/setup-nginx-certbot.sh cad.quokkanetworks.net your-email@domain.tld
```

## Quick Setup (Windows VPS)

Run from an **Administrator** terminal on the Windows VPS:

```bat
deploy\scripts\setup-nginx-win.bat
```

The Windows setup script will:

1. Install nginx (zip build) if missing
2. Install win-acme (Let's Encrypt client) if missing
3. Open inbound firewall ports `80` and `443`
4. Write bootstrap nginx config for ACME HTTP-01 validation
5. Request a certificate and configure renewal via win-acme
6. Write final HTTPS + redirect nginx config and reload nginx

## Quick Setup From Windows (.bat + SSH)

From repo root on your Windows machine:

```bat
deploy\scripts\setup-nginx-certbot.bat
```

The batch script will prompt for VPS host/user/domain/email, upload the Linux setup files, then run the same nginx+certbot installer remotely over SSH.

The script will:

1. Install `nginx`, `certbot`, and `python3-certbot-nginx`
2. Deploy nginx site config from `deploy/nginx/cad-site.conf.template`
3. Enable HTTPS with a Let's Encrypt certificate
4. Enable auto-renewal (`certbot.timer`) and run a dry-run renewal test

## CAD Environment Settings

Set these in your `.env` for production:

```env
NODE_ENV=production
WEB_URL=https://cad.quokkanetworks.net
STEAM_REALM=https://cad.quokkanetworks.net
STEAM_RETURN_URL=https://cad.quokkanetworks.net/api/auth/steam/callback
AUTH_COOKIE_SECURE=true
TRUST_PROXY=1
FIVEM_BRIDGE_LICENSE_LOG_TO_FILE=true
# Optional override to store logs at a specific node path:
# FIVEM_BRIDGE_LICENSE_LOG_FILE=/var/log/cad/fivem-license.log
```

## Notes

- Keep FiveM bridge base URL on local HTTP (`http://127.0.0.1:3031`) for bridge compatibility.
- The nginx config includes websocket forwarding for `/voice-bridge`.
- The nginx config disables proxy buffering for `/api/events` (SSE live events).
- Cloud/VPS network firewalls/security groups must also allow inbound `80` and `443`.
- Canonical host redirect is enforced so IP-host requests are redirected to `https://cad.quokkanetworks.net`.
- License bridge events are persisted by default at `server/data/logs/fivem-license.log` (or `FIVEM_BRIDGE_LICENSE_LOG_FILE` if set).

## If Browser Still Shows "Not Secure" (Windows VPS)

1. Make sure you are opening `https://cad.quokkanetworks.net` (not the raw VPS IP).
2. Re-run the Windows setup as Administrator so nginx picks the current cert PEM files:

```bat
deploy\scripts\setup-nginx-win.bat
```

3. Verify nginx is serving HTTPS and using the domain site config:

```powershell
C:\nginx\nginx.exe -p C:\nginx\ -c conf\nginx.conf -t
Get-Content C:\nginx\conf\conf.d\cad.quokkanetworks.net.conf
```

4. Confirm the certificate is reachable from the VPS:

```powershell
Invoke-WebRequest https://cad.quokkanetworks.net/health -UseBasicParsing
```

If HTTPS works on domain but not on IP, that is expected: Let's Encrypt certs are issued to the domain, not the IP address.
