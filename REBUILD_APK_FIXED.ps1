# Rebuild APK Script - Fixed Version
# This script rebuilds the Farmer App APK after fixing the duplicate switchTab error

Write-Host "====================================="
Write-Host "FARMER APP REBUILD - FIXED"
Write-Host "====================================="
Write-Host ""

# Step 1: Pull latest code
Write-Host "[1/5] Pulling latest code from Git..."
git pull origin cursor/comprehensive-improvements-7360

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to pull latest code" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Code updated" -ForegroundColor Green
Write-Host ""

# Step 2: Sync Capacitor
Write-Host "[2/5] Syncing Capacitor to Android..."
cd farmer-app
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Capacitor sync failed" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Capacitor synced" -ForegroundColor Green
Write-Host ""

# Step 3: Clean Gradle caches
Write-Host "[3/5] Cleaning Gradle caches..."
cd android
./gradlew clean

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Gradle clean failed" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Caches cleaned" -ForegroundColor Green
Write-Host ""

# Step 4: Build APK
Write-Host "[4/5] Building APK (this may take a few minutes)..."
./gradlew assembleDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: APK build failed" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: APK built" -ForegroundColor Green
Write-Host ""

# Step 5: Install APK
Write-Host "[5/5] Installing APK to device..."
cd ..
cd ..

# Find ADB
$adbPath = $null
$possiblePaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $adbPath = $path
        break
    }
}

if (-not $adbPath) {
    Write-Host "WARNING: ADB not found. Please install manually." -ForegroundColor Yellow
    Write-Host "APK location: farmer-app\android\app\build\outputs\apk\debug\app-debug.apk"
    exit 0
}

# Install APK
$apkPath = "farmer-app\android\app\build\outputs\apk\debug\app-debug.apk"
& $adbPath install -r $apkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: APK installed on device" -ForegroundColor Green
} else {
    Write-Host "WARNING: Installation may have failed. Try manually installing." -ForegroundColor Yellow
    Write-Host "APK location: $apkPath"
}

Write-Host ""
Write-Host "====================================="
Write-Host "REBUILD COMPLETE"
Write-Host "====================================="
Write-Host ""
Write-Host "The app should now work correctly on your device."
Write-Host "If the app is still open, close it completely and reopen it."
Write-Host ""
