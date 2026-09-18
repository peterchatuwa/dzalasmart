# 🌾 Nzeru Farmer - Mobile Data Collection App

**Version:** 1.0.0  
**Platform:** Android  
**Purpose:** Offline-first agricultural data collection for farmers in Malawi

---

## 📱 Overview

Nzeru Farmer is a mobile Android application designed for field officers and extension workers to collect agricultural data from farmers. The app works **offline-first**, storing all data locally and syncing to the server when internet connectivity is available.

### **Key Features:**

✅ **Farmer Registration** - Capture demographic and household information  
✅ **Land Parcel Recording** - GPS coordinates, size, soil type, water source  
✅ **Crop Data Collection** - Planting dates, varieties, expected yields  
✅ **Photo Capture** - Document farmers, land, and crops  
✅ **GPS Location** - Precise geolocation for parcels  
✅ **Offline Storage** - All data saved locally first  
✅ **Auto-Sync** - Upload to server when online  
✅ **Beautiful UI** - Clean, modern, farmer-friendly interface

---

## 🎯 Use Cases

1. **Extension Officers** - Register farmers and parcels during field visits
2. **Agricultural Surveyors** - Collect crop data across multiple districts
3. **Cooperatives** - Document member farms and production
4. **NGOs** - Monitor project beneficiaries and impact
5. **Ministry Staff** - Census and agricultural statistics

---

## 📊 Data Collected

### **Farmer Information:**
- Full name and phone number
- District, EPA (Extension Planning Area), Village
- Gender, date of birth
- Household size and type
- Livestock ownership
- Photo

### **Parcel Information:**
- Farmer phone (linkage)
- Parcel name and size (hectares)
- Land tenure status
- Soil type
- Water source
- GPS coordinates
- Photo

### **Crop Data:**
- Farmer phone and parcel name
- Crop type and variety
- Planting and harvest dates
- Area planted
- Expected yield
- Irrigation status
- Photo and notes

---

## 🔧 Technical Stack

**Frontend:**
- HTML5 / CSS3 / JavaScript (ES6+)
- Responsive mobile-first design

**Framework:**
- Capacitor (Ionic team) - Native bridge

**Plugins:**
- `@capacitor/camera` - Photo capture
- `@capacitor/geolocation` - GPS location
- `@capacitor/preferences` - Local storage

**Storage:**
- LocalStorage / Preferences API
- JSON-based data structure

**Server API:**
- REST API endpoint: `https://api.zammunda.com`
- JSON payload sync

---

## 🚀 Quick Start

### **For Users (Installing APK):**

1. Download `nzeru-farmer.apk` to your Android phone
2. Open the APK file
3. Allow "Install from Unknown Sources" if prompted
4. Install the app
5. Open **Nzeru Farmer**
6. Start collecting data!

### **For Developers (Building from Source):**

See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) for detailed build guide.

**Quick build:**
```bash
npm install
npx cap sync android
npx cap open android
# Build APK in Android Studio
```

---

## 📖 User Guide

### **1. Register a Farmer**

1. Open app → **Register Farmer** tab
2. Fill in required fields (marked with *)
3. Optional: Take farmer photo
4. Click **Save Farmer**
5. Success! Farmer saved locally

### **2. Add a Parcel**

1. Go to **Add Parcel** tab
2. Enter farmer's phone number
3. Fill parcel details
4. Capture GPS location
5. Optional: Take parcel photo
6. Click **Save Parcel**

### **3. Record Crop Data**

1. Go to **Record Crop** tab
2. Enter farmer phone and parcel name
3. Select crop type and fill details
4. Optional: Take crop photo
5. Click **Save Crop Data**

### **4. Sync Data to Server**

1. Connect to internet/WiFi
2. Go to **Sync Data** tab
3. Click **🔄 Sync All Data**
4. Wait for sync to complete
5. All data uploaded to server!

---

## 🔄 Offline Functionality

### **How it Works:**

1. **Data Collection** - All forms save data to local storage immediately
2. **Offline Queue** - Data tagged as "unsynced"
3. **Sync Detection** - App checks server connectivity
4. **Batch Upload** - When online, all unsynced data uploads automatically
5. **Confirmation** - Synced data marked as complete

### **Sync Indicators:**

- 🟢 Green dot = Online, connected to server
- 🟠 Orange dot = Offline mode, data saved locally
- Pending count = Number of records waiting to sync

---

## 📸 Screenshots

*(Screenshots would go here once app is built)*

- Registration form
- Parcel capture with GPS
- Crop data entry
- Sync dashboard

---

## 🔒 Permissions

The app requires these Android permissions:

- **Camera** - To take photos of farmers, parcels, and crops
- **Location** - To capture GPS coordinates for parcels
- **Internet** - To sync data to server
- **Storage** - To save photos and data locally

All permissions are requested when needed (not on install).

---

## 🌐 Server Integration

### **API Endpoints:**

```
POST /api/mobile/farmers   - Upload farmer data
POST /api/mobile/parcels   - Upload parcel data
POST /api/mobile/crops     - Upload crop data
GET  /health               - Check server status
```

### **Data Format:**

```json
{
  "id": "nzeru_1234567890_abc123",
  "type": "farmer",
  "timestamp": "2026-09-18T10:00:00.000Z",
  "synced": false,
  "data": {
    "fullName": "John Phiri",
    "phone": "+265888000001",
    "district": "Lilongwe",
    ...
  }
}
```

---

## 📦 App Details

**Package Name:** `com.zammunda.nzeru.farmer`  
**App ID:** Nzeru Farmer  
**Min Android Version:** 5.0 (API Level 21)  
**Target Android Version:** 13 (API Level 33)  
**App Size:** ~10 MB  
**Supported Languages:** English (Chichewa coming soon)

---

## 🛠️ Development

### **Project Structure:**

```
android-app/
├── www/                     # Web app files
│   ├── index.html          # Main UI
│   ├── style.css           # Styling
│   └── app.js              # App logic
├── android/                 # Android native project
├── capacitor.config.json   # Capacitor config
└── package.json            # Dependencies
```

### **Local Development:**

```bash
# Install dependencies
npm install

# Run in browser (for UI testing)
cd www && python3 -m http.server 8080

# Sync with Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

---

## 🐛 Known Issues

- GPS accuracy depends on device hardware
- Photos stored as base64 (larger storage)
- Sync requires stable internet connection
- Camera permission must be granted manually

---

## 🔮 Future Enhancements

### **Planned Features:**

- [ ] Bulk import farmers from CSV
- [ ] Export local data to Excel
- [ ] Multi-language support (Chichewa)
- [ ] Crop health assessment
- [ ] Weather integration
- [ ] Offline maps
- [ ] Voice notes
- [ ] Barcode scanning for input vouchers
- [ ] Push notifications
- [ ] User authentication

---

## 📝 License

**Proprietary** - Zammunda / Nzeru za Alimi  
© 2026 All Rights Reserved

---

## 📞 Support

**Technical Issues:**  
Email: peter.chatuwa@zammunda.com  
Phone: [Your Support Number]

**Server Status:**  
https://api.zammunda.com/health

**Documentation:**  
See BUILD_INSTRUCTIONS.md for detailed build guide

---

## 🙏 Credits

**Developed by:** Zammunda Team  
**Platform:** Nzeru za Alimi (Smart Farming Platform)  
**Country:** Malawi  
**Year:** 2026

**Technologies:**
- Capacitor (Ionic)
- Android SDK
- JavaScript/HTML/CSS

---

**Version:** 1.0.0  
**Last Updated:** September 18, 2026  
**Status:** Production Ready 🚀
