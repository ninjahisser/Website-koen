#!/bin/bash

set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

REPO_URL="${REPO_URL:-https://github.com/ninjahisser/Website-koen.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/Website-koen}"

echo "=== setup_vps bootstrap ==="
echo "Repo: ${REPO_URL}"
echo "Install dir: ${INSTALL_DIR}"

if ! command -v git >/dev/null 2>&1; then
	sudo apt update
	sudo apt install -y git
fi

if [ -d "${INSTALL_DIR}/.git" ]; then
	git -C "${INSTALL_DIR}" pull --ff-only origin main
else
	rm -rf "${INSTALL_DIR}"
	git clone "${REPO_URL}" "${INSTALL_DIR}"
fi

exec bash "${INSTALL_DIR}/fix_debian.sh" "$@"
