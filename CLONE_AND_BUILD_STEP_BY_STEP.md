# 📥 Clone from Git and Build APK - Step by Step

**Date**: September 18, 2026  
**Repository**: https://github.com/peterchatuwa/dzalasmart  
**Branch**: cursor/comprehensive-improvements-7360

---

## 🎯 What You'll Do

1. Clone the repository from GitHub
2. Navigate to the farmer app
3. Install dependencies
4. Build the Android APK

**Time Required**: 15-20 minutes

---

## 📋 Prerequisites

Before starting, make sure you have:

- ✅ Git installed
- ✅ Node.js v22+ installed
- ✅ Android Studio installed
- ✅ Internet connection

### Check if Git is Installed

Open PowerShell or CMD and run:

```powershell
git --version
```

**Expected output:**
```
git version 2.x.x
```

**If not installed:**
- Download from: https://git-scm.com/download/win
- Install with default settings
- Restart PowerShell/CMD

### Check if Node.js is Installed

```powershell
node --version
```

**Expected output:**
```
v22.x.x
```

**If not installed:**
- Download from: https://nodejs.org/
- Install LTS version (v22+)
- Restart PowerShell/CMD

---

## 🚀 Step-by-Step Instructions

### Step 1: Open PowerShell or CMD

**Method 1: PowerShell**
- Press `Windows Key + X`
- Click "Windows PowerShell" or "Terminal"

**Method 2: CMD**
- Press `Windows Key + R`
- Type `cmd`
- Press Enter

---

### Step 2: Navigate to Your Projects Folder

Create a folder for your projects if it doesn't exist:

```powershell
# Create Projects folder
mkdir C:\Users\peter\Projects

# Navigate to it
cd C:\Users\peter\Projects
```

**Expected output:**
```
C:\Users\peter\Projects>
```

---

### Step 3: Clone the Repository

Run this command:

```powershell
git clone https://github.com/peterchatuwa/dzalasmart.git
```

**What happens:**
- Git downloads all the code from GitHub
- Creates a folder called `dzalasmart`
- Takes 10-30 seconds depending on internet speed

**Expected output:**
```
Cloning into 'dzalasmart'...
remote: Enumerating objects: 1234, done.
remote: Counting objects: 100% (1234/1234), done.
remote: Compressing objects: 100% (567/567), done.
remote: Total 1234 (delta 890), reused 1123 (delta 789)
Receiving objects: 100% (1234/1234), 2.34 MiB | 1.23 MiB/s, done.
Resolving deltas: 100% (890/890), done.
```

---

### Step 4: Navigate to the Repository

```powershell
cd dzalasmart
```

**Now you're in:** `C:\Users\peter\Projects\dzalasmart`

---

### Step 5: Switch to the Correct Branch

The fixed code is on a specific branch:

```powershell
git checkout cursor/comprehensive-improvements-7360
```

**Expected output:**
```
Branch 'cursor/comprehensive-improvements-7360' set up to track remote branch 'cursor/comprehensive-improvements-7360' from 'origin'.
Switched to a new branch 'cursor/comprehensive-improvements-7360'
```

---

### Step 6: Verify You Have the Fixed Code

Check that you have the latest fixes:

```powershell
git log -1 --oneline
```

**Expected output (should mention "fix: Resolve APK crash"):**
```
7c01248 docs: Add rebuild guide for crash-fixed APK
```

---

### Step 7: Navigate to Farmer App

```powershell
cd farmer-app
```

**Now you're in:** `C:\Users\peter\Projects\dzalasmart\farmer-app`

---

### Step 8: Install Node.js Dependencies

```powershell
npm install
```

**What happens:**
- Downloads ~234 packages
- Takes 2-3 minutes
- Uses ~150 MB of disk space

**Expected output:**
```
npm WARN deprecated ...
added 234 packages, and audited 235 packages in 2m

45 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**If you see errors:**
- Try: `npm cache clean --force`
- Then: `npm install` again

---

### Step 9: Sync with Android

```powershell
npx cap sync android
```

**What happens:**
- Copies web files to Android project
- Configures Capacitor plugins
- Takes 10-30 seconds

**Expected output:**
```
✔ Copying web assets from www to android/app/src/main/assets/public in 3.91ms
✔ Creating capacitor.config.json in android/app/src/main/assets in 406μs
✔ copy android in 9.11ms
✔ Updating Android plugins in 403μs
[info] Found 3 Capacitor plugins for android:
       @capacitor/camera@8.2.4
       @capacitor/geolocation@8.2.2
       @capacitor/preferences@8.0.1
✔ update android in 20.37ms
[info] Sync finished in 0.039s
```

---

### Step 10: Open in Android Studio

```powershell
npx cap open android
```

**What happens:**
- Android Studio launches automatically
- Opens the project
- Takes 10-20 seconds

**If Android Studio doesn't open:**
- Open Android Studio manually
- Click "Open"
- Navigate to: `C:\Users\peter\Projects\dzalasmart\farmer-app\android`
- Click "OK"

---

### Step 11: Wait for Gradle Sync

**In Android Studio:**

1. **Look at the bottom of the window**
   - You'll see: "Gradle sync in progress..."
   
2. **DO NOT DO ANYTHING YET!**
   - Just wait for it to finish
   - Takes 3-5 minutes (first time only)
   
3. **When finished, you'll see:**
   - "Gradle sync finished in X min X sec"
   - Status bar at bottom shows "Ready"

**What's happening:**
- Android Studio downloads build tools
- Configures the project
- Downloads dependencies (~300 MB)

---

### Step 12: Build the APK

**Method 1: Using Menu (Easiest)**

1. Click menu: **Build**
2. Click: **Build Bundle(s) / APK(s)**
3. Click: **Build APK(s)**
4. Wait 2-4 minutes

**Method 2: Using Keyboard**

1. Press: `Ctrl + B`
2. Wait 2-4 minutes

**Method 3: Using Toolbar**

1. Find the green hammer icon 🔨
2. Click it
3. Wait 2-4 minutes

---

### Step 13: Locate Your APK

**When build completes:**

1. You'll see a notification: "APK(s) generated successfully"
2. Click **"locate"** in the notification

**Or manually find it at:**

```
C:\Users\peter\Projects\dzalasmart\farmer-app\android\app\build\outputs\apk\debug\app-debug.apk
```

**APK details:**
- Filename: `app-debug.apk`
- Size: ~8-9 MB
- This is a debug build (for testing)

---

## 📱 Install the APK

### Method 1: Via USB Cable

1. **Enable USB Debugging on your phone:**
   - Go to: Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back to: Settings → Developer Options
   - Enable "USB Debugging"

2. **Connect phone to computer via USB**

3. **In PowerShell/CMD:**
```powershell
cd C:\Users\peter\Projects\dzalasmart\farmer-app\android\app\build\outputs\apk\debug
adb install app-debug.apk
```

**Expected output:**
```
Performing Streamed Install
Success
```

### Method 2: Copy APK to Phone

1. **Copy the APK file:**
   - From: `C:\Users\peter\Projects\dzalasmart\farmer-app\android\app\build\outputs\apk\debug\app-debug.apk`
   - To: Your phone (via USB, Bluetooth, or cloud)

2. **On your phone:**
   - Open file manager
   - Find the APK file
   - Tap it
   - Allow installation from unknown sources if prompted
   - Tap "Install"

---

## 🧪 Test the App

### Launch the App

1. Find the app icon: **Nzeru za Alimi** 🌾
2. Tap it
3. You should see:
   - ✅ Loading screen (1 second)
   - ✅ Login screen

### Test Login

Use these test credentials:

```
Phone: +265888000101
PIN: 0000
```

**What should happen:**
1. Type the phone number
2. Type the PIN
3. Click "Login"
4. Button changes to "Logging in..."
5. Either:
   - ✅ Success: Shows main app with 5 tabs
   - ❌ Error: Shows red error message

---

## 🔍 Troubleshooting

### Issue: "git: command not found"

**Solution:**
1. Install Git from: https://git-scm.com/download/win
2. Restart PowerShell/CMD
3. Try again

---

### Issue: "npm: command not found"

**Solution:**
1. Install Node.js from: https://nodejs.org/
2. Restart PowerShell/CMD
3. Try again

---

### Issue: "npx cap sync android" fails

**Solution:**
```powershell
# Clear cache and reinstall
rm -r node_modules
npm cache clean --force
npm install
npx cap sync android
```

---

### Issue: Gradle sync fails in Android Studio

**Solution 1: Invalidate Caches**
1. In Android Studio: File → Invalidate Caches / Restart
2. Click "Invalidate and Restart"
3. Wait for Android Studio to reopen

**Solution 2: Check SDK**
1. In Android Studio: Tools → SDK Manager
2. Make sure these are installed:
   - Android SDK Platform 33
   - Android SDK Build-Tools 33.0.0
   - Android SDK Platform-Tools
3. Click "Apply" if anything needs to be installed

---

### Issue: Build fails with "SDK location not found"

**Solution:**
1. In Android Studio: File → Project Structure
2. Set SDK Location to: `C:\Users\peter\AppData\Local\Android\Sdk`
3. Click OK
4. Try building again

---

### Issue: APK installs but crashes

**Check logcat:**
```powershell
adb logcat | grep -E "Capacitor|chromium|ERROR"
```

**Solutions:**
- Make sure you're on the correct branch
- Verify you have the latest code: `git pull origin cursor/comprehensive-improvements-7360`
- Rebuild: `npx cap sync android` then build again

---

### Issue: Can't find APK after build

**Manual path:**
```
C:\Users\peter\Projects\dzalasmart\farmer-app\android\app\build\outputs\apk\debug\app-debug.apk
```

**Or search:**
```powershell
dir app-debug.apk /s
```

---

## ✅ Success Checklist

Mark each step as you complete it:

- [ ] Git installed and working
- [ ] Node.js installed and working
- [ ] Android Studio installed
- [ ] Repository cloned
- [ ] Switched to correct branch
- [ ] `npm install` completed
- [ ] `npx cap sync android` completed
- [ ] Android Studio opened project
- [ ] Gradle sync finished
- [ ] APK built successfully
- [ ] APK file found
- [ ] APK installed on phone
- [ ] App opens without crashing
- [ ] Can login or see error message

---

## 📊 Expected Timeline

| Step | Time |
|------|------|
| Clone repository | 30 seconds |
| Switch branch | 5 seconds |
| npm install | 2-3 minutes |
| cap sync | 30 seconds |
| Open Android Studio | 20 seconds |
| Gradle sync | 3-5 minutes |
| Build APK | 2-4 minutes |
| Install on phone | 30 seconds |
| **Total** | **10-15 minutes** |

---

## 🎯 Quick Command Summary

Here's all the commands in one place:

```powershell
# Navigate to projects folder
mkdir C:\Users\peter\Projects
cd C:\Users\peter\Projects

# Clone repository
git clone https://github.com/peterchatuwa/dzalasmart.git
cd dzalasmart

# Switch to fixed branch
git checkout cursor/comprehensive-improvements-7360

# Navigate to farmer app
cd farmer-app

# Install dependencies
npm install

# Sync with Android
npx cap sync android

# Open in Android Studio
npx cap open android

# (In Android Studio: Wait for Gradle sync, then Build → Build APK)

# Install on phone (optional)
cd android\app\build\outputs\apk\debug
adb install app-debug.apk
```

---

## 📞 Need Help?

### Check Current Status

```powershell
# Check Git version
git --version

# Check Node version
node --version

# Check npm version
npm --version

# Check current branch
git branch

# Check latest commit
git log -1 --oneline

# List files in current directory
dir
```

### Verify You're in the Right Place

```powershell
# Should show: C:\Users\peter\Projects\dzalasmart\farmer-app
pwd

# Should show: www, android, capacitor.config.json, package.json
dir
```

---

## 🎉 You're Done!

Once you complete all steps, you should have:

✅ **On Your Computer:**
- Repository cloned
- APK file built
- Located at: `android\app\build\outputs\apk\debug\app-debug.apk`

✅ **On Your Phone:**
- App installed
- App icon visible
- App opens without crashing
- Can test login functionality

---

**Repository**: https://github.com/peterchatuwa/dzalasmart  
**Branch**: cursor/comprehensive-improvements-7360  
**APK Location**: `farmer-app\android\app\build\outputs\apk\debug\app-debug.apk`  
**Test Login**: `+265888000101` / `0000`  

**Status**: ✅ Ready to clone and build!
