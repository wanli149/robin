# media_kit 原生库下载脚本
# 由于网络问题，可能需要手动下载或使用代理

$version = "v1.1.7"
$baseUrl = "https://github.com/media-kit/libmpv-android-video-build/releases/download/$version"
$outputDir = "build\media_kit_libs_android_video\$version"

# 需要下载的文件
$files = @(
    "default-arm64-v8a.jar",
    "default-armeabi-v7a.jar",
    "default-x86_64.jar",
    "default-x86.jar"
)

# 创建输出目录
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force
}

Write-Host "下载 media_kit 原生库..."
Write-Host "版本: $version"
Write-Host "输出目录: $outputDir"
Write-Host ""

foreach ($file in $files) {
    $url = "$baseUrl/$file"
    $output = "$outputDir\$file"
    
    Write-Host "下载: $file"
    Write-Host "URL: $url"
    
    try {
        # 使用 Invoke-WebRequest 下载
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
        Write-Host "成功: $file" -ForegroundColor Green
    } catch {
        Write-Host "失败: $file - $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "如果下载失败，请手动下载以下文件并放到 $outputDir 目录："
        Write-Host $url
    }
    Write-Host ""
}

Write-Host "完成！"
Write-Host ""
Write-Host "如果下载失败，可以尝试："
Write-Host "1. 使用 VPN 或代理"
Write-Host "2. 手动从浏览器下载文件"
Write-Host "3. 从镜像站点下载"
