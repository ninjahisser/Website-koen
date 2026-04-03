#!/bin/bash

set -euo pipefail

DOMAIN="${DOMAIN:-studiomalem.be}"
WWW_DOMAIN="${WWW_DOMAIN:-www.studiomalem.be}"
REPO_URL="${REPO_URL:-https://github.com/ninjahisser/Website-koen.git}"
APP_NAME="${APP_NAME:-studiomalem}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/Website-koen}"
APP_BASE_URL="${APP_BASE_URL:-https://$WWW_DOMAIN}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
CMS_PASSWORD_VALUE="${CMS_PASSWORD_VALUE:-ChangeMeNow123!}"
SECRET_KEY_VALUE="${SECRET_KEY_VALUE:-$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)}"

CURRENT_USER="$(id -un)"
CURRENT_GROUP="$(id -gn)"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_FILE="/etc/nginx/sites-available/${APP_NAME}.conf"
NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}.conf"

echo "=== ${APP_NAME} VPS Setup ==="
echo "Domain: ${DOMAIN}"
echo "WWW domain: ${WWW_DOMAIN}"
echo "Install dir: ${INSTALL_DIR}"
echo "User: ${CURRENT_USER}"
echo

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "ERROR: Vereist commando ontbreekt: $1"
        exit 1
    fi
}

echo "1. System packages installeren..."
sudo apt update
sudo apt install -y \
    git \
    curl \
    nginx \
    certbot \
    python3-certbot-nginx \
    python3-pip \
    python3-venv

require_command git
require_command python3
require_command nginx

echo "2. Repo ophalen of updaten..."
if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}"
    git pull --ff-only origin main
else
    rm -rf "${INSTALL_DIR}"
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
fi

echo "3. Python environment opzetten..."
cd "${INSTALL_DIR}/backend"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "4. backend/.env aanmaken of aanvullen..."
ENV_FILE="${INSTALL_DIR}/backend/.env"
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

echo "5. systemd service configureren..."
sudo tee "${SERVICE_FILE}" >/dev/null <<EOF
[Unit]
Description=Studio Malem Flask app via Gunicorn
After=network.target

[Service]
User=${CURRENT_USER}
Group=${CURRENT_GROUP}
WorkingDirectory=${INSTALL_DIR}/backend
Environment=PATH=${INSTALL_DIR}/backend/.venv/bin
ExecStart=${INSTALL_DIR}/backend/.venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 server:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "6. nginx configureren..."
sudo tee "${NGINX_FILE}" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    return 301 http://${WWW_DOMAIN}\$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${WWW_DOMAIN};

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

sudo ln -sf "${NGINX_FILE}" "${NGINX_LINK}"
sudo rm -f /etc/nginx/sites-enabled/default

echo "7. Services starten..."
sudo systemctl daemon-reload
sudo systemctl enable "${APP_NAME}"
sudo systemctl restart "${APP_NAME}"
sudo nginx -t
sudo systemctl restart nginx

echo "8. HTTPS proberen inschakelen..."
if [ -n "${LETSENCRYPT_EMAIL}" ]; then
    if sudo certbot --nginx --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" -d "${DOMAIN}" -d "${WWW_DOMAIN}"; then
        echo "HTTPS succesvol ingesteld."
    else
        echo "WAARSCHUWING: Certbot kon geen certificaat ophalen. Controleer DNS en probeer later opnieuw."
    fi
else
    echo "LETSENCRYPT_EMAIL niet gezet, HTTPS stap overgeslagen."
fi

echo
echo "=== Klaar ==="
echo "CMS URL: ${APP_BASE_URL}/cms"
echo "Site URL: ${APP_BASE_URL}"
echo
echo "Nuttige commando's:"
echo "sudo systemctl status ${APP_NAME}"
echo "journalctl -u ${APP_NAME} -n 100 --no-pager"
echo "sudo nginx -t"
echo
echo "Als HTTPS is overgeslagen, voer later uit:"
echo "sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
