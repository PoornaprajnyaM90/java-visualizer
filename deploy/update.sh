#!/usr/bin/env bash
# Run on the server to ship a new version:  cd /opt/javalens && bash deploy/update.sh
set -euo pipefail
cd /opt/javalens
git pull
docker build -t java-visualizer-sandbox:latest ./sandbox
(cd backend && npm ci && npm run build)
(cd frontend && npm ci && npm run build)
sudo systemctl restart javalens-api
echo "Deployed. Check: curl -s http://127.0.0.1:4000/api/health"
