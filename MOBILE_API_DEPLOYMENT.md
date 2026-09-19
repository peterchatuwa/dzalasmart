# Mobile API Deployment Guide

## Overview

The mobile API endpoints have been implemented and are ready for deployment. These endpoints support the Nzeru Farmer Android app for offline-first data collection.

## What Was Built

### 1. Mobile API Module (`server/src/mobile-api.js`)
- **Farmer Registration**: Save farmer demographic data from mobile app
- **Parcel Management**: Record land parcel information with GPS coordinates
- **Crop Tracking**: Log crop planting and yield data
- **Statistics**: Get mobile data collection statistics
- **Monitoring**: Track recent submissions

### 2. API Endpoints

#### POST /api/mobile/farmers
Register a new farmer from mobile app.

**Request Body:**
```json
{
  "fullName": "John Banda",
  "phone": "+265991234567",
  "district": "Lilongwe",
  "epa": "Lilongwe RDP",
  "village": "Mtandire",
  "gender": "male",
  "dateOfBirth": "1985-03-15",
  "householdSize": 6,
  "householdType": "married_with_children",
  "livestock": "goats,chickens",
  "photo": "base64_encoded_photo_data"
}
```

**Response:**
```json
{
  "success": true,
  "farmerId": "farmer_abc123",
  "farmerCode": "F12345678",
  "message": "Farmer registered successfully. Default PIN is 0000.",
  "photoStored": true
}
```

#### POST /api/mobile/parcels
Add a land parcel for a farmer.

**Request Body:**
```json
{
  "farmerPhone": "+265991234567",
  "name": "Main Field",
  "size": 2.5,
  "tenure": "owned",
  "soilType": "loam",
  "waterSource": "borehole",
  "location": {
    "latitude": -13.9626,
    "longitude": 33.7741,
    "accuracy": 10
  },
  "photo": "base64_encoded_photo_data"
}
```

**Response:**
```json
{
  "success": true,
  "parcelId": "parcel_def456",
  "farmerId": "farmer_abc123",
  "message": "Parcel saved successfully",
  "photoStored": true
}
```

#### POST /api/mobile/crops
Record crop information for a parcel.

**Request Body:**
```json
{
  "farmerPhone": "+265991234567",
  "parcelName": "Main Field",
  "cropType": "maize",
  "variety": "SC627",
  "plantingDate": "2026-12-01",
  "expectedHarvest": "2027-04-15",
  "areaPlanted": 2.0,
  "expectedYield": 4000,
  "irrigation": "drip",
  "notes": "First season with irrigation",
  "photo": "base64_encoded_photo_data"
}
```

**Response:**
```json
{
  "success": true,
  "cropId": "crop_ghi789",
  "farmerId": "farmer_abc123",
  "parcelId": "parcel_def456",
  "season": "2026/2027",
  "message": "Crop data saved successfully",
  "photoStored": true
}
```

#### GET /api/mobile/stats
Get mobile data collection statistics.

**Query Parameters:**
- `district` (optional): Filter by district
- `epa` (optional): Filter by EPA

**Response:**
```json
{
  "farmers_count": 150,
  "parcels_count": 280,
  "crops_count": 450,
  "total_land_hectares": 520.5,
  "total_expected_yield_kg": 1250000,
  "cropBreakdown": [
    {
      "crop": "maize",
      "count": 280,
      "total_yield": 980000
    },
    {
      "crop": "soybeans",
      "count": 120,
      "total_yield": 180000
    }
  ]
}
```

#### GET /api/mobile/submissions
Get recent mobile submissions (requires staff authentication).

**Query Parameters:**
- `limit` (optional): Number of submissions to return (default: 50)

**Response:**
```json
[
  {
    "id": "farmer_abc123",
    "phone": "+265991234567",
    "name": "John Banda",
    "district": "Lilongwe",
    "timestamp": 1726657200000,
    "type": "farmer"
  },
  {
    "id": "parcel_def456",
    "phone": "+265991234567",
    "name": "Main Field",
    "hectares": 2.5,
    "timestamp": 1726657260000,
    "type": "parcel"
  }
]
```

## Deployment Steps

### Option 1: Manual SSH Deployment

1. **SSH into your VPS:**
   ```bash
   ssh peter@37.60.252.211
   ```

2. **Navigate to app directory and pull changes:**
   ```bash
   cd /home/peter/dzalasmart
   git pull origin cursor/comprehensive-improvements-7360
   ```

3. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

4. **Restart the API service:**
   ```bash
   pm2 restart nzeru-api
   # Or if it's not running yet:
   pm2 start src/index.js --name nzeru-api
   ```

5. **Check logs:**
   ```bash
   pm2 logs nzeru-api --lines 30
   ```

### Option 2: Automated Script (if sshpass is available)

If you have `sshpass` installed on your local machine:

```bash
./deploy-mobile-api.sh
```

## Testing the Deployment

### 1. Check API Health
```bash
curl https://api.zammunda.com/health
```

Expected: `{"ok":true,"timestamp":"..."}`

### 2. Test Statistics Endpoint
```bash
curl https://api.zammunda.com/api/mobile/stats
```

Expected: JSON with farmer counts, parcel counts, etc.

### 3. Test Farmer Registration
```bash
curl -X POST https://api.zammunda.com/api/mobile/farmers \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Farmer",
    "phone": "+265999TEST123",
    "district": "Lilongwe",
    "epa": "Lilongwe RDP"
  }'
```

Expected: `{"success":true,"farmerId":"...","message":"..."}`

### 4. Install and Test APK

The Android APK is ready at:
```
/workspace/nzeru-farmer-v1.0.0.apk
```

**To install on device:**
1. Download the APK from the workspace
2. Transfer to Android device via USB or cloud storage
3. Enable "Install from Unknown Sources" in Android settings
4. Install the APK
5. Launch the app and test data collection
6. Use "Sync Data" button to push collected data to the API

## Monitoring

### Check Service Status
```bash
ssh peter@37.60.252.211 'pm2 list'
```

### View Real-time Logs
```bash
ssh peter@37.60.252.211 'pm2 logs nzeru-api'
```

### Monitor Mobile Submissions
```bash
# Get recent submissions (requires staff auth token)
curl -H "Authorization: Bearer YOUR_STAFF_TOKEN" \
  https://api.zammunda.com/api/mobile/submissions?limit=10
```

## Database Schema Used

The mobile API integrates with existing tables:

- **farmers**: Farmer demographic and contact information
- **farm_land_parcels**: Land parcel details with GPS coordinates
- **parcel_crop_history**: Crop planting and yield records

No schema changes required - the mobile API uses the existing database structure.

## Known Limitations & Future Enhancements

### Current Limitations:
1. **Photo Storage**: Photos are received but not yet optimized/stored (marked with `photoStored` flag)
2. **Offline Sync**: Basic implementation - no conflict resolution for concurrent edits
3. **Authentication**: Mobile endpoints are currently open (no farmer auth required)

### Recommended Enhancements:
1. **Photo Optimization**: 
   - Implement image compression
   - Upload to S3/cloud storage
   - Store URLs instead of base64 data

2. **Sync Improvements**:
   - Add timestamp-based conflict resolution
   - Implement incremental sync (only new data)
   - Add sync status tracking per record

3. **Authentication**:
   - Add API key or JWT token for mobile app
   - Rate limiting per device/user
   - Track which extension officer deployed the data

4. **Validation**:
   - GPS coordinate boundary checks (Malawi bounds)
   - Phone number format validation
   - Duplicate detection (same farmer from multiple devices)

## VPN Status

**Status**: Pending PSK from Airtel

The VPN configuration is ready to deploy once Airtel provides the Pre-Shared Key (PSK):
- IPSec configuration: `ipsec.conf.airtel`
- Secrets template: `ipsec.secrets.airtel` (needs PSK)
- Deployment script: `deploy-vpn-to-vps.sh`

The mobile API does NOT depend on the VPN. The VPN is only required for the USSD integration with Airtel.

## Support & Troubleshooting

### API Returns 500 Error
- Check PM2 logs: `pm2 logs nzeru-api`
- Verify database connection
- Check disk space: `df -h`

### Farmer Registration Fails
- Verify phone number is unique
- Check required fields (fullName, phone, district)
- Ensure database schema is up to date

### Parcel/Crop Save Fails
- Verify farmer exists with that phone number
- For crops: verify parcel exists with that name
- Check GPS coordinates are valid numbers

### Mobile App Can't Sync
- Test API endpoint manually with curl
- Check device internet connection
- Verify API URL in app.js matches deployment domain
- Check CORS settings in server/src/app.js

## Success Criteria

✅ **Deployment Successful When:**
1. API health check returns `{"ok":true}`
2. Statistics endpoint returns valid counts
3. Can register a test farmer via API
4. PM2 shows `nzeru-api` running without errors
5. Android app successfully syncs data

## Next Steps After Deployment

1. **Test with Real Data**:
   - Install APK on field devices
   - Collect sample data from 5-10 farmers
   - Verify sync works reliably

2. **Monitor Performance**:
   - Track API response times
   - Monitor database size growth
   - Check for failed sync attempts

3. **Scale Planning**:
   - Estimate storage needs (photos + data)
   - Plan backup strategy
   - Consider database indexing if queries slow down

4. **VPN Completion**:
   - Follow up with Airtel for PSK
   - Deploy VPN configuration
   - Test USSD integration end-to-end

---

**Deployment Date**: September 18, 2026  
**Version**: 1.0.0  
**Status**: Ready for Production Testing
