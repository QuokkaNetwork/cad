#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo bash deploy/scripts/setup-nginx-certbot.sh cad.quokkanetworks.net admin@quokkanetworks.net
#
# Optional env override:
#   CAD_BACKEND_URL=http://127.0.0.1:3031

DOMAIN="${1:-cad.quokkanetworks.net}"
EMAIL="${2:-}"
CAD_BACKEND_URL="${CAD_BACKEND_URL:-http://127.0.0.1:3031}"

if [[ -z "${EMAIL}" ]]; then
  echo "ERROR: email is required."
  echo "Usage: sudo bash deploy/scripts/setup-nginx-certbot.sh <domain> <email>"
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root (sudo)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEMPLATE_PATH="${REPO_ROOT}/deploy/nginx/cad-site.conf.template"
NGINX_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"

if [[ ! -f "${TEMPLATE_PATH}" ]]; then
  echo "ERROR: template not found: ${TEMPLATE_PATH}"
  exit 1
fi

echo "[CAD] Installing nginx + certbot packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx

echo "[CAD] Writing nginx site config for ${DOMAIN} -> ${CAD_BACKEND_URL}"
sed \
  -e "s#{{DOMAIN}}#${DOMAIN}#g" \
  -e "s#{{BACKEND}}#${CAD_BACKEND_URL}#g" \
  "${TEMPLATE_PATH}" > "${NGINX_AVAILABLE}"

ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

echo "[CAD] Validating nginx config..."
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "[CAD] Requesting Let's Encrypt certificate for ${DOMAIN}..."
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --no-eff-email \
  --redirect \
  --email "${EMAIL}" \
  -d "${DOMAIN}"

echo "[CAD] Reloading nginx after certificate install..."
nginx -t
systemctl reload nginx

echo "[CAD] Verifying renewal timer..."
systemctl enable --now certbot.timer
certbot renew --dry-run

echo
echo "[CAD] Completed."
echo "  Domain: ${DOMAIN}"
echo "  Backend: ${CAD_BACKEND_URL}"
echo "  Nginx site: ${NGINX_AVAILABLE}"
echo "  Cert path: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
