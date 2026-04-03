#!/bin/bash

set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_DIR="${SCRIPT_DIR}"

DOMAIN="${DOMAIN:-studiomalem.be}"
WWW_DOMAIN="${WWW_DOMAIN:-www.studiomalem.be}"
APP_NAME="${APP_NAME:-studiomalem}"
REPO_URL="${REPO_URL:-https://github.com/ninjahisser/Website-koen.git}"
REPO_DIR="${REPO_DIR:-$DEFAULT_REPO_DIR}"
APP_BASE_URL="${APP_BASE_URL:-https://$WWW_DOMAIN}"
CMS_PASSWORD_VALUE="${CMS_PASSWORD_VALUE:-ChangeMeNow123!}"
PUBLIC_IP="${PUBLIC_IP:-136.144.201.79}"
APP_USER="${SUDO_USER:-$(id -un)}"
APP_GROUP="$(id -gn "$APP_USER")"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_FILE="/etc/nginx/sites-available/${APP_NAME}.conf"
NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}.conf"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

make_secret_key() {
    python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
}

SECRET_KEY_VALUE="${SECRET_KEY_VALUE:-$(make_secret_key)}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "ERROR: Vereist commando ontbreekt: $1"
        exit 1
    fi
}

ensure_repo() {
    if [ -f "${REPO_DIR}/backend/server.py" ]; then
        return
    fi

    REPO_DIR="${HOME}/Website-koen"
    if [ -d "${REPO_DIR}/.git" ]; then
        git -C "${REPO_DIR}" pull --ff-only origin main
    else
        rm -rf "${REPO_DIR}"
        git clone "${REPO_URL}" "${REPO_DIR}"
    fi
}

write_http_nginx_config() {
    sudo tee "${NGINX_FILE}" >/dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${DOMAIN};

    return 301 http://${WWW_DOMAIN}\$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${WWW_DOMAIN} ${PUBLIC_IP} _;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }
}
EOF
}

write_https_nginx_config() {
    sudo tee "${NGINX_FILE}" >/dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${DOMAIN};

    return 301 https://${WWW_DOMAIN}\$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${WWW_DOMAIN};

    return 301 https://${WWW_DOMAIN}\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};

    return 301 https://${WWW_DOMAIN}\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${WWW_DOMAIN} ${PUBLIC_IP} _;

    ssl_certificate ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }
}
EOF
}

echo "=== Debian repair for ${APP_NAME} ==="
echo "Repo dir: ${REPO_DIR}"
echo "Domain: ${DOMAIN}"
echo "App user: ${APP_USER}"
echo

echo "1. Packages installeren..."
sudo apt update
sudo apt install -y git curl nginx certbot python3-certbot-nginx python3-pip python3-venv

require_command git
require_command python3
require_command nginx
require_command certbot

echo "2. Repo bepalen..."
ensure_repo
cd "${REPO_DIR}"
if [ -d .git ]; then
    git pull --ff-only origin main || true
fi

echo "3. Python environment en dependencies..."
cd "${REPO_DIR}/backend"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "4. backend/.env aanmaken of aanvullen..."
ENV_FILE="${REPO_DIR}/backend/.env"
if [ ! -f "${ENV_FILE}" ]; then
    cat > "${ENV_FILE}" <<EOF
# CMS Configuration
CMS_PASSWORD=${CMS_PASSWORD_VALUE}

# Secret key for sessions (change this in production!)
SECRET_KEY=${SECRET_KEY_VALUE}

# Stripe Configuration
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
APP_BASE_URL=${APP_BASE_URL}
EOF
else
    if ! grep -q '^CMS_PASSWORD=' "${ENV_FILE}"; then
        printf '\nCMS_PASSWORD=%s\n' "${CMS_PASSWORD_VALUE}" >> "${ENV_FILE}"
    fi
    if ! grep -q '^SECRET_KEY=' "${ENV_FILE}"; then
        printf 'SECRET_KEY=%s\n' "${SECRET_KEY_VALUE}" >> "${ENV_FILE}"
    fi
    if grep -q '^APP_BASE_URL=' "${ENV_FILE}"; then
        sed -i "s|^APP_BASE_URL=.*|APP_BASE_URL=${APP_BASE_URL}|" "${ENV_FILE}"
    else
        printf 'APP_BASE_URL=%s\n' "${APP_BASE_URL}" >> "${ENV_FILE}"
    fi
    if ! grep -q '^STRIPE_SECRET_KEY=' "${ENV_FILE}"; then
        printf 'STRIPE_SECRET_KEY=\n' >> "${ENV_FILE}"
    fi
    if ! grep -q '^STRIPE_PUBLISHABLE_KEY=' "${ENV_FILE}"; then
        printf 'STRIPE_PUBLISHABLE_KEY=\n' >> "${ENV_FILE}"
    fi
fi

echo "5. systemd service schrijven..."
sudo tee "${SERVICE_FILE}" >/dev/null <<EOF
[Unit]
Description=Studio Malem Flask app via Gunicorn
After=network.target

[Service]
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${REPO_DIR}/backend
Environment=PATH=${REPO_DIR}/backend/.venv/bin
ExecStart=${REPO_DIR}/backend/.venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 server:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "6. nginx config herstellen..."
if [ -f "${CERT_PATH}" ] && [ -f "${KEY_PATH}" ]; then
    write_https_nginx_config
else
    write_http_nginx_config
fi

sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f "${NGINX_LINK}"
sudo ln -sf "${NGINX_FILE}" "${NGINX_LINK}"

echo "7. Services herstarten..."
sudo systemctl daemon-reload
sudo systemctl enable "${APP_NAME}"
sudo systemctl restart "${APP_NAME}"
sudo nginx -t
sudo systemctl restart nginx

echo "8. HTTPS certificaat controleren..."
if [ ! -f "${CERT_PATH}" ] || [ ! -f "${KEY_PATH}" ]; then
    if sudo certbot certonly --nginx --non-interactive --agree-tos --register-unsafely-without-email -d "${DOMAIN}" -d "${WWW_DOMAIN}"; then
        write_https_nginx_config
        sudo nginx -t
        sudo systemctl restart nginx
        echo "HTTPS succesvol ingesteld."
    else
        echo "WAARSCHUWING: Certbot kon geen certificaat ophalen. HTTP blijft werken; controleer DNS en probeer later opnieuw."
    fi
else
    echo "Bestaand certificaat gevonden; HTTPS config is toegepast."
fi

echo
echo "=== Klaar ==="
echo "Site URL: ${APP_BASE_URL}"
echo "CMS URL: ${APP_BASE_URL}/cms"
echo
echo "Checks:"
echo "sudo systemctl status ${APP_NAME} --no-pager"
echo "curl -I http://127.0.0.1:5000"
echo "curl -I http://${WWW_DOMAIN}"
echo "curl -I https://${WWW_DOMAIN}"