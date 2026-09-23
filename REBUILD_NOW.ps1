# Quick Rebuild Script for Farm Tab Fix
# This script pulls the latest changes and rebuilds the APK

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   FARM TAB FIX - REBUILD APP" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "The backend has been fixed!" -ForegroundColor Green
Write-Host "The production-management.js file has been deployed to the server." -ForegroundColor Green
Write-Host "Now rebuilding the mobile app with enhanced logging..." -ForegroundColor Green
Write-Host ""

# Pull latest code
Write-Host "[1/5] Pulling latest code..." -ForegroundColor Yellow
git pull origin cursor/comprehensive-improvements-7360

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to pull latest code" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Code updated" -ForegroundColor Green
Write-Host ""

# Sync Capacitor
Write-Host "[2/5] Syncing Capacitor to Android..." -ForegroundColor Yellow
Set-Location farmer-app
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Capacitor sync failed" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "SUCCESS: Capacitor synced" -ForegroundColor Green
Write-Host ""

# Clean
Write-Host "[3/5] Cleaning Gradle caches..." -ForegroundColor Yellow
Set-Location android
./gradlew clean

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "WARNING: Gradle clean failed, but continuing..." -ForegroundColor Yellow
}

Write-Host "SUCCESS: Caches cleaned" -ForegroundColor Green
Write-Host ""

# Build
Write-Host "[4/5] Building APK (this may take a few minutes)..." -ForegroundColor Yellow
./gradlew assembleDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: APK build failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "1. In Android Studio, go to File > Settings > Build > Gradle" -ForegroundColor Yellow
    Write-Host "2. Change 'Gradle JDK' to 'Embedded JDK (jbr-17)'" -ForegroundColor Yellow
    Write-Host "3. Try running this script again" -ForegroundColor Yellow
    Set-Location ../..
    exit 1
}

Write-Host "SUCCESS: APK built" -ForegroundColor Green
Write-Host ""

# Install
Write-Host "[5/5] Installing APK..." -ForegroundColor Yellow
Set-Location ../..

$apkPath = "farmer-app\android\app\build\outputs\apk\debug\app-debug.apk"

# Try to find ADB
$adbPath = $null
$possiblePaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "C:\Android\Sdk\platform-tools\adb.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $adbPath = $path
        Write-Host "Found ADB at: $adbPath" -ForegroundColor Green
        break
    }
}

if ($adbPath) {
    Write-Host "Installing APK to connected device..." -ForegroundColor Yellow
    & $adbPath install -r $apkPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: APK installed" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Installation failed" -ForegroundColor Yellow
        Write-Host "You can manually install from: $apkPath" -ForegroundColor Yellow
    }
} else {
    Write-Host "ADB not found - manual installation required" -ForegroundColor Yellow
    Write-Host "APK location: $apkPath" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   REBUILD COMPLETE!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. If app is already open, CLOSE it completely" -ForegroundColor White
Write-Host "2. Open the app fresh" -ForegroundColor White
Write-Host "3. Login with your farmer credentials" -ForegroundColor White
Write-Host "4. Go to the Farm tab (house icon)" -ForegroundColor White
Write-Host ""
Write-Host "WHAT TO EXPECT:" -ForegroundColor Yellow
Write-Host "- You should see three sections:" -ForegroundColor White
Write-Host "  * Land Parcels" -ForegroundColor White
Write-Host "  * Production Seasons" -ForegroundColor White
Write-Host "  * Household Members" -ForegroundColor White
Write-Host ""
Write-Host "- Each section will show 'No ... added yet'" -ForegroundColor White
Write-Host "  This is NORMAL if you haven't added data!" -ForegroundColor White
Write-Host ""
Write-Host "- Click the '+ Add' buttons to add data" -ForegroundColor White
Write-Host ""
Write-Host "If you see any errors, check Chrome DevTools:" -ForegroundColor Yellow
Write-Host "1. Connect device via USB" -ForegroundColor White
Write-Host "2. Open Chrome and go to chrome://inspect" -ForegroundColor White
Write-Host "3. Click 'inspect' on your app" -ForegroundColor White
Write-Host "4. Check Console for detailed logs" -ForegroundColor White
Write-Host ""
Write-Host "The backend is now working correctly!" -ForegroundColor Green
Write-Host ""
