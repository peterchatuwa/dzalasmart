#!/bin/bash
# Deploy Mobile API to VPS
# Usage: ./deploy-mobile-api.sh

set -e

VPS_HOST="37.60.252.211"
VPS_USER="peter"
VPS_PASSWORD="C8\$mq0Ws"
APP_DIR="/home/peter/dzalasmart"
BRANCH="cursor/comprehensive-improvements-7360"

echo "========================================"
echo "  Deploying Mobile API to VPS"
echo "========================================"
echo ""

echo "[1/5] Connecting to VPS and pulling latest code..."
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /home/peter/dzalasmart
echo "Current directory: $(pwd)"
echo "Git status:"
git status --short
echo ""
echo "Pulling latest changes..."
git pull origin cursor/comprehensive-improvements-7360
echo ""
ENDSSH

echo "[2/5] Installing dependencies..."
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /home/peter/dzalasmart/server
echo "Installing npm packages..."
npm install
echo ""
ENDSSH

echo "[3/5] Restarting API service..."
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
echo "Restarting nzeru-api..."
pm2 restart nzeru-api || pm2 start /home/peter/dzalasmart/server/src/index.js --name nzeru-api
echo ""
ENDSSH

echo "[4/5] Checking service health..."
sleep 3
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
echo "PM2 status:"
pm2 list
echo ""
echo "Recent logs:"
pm2 logs nzeru-api --lines 15 --nostream
echo ""
ENDSSH

echo "[5/5] Testing mobile API endpoints..."
echo ""
echo "Testing farmer registration endpoint:"
curl -s -X GET https://api.zammunda.com/health | jq '.'
echo ""
echo "Testing API status:"
curl -s -X GET https://api.zammunda.com/api/mobile/stats | jq '.'
echo ""

echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Mobile API Endpoints:"
echo "  - POST https://api.zammunda.com/api/mobile/farmers"
echo "  - POST https://api.zammunda.com/api/mobile/parcels"
echo "  - POST https://api.zammunda.com/api/mobile/crops"
echo "  - GET  https://api.zammunda.com/api/mobile/stats"
echo ""
echo "Android APK Location:"
echo "  - /workspace/nzeru-farmer-v1.0.0.apk"
echo ""
echo "Next Steps:"
echo "  1. Test the mobile API endpoints using the APK"
echo "  2. Monitor logs: ssh peter@37.60.252.211 'pm2 logs nzeru-api'"
echo "  3. VPN setup pending PSK from Airtel"
echo ""
