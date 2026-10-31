#!/usr/bin/env bash
# One-command setup for a fresh Ubuntu 22.04 / 24.04 server. Safe to run again to update.
#
#   sudo bash deploy/setup.sh your-domain.com [anthropic-api-key]
#
# It installs Docker, Node.js and Caddy, builds the Java sandbox, the backend and the frontend,
# starts the API as a service, and turns on HTTPS for your domain.
set -euo pipefail

DOMAIN="${1:-}"
API_KEY="${2:-}"
APP=/opt/javalens

if [ -z "$DOMAIN" ]; then echo "Usage: sudo bash deploy/setup.sh your-domain.com [anthropic-api-key]"; exit 1; fi
if [ "$(id -u)" -ne 0 ]; then echo "Please run as root:  sudo bash deploy/setup.sh $DOMAIN"; exit 1; fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"
export DEBIAN_FRONTEND=noninteractive

echo "==> 1/8 Installing basic packages"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg ufw rsync debian-keyring debian-archive-keyring apt-transport-https

echo "==> 2/8 Installing Docker"
command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh

echo "==> 3/8 Installing Node.js"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> 4/8 Installing Caddy (web server with automatic HTTPS)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> 5/8 Creating the app user and copying files to $APP"
id javalens >/dev/null 2>&1 || adduser --disabled-password --gecos "" javalens
usermod -aG docker javalens
mkdir -p "$APP"
if [ "$SRC" != "$APP" ]; then
  rsync -a --delete --exclude node_modules --exclude dist --exclude .env "$SRC"/ "$APP"/
fi
rm -f "$APP/frontend/.env"      # demo mode must be OFF in the production build
chown -R javalens:javalens "$APP"

echo "==> 6/8 Building the Java sandbox image (the first time takes a few minutes)"
docker build -t java-visualizer-sandbox:latest "$APP/sandbox"

echo "==> 7/8 Building the backend and the frontend"
su javalens -s /bin/bash -c "cd $APP/backend && npm ci && npm run build"
su javalens -s /bin/bash -c "cd $APP/frontend && npm ci && npm run build"

ENVF="$APP/backend/.env"
if [ ! -f "$ENVF" ]; then
  cat > "$ENVF" <<ENV_END
PORT=4000
HOST=127.0.0.1
TRUST_PROXY=1
FRONTEND_ORIGIN=https://$DOMAIN
SANDBOX_IMAGE=java-visualizer-sandbox:latest
MAX_CONCURRENT=2
ANTHROPIC_API_KEY=$API_KEY
EXPLAIN_MODEL=claude-sonnet-5-5
ENV_END
  chown javalens:javalens "$ENVF"
  chmod 600 "$ENVF"
else
  echo "    (keeping your existing $ENVF)"
fi

echo "==> 8/8 Starting the API and the website"
cp "$APP/deploy/javalens-api.service" /etc/systemd/system/
sed "s/javalens.example.com/$DOMAIN/g" "$APP/deploy/Caddyfile" > /etc/caddy/Caddyfile
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl daemon-reload
systemctl enable javalens-api >/dev/null 2>&1
systemctl restart javalens-api
systemctl restart caddy

sleep 4
echo
echo "API health check:"
curl -fsS http://127.0.0.1:4000/api/health || echo "(API did not answer. See: journalctl -u javalens-api -n 40)"
echo
echo "Done. Open  https://$DOMAIN  (the header chip should say Ready)."
