# Build Nzeru Farmer App APK on Windows

**Machine**: Your local Windows computer (with Android Studio installed)  
**Date**: September 18, 2026

---

## 📋 Prerequisites Check

Before starting, ensure you have:
- ✅ Android Studio installed
- ✅ JDK 17 or higher
- ✅ Node.js v22+ installed
- ✅ Git installed

---

## 🚀 Step-by-Step Build Instructions

### Step 1: Get the Code from Workspace

**Option A: If you have access to the workspace folder**
```cmd
# Copy the entire farmer-app folder from workspace to your local machine
# Workspace location: /workspace/farmer-app/
# Copy to: C:\Users\peter\Projects\farmer-app\
```

**Option B: Clone from GitHub**
```cmd
git clone https://github.com/peterchatuwa/dzalasmart.git
cd dzalasmart
git checkout cursor/comprehensive-improvements-7360
```

### Step 2: Navigate to Farmer App
```cmd
cd farmer-app
```

### Step 3: Install Dependencies
```cmd
npm install
```

### Step 4: Sync Capacitor with Android
```cmd
npx cap sync android
```

### Step 5: Open in Android Studio
```cmd
npx cap open android
```

This will automatically open Android Studio with the Android project.

### Step 6: In Android Studio

1. **Wait for Gradle Sync**
   - Android Studio will automatically start syncing
   - Wait for "Gradle sync finished" message (1-5 minutes)
   - Check bottom status bar for progress

2. **Configure Build Variant**
   - Bottom left: Click "Build Variants"
   - Select "debug" for testing
   - Select "release" for production (needs signing)

3. **Build the APK**
   - Go to: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
   - Or press: `Ctrl + B` (shortcut)
   - Wait for build to complete (2-5 minutes)

4. **Locate the APK**
   - When build completes, you'll see a notification
   - Click "locate" in the notification
   - Or manually find at:
     ```
     farmer-app\android\app\build\outputs\apk\debug\app-debug.apk
     ```

---

## 🎯 Alternative: Command Line Build

If you prefer command line:

### Step 1: Open PowerShell/CMD
```cmd
cd farmer-app\android
```

### Step 2: Build APK
```cmd
gradlew assembleDebug
```

### Step 3: Find APK
```
farmer-app\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 📱 Install on Android Device

### Via USB Cable
1. Enable Developer Options on phone:
   - Settings > About Phone
   - Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings > Developer Options > USB Debugging
3. Connect phone to computer
4. Run in Android Studio:
   - Click green "Run" button
   - Or: `Shift + F10`

### Via APK File
1. Copy `app-debug.apk` to phone (USB or cloud)
2. On phone: Settings > Security > Install Unknown Apps
3. Enable for file manager
4. Tap APK file to install

---

## ⚠️ Troubleshooting

### Issue: "SDK Location Not Found"

**Solution**:
Create `local.properties` in `farmer-app/android/`:
```properties
sdk.dir=C\:\\Users\\peter\\AppData\\Local\\Android\\Sdk
```

### Issue: "Gradle Sync Failed"

**Solution**:
1. File > Invalidate Caches / Restart
2. Try again

### Issue: "Build Failed - Out of Memory"

**Solution**:
Edit `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx2048m
```

### Issue: "Cannot Find Android SDK"

**Solution**:
1. Open Android Studio
2. Tools > SDK Manager
3. Install:
   - Android SDK Platform 33
   - Android SDK Build-Tools 33.0.0
   - Android SDK Platform-Tools

### Issue: "Dependencies Failed to Download"

**Solution**:
```cmd
cd farmer-app
npm cache clean --force
npm install
npx cap sync android
```

---

## 🔧 Build Configuration

### App Details
- **App Name**: Nzeru za Alimi
- **Package**: com.zammunda.nzeru
- **Version**: 2.0.0
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 33 (Android 13)

### Debug vs Release

**Debug Build** (for testing):
- Filename: `app-debug.apk`
- Signed with debug key (automatic)
- Can install directly
- Larger file size (~10MB)

**Release Build** (for Play Store):
- Requires signing keystore
- Smaller file size
- Optimized and obfuscated
- See section below

---

## 📦 Release Build (Production)

### Step 1: Generate Signing Key
```cmd
cd farmer-app\android\app

keytool -genkey -v -keystore nzeru-release.keystore -alias nzeru-key -keyalg RSA -keysize 2048 -validity 10000
```

### Step 2: Configure Signing

Edit `android/app/build.gradle`:

Add before `android {`:
```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `android {` add:
```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
        storePassword keystoreProperties['storePassword']
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

### Step 3: Create key.properties

Create `android/key.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=nzeru-key
storeFile=app/nzeru-release.keystore
```

### Step 4: Build Release APK
```cmd
cd android
gradlew assembleRelease
```

APK location: `app/build/outputs/apk/release/app-release.apk`

---

## ✅ Success Checklist

After building, verify:

- [ ] APK file created in outputs folder
- [ ] File size: ~8-10 MB
- [ ] Can install on test device
- [ ] App launches successfully
- [ ] Login screen appears
- [ ] Can login with test credentials
- [ ] All 5 tabs work
- [ ] Can view profile
- [ ] Market prices load
- [ ] Advisor chat works

---

## 🧪 Test Credentials

After installing APK, test with:

```
Phone: +265888000101
PIN: 0000
```

Or any existing farmer's phone and PIN.

---

## 📊 Expected Build Output

```
BUILD SUCCESSFUL in 2m 15s
142 actionable tasks: 142 executed

Generated APK:
Location: app\build\outputs\apk\debug\app-debug.apk
Size: 8,847 KB (8.6 MB)
```

---

## 🎯 Quick Reference Commands

```cmd
# Full build process
cd farmer-app
npm install
npx cap sync android
npx cap open android

# Command-line build
cd farmer-app\android
gradlew assembleDebug

# Clean build (if issues)
gradlew clean assembleDebug

# Install on connected device
gradlew installDebug

# View connected devices
adb devices
```

---

## 📞 Need Help?

### Check Build Logs
- Android Studio: View > Tool Windows > Build
- Command line: Look for error messages in red

### Common Error Patterns
- "SDK not found" → Install Android SDK
- "Gradle failed" → Clean and rebuild
- "Dependencies failed" → Check internet, clear npm cache
- "Out of memory" → Increase heap size in gradle.properties

---

## 🎉 Next Steps After Building

1. **Install on test device**
2. **Test all features**
3. **Get user feedback**
4. **Fix any issues**
5. **Build release version**
6. **Distribute to farmers**

---

**Status**: Ready to build  
**App Version**: 2.0.0  
**Location**: `/workspace/farmer-app/`  
**Build Time**: ~2-5 minutes  
**Output**: APK file ready for installation
