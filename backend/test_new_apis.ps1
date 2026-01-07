# PowerShell版本的API测试脚本
# 使用方法: .\test_new_apis.ps1 -BaseUrl "http://localhost:8787"

param(
    [string]$BaseUrl = "http://localhost:8787"
)

Write-Host "🧪 测试新增接口" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host ""

function Test-Api {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null
    )
    
    Write-Host "Testing $Name... " -NoNewline
    
    try {
        $url = "$BaseUrl$Endpoint"
        
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
        } else {
            $headers = @{
                "Content-Type" = "application/json"
            }
            $response = Invoke-RestMethod -Uri $url -Method $Method -Body $Data -Headers $headers -ErrorAction Stop
        }
        
        Write-Host "✅ PASS" -ForegroundColor Green
        Write-Host "   Response: $($response | ConvertTo-Json -Compress -Depth 2)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ FAIL" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "1️⃣  测试崩溃上报接口" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$crashData = @{
    error = "Test crash error"
    stack_trace = "at main.dart:123`nat app.dart:456"
    context = "Test Context"
    device_info = @{
        platform = "Android"
        version = "1.0.0"
    }
    timestamp = "2024-12-09T10:00:00Z"
} | ConvertTo-Json

Test-Api -Name "崩溃上报" -Method "POST" -Endpoint "/api/system/crash_report" -Data $crashData

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "2️⃣  测试播放失效上报接口" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

$invalidData = @{
    vod_id = "test_123"
    vod_name = "测试视频"
    play_url = "https://example.com/video.m3u8"
    error_type = "timeout"
} | ConvertTo-Json

Test-Api -Name "播放失效上报" -Method "POST" -Endpoint "/api/report_invalid" -Data $invalidData

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "3️⃣  测试缓存搜索接口" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Test-Api -Name "缓存搜索" -Method "GET" -Endpoint "/api/search_cache?wd=三体&limit=5"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "4️⃣  测试闪屏广告接口" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Test-Api -Name "闪屏广告" -Method "GET" -Endpoint "/api/ads/splash"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "5️⃣  测试热搜关键词接口" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Test-Api -Name "热搜关键词" -Method "GET" -Endpoint "/api/hot_search"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "6️⃣  测试实时搜索接口（对比）" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

Test-Api -Name "实时搜索" -Method "GET" -Endpoint "/api/search?wd=三体"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ 测试完成！" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "💡 提示：" -ForegroundColor Cyan
Write-Host "  - 如果缓存搜索返回空，说明数据库中还没有缓存数据" -ForegroundColor Gray
Write-Host "  - 如果闪屏广告返回null，说明广告表中还没有数据" -ForegroundColor Gray
Write-Host "  - 可以通过管理后台添加广告和采集视频数据" -ForegroundColor Gray
Write-Host ""
