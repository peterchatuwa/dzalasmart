# Farmer App Data Loading Fix

## Problem
The farmer app was not showing any farmer details after login because:

1. **API Response Structure Issue**: The `/api/farmers/me` endpoint returns `{ farmer: {...} }`, but the app was treating the entire response as the farmer object.

2. **Missing API Endpoints**: The app was calling three endpoints that didn't exist:
   - `GET /api/farmers/me/receipts` - to load warehouse receipts
   - `GET /api/farmers/market` - to load market prices (filtered by farmer's district)
   - `POST /api/farmers/advisor` - for agricultural advice chatbot

## Fixes Applied

### 1. Fixed Data Extraction (farmer-app/www/app.js)

**Before:**
```javascript
const statusResponse = await fetch(`${API_URL}/api/farmers/me`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
});

if (statusResponse.ok) {
    currentFarmer = await statusResponse.json();  // ❌ Wrong!
    updateUI();
}
```

**After:**
```javascript
const statusResponse = await fetch(`${API_URL}/api/farmers/me`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
});

if (statusResponse.ok) {
    const data = await statusResponse.json();
    // API returns { farmer: {...} }, extract the farmer object
    currentFarmer = data.farmer || data;  // ✅ Fixed!
    updateUI();
}
```

### 2. Added Missing API Endpoints (server/src/app.js)

#### GET /api/farmers/me/receipts
Returns all warehouse receipts for the logged-in farmer:
```javascript
app.get("/api/farmers/me/receipts", requireFarmer(db, jwtSecret), async (req, res, next) => {
  const receipts = await db.prepare(`
    SELECT id, code, crop, weight_kg, moisture_pct, price_per_kg, 
           asset_value, loan_cap, loan_disbursed, disbursed_at, created_at
    FROM warehouse_receipts 
    WHERE farmer_id = ?
    ORDER BY created_at DESC
  `).all(req.farmer.id);
  res.json(receipts);
});
```

#### GET /api/farmers/market
Returns market prices filtered by the farmer's district:
```javascript
app.get("/api/farmers/market", requireFarmer(db, jwtSecret), async (req, res, next) => {
  // Get district-specific market prices
  const prices = await db.prepare(`
    SELECT crop, price, district, recorded_at
    FROM market_prices
    WHERE district = ?
    ORDER BY recorded_at DESC
  `).all(req.farmer.district);
  
  // Get government floor prices
  const floors = await db.prepare(`
    SELECT crop, floor_price, season
    FROM price_floors
    WHERE season = (SELECT MAX(season) FROM price_floors)
    ORDER BY crop
  `).all();
  
  res.json({ prices, floors });
});
```

#### POST /api/farmers/advisor
Simple rule-based agricultural chatbot:
```javascript
app.post("/api/farmers/advisor", requireFarmer(db, jwtSecret), async (req, res, next) => {
  const { query } = req.body;
  
  // Rule-based responses for common agricultural questions
  let advice = '';
  if (query.includes('weather')) {
    advice = 'Based on current forecasts, expect moderate rainfall...';
  } else if (query.includes('fertilizer')) {
    advice = 'For maize, use NPK 23:21:0+4S at planting...';
  }
  // ... more rules for pests, irrigation, storage, market, etc.
  
  // Log the query
  await db.prepare(`
    INSERT INTO advisor_queries (farmer_id, query, response, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(req.farmer.id, query, advice);
  
  res.json({ advice });
});
```

## Deployment Steps

### 1. Deploy to VPS

```bash
# SSH into VPS
ssh root@41.70.108.118

# Navigate to app directory
cd /opt/nzeru-za-alimi

# Pull latest code
git pull origin cursor/comprehensive-improvements-7360

# Restart API
pm2 restart nzeru-api

# Test the endpoints
TOKEN=$(curl -s -X POST https://api.zammunda.com/api/farmers/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+265888000001","pin":"1234"}' | jq -r '.token')

# Test /api/farmers/me
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.zammunda.com/api/farmers/me | jq '.farmer.name'

# Test /api/farmers/me/receipts
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.zammunda.com/api/farmers/me/receipts | jq 'length'

# Test /api/farmers/market
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.zammunda.com/api/farmers/market | jq '.prices | length'
```

### 2. Rebuild the APK

On your Windows machine:

```powershell
cd C:\Users\peter\Projects\dzalasmart

# Pull latest farmer-app code
git pull origin cursor/comprehensive-improvements-7360

# Sync web files to Android
Copy-Item farmer-app\www\* -Destination farmer-app\android\app\src\main\assets\public\ -Recurse -Force

# Build APK
cd farmer-app\android
Remove-Item -Recurse -Force build, app\build -ErrorAction SilentlyContinue
.\gradlew.bat clean
.\gradlew.bat assembleDebug

# Install
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

## What Will Work Now

After deploying and rebuilding:

1. ✅ **Login** - Farmer can log in with phone/PIN
2. ✅ **Profile Data** - Name, phone, district, EPA, village, gender, household info will display
3. ✅ **Warehouse Receipts** - List of all receipts and loans will show
4. ✅ **Market Prices** - District-specific market prices and floor prices will display
5. ✅ **Advisor Chat** - Ask agricultural questions and get relevant advice
6. ✅ **Recent Activity** - Timeline of farmer events

## Test Credentials

Use any of these test farmers (all use PIN **1234**):

- Phone: `+265888000001` | PIN: `1234`
- Phone: `+265888000002` | PIN: `1234`
- Phone: `+265888000003` | PIN: `1234`

## Commit Reference

- Commit: `ac6059f`
- Branch: `cursor/comprehensive-improvements-7360`
- Message: "Fix farmer app data loading and add missing API endpoints"
