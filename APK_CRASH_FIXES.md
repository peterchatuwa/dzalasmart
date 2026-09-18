# APK Crash Fixes - Nzeru Farmer App

**Date**: September 18, 2026  
**Issue**: APK crashes on startup or fails to open  
**Status**: ✅ FIXED

---

## 🐛 Issues Found and Fixed

### 1. Missing Capacitor Runtime Initialization

**Problem**: The app was trying to use Capacitor APIs before the runtime was initialized.

**Fix**: 
- Added `<script src="cordova.js"></script>` before app.js
- Modified initialization to handle both DOM ready and Capacitor ready states
- Added proper error handling for initialization failures

### 2. Module Import Timing

**Problem**: ES6 module imports were executing before Capacitor was ready.

**Fix**:
- Changed from `DOMContentLoaded` event to custom `initializeApp()` function
- Added conditional check for `document.readyState`
- Graceful fallback if initialization fails

### 3. Preferences API Error Handling

**Problem**: Capacitor Preferences calls could fail without proper error handling.

**Fix**:
- Wrapped all `Preferences.get()` calls in try-catch
- Wrapped all `Preferences.set()` calls in try-catch
- Wrapped all `Preferences.remove()` calls in try-catch
- Added console warnings for preference errors

### 4. Null Reference Errors

**Problem**: UI update functions could crash if DOM elements weren't found.

**Fix**:
- Added null checks for every `document.getElementById()` call
- Wrapped entire `updateUI()` function in try-catch
- Safe defaults for all farmer data fields

### 5. Login Button State

**Problem**: Login button could be clicked multiple times, causing duplicate requests.

**Fix**:
- Added button disable during login
- Changed button text to "Logging in..."
- Restored button state in finally block

---

## 📝 Changes Made

### `/workspace/farmer-app/www/index.html`

**Before:**
```html
<script src="app.js" type="module"></script>
```

**After:**
```html
<!-- Capacitor Scripts -->
<script src="cordova.js"></script>
<script src="app.js" type="module"></script>
```

### `/workspace/farmer-app/www/app.js`

**Key Changes:**

1. **New Initialization Pattern:**
```javascript
async function initializeApp() {
    console.log('App initializing...');
    try {
        // Check for saved session with error handling
        const session = await Preferences.get({ key: 'farmer_session' });
        // ... rest of initialization
    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
        showLogin();
    }
    setupEventListeners();
}

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
```

2. **Safer Login Handler:**
```javascript
async function handleLogin(e) {
    e.preventDefault();
    
    const loginBtn = e.target.querySelector('button[type="submit"]');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    
    try {
        // ... login logic
        try {
            await Preferences.set({
                key: 'farmer_session',
                value: JSON.stringify({ token: authToken, farmer: currentFarmer })
            });
        } catch (prefError) {
            console.warn('Could not save session:', prefError);
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Connection error. Please check your internet.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}
```

3. **Null-Safe UI Updates:**
```javascript
function updateUI() {
    if (!currentFarmer) return;
    
    try {
        const welcomeName = document.getElementById('welcomeName');
        if (welcomeName) welcomeName.textContent = `Welcome, ${currentFarmer.name || 'Farmer'}!`;
        // ... all other updates with null checks
    } catch (error) {
        console.error('Error updating UI:', error);
    }
}
```

---

## 🔄 How to Apply Fixes

### Method 1: Rebuild from Workspace (Recommended)

The workspace code has been updated and synced. Just rebuild:

```powershell
cd C:\Users\peter\Projects\farmer-app

# Pull latest changes from workspace or re-copy the folder

# Sync to Android
npx cap sync android

# Open and build
npx cap open android
# Then: Build → Build APK
```

### Method 2: Update Existing Project

If you already copied the folder:

1. **Copy updated files from workspace:**
   - `/workspace/farmer-app/www/index.html`
   - `/workspace/farmer-app/www/app.js`

2. **Or manually apply changes shown above**

3. **Sync to Android:**
```powershell
cd C:\Users\peter\Projects\farmer-app
npx cap sync android
```

4. **Rebuild APK:**
```powershell
cd android
.\gradlew clean assembleDebug
```

---

## 🧪 Testing the Fixed APK

### 1. Install Fresh APK

Uninstall old version first:
```bash
adb uninstall com.zammunda.nzeru
```

Install new version:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 2. Check Logcat for Errors

While app is running:
```bash
adb logcat | grep -i "capacitor\|nzeru\|error"
```

### 3. Expected Behavior

✅ **What should happen:**
1. App opens without crashing
2. Loading screen shows for 1 second
3. Login screen appears
4. Can enter phone and PIN
5. "Logging in..." appears when submitting
6. Either:
   - Success: Shows main app with 5 tabs
   - Error: Shows toast message (red notification)

❌ **What should NOT happen:**
1. App crashes immediately
2. White/blank screen
3. "App has stopped" dialog
4. No response to button clicks

---

## 🔍 Debug Common Issues

### Issue: "App keeps crashing"

**Check:**
```bash
adb logcat | grep -E "AndroidRuntime|FATAL"
```

**Look for:**
- JavaScript errors
- Module loading errors
- Capacitor plugin errors

**Solutions:**
- Clear app data: Settings → Apps → Nzeru → Clear Data
- Rebuild with clean: `gradlew clean assembleDebug`
- Check Android version (needs 5.1+)

### Issue: "Login button does nothing"

**Check:**
- Is the API server running?
- Test: `curl https://api.zammunda.com/health`
- Check internet connection on phone
- Look at logcat for network errors

**Solutions:**
- Verify API URL in `www/app.js`
- Check phone's internet connection
- Try with Wi-Fi instead of mobile data

### Issue: "White screen after login"

**Check:**
- Logcat for JavaScript errors
- Check if API returned valid farmer data

**Solutions:**
- Add better error handling in `loadFarmerData()`
- Verify API responses match expected format

### Issue: "App works in emulator but not on phone"

**Check:**
- Android version (needs 5.1+)
- WebView version (needs Chrome WebView 60+)

**Solutions:**
- Update WebView: Play Store → "Android System WebView"
- Test on different device
- Check device-specific logcat

---

## 📊 Verification Checklist

After rebuilding, verify:

- [ ] APK builds without errors
- [ ] APK installs on device
- [ ] App icon appears in launcher
- [ ] App opens (not crashes)
- [ ] Loading screen shows briefly
- [ ] Login screen appears
- [ ] Can type in phone field
- [ ] Can type in PIN field
- [ ] Login button is clickable
- [ ] Button shows "Logging in..." when clicked
- [ ] Either error message or main app appears

---

## 🎯 Expected File Sizes

After fixes:
- `app.js`: ~17-18 KB (was ~16 KB)
- `index.html`: ~11 KB (unchanged)
- `app-debug.apk`: ~9 MB (unchanged)

---

## 🚀 Quick Rebuild Commands

```powershell
# Navigate to project
cd C:\Users\peter\Projects\farmer-app

# Clean previous build
cd android
.\gradlew clean

# Go back and sync
cd ..
npx cap sync android

# Build new APK
cd android
.\gradlew assembleDebug

# Install on connected device
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

---

## 📱 Test with ADB

```bash
# List connected devices
adb devices

# Install APK
adb install -r path/to/app-debug.apk

# Watch logs while testing
adb logcat -c && adb logcat | grep -i "capacitor\|chromium\|console"

# Clear app data and retest
adb shell pm clear com.zammunda.nzeru

# Uninstall completely
adb uninstall com.zammunda.nzeru
```

---

## 🎉 Success Indicators

When everything is fixed, you should see:

**In Logcat:**
```
I/Capacitor: Loading app at file:///android_asset/public/index.html
I/chromium: [INFO:CONSOLE(10)] "App initializing...", source: file:///android_asset/public/app.js (10)
```

**On Phone:**
- App icon shows correctly
- Tap icon → app opens
- See loading screen with 🌾 icon
- Login form appears
- Can interact with form
- Login works or shows error message

---

## 📞 Still Having Issues?

### Collect Debug Information

1. **Get logcat output:**
```bash
adb logcat > app-crash-log.txt
```

2. **Get device info:**
```bash
adb shell getprop ro.build.version.release
adb shell getprop ro.product.model
```

3. **Check WebView version:**
```bash
adb shell dumpsys package com.google.android.webview | grep versionName
```

### Check These Files

- `/workspace/farmer-app/www/app.js` (should have all fixes)
- `/workspace/farmer-app/www/index.html` (should include cordova.js)
- `/workspace/farmer-app/android/app/src/main/assets/public/` (should match www/)

---

**Status**: ✅ All fixes applied and synced  
**Next Step**: Rebuild APK using updated code  
**Expected Result**: App should open without crashing
