# Nzeru Farmer App - Sync and Build Script
# This script syncs the web files to Android and rebuilds the APK

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Nzeru Farmer App - Sync and Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull latest code
Write-Host "[1/5] Pulling latest code from GitHub..." -ForegroundColor Yellow
git pull origin cursor/comprehensive-improvements-7360
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to pull from GitHub" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Code updated successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Sync web files to Android assets
Write-Host "[2/5] Syncing web files to Android assets..." -ForegroundColor Yellow
$webDir = "farmer-app\www"
$androidAssetsDir = "farmer-app\android\app\src\main\assets\public"

# Create assets directory if it doesn't exist
if (!(Test-Path $androidAssetsDir)) {
    New-Item -ItemType Directory -Path $androidAssetsDir -Force | Out-Null
}

# Copy all web files
Copy-Item "$webDir\*" -Destination $androidAssetsDir -Recurse -Force
Write-Host "✓ Web files synced to Android assets" -ForegroundColor Green
Write-Host ""

# Step 3: Verify the files
Write-Host "[3/5] Verifying app.js..." -ForegroundColor Yellow
$appJsContent = Get-Content "$androidAssetsDir\app.js" -Raw
if ($appJsContent -match "window\.Capacitor") {
    Write-Host "✓ app.js contains correct Capacitor code" -ForegroundColor Green
} else {
    Write-Host "WARNING: app.js may not have the latest fixes" -ForegroundColor Red
}
Write-Host ""

# Step 4: Clean build cache
Write-Host "[4/5] Cleaning build cache..." -ForegroundColor Yellow
Set-Location "farmer-app\android"
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "app\build") { Remove-Item -Recurse -Force "app\build" }
if (Test-Path ".gradle\caches") { Remove-Item -Recurse -Force ".gradle\caches" }
Write-Host "✓ Build cache cleared" -ForegroundColor Green
Write-Host ""

# Step 5: Instructions for Android Studio
Write-Host "[5/5] Next Steps in Android Studio:" -ForegroundColor Yellow
Write-Host "  1. Open Android Studio" -ForegroundColor White
Write-Host "  2. File -> Invalidate Caches / Restart -> Invalidate and Restart" -ForegroundColor White
Write-Host "  3. After restart, click: Build -> Clean Project" -ForegroundColor White
Write-Host "  4. Then click: Build -> Rebuild Project" -ForegroundColor White
Write-Host "  5. Finally click: Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "After building the APK, install it with:" -ForegroundColor Cyan
Write-Host "  adb install -r app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
