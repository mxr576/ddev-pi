#!/usr/bin/env bash
#ddev-generated
set -e

# Verify the .pi configuration directory exists
if [ ! -d "${HOME}/.pi" ]; then
  echo "Error: .pi directory missing or not properly initialized."
  exit 1
fi

# Setup SSH connectivity to DDEV web container
SSH_KEY_DIR="/var/www/html/.ddev/.agent-ssh-keys"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

# SSH client: copy private key for connecting to web
cp "$SSH_KEY_DIR/id_ed25519" "${HOME}/.ssh/ddev_agent_key" 2>/dev/null || true
chmod 600 "${HOME}/.ssh/ddev_agent_key" 2>/dev/null || true

# Wait for web-user file (web container writes it on startup, max 15s)
for i in $(seq 1 15); do
  [ -f "$SSH_KEY_DIR/web-user" ] && break
  sleep 1
done
WEB_USER=$(cat "$SSH_KEY_DIR/web-user" 2>/dev/null || echo "ddev")

# Patch ssh config with the detected username, but only once
if ! sed -n '/^Host web$/,/^Host /p' "${HOME}/.ssh/config" 2>/dev/null | grep -q "^    User "; then
  sed -i "/^Host web$/a\\    User $WEB_USER" "${HOME}/.ssh/config" 2>/dev/null
fi

# Trap signals for graceful shutdown
trap 'echo "Shutting down Pi Workspace..."; exit 0' TERM INT

exec tail -f /dev/null
