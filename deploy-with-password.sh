#!/bin/bash
# Deploy Mobile API with password authentication

VPS_HOST="37.60.252.211"
VPS_USER="peter"
VPS_PASSWORD="Malawi12"

# Install sshpass if not available
if ! command -v sshpass &> /dev/null; then
    echo "Installing sshpass..."
    apt-get update -qq && apt-get install -y sshpass
fi

echo "========================================"
echo "  Deploying Mobile API to VPS"
echo "========================================"
echo ""

echo "[1/5] Connecting to VPS and pulling latest code..."
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /home/peter/dzalasmart
echo "Current directory: $(pwd)"
echo ""
echo "Git status:"
git status --short
echo ""
echo "Pulling latest changes..."
git pull origin cursor/comprehensive-improvements-7360
echo ""
ENDSSH

echo ""
echo "[2/5] Installing dependencies..."
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /home/peter/dzalasmart/server
echo "Installing npm packages..."
npm install --production
echo ""
ENDSSH

echo ""
echo "[3/5] Restarting API service..."
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
echo "Restarting nzeru-api..."
pm2 restart nzeru-api || pm2 start /home/peter/dzalasmart/server/src/index.js --name nzeru-api
echo ""
ENDSSH

echo ""
echo "[4/5] Checking service health..."
sleep 3
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
echo "PM2 status:"
pm2 list
echo ""
echo "Recent logs:"
pm2 logs nzeru-api --lines 20 --nostream
echo ""
ENDSSH

echo ""
echo "[5/5] Testing mobile API endpoints..."
echo ""
echo "Testing health endpoint:"
curl -s https://api.zammunda.com/health | jq '.' || curl -s https://api.zammunda.com/health
echo ""
echo "Testing mobile stats endpoint:"
curl -s https://api.zammunda.com/api/mobile/stats | jq '.' || curl -s https://api.zammunda.com/api/mobile/stats
echo ""

echo "========================================"
echo "  ✅ Deployment Complete!"
echo "========================================"
echo ""
echo "Mobile API Endpoints:"
echo "  - POST https://api.zammunda.com/api/mobile/farmers"
echo "  - POST https://api.zammunda.com/api/mobile/parcels"
echo "  - POST https://api.zammunda.com/api/mobile/crops"
echo "  - GET  https://api.zammunda.com/api/mobile/stats"
echo ""
echo "Android APK: /workspace/nzeru-farmer-v1.0.0.apk"
echo ""
echo "⚠️  IMPORTANT: Rotate password 'Malawi12' after deployment"
echo ""
