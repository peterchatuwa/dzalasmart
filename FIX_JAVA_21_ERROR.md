# Fix "invalid source release: 21" Error - Complete Solution

**Issue**: Still getting `error: invalid source release: 21` after pulling changes  
**Cause**: Android Studio has cached build files using Java 21

---

## 🔧 Complete Fix (Do These Steps in Order)

### Step 1: Pull Latest Changes

```powershell
cd C:\Users\peter\Projects\dzalasmart
git pull origin cursor/comprehensive-improvements-7360
cd farmer-app
```

### Step 2: Clean Old Build Files

In PowerShell:

```powershell
# Delete the build directories
Remove-Item -Recurse -Force android\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\.gradle -ErrorAction SilentlyContinue
```

Or manually delete these folders:
- `farmer-app\android\build\`
- `farmer-app\android\app\build\`
- `farmer-app\android\.gradle\`

### Step 3: Sync Capacitor

```powershell
npx cap sync android
```

### Step 4: Close Android Studio (If Open)

- Close Android Studio completely
- Make sure no Gradle processes are running

### Step 5: Verify JDK Settings

Before reopening, make sure:

1. Open `farmer-app\android\gradle.properties` in Notepad

2. Add or verify these lines at the end:

```properties
# Java version settings
org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
```

3. Save and close

### Step 6: Reopen in Android Studio

```powershell
npx cap open android
```

### Step 7: Set JDK in Android Studio

When Android Studio opens:

1. **File → Settings** (or Ctrl + Alt + S)
2. **Build, Execution, Deployment → Build Tools → Gradle**
3. **Gradle JDK:** Select **jbr-17** (or Embedded JDK)
4. Click **OK**

### Step 8: Invalidate Caches

1. **File → Invalidate Caches / Restart**
2. Check **"Invalidate and Restart"**
3. Click **Invalidate and Restart** button
4. Wait for Android Studio to restart

### Step 9: Clean Build

After Android Studio restarts:

1. Wait for Gradle sync to complete
2. **Build → Clean Project**
3. Wait for clean to finish
4. **Build → Rebuild Project**
5. Wait for rebuild

### Step 10: Build APK

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait 2-4 minutes
3. Success! ✅

---

## 🎯 Alternative: Command Line Build

If Android Studio still has issues, try building from command line:

```powershell
cd C:\Users\peter\Projects\dzalasmart\farmer-app\android

# Clean
.\gradlew clean

# Build
.\gradlew assembleDebug
```

The APK will be at:
```
app\build\outputs\apk\debug\app-debug.apk
```

---

## 🔍 If Still Failing

### Check Your JDK Version

In PowerShell:

```powershell
java -version
```

Should show version 17 or lower (not 21 or 25).

### Install JDK 17 if Needed

1. Download from: https://adoptium.net/temurin/releases/
2. Select: **Version 17 (LTS)**, **Windows x64**
3. Install it
4. Note the installation path (e.g., `C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot`)

### Point Gradle to JDK 17

Edit `farmer-app\android\gradle.properties`:

```properties
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.10-hotspot
```

(Replace with your actual JDK 17 path)

### Retry Build

```powershell
cd android
.\gradlew clean
.\gradlew assembleDebug
```

---

## ✅ Success Indicators

When it works, you'll see:

```
BUILD SUCCESSFUL in 2m 15s
142 actionable tasks: 142 executed

Generated APK:
app\build\outputs\apk\debug\app-debug.apk
```

---

## 📋 Quick Checklist

- [ ] Pulled latest code
- [ ] Deleted build folders
- [ ] Synced Capacitor
- [ ] Closed Android Studio
- [ ] Set JDK to 17 in gradle.properties
- [ ] Reopened Android Studio
- [ ] Selected jbr-17 in Settings
- [ ] Invalidated caches
- [ ] Cleaned project
- [ ] Rebuilt project
- [ ] Built APK successfully

---

## 🎉 After Success

Once APK is built:

1. Find it at: `farmer-app\android\app\build\outputs\apk\debug\app-debug.apk`
2. Install on phone
3. Test with: `+265888000101` / `0000`

---

**Key Point**: The issue is cached build files using Java 21. Cleaning everything and restarting ensures it uses Java 17.
