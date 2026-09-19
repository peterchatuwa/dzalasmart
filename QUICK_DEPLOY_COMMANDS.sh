#!/bin/bash
# Copy-paste these commands into your VPS terminal after SSH

# ============================================
# MOBILE API DEPLOYMENT - VPS COMMANDS
# ============================================

# Step 1: Navigate to app directory
cd /home/peter/dzalasmart

# Step 2: Pull latest code from GitHub
git pull origin cursor/comprehensive-improvements-7360

# Step 3: Install any new dependencies
cd server
npm install

# Step 4: Restart the API service
pm2 restart nzeru-api

# If above fails, start fresh:
# pm2 delete nzeru-api
# pm2 start src/index.js --name nzeru-api

# Step 5: Check logs for errors
pm2 logs nzeru-api --lines 30 --nostream

# Step 6: Verify service status
pm2 list

# ============================================
# TESTING COMMANDS (run from local machine)
# ============================================

# Test 1: Health check
# curl https://api.zammunda.com/health

# Test 2: Mobile stats
# curl https://api.zammunda.com/api/mobile/stats

# Test 3: Farmer registration
# curl -X POST https://api.zammunda.com/api/mobile/farmers \
#   -H "Content-Type: application/json" \
#   -d '{"fullName":"Test Farmer","phone":"+265999TEST999","district":"Lilongwe","epa":"Lilongwe RDP"}'

# ============================================
# ALL DONE!
# ============================================

echo ""
echo "Deployment complete!"
echo ""
echo "Mobile API Endpoints:"
echo "  - POST /api/mobile/farmers"
echo "  - POST /api/mobile/parcels"
echo "  - POST /api/mobile/crops"
echo "  - GET  /api/mobile/stats"
echo ""
echo "Android APK: /workspace/nzeru-farmer-v1.0.0.apk"
echo ""
