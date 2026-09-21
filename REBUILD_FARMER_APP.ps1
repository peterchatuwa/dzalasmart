# ==============================================
# Nzeru za Alimi - Rebuild Farmer App
# ==============================================
# This script rebuilds the farmer app with the new
# comprehensive farm management features.
# ==============================================

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  Nzeru za Alimi APK Builder" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "farmer-app")) {
    Write-Host "ERROR: Please run this script from the workspace root directory" -ForegroundColor Red
    exit 1
}

# Step 1: Clean cache
Write-Host "[1/5] Cleaning build cache..." -ForegroundColor Yellow
Set-Location farmer-app/android
if (Test-Path ".gradle") { Remove-Item -Recurse -Force ".gradle" }
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "app/build") { Remove-Item -Recurse -Force "app/build" }
Set-Location ../..

# Step 2: Sync web assets
Write-Host "[2/5] Syncing web assets to Android..." -ForegroundColor Yellow
Set-Location farmer-app
npx cap sync android

# Step 3: Build APK
Write-Host "[3/5] Building APK (this may take a few minutes)..." -ForegroundColor Yellow
Set-Location android
./gradlew assembleDebug --warning-mode all

# Step 4: Install to device
if ($?) {
    Write-Host "[4/5] Installing APK to device..." -ForegroundColor Yellow
    adb install -r "app\build\outputs\apk\debug\app-debug.apk"
    
    if ($?) {
        Write-Host "[5/5] Starting app on device..." -ForegroundColor Yellow
        adb shell am start -n com.zammunda.nzeru.farmer/.MainActivity
        
        Write-Host ""
        Write-Host "=================================" -ForegroundColor Green
        Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
        Write-Host "=================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK location: farmer-app/android/app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor White
        Write-Host ""
        Write-Host "New Features Included:" -ForegroundColor Cyan
        Write-Host "  * Farm Tab - Manage land parcels, household members" -ForegroundColor White
        Write-Host "  * Production Tab - Track activities, monitoring, costs" -ForegroundColor White
        Write-Host "  * Cost Tracking - Record all production expenses" -ForegroundColor White
        Write-Host "  * Season Management - Track multiple production seasons" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERROR: Failed to install APK" -ForegroundColor Red
        Write-Host "Make sure device is connected: adb devices" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "ERROR: Build failed. Check the output above for details." -ForegroundColor Red
}

Set-Location ..\..
