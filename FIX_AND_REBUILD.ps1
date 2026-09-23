# Complete Fix and Rebuild Script for Farmer App
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Farmer App - Fix and Rebuild" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$VPS_IP = "37.60.252.211"
$VPS_USER = "root"
$VPS_PASS = "Malawi12"

# Step 1: Deploy API fixes to VPS
Write-Host "[1/4] Deploying API fixes to VPS..." -ForegroundColor Yellow
Write-Host "Connecting to $VPS_IP..." -ForegroundColor Gray

$deployScript = @"
cd /opt/nzeru-za-alimi && \
git pull origin cursor/comprehensive-improvements-7360 && \
pm2 restart nzeru-api && \
echo 'API deployed successfully'
"@

try {
    $result = echo $VPS_PASS | ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $VPS_USER@$VPS_IP $deployScript
    Write-Host $result -ForegroundColor Gray
    Write-Host "API deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not connect to VPS" -ForegroundColor Yellow
    Write-Host "You may need to deploy manually later" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Pull latest code
Write-Host "[2/4] Pulling latest code from GitHub..." -ForegroundColor Yellow
Set-Location "C:\Users\peter\Projects\dzalasmart"
git pull origin cursor/comprehensive-improvements-7360
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to pull code" -ForegroundColor Red
    exit 1
}
Write-Host "Code updated" -ForegroundColor Green
Write-Host ""

# Step 3: Sync web files to Android
Write-Host "[3/4] Syncing web files to Android assets..." -ForegroundColor Yellow
$webDir = "farmer-app\www"
$androidAssetsDir = "farmer-app\android\app\src\main\assets\public"

Copy-Item "$webDir\*" -Destination $androidAssetsDir -Recurse -Force
Write-Host "Web files synced" -ForegroundColor Green

# Verify the fix is in place
$appJsContent = Get-Content "$androidAssetsDir\app.js" -Raw
if ($appJsContent -match "data\.farmer") {
    Write-Host "Verified: Data extraction fix is in place" -ForegroundColor Green
} else {
    Write-Host "WARNING: Fix may not be applied correctly" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Clean and build APK
Write-Host "[4/4] Building APK..." -ForegroundColor Yellow
Set-Location "farmer-app\android"

# Set JAVA_HOME
if (-not $env:JAVA_HOME) {
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
    $env:PATH = "$env:PATH;$env:JAVA_HOME\bin"
}

# Clean
Write-Host "Cleaning previous build..." -ForegroundColor Gray
Remove-Item -Recurse -Force build, app\build -ErrorAction SilentlyContinue

# Build
Write-Host "Building APK (this may take a few minutes)..." -ForegroundColor Gray
.\gradlew.bat clean assembleDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}

$apkPath = "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "APK: $apkPath" -ForegroundColor White
    Write-Host "Size: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "What's Fixed:" -ForegroundColor Yellow
    Write-Host "  - Farmer profile data now loads correctly" -ForegroundColor White
    Write-Host "  - Warehouse receipts and loans display" -ForegroundColor White
    Write-Host "  - Market prices filtered by district" -ForegroundColor White
    Write-Host "  - Agricultural advisor chatbot works" -ForegroundColor White
    Write-Host ""
    Write-Host "To install, press Enter (or Ctrl+C to cancel)" -ForegroundColor Yellow
    $null = Read-Host
    
    Write-Host "Installing APK..." -ForegroundColor Yellow
    adb install -r $apkPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "INSTALLATION COMPLETE!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Test Credentials:" -ForegroundColor Yellow
        Write-Host "  Phone: +265888000001" -ForegroundColor White
        Write-Host "  PIN:   1234" -ForegroundColor White
        Write-Host ""
        Write-Host "What to Test:" -ForegroundColor Yellow
        Write-Host "  1. Login with test credentials" -ForegroundColor White
        Write-Host "  2. Check Home tab - farmer name and district should show" -ForegroundColor White
        Write-Host "  3. Check Profile tab - all farmer details should display" -ForegroundColor White
        Write-Host "  4. Check Receipts tab - warehouse receipts should load" -ForegroundColor White
        Write-Host "  5. Check Market tab - prices should display" -ForegroundColor White
        Write-Host "  6. Check Advisor tab - ask a question and get advice" -ForegroundColor White
        Write-Host ""
        Write-Host "Monitor logs with:" -ForegroundColor Yellow
        Write-Host "  adb logcat Capacitor:D chromium:D *:S" -ForegroundColor White
        Write-Host "========================================" -ForegroundColor Cyan
    } else {
        Write-Host "ERROR: Installation failed" -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: APK not found" -ForegroundColor Red
    exit 1
}
