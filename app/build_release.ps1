# Flutter Release 构建脚本 (带代码混淆)
# 使用方法: .\build_release.ps1 [apk|appbundle|ios]

param(
    [string]$Target = "apk"
)

$ErrorActionPreference = "Stop"

# 创建调试符号目录
$DebugInfoDir = "build/debug-info"
if (-not (Test-Path $DebugInfoDir)) {
    New-Item -ItemType Directory -Path $DebugInfoDir -Force | Out-Null
}

Write-Host "🔨 Building Flutter $Target with obfuscation..." -ForegroundColor Cyan

switch ($Target.ToLower()) {
    "apk" {
        # 构建 APK (带混淆)
        flutter build apk --release `
            --obfuscate `
            --split-debug-info=$DebugInfoDir `
            --no-tree-shake-icons
        
        Write-Host "✅ APK built successfully!" -ForegroundColor Green
        Write-Host "📦 Output: build/app/outputs/flutter-apk/app-release.apk" -ForegroundColor Yellow
    }
    "appbundle" {
        # 构建 App Bundle (Google Play)
        flutter build appbundle --release `
            --obfuscate `
            --split-debug-info=$DebugInfoDir `
            --no-tree-shake-icons
        
        Write-Host "✅ App Bundle built successfully!" -ForegroundColor Green
        Write-Host "📦 Output: build/app/outputs/bundle/release/app-release.aab" -ForegroundColor Yellow
    }
    "ios" {
        # 构建 iOS (需要 macOS)
        flutter build ios --release `
            --obfuscate `
            --split-debug-info=$DebugInfoDir `
            --no-tree-shake-icons
        
        Write-Host "✅ iOS build completed!" -ForegroundColor Green
    }
    default {
        Write-Host "❌ Unknown target: $Target" -ForegroundColor Red
        Write-Host "Usage: .\build_release.ps1 [apk|appbundle|ios]" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "📋 Debug symbols saved to: $DebugInfoDir" -ForegroundColor Cyan
Write-Host "   (Keep these files for crash report symbolication)" -ForegroundColor Gray
