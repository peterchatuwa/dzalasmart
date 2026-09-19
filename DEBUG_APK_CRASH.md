# Debug APK Crash on Startup

**Issue**: App installs but crashes immediately when opened  
**Status**: Investigating

---

## 🔍 Step 1: Check Logcat

Connect your phone via USB and run:

```powershell
# Clear previous logs
adb logcat -c

# Start the app and watch logs
adb logcat | Select-String "Capacitor|chromium|AndroidRuntime|FATAL|ERROR"
```

Then open the app on your phone. The logs will show what's crashing.

---

## 🐛 Common Causes & Quick Checks

### Check 1: WebView Version

```powershell
adb shell dumpsys package com.google.android.webview | Select-String "versionName"
```

**Needs**: Chrome WebView 60+ (should show version 100+)

**Fix if outdated**:
- Open Play Store on phone
- Search "Android System WebView"
- Update it

### Check 2: Android Version

```powershell
adb shell getprop ro.build.version.release
```

**Needs**: Android 5.1+ (API 22+)

### Check 3: App Permissions

```powershell
adb shell dumpsys package com.zammunda.nzeru | Select-String "permission"
```

---

## 🔧 Quick Fixes to Try

### Fix 1: Clear App Data and Reinstall

```powershell
# Uninstall completely
adb uninstall com.zammunda.nzeru

# Reinstall
adb install "C:\Users\peter\Projects\dzalasmart\farmer-app\android\app\build\outputs\apk\debug\app-debug.apk"
```

### Fix 2: Check if API Server is Accessible

The app needs to connect to the API. Test from your phone's browser:

Open: `https://api.zammunda.com/health`

Should show: `{"status":"ok"}`

---

## 📱 Get Crash Details

Run this and open the app:

```powershell
adb logcat -c
adb logcat *:E
```

This shows only errors. Copy and paste the output here so I can see what's wrong.

---

## 🎯 Likely Issues

1. **WebView not installed/outdated**
2. **Missing internet permission**
3. **JavaScript error in app code**
4. **Capacitor plugin issue**

---

## ✅ What to Send Me

After running logcat, send me:
- Any lines with "FATAL"
- Any lines with "ERROR"
- Any lines with "Capacitor"
- Your Android version

This will help me pinpoint the exact issue.
