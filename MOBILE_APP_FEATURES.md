# Nzeru za Alimi - Mobile App Features

## Overview
The Nzeru za Alimi mobile app is a comprehensive farm management tool for farmers to track their entire agricultural production cycle from land registration to harvest.

## Key Features Implemented

### 1. Farm Management Tab 🏡

#### Land Parcels
- **Register multiple parcels** with detailed information
- **GPS location capture** for each parcel
- **Track ownership type** (owned, leased, borrowed, communal)
- **Record soil type and water sources**
- **View all parcels** at a glance

#### Household Members
- **Add household members** with relationship details
- **Track ages and gender** for demographic data
- **Mark farming involvement** for labor tracking
- **View all household members** in one place

#### Production Seasons
- **Start new production seasons** linked to parcels
- **Select crop and variety**
- **Define area under cultivation**
- **Track season status** (active/completed/failed)
- **Multiple concurrent seasons** per farmer

### 2. Production Tracking Tab 📊

#### Activities Timeline
- **Log daily farm activities**:
  - Land Preparation
  - Planting
  - Weeding
  - Fertilizing
  - Spraying
  - Irrigation
  - Harvesting
- **Record labor hours** for each activity
- **Track activity costs**
- **View chronological timeline** of all activities

#### Crop Monitoring
- **Daily/weekly monitoring logs**
- **Track crop growth stages**:
  - Germination
  - Vegetative
  - Flowering
  - Grain Filling
  - Maturity
- **Record crop health** (5-star rating)
- **Document pests and diseases** observed
- **Log actions taken** for issues
- **Add photos** (Capacitor camera integration)

#### Cost Tracking
- **Comprehensive cost recording** by category:
  - Land Preparation
  - Seeds & Planting Materials
  - Fertilizers
  - Pesticides & Herbicides
  - Labor
  - Equipment & Tools
  - Irrigation
  - Transportation
  - Storage
  - Other
- **Production stage classification**
- **Payment method tracking** (cash, mobile money, credit, voucher)
- **Real-time cost summaries** by category
- **Total season costs** displayed prominently

### 3. Market Intelligence Tab 💰

#### Price Information
- **Government floor prices** by crop
- **Last updated timestamps**
- **District-specific pricing**

#### Advisor Chat (AI-powered)
- **Ask farming questions** in natural language
- **Get expert advice** on:
  - Pest control
  - Disease management
  - Best practices
  - Market conditions
  - Input recommendations

### 4. Profile Tab 👤

#### Farmer Information
- **View personal details**
- **District and village** information
- **Household details**
- **Edit profile** functionality
- **Total land holdings** summary
- **Total receipts and loans**

### 5. Home Dashboard 🏠

#### Quick Stats
- **Total hectares** under cultivation
- **Number of receipts** (input vouchers)
- **Active loans** summary

#### Recent Activity Feed
- Latest farm activities
- Recent monitoring records
- New market updates

#### Quick Actions
- Start new season
- Log activity
- Record monitoring
- Add cost
- View market prices

## Technical Features

### Offline Support
- **Local data caching** with Capacitor Preferences
- **Queue sync** when connection restored
- **Offline-first architecture**

### GPS Integration
- **Capture parcel coordinates** automatically
- **View on map** (future enhancement)
- **Boundary mapping** (future enhancement)

### Photo Capture
- **Take photos** of crops, pests, diseases
- **Attach to monitoring records**
- **Document evidence** for insurance/credit

### Authentication
- **Secure PIN login** (4-6 digits)
- **JWT token authentication**
- **Auto-logout on inactivity**

## Data Flow

```
Farmer App → API Server → PostgreSQL Database
     ↓
  Preferences (Local Cache)
```

## API Endpoints Used

### Farm Management
- `POST /api/farmers/me/parcels` - Add land parcel
- `GET /api/farmers/me/parcels` - List parcels
- `POST /api/farmers/me/household` - Add household member
- `GET /api/farmers/me/household` - List household members
- `POST /api/farmers/me/seasons` - Start production season
- `GET /api/farmers/me/seasons` - List seasons

### Production Tracking
- `POST /api/farmers/me/seasons/:id/activities` - Log activity
- `GET /api/farmers/me/seasons/:id/activities` - List activities
- `POST /api/farmers/me/seasons/:id/monitoring` - Record monitoring
- `GET /api/farmers/me/seasons/:id/monitoring` - List monitoring records
- `POST /api/farmers/me/seasons/:id/costs` - Add cost
- `GET /api/farmers/me/seasons/:id/costs` - Get costs and summary

### Market & Profile
- `GET /api/farmers/market` - Get market prices
- `POST /api/farmers/advisor` - Ask advisor question
- `GET /api/farmers/me` - Get farmer profile
- `PUT /api/farmers/me` - Update profile

## Build & Deploy

### Prerequisites
- Android Studio with JDK 17
- Node.js 18+
- ADB (Android Debug Bridge)
- Connected Android device or emulator

### Build Instructions

#### Option 1: PowerShell Script (Recommended)
```powershell
.\REBUILD_FARMER_APP.ps1
```

#### Option 2: Manual Build
```powershell
# 1. Sync web assets
cd farmer-app
npx cap sync android

# 2. Build APK
cd android
.\gradlew assembleDebug

# 3. Install
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

### Test Credentials
- **PIN**: Any registered farmer's 4-6 digit PIN
- **API Base URL**: `https://api.zammunda.com`

## Future Enhancements (Not Yet Implemented)

1. **Offtake Agreements Tab**
   - View buyer contracts
   - Track delivery schedules
   - Record deliveries

2. **Weather Integration**
   - Local weather forecasts
   - Rainfall data
   - Planting advisories

3. **Offline Maps**
   - Download district maps
   - GPS navigation to parcels
   - Boundary drawing

4. **Push Notifications**
   - Activity reminders
   - Market price alerts
   - Weather warnings
   - Extension officer messages

5. **Report Generation**
   - Season summary PDFs
   - Cost analysis charts
   - Yield projections

6. **Barcode Scanning**
   - Scan input vouchers
   - Product identification
   - Quick data entry

## Testing Checklist

### Farm Tab
- [ ] Add new land parcel with GPS
- [ ] View list of parcels
- [ ] Add household member
- [ ] View household list
- [ ] Start new production season
- [ ] View season list

### Production Tab
- [ ] Select active season
- [ ] Log multiple activity types
- [ ] Record monitoring with health rating
- [ ] Add costs in different categories
- [ ] View cost summary
- [ ] View timeline of all records

### Market Tab
- [ ] View government floor prices
- [ ] Ask advisor question
- [ ] Receive AI-generated advice

### Profile Tab
- [ ] View farmer details
- [ ] Edit profile information
- [ ] Save changes successfully

### Authentication
- [ ] Login with PIN
- [ ] Logout functionality
- [ ] Token refresh on app resume

## Known Issues & Fixes

### Module Resolution Error
**Error**: `Failed to resolve module specifier "@capacitor/preferences"`
**Fix**: Use `window.Capacitor?.Plugins` instead of ES6 imports

### Java Version Mismatch
**Error**: `invalid source release: 21`
**Fix**: Set Gradle JDK to JDK 17 in Android Studio settings

### APK Crashes on Startup
**Fix**: Ensure `MainActivity.java` package matches `capacitor.config.json` appId

### GPS Not Working
**Fix**: Grant location permissions in Android settings

## Support & Documentation

- **Backend API**: Located in `/workspace/server/`
- **Frontend Code**: Located in `/workspace/farmer-app/www/`
- **Database Schema**: `/workspace/comprehensive-farm-management-schema.sql`
- **Backend Logic**: `/workspace/server/src/production-management.js`

## Version History

### v2.0.0 (Current) - Comprehensive Farm Management
- ✅ Farm management tab with parcels, household, seasons
- ✅ Production tracking with activities, monitoring, costs
- ✅ Cost tracking and summaries
- ✅ Market intelligence integration
- ✅ GPS location capture
- ✅ Timeline-based activity view

### v1.0.0 - Basic Data Collection
- Basic farmer profile
- Simple crop recording
- Market prices viewing

---

**Built with**: Capacitor 7, Vanilla JavaScript, CSS3, Node.js, PostgreSQL
**Target Platform**: Android 7.0+ (API Level 24+)
**License**: Proprietary
