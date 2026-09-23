# ===================================================================
# CRITICAL: This is the LATEST version of the app rebuild script
# Run this to get the app with ALL fixes applied
# ===================================================================

Write-Host ""
Write-Host "********************************************" -ForegroundColor Red
Write-Host "*  CRITICAL REBUILD - FARM TAB FIX        *" -ForegroundColor Red
Write-Host "********************************************" -ForegroundColor Red
Write-Host ""
Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Pull the LATEST code from the server" -ForegroundColor White
Write-Host "  2. COMPLETELY rebuild the Android app" -ForegroundColor White
Write-Host "  3. Install it on your device" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Make sure your phone is connected via USB!" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Ready to proceed? Type 'yes' to continue"
if ($confirm -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   STEP 1: PULL LATEST CODE" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Make absolutely sure we're in the right directory
$originalDir = Get-Location
Set-Location /workspace

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "Current branch: $(git branch --show-current)" -ForegroundColor Gray
Write-Host ""

Write-Host "Pulling latest changes..." -ForegroundColor Yellow
git fetch origin
git reset --hard origin/cursor/comprehensive-improvements-7360

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to pull code" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Code is now up-to-date" -ForegroundColor Green
Write-Host ""

# Verify the fix is present
Write-Host "Verifying fix is present..." -ForegroundColor Yellow
$appJsContent = Get-Content -Path "farmer-app/www/app.js" -Raw
$switchTabCount = ([regex]::Matches($appJsContent, "function switchTab\(")).Count

Write-Host "Found $switchTabCount 'function switchTab(' declarations" -ForegroundColor Gray

if ($switchTabCount -ne 1) {
    Write-Host ""
    Write-Host "ERROR: Code still has multiple switchTab declarations!" -ForegroundColor Red
    Write-Host "Expected 1, found $switchTabCount" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please contact support - there may be a code sync issue." -ForegroundColor Yellow
    exit 1
}

Write-Host "VERIFIED: Fix is present (exactly 1 switchTab function)" -ForegroundColor Green
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   STEP 2: SYNC CAPACITOR" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Set-Location farmer-app
Write-Host "Syncing web assets to Android..." -ForegroundColor Yellow
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Capacitor sync failed" -ForegroundColor Red
    Set-Location $originalDir
    exit 1
}

Write-Host "SUCCESS: Assets synced to android/app/src/main/assets/public/" -ForegroundColor Green
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   STEP 3: CLEAN BUILD" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Set-Location android
Write-Host "Cleaning all Gradle caches and build artifacts..." -ForegroundColor Yellow
./gradlew clean

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "WARNING: Clean failed, but continuing..." -ForegroundColor Yellow
} else {
    Write-Host "SUCCESS: Caches cleared" -ForegroundColor Green
}

Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   STEP 4: BUILD APK" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Write-Host "Building debug APK (this will take 2-5 minutes)..." -ForegroundColor Yellow
Write-Host ""
./gradlew assembleDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "********************************************" -ForegroundColor Red
    Write-Host "*  ERROR: APK BUILD FAILED                *" -ForegroundColor Red
    Write-Host "********************************************" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  1. Open Android Studio" -ForegroundColor White
    Write-Host "  2. File > Settings > Build, Execution, Deployment > Build Tools > Gradle" -ForegroundColor White
    Write-Host "  3. Set 'Gradle JDK' to 'jbr-17' or 'Embedded JDK (jbr-17)'" -ForegroundColor White
    Write-Host "  4. Close Android Studio" -ForegroundColor White
    Write-Host "  5. Run this script again" -ForegroundColor White
    Write-Host ""
    Set-Location $originalDir
    exit 1
}

Write-Host ""
Write-Host "SUCCESS: APK built successfully" -ForegroundColor Green
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   STEP 5: UNINSTALL OLD APP" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Set-Location $originalDir
$apkPath = "farmer-app\android\app\build\outputs\apk\debug\app-debug.apk"

# Find ADB
$adbPath = $null
$possiblePaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "C:\Android\Sdk\platform-tools\adb.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $adbPath = $path
        break
    }
}

if (-not $adbPath) {
    Write-Host ""
    Write-Host "WARNING: ADB not found" -ForegroundColor Yellow
    Write-Host "Cannot automatically install APK" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual installation:" -ForegroundColor Yellow
    Write-Host "  1. Copy this file to your phone: $apkPath" -ForegroundColor White
    Write-Host "  2. Open it on your phone to install" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Host "Found ADB at: $adbPath" -ForegroundColor Gray
Write-Host ""

# Check if device is connected
Write-Host "Checking for connected devices..." -ForegroundColor Yellow
& $adbPath devices

$devices = & $adbPath devices | Select-String -Pattern "device$"
if ($devices.Count -eq 0) {
    Write-Host ""
    Write-Host "ERROR: No device connected!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "  1. Connect your phone via USB" -ForegroundColor White
    Write-Host "  2. Enable USB debugging on your phone" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Device connected!" -ForegroundColor Green
Write-Host ""

Write-Host "Uninstalling old version of app..." -ForegroundColor Yellow
& $adbPath uninstall com.zammunda.nzeru.farmer 2>$null
Write-Host "Old app removed (if it existed)" -ForegroundColor Gray
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   STEP 6: INSTALL NEW APK" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Write-Host "Installing fresh APK to device..." -ForegroundColor Yellow
& $adbPath install $apkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "********************************************" -ForegroundColor Green
    Write-Host "*  SUCCESS: APP INSTALLED                 *" -ForegroundColor Green
    Write-Host "********************************************" -ForegroundColor Green
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Open the 'Nzeru Za Alimi' app on your phone" -ForegroundColor White
    Write-Host "     (it should have a fresh icon)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Login with your farmer credentials:" -ForegroundColor White
    Write-Host "     - Phone number" -ForegroundColor Gray
    Write-Host "     - PIN" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Tap the 'Farm' tab (house icon)" -ForegroundColor White
    Write-Host ""
    Write-Host "  4. You should see:" -ForegroundColor White
    Write-Host "     - Land Parcels section" -ForegroundColor Gray
    Write-Host "     - Production Seasons section" -ForegroundColor Gray
    Write-Host "     - Household Members section" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  5. If sections are empty, that's NORMAL!" -ForegroundColor White
    Write-Host "     Click '+ Add Parcel' to add your first land parcel" -ForegroundColor Gray
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  If the Farm tab still shows an error:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. Connect phone to computer via USB" -ForegroundColor Gray
    Write-Host "  2. In Chrome, go to: chrome://inspect" -ForegroundColor Gray
    Write-Host "  3. Find your app and click 'inspect'" -ForegroundColor Gray
    Write-Host "  4. Check the Console tab for errors" -ForegroundColor Gray
    Write-Host "  5. Take a screenshot and send it" -ForegroundColor Gray
    Write-Host ""
    Write-Host "The app is now running the LATEST code with all fixes!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "********************************************" -ForegroundColor Red
    Write-Host "*  ERROR: INSTALLATION FAILED             *" -ForegroundColor Red
    Write-Host "********************************************" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual installation:" -ForegroundColor Yellow
    Write-Host "  1. Copy this file to your phone:" -ForegroundColor White
    Write-Host "     $apkPath" -ForegroundColor Cyan
    Write-Host "  2. On your phone, open the file to install" -ForegroundColor White
    Write-Host ""
    exit 1
}
