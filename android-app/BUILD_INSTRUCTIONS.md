# Nzeru Farmer App - Build Instructions

**App Name:** Nzeru Farmer  
**Package:** com.zammunda.nzeru.farmer  
**Version:** 1.0.0  
**Target:** Android Data Collection for Farmers

---

## 🎯 App Features

### **Offline-First Data Collection:**
- ✅ Farmer Registration (demographics, household data)
- ✅ Land Parcel Recording (size, GPS, soil type, water source)
- ✅ Crop Data Collection (type, variety, planting dates, yield)
- ✅ Photo Capture (farmers, parcels, crops)
- ✅ GPS Location Tracking
- ✅ Offline Storage (data saved locally)
- ✅ Data Sync (upload to server when online)

---

## 📋 Prerequisites

### **Required Software:**

1. **Node.js** (v18 or higher)
   ```bash
   node --version
   ```

2. **Java Development Kit (JDK 17)**
   ```bash
   java -version
   ```

3. **Android Studio**
   - Download: https://developer.android.com/studio
   - Install Android SDK
   - Install Android Build Tools

4. **Gradle** (Usually comes with Android Studio)
   ```bash
   gradle --version
   ```

### **Environment Variables:**

```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

---

## 🚀 Quick Build (If Environment is Ready)

If you have Android Studio and all dependencies installed:

### **Option 1: Build APK via Android Studio**

```bash
cd /workspace/android-app

# Sync Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

**In Android Studio:**
1. Wait for Gradle sync to complete
2. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### **Option 2: Build via Command Line**

```bash
cd /workspace/android-app/android

# Build debug APK
./gradlew assembleDebug

# Build release APK (signed)
./gradlew assembleRelease

# APK location:
# Debug: app/build/outputs/apk/debug/app-debug.apk
# Release: app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## 📦 Build on Your Local Machine

Since this is a Cloud Agent environment without Android SDK, you need to:

### **Step 1: Download the Project**

```bash
# From your local machine
git clone <your-repo>
cd android-app
```

Or download the entire `/workspace/android-app` folder.

### **Step 2: Install Dependencies**

```bash
npm install
```

### **Step 3: Install Android Studio**

1. Download Android Studio: https://developer.android.com/studio
2. Install Android SDK (API Level 33 or higher)
3. Install Android Build Tools
4. Accept Android SDK licenses:
   ```bash
   sdkmanager --licenses
   ```

### **Step 4: Build the APK**

**Method A - Android Studio GUI:**
```bash
npx cap sync android
npx cap open android

# In Android Studio:
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

**Method B - Command Line:**
```bash
cd android
./gradlew assembleDebug
```

### **Step 5: Find Your APK**

```bash
# Debug APK
android/app/build/outputs/apk/debug/app-debug.apk

# Release APK
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📱 Install APK on Device

### **Via USB (ADB):**

```bash
# Enable USB debugging on device first
adb devices
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### **Via File Transfer:**

1. Copy APK to phone storage
2. Open file manager on phone
3. Tap APK file
4. Allow "Install from Unknown Sources"
5. Install

---

## 🔧 App Configuration

### **Update API Endpoint:**

Edit `www/app.js` if you need to change the server:

```javascript
// Current: https://api.zammunda.com
const API_URL = 'https://your-server.com';
```

### **Update App Details:**

Edit `capacitor.config.json`:

```json
{
  "appId": "com.zammunda.nzeru.farmer",
  "appName": "Nzeru Farmer",
  "webDir": "www"
}
```

### **Update Android Manifest:**

Edit `android/app/src/main/AndroidManifest.xml` for permissions:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 🎨 Customization

### **Change App Icon:**

Replace files in:
```
android/app/src/main/res/mipmap-*/
```

With your custom icons (48x48, 72x72, 96x96, 144x144, 192x192 px)

### **Change App Colors:**

Edit `android/app/src/main/res/values/styles.xml`:

```xml
<item name="colorPrimary">#2E7D32</item>
<item name="colorPrimaryDark">#1B5E20</item>
<item name="colorAccent">#FF6F00</item>
```

### **Update Splash Screen:**

Replace `android/app/src/main/res/drawable/splash.png`

---

## 🔒 Signing the Release APK

### **Generate Keystore:**

```bash
keytool -genkey -v -keystore nzeru-farmer.keystore -alias nzeru -keyalg RSA -keysize 2048 -validity 10000
```

### **Configure Signing:**

Edit `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file("path/to/nzeru-farmer.keystore")
            storePassword "your-password"
            keyAlias "nzeru"
            keyPassword "your-password"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### **Build Signed APK:**

```bash
cd android
./gradlew assembleRelease
```

**Signed APK:** `app/build/outputs/apk/release/app-release.apk`

---

## 📊 App Structure

```
android-app/
├── www/                     # Web app (HTML/CSS/JS)
│   ├── index.html          # Main UI
│   ├── style.css           # Styling
│   └── app.js              # JavaScript logic
├── android/                 # Android native project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── res/        # Resources (icons, etc.)
│   │   └── build.gradle    # App build config
│   └── build.gradle        # Project build config
├── capacitor.config.json   # Capacitor configuration
└── package.json            # Dependencies
```

---

## 🧪 Testing

### **In Browser (Development):**

```bash
cd /workspace/android-app
python3 -m http.server 8080 --directory www

# Open: http://localhost:8080
```

**Note:** Camera and GPS won't work in browser, but UI can be tested.

### **On Android Emulator:**

1. Open Android Studio
2. Tools → AVD Manager
3. Create Virtual Device
4. Run app: `npx cap run android`

### **On Physical Device:**

1. Enable USB debugging
2. Connect device
3. Run: `npx cap run android`

---

## 🚨 Troubleshooting

### **Gradle Build Failed:**

```bash
cd android
./gradlew clean
./gradlew assembleDebug --stacktrace
```

### **Capacitor Sync Issues:**

```bash
npx cap sync android --force
```

### **Permission Denied (gradlew):**

```bash
chmod +x android/gradlew
```

### **SDK Not Found:**

Check `ANDROID_HOME` environment variable:
```bash
echo $ANDROID_HOME
# Should point to: /Users/you/Library/Android/sdk (Mac)
# Or: /home/you/Android/Sdk (Linux)
```

---

## 📦 Alternative: Build APK Online

If you can't install Android Studio locally, use online build services:

### **Capacitor Cloud:**
- https://capacitorjs.com/cloud

### **App Center:**
- https://appcenter.ms/

### **Codemagic:**
- https://codemagic.io/

---

## 📱 Minimum Requirements

**Android Version:** 5.0 (API Level 21) or higher  
**App Size:** ~10 MB  
**Permissions Required:**
- Camera (for photos)
- Location (for GPS)
- Internet (for sync)
- Storage (for offline data)

---

## 🎯 Next Steps After Build

1. **Install APK on test device**
2. **Test all features:**
   - Register farmer
   - Add parcel with GPS
   - Take photos
   - Record crop data
   - Test offline mode
   - Test sync to server

3. **Distribute to farmers:**
   - Share APK via WhatsApp
   - Upload to Google Drive
   - Use USB transfer
   - (Optional) Publish to Play Store

---

## 📄 Publishing to Google Play Store

### **Requirements:**

1. Google Play Console account ($25 one-time fee)
2. Signed release APK
3. App screenshots
4. Privacy policy
5. App description

### **Steps:**

1. Create app in Play Console
2. Upload signed APK
3. Fill in store listing
4. Submit for review
5. Wait for approval (~2-3 days)

---

## 🔗 Useful Links

- **Capacitor Docs:** https://capacitorjs.com/docs
- **Android Developers:** https://developer.android.com/
- **Gradle Docs:** https://gradle.org/
- **Camera Plugin:** https://capacitorjs.com/docs/apis/camera
- **Geolocation Plugin:** https://capacitorjs.com/docs/apis/geolocation

---

## 📞 Support

**Issues with building?**
- Check Android Studio version (latest recommended)
- Verify Java version (JDK 17)
- Clear Gradle cache: `./gradlew clean`
- Rebuild: `./gradlew assembleDebug`

---

**Build Status:** Ready to build on local machine with Android Studio  
**Current Version:** 1.0.0  
**Last Updated:** September 18, 2026
