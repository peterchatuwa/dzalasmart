#!/bin/bash

# Farm Tab Diagnostic Script
# This script checks if all the backend components are properly deployed

echo "=================================="
echo "FARM TAB DIAGNOSTIC SCRIPT"
echo "=================================="
echo ""

VPS_IP="37.60.252.211"
VPS_USER="root"
VPS_PASS="Malawi12"

echo "[1/6] Checking if API server is running..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "systemctl is-active nzeru-za-alimi.service" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Server is running"
else
    echo "❌ Server is NOT running"
    exit 1
fi
echo ""

echo "[2/6] Checking if production-management.js exists..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "test -f /root/dzalasmart/server/src/production-management.js && echo 'EXISTS' || echo 'MISSING'" 2>/dev/null
echo ""

echo "[3/6] Checking for required functions in production-management.js..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "grep -c 'export.*function.*addLandParcel\|listLandParcels\|createProductionSeason\|listProductionSeasons\|addHouseholdMember\|listHouseholdMembers' /root/dzalasmart/server/src/production-management.js" 2>/dev/null
echo ""

echo "[4/6] Checking if functions are imported in app.js..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "grep -c 'addLandParcel\|listLandParcels\|createProductionSeason\|listProductionSeasons' /root/dzalasmart/server/src/app.js | head -1" 2>/dev/null
echo ""

echo "[5/6] Checking database tables..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "cd /root/dzalasmart && sudo -u postgres psql dzalasmart -c \"SELECT table_name FROM information_schema.tables WHERE table_name IN ('land_parcels', 'production_seasons', 'household_members') ORDER BY table_name;\"" 2>/dev/null
echo ""

echo "[6/6] Testing API endpoints..."
echo "Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST https://api.zammunda.com/api/farmers/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+265991234567","pin":"1234"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed or no test farmer exists"
    echo "Response: $LOGIN_RESPONSE"
else
    echo "✅ Login successful, token obtained"
    echo ""
    
    echo "Testing /api/farmers/me/parcels..."
    PARCELS_RESPONSE=$(curl -s -X GET https://api.zammunda.com/api/farmers/me/parcels \
      -H "Authorization: Bearer $TOKEN" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$PARCELS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$PARCELS_RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✅ Parcels endpoint working (HTTP 200)"
        echo "Response: $BODY"
    else
        echo "❌ Parcels endpoint failed (HTTP $HTTP_STATUS)"
        echo "Response: $BODY"
    fi
    echo ""
    
    echo "Testing /api/farmers/me/seasons..."
    SEASONS_RESPONSE=$(curl -s -X GET https://api.zammunda.com/api/farmers/me/seasons \
      -H "Authorization: Bearer $TOKEN" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$SEASONS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$SEASONS_RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✅ Seasons endpoint working (HTTP 200)"
        echo "Response: $BODY"
    else
        echo "❌ Seasons endpoint failed (HTTP $HTTP_STATUS)"
        echo "Response: $BODY"
    fi
    echo ""
    
    echo "Testing /api/farmers/me/household..."
    HOUSEHOLD_RESPONSE=$(curl -s -X GET https://api.zammunda.com/api/farmers/me/household \
      -H "Authorization: Bearer $TOKEN" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$HOUSEHOLD_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$HOUSEHOLD_RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✅ Household endpoint working (HTTP 200)"
        echo "Response: $BODY"
    else
        echo "❌ Household endpoint failed (HTTP $HTTP_STATUS)"
        echo "Response: $BODY"
    fi
fi

echo ""
echo "=================================="
echo "DIAGNOSTIC COMPLETE"
echo "=================================="
