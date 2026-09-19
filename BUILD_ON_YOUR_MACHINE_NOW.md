# Build APK on Your Windows Machine - Step by Step

**For**: Peter Chatuwa  
**Machine**: Your local Windows computer with Android Studio  
**Date**: September 18, 2026  
**App**: Nzeru za Alimi (Complete Farmer App v2.0)

---

## 🎯 What You're Building

A complete Android app for farmers that includes:
- ✅ Phone + PIN login
- ✅ Profile viewing and editing
- ✅ Warehouse receipts and loans
- ✅ District-specific market prices
- ✅ AI agricultural advisor chat
- ✅ Offline-first architecture

---

## 📁 Step 1: Copy the App to Your Computer

### Option A: Using Cursor (Recommended)

1. In Cursor, right-click the `farmer-app` folder in the file explorer
2. Click "Download"
3. Save to: `C:\Users\peter\Projects\`
4. You should now have: `C:\Users\peter\Projects\farmer-app\`

### Option B: Using Git

Open PowerShell and run:
```powershell
cd C:\Users\peter\Projects
git clone https://github.com/peterchatuwa/dzalasmart.git
cd dzalasmart
git checkout cursor/comprehensive-improvements-7360
cd ..
mv dzalasmart\farmer-app farmer-app
```

---

## ⚙️ Step 2: Install Dependencies

Open PowerShell or CMD:

```powershell
cd C:\Users\peter\Projects\farmer-app
npm install
```

**What happens**: Downloads ~150MB of Node.js packages  
**Time**: 2-3 minutes  
**Expected output**: 
```
added 234 packages in 2m 15s
```

---

## 🔧 Step 3: Sync with Android

Still in the same PowerShell/CMD:

```powershell
npx cap sync android
```

**What happens**: 
- Creates Android project structure
- Copies your web files (HTML/CSS/JS) to Android assets
- Configures Capacitor plugins

**Time**: 30 seconds  
**Expected output**:
```
✔ Copying web assets from www to android/app/src/main/assets/public in 234ms
✔ Creating capacitor.config.json in android/app/src/main/assets in 2ms
✔ Copying native bridge in 3ms
✔ Copying Capacitor plugins in 45ms
✔ Updating Android plugins in 12ms
```

---

## 🚀 Step 4: Open in Android Studio

Still in the same PowerShell/CMD:

```powershell
npx cap open android
```

**What happens**: Android Studio launches automatically with your project  
**Time**: 10-20 seconds for Android Studio to start

---

## 🏗️ Step 5: Wait for Gradle Sync (IMPORTANT!)

Once Android Studio opens:

1. **Look at the bottom of the window** for sync status
2. You'll see: "Gradle sync in progress..."
3. **DO NOT do anything yet!** Wait for it to finish
4. When done, you'll see: "Gradle sync finished in X min X sec"

**Time**: 3-5 minutes (first time only)  
**What it's doing**: Downloading Android build tools and dependencies

### If you see errors during Gradle sync:

**Error: "SDK location not found"**

Fix:
1. In Android Studio: File > Project Structure
2. Set Android SDK Location to your SDK path (usually `C:\Users\peter\AppData\Local\Android\Sdk`)
3. Click OK
4. Gradle will sync again

---

## 📦 Step 6: Build the APK

Once Gradle sync is complete:

### Method A: Using Menu (Easiest)

1. Click menu: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete (2-4 minutes)
3. You'll see a notification: "APK(s) generated successfully"
4. Click "locate" in the notification

### Method B: Using Keyboard Shortcut

1. Press `Ctrl + B`
2. Wait for build
3. Click "locate" when done

### Method C: Using Toolbar

1. Find the green hammer icon 🔨 in the toolbar
2. Click it
3. Wait for build

---

## 📍 Step 7: Find Your APK

The APK will be at:

```
C:\Users\peter\Projects\farmer-app\android\app\build\outputs\apk\debug\app-debug.apk
```

**File details**:
- Name: `app-debug.apk`
- Size: ~8-9 MB
- This is a debug build (for testing)

---

## 🎉 Alternative: Command Line Build

If you prefer command line (no Android Studio UI):

```powershell
cd C:\Users\peter\Projects\farmer-app\android
.\gradlew assembleDebug
```

**Time**: 2-4 minutes  
**Output**: Same location as above

---

## 📱 Step 8: Install on Your Phone

### Method 1: Direct Install from Android Studio

1. Connect your phone via USB
2. Enable USB Debugging on phone:
   - Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings → Developer Options
   - Enable "USB Debugging"
3. In Android Studio, click green "Run" button ▶️
4. Select your device
5. App installs and launches automatically

### Method 2: Copy APK File

1. Copy `app-debug.apk` from your computer to your phone
2. On phone: Open the APK file
3. Allow installation from unknown sources if prompted
4. Tap "Install"

---

## 🧪 Step 9: Test the App

After installing, test with these credentials:

```
Phone: +265888000101
PIN: 0000
```

### What to test:

- [ ] App opens without crashing
- [ ] Login screen appears
- [ ] Can login with test credentials
- [ ] Home tab shows dashboard
- [ ] Profile tab shows farmer details
- [ ] Can edit profile
- [ ] Receipts tab shows warehouse receipts
- [ ] Markets tab shows prices
- [ ] Advisor tab has chat interface

---

## ⚠️ Troubleshooting

### Problem: "npm: command not found"

**Solution**: Install Node.js from https://nodejs.org/ (v22+)

### Problem: "Android Studio not found"

**Solution**: Install from https://developer.android.com/studio

### Problem: "Gradle sync failed"

**Solution**:
1. In Android Studio: File → Invalidate Caches / Restart
2. Click "Invalidate and Restart"
3. Wait for reopen and sync

### Problem: "Build failed - dependencies not found"

**Solution**:
```powershell
cd C:\Users\peter\Projects\farmer-app
npm cache clean --force
npm install
npx cap sync android
```

### Problem: "App crashes on phone after install"

**Solution**: Check the API URL in `www/app.js`:
- Should be: `https://api.zammunda.com`
- If server is down, app won't work (needs API connection)

---

## 📊 Build Output Details

### What gets created:

```
farmer-app/
├── node_modules/          (~150 MB - dependencies)
├── android/
│   ├── app/
│   │   ├── build/
│   │   │   └── outputs/
│   │   │       └── apk/
│   │   │           └── debug/
│   │   │               └── app-debug.apk  ← YOUR APK
│   └── build/             (~200 MB - build cache)
└── www/                   (your source code)
```

### Total disk space used: ~500 MB

---

## 🔄 Rebuilding After Changes

If you modify the app code:

```powershell
cd C:\Users\peter\Projects\farmer-app

# Sync changes
npx cap sync android

# Rebuild
cd android
.\gradlew assembleDebug
```

New APK will be in the same location.

---

## 🏭 Production Build (For Distribution)

When ready to deploy to farmers:

### Step 1: Generate Signing Key

```powershell
cd C:\Users\peter\Projects\farmer-app\android\app

keytool -genkey -v -keystore nzeru-release.keystore -alias nzeru-key -keyalg RSA -keysize 2048 -validity 10000
```

Follow prompts to set passwords (remember them!)

### Step 2: Configure Signing

See full instructions in: `BUILD_APK_ON_WINDOWS.md` (release build section)

### Step 3: Build Release

```powershell
cd C:\Users\peter\Projects\farmer-app\android
.\gradlew assembleRelease
```

**Output**: `app-release.apk` (smaller, optimized, signed)

---

## ✅ Success Checklist

- [ ] Node.js installed and working (`node --version`)
- [ ] Android Studio installed
- [ ] farmer-app folder copied to local machine
- [ ] `npm install` completed successfully
- [ ] `npx cap sync android` completed
- [ ] Android Studio opened project
- [ ] Gradle sync finished without errors
- [ ] Build APK completed successfully
- [ ] APK file found at expected location
- [ ] APK installed on phone
- [ ] App launches and login works

---

## 📞 Quick Command Reference

```powershell
# Navigate to project
cd C:\Users\peter\Projects\farmer-app

# Install dependencies
npm install

# Sync with Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Build from command line
cd android
.\gradlew assembleDebug

# Clean build (if issues)
.\gradlew clean assembleDebug

# Install on connected device
.\gradlew installDebug

# Check connected devices
adb devices
```

---

## 🎯 Expected Timeline

### First build:
- Copy files: 1 min
- npm install: 2-3 min
- cap sync: 30 sec
- Open Android Studio: 30 sec
- Gradle sync: 3-5 min
- Build APK: 2-4 min
- **Total: ~10-15 minutes**

### Subsequent builds:
- Sync: 10 sec
- Build: 1-2 min
- **Total: ~2-3 minutes**

---

## 🎊 You're Done!

Once you have `app-debug.apk`, you can:

1. ✅ Install on test phones
2. ✅ Share with team for testing
3. ✅ Collect feedback
4. ✅ Make improvements
5. ✅ Build release version for production

---

**App Name**: Nzeru za Alimi  
**Version**: 2.0.0  
**Package**: com.zammunda.nzeru  
**API Endpoint**: https://api.zammunda.com  
**Status**: ✅ Ready to build on your machine

---

**Need help?** Check the full guide: `BUILD_APK_ON_WINDOWS.md`
