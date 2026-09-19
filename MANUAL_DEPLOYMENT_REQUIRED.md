# Manual Deployment Required

## ⚠️ SSH Password Authentication Failed

The automated deployment couldn't connect to your VPS with the provided password. This could mean:
- Password authentication might be disabled on the VPS
- SSH key authentication is required
- The password needs verification

## ✅ Solution: Manual Deployment (5 Minutes)

The code is already committed and pushed to GitHub. You just need to pull it on your VPS.

### Step 1: Open Terminal and SSH

```bash
ssh peter@37.60.252.211
```

When prompted, enter password: **Malawi12**

### Step 2: Deploy the Mobile API

Once connected, **copy and paste these commands**:

```bash
cd /home/peter/dzalasmart

# Pull latest code
git pull origin cursor/comprehensive-improvements-7360

# Install dependencies
cd server
npm install

# Restart API
pm2 restart nzeru-api

# Check logs
pm2 logs nzeru-api --lines 20
```

### Step 3: Verify Deployment

Test from your browser or terminal:

```bash
# Health check
https://api.zammunda.com/health

# Mobile stats
https://api.zammunda.com/api/mobile/stats
```

Expected response for health:
```json
{"ok": true, "timestamp": "..."}
```

Expected response for stats:
```json
{
  "farmers_count": 0,
  "parcels_count": 0,
  "crops_count": 0,
  "total_land_hectares": 0,
  "total_expected_yield_kg": 0,
  "cropBreakdown": []
}
```

## 📋 What This Deployment Includes

### New Backend Code
- `server/src/mobile-api.js` - Mobile API endpoints module
- Updated `server/src/app.js` - 5 new routes

### New API Endpoints
```
POST /api/mobile/farmers       - Register farmer
POST /api/mobile/parcels       - Add land parcel
POST /api/mobile/crops         - Record crop data
GET  /api/mobile/stats         - Get statistics
GET  /api/mobile/submissions   - Recent submissions
```

## 🎯 After Deployment

### 1. Test Farmer Registration
```bash
curl -X POST https://api.zammunda.com/api/mobile/farmers \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Farmer",
    "phone": "+265999123456",
    "district": "Lilongwe",
    "epa": "Lilongwe RDP"
  }'
```

Expected response:
```json
{
  "success": true,
  "farmerId": "farmer_...",
  "farmerCode": "F...",
  "message": "Farmer registered successfully. Default PIN is 0000."
}
```

### 2. Install Android APK

**APK Location**: `/workspace/nzeru-farmer-v1.0.0.apk` (8.4 MB)

**To install**:
1. Download APK from workspace
2. Transfer to Android device
3. Enable "Install from Unknown Sources"
4. Install and test

### 3. Test Complete Flow

1. ✅ Register farmer via app (offline)
2. ✅ Add parcel with GPS
3. ✅ Record crop data
4. ✅ Sync data to server
5. ✅ Verify data in stats endpoint

## 🔧 Troubleshooting

### PM2 Service Not Running
```bash
pm2 list
# If nzeru-api not listed:
pm2 start /home/peter/dzalasmart/server/src/index.js --name nzeru-api
pm2 save
```

### Check for Errors
```bash
pm2 logs nzeru-api --lines 50
```

### API Returns 404
- Verify git pull completed successfully
- Check PM2 restarted properly
- Ensure you're in the correct directory

### Database Connection Issues
```bash
# Check database status
psql -U peter -d nzeru -c "SELECT COUNT(*) FROM farmers;"
```

## 🔐 Security Reminder

**⚠️ IMPORTANT**: Rotate the password **Malawi12** after deployment for security:

```bash
# On VPS, change password:
passwd peter
```

Then update any scripts or documentation with the new password.

## 📊 Expected Results

### Before Mobile App Usage
- Farmers: Existing count (from web/USSD)
- Parcels: 0 or minimal
- Crops: 0 or minimal

### After Field Data Collection
- Farmers: Should increase as officers register new farmers
- Parcels: Should grow as land data is collected
- Crops: Should grow as planting is recorded

## ✨ Success Indicators

Deployment is successful when:

1. ✅ `pm2 list` shows `nzeru-api` as "online"
2. ✅ `https://api.zammunda.com/health` returns `{"ok": true}`
3. ✅ `https://api.zammunda.com/api/mobile/stats` returns valid JSON
4. ✅ Can POST to `/api/mobile/farmers` and get 201 response
5. ✅ Android app successfully syncs data

## 📞 Need Help?

If you encounter issues:

1. Check PM2 logs: `pm2 logs nzeru-api`
2. Verify git branch: `git branch --show-current`
3. Check Node.js version: `node --version` (should be v22+)
4. Verify database: `psql -U peter -d nzeru -c "\dt"`

## 📚 Full Documentation

- **Deployment Guide**: `/workspace/MOBILE_API_DEPLOYMENT.md`
- **API Documentation**: See endpoints section above
- **Android App Docs**: `/workspace/android-app/README.md`
- **Build Instructions**: `/workspace/android-app/BUILD_INSTRUCTIONS.md`

---

## Quick Copy-Paste Deployment

```bash
# SSH to VPS
ssh peter@37.60.252.211

# Deploy commands (paste all at once)
cd /home/peter/dzalasmart && \
git pull origin cursor/comprehensive-improvements-7360 && \
cd server && \
npm install && \
pm2 restart nzeru-api && \
pm2 logs nzeru-api --lines 20
```

---

**Status**: Code ready on GitHub, manual VPS deployment required  
**Time Estimate**: 5 minutes  
**Difficulty**: Easy (copy-paste commands)

🚀 Ready when you are!
