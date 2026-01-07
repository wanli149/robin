# 复制 libmpv jar 文件到构建目录
# 用于解决 media_kit 依赖下载慢的问题

$sourceDir = "C:\Users\wanli\Downloads"
$destDir = "I:\Project Robin\app\build\media_kit_libs_android_video\v1.1.7"

Write-Host "📦 开始复制 libmpv jar 文件..." -ForegroundColor Cyan

# 创建目标目录
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

# 复制文件
$files = @(
    "default-arm64-v8a.jar",
    "default-armeabi-v7a.jar",
    "default-x86.jar",
    "default-x86_64.jar"
)

foreach ($file in $files) {
    $source = Join-Path $sourceDir $file
    $dest = Join-Path $destDir $file
    
    if (Test-Path $source) {
        Copy-Item $source -Destination $dest -Force
        $size = [math]::Round((Get-Item $dest).Length / 1MB, 2)
        Write-Host "✅ $file ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "❌ 未找到: $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 完成！现在可以运行构建了。" -ForegroundColor Green
