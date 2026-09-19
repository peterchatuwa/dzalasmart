# Build APK from PowerShell
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Nzeru Farmer APK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set JAVA_HOME if not already set
if (-not $env:JAVA_HOME) {
    Write-Host "Setting JAVA_HOME..." -ForegroundColor Yellow
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
    $env:PATH = "$env:PATH;$env:JAVA_HOME\bin"
    Write-Host "JAVA_HOME set to: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "JAVA_HOME already set: $env:JAVA_HOME" -ForegroundColor Green
}
Write-Host ""

# Navigate to android folder
Set-Location "C:\Users\peter\Projects\dzalasmart\farmer-app\android"
Write-Host "Working directory: $PWD" -ForegroundColor Cyan
Write-Host ""

# Clean build
Write-Host "[1/3] Cleaning previous build..." -ForegroundColor Yellow
.\gradlew.bat clean
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Clean failed" -ForegroundColor Red
    exit 1
}
Write-Host "Clean completed" -ForegroundColor Green
Write-Host ""

# Build debug APK
Write-Host "[2/3] Building debug APK..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host ""

# Show APK location
Write-Host "[3/3] APK Location:" -ForegroundColor Yellow
$apkPath = "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host "APK created: $apkPath" -ForegroundColor Green
    Write-Host "Size: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Gray
    Write-Host ""
    
    # Install prompt
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "To install the APK, run:" -ForegroundColor Cyan
    Write-Host "  adb install -r $apkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "To install now, press Enter (or Ctrl+C to cancel)" -ForegroundColor Yellow
    $null = Read-Host
    
    Write-Host "Installing APK..." -ForegroundColor Yellow
    adb install -r $apkPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APK installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Open the app on your device and monitor logs with:" -ForegroundColor Cyan
        Write-Host "  adb logcat Capacitor:D chromium:D *:S" -ForegroundColor White
        Write-Host "========================================" -ForegroundColor Cyan
    } else {
        Write-Host "ERROR: Installation failed" -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: APK not found at expected location" -ForegroundColor Red
    exit 1
}
