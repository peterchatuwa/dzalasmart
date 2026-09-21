# Farm Tab Debugging Guide

## Issue
The user reports that the Farm tab is not working in the mobile app.

## Changes Made

### Enhanced Error Logging
I've added comprehensive console logging to help identify the issue:

1. **switchTab function** - Now logs when tabs are switched
2. **loadParcels function** - Logs API calls, responses, and errors
3. **loadSeasons function** - Logs API calls, responses, and errors  
4. **loadHousehold function** - Logs API calls, responses, and errors

### What to Check

#### 1. Rebuild and Install the App
```powershell
cd C:\path\to\workspace
.\REBUILD_APK_FIXED.ps1
```

#### 2. View Chrome DevTools Logs
After installing:
1. Connect your device via USB
2. Open Chrome and navigate to `chrome://inspect`
3. Find your device and click "inspect"
4. Look for the WebView console logs

#### 3. View ADB Logcat
```powershell
adb logcat | Select-String "chromium|Capacitor|Console"
```

## What the Logs Will Show

### When Farm Tab is Clicked
```
Switching to tab: farm
Tab activated: farm
Loading farm data...
Loading parcels...
Loading seasons...
Loading household...
```

### If Auth Token is Missing
```
No auth token available
```
**Fix**: This means the user is not logged in properly

### If API Calls Fail
```
Parcels response status: 401
Parcels API error: 401 {"error":"Invalid or expired session"}
```
**Fix**: Session expired, user needs to login again

```
Parcels response status: 500
Parcels API error: 500 Internal Server Error
```
**Fix**: Server-side error, check server logs

### If Network Fails
```
Failed to load parcels: TypeError: Failed to fetch
Network error loading parcels
```
**Fix**: Device has no internet or API server is down

## Common Issues and Fixes

### Issue 1: Farm Tab is Empty (No Error)
**Symptoms**: Tab switches but shows empty state messages for all sections

**Likely Cause**: This is actually CORRECT behavior if the farmer has not added any data yet!

**What to do**: 
- Click "+ Add Parcel" to add a land parcel
- Click "+ Start Season" to create a production season
- Click "+ Add Member" to add household members

### Issue 2: Farm Tab Won't Switch
**Symptoms**: Clicking the Farm tab button does nothing

**Likely Cause**: JavaScript error preventing tab switch

**What to do**:
1. Check console for errors
2. Look for `Tab not found: farmTab` in logs
3. Verify HTML has `<div id="farmTab" class="tab-pane">`

### Issue 3: API Errors (401 Unauthorized)
**Symptoms**: Error toasts appear, logs show 401 errors

**Likely Cause**: Auth token expired or invalid

**What to do**:
1. Logout and login again
2. Check if token is being saved: `Preferences.get({ key: 'farmer_session' })`

### Issue 4: API Errors (404 Not Found)
**Symptoms**: Logs show 404 errors for `/api/farmers/me/parcels`

**Likely Cause**: Backend not deployed or endpoint missing

**What to do**:
1. Verify server is running: `systemctl status nzeru-za-alimi.service`
2. Check server logs: `journalctl -u nzeru-za-alimi.service -n 50`
3. Test endpoint directly: `curl https://api.zammunda.com/api/farmers/me/parcels`

## Backend Verification

### Check if Endpoints Exist
```bash
# On the VPS
ssh root@37.60.252.211

# Check if production-management.js exists
ls -la /root/dzalasmart/server/src/production-management.js

# Restart the service
systemctl restart nzeru-za-alimi.service

# View logs
journalctl -u nzeru-za-alimi.service -f
```

### Test Endpoints with curl
```bash
# Get a login token first
TOKEN=$(curl -s -X POST https://api.zammunda.com/api/farmers/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+265991234567","pin":"1234"}' | jq -r .token)

# Test parcels endpoint
curl -X GET https://api.zammunda.com/api/farmers/me/parcels \
  -H "Authorization: Bearer $TOKEN"

# Test seasons endpoint
curl -X GET https://api.zammunda.com/api/farmers/me/seasons \
  -H "Authorization: Bearer $TOKEN"

# Test household endpoint
curl -X GET https://api.zammunda.com/api/farmers/me/household \
  -H "Authorization: Bearer $TOKEN"
```

## Expected Behavior

### Empty State (No Data Added Yet)
When a farmer first uses the app, they should see:
- **Parcels section**: "No land parcels added yet" with "+ Add Parcel" button
- **Seasons section**: "No production seasons yet" with "+ Start Season" button
- **Household section**: "No household members added yet" with "+ Add Member" button

**This is CORRECT and EXPECTED!**

### With Data
After adding parcels, seasons, and household members, they should display as cards with all the relevant information.

## Next Steps

1. **Rebuild the app** with the enhanced logging
2. **Login** and navigate to the Farm tab
3. **Check the console logs** in Chrome DevTools or ADB logcat
4. **Report back** with:
   - What you see in the logs
   - Whether the tab switches
   - Whether you see empty state messages or actual errors
   - Any error toasts that appear

The enhanced logging will help us pinpoint exactly where the issue is occurring.
