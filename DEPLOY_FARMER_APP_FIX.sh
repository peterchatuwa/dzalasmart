#!/bin/bash
# Deploy Farmer App API Fixes to VPS

echo "========================================="
echo "Deploying Farmer App API Fixes"
echo "========================================="
echo ""

# VPS Details
VPS_IP="41.70.108.118"
VPS_USER="root"
APP_DIR="/opt/nzeru-za-alimi"

echo "[1/3] Pulling latest code from GitHub..."
ssh $VPS_USER@$VPS_IP << 'EOF'
cd /opt/nzeru-za-alimi
git pull origin cursor/comprehensive-improvements-7360
EOF

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to pull code"
    exit 1
fi
echo "✓ Code updated"
echo ""

echo "[2/3] Restarting API service..."
ssh $VPS_USER@$VPS_IP << 'EOF'
pm2 restart nzeru-api
pm2 logs nzeru-api --lines 20 --nostream
EOF

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to restart service"
    exit 1
fi
echo "✓ API restarted"
echo ""

echo "[3/3] Testing new endpoints..."
echo "Testing /api/farmers/me endpoint..."
ssh $VPS_USER@$VPS_IP << 'EOF'
# Get a test token
TOKEN=$(curl -s -X POST https://api.zammunda.com/api/farmers/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+265888000001","pin":"1234"}' | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
  echo "✓ Login successful, testing endpoints..."
  
  # Test /api/farmers/me
  curl -s -H "Authorization: Bearer $TOKEN" \
    https://api.zammunda.com/api/farmers/me | jq '.farmer.name'
  
  # Test /api/farmers/me/receipts
  echo "Testing receipts endpoint..."
  curl -s -H "Authorization: Bearer $TOKEN" \
    https://api.zammunda.com/api/farmers/me/receipts | jq 'length'
  
  # Test /api/farmers/market
  echo "Testing market endpoint..."
  curl -s -H "Authorization: Bearer $TOKEN" \
    https://api.zammunda.com/api/farmers/market | jq '.prices | length'
else
  echo "ERROR: Could not get auth token"
  exit 1
fi
EOF

echo ""
echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "New endpoints available:"
echo "  - GET  /api/farmers/me/receipts"
echo "  - GET  /api/farmers/market"
echo "  - POST /api/farmers/advisor"
echo ""
echo "Rebuild the APK with the latest farmer-app code to see farmer data!"
