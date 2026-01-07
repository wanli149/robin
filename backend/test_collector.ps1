# 采集引擎测试脚本 (PowerShell版本)
# 用于测试优化后的采集功能

Write-Host "🚀 采集引擎测试脚本" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host ""

# 配置
$API_URL = "http://localhost:8787"
$ADMIN_KEY = "your_admin_secret_key"

# 1. 检查服务状态
Write-Host "📡 检查服务状态..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/api/health" -Method GET -ErrorAction Stop
    Write-Host "✓ 服务运行正常" -ForegroundColor Green
} catch {
    Write-Host "✗ 服务未启动" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. 查看采集统计
Write-Host "📊 查看采集统计..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $ADMIN_KEY"
}
$stats = Invoke-RestMethod -Uri "$API_URL/admin/collect/stats" -Headers $headers
$stats | ConvertTo-Json -Depth 10
Write-Host ""

# 3. 触发增量采集（测试）
Write-Host "🔄 触发增量采集（限制10条）..." -ForegroundColor Yellow
$body = @{
    taskType = "incremental"
    limit = 10
} | ConvertTo-Json

$headers["Content-Type"] = "application/json"
$taskResponse = Invoke-RestMethod -Uri "$API_URL/admin/collect/trigger" -Method POST -Headers $headers -Body $body
$taskResponse | ConvertTo-Json

if ($taskResponse.code -eq 1) {
    Write-Host "✓ 采集任务已触发" -ForegroundColor Green
} else {
    Write-Host "✗ 采集任务触发失败" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. 等待任务完成
Write-Host "⏳ 等待任务完成（10秒）..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host ""

# 5. 查看任务历史
Write-Host "📜 查看最近的采集任务..." -ForegroundColor Yellow
$tasks = Invoke-RestMethod -Uri "$API_URL/admin/collect/tasks?page=1" -Headers @{"Authorization" = "Bearer $ADMIN_KEY"}
$tasks.list[0] | ConvertTo-Json
Write-Host ""

# 6. 测试搜索功能
Write-Host "🔍 测试搜索功能..." -ForegroundColor Yellow
$searchResult = Invoke-RestMethod -Uri "$API_URL/api/search_cache?wd=三体&limit=5"
Write-Host "搜索结果数量: $($searchResult.list.Count)"
Write-Host ""

# 7. 查看数据质量
Write-Host "📈 查看数据质量分布..." -ForegroundColor Yellow
Write-Host "（需要手动在数据库中查询）" -ForegroundColor Gray
Write-Host @"
wrangler d1 execute robin-db --local --command="
SELECT 
  CASE 
    WHEN quality_score >= 80 THEN '优秀(80+)'
    WHEN quality_score >= 60 THEN '良好(60-79)'
    WHEN quality_score >= 40 THEN '一般(40-59)'
    ELSE '较差(<40)'
  END as quality_level,
  COUNT(*) as count
FROM vod_cache
GROUP BY quality_level;
"
"@ -ForegroundColor Gray
Write-Host ""

Write-Host "✅ 测试完成！" -ForegroundColor Green
Write-Host ""
Write-Host "💡 提示：" -ForegroundColor Cyan
Write-Host "  - 查看完整日志：wrangler tail"
Write-Host "  - 查看数据库：wrangler d1 execute robin-db --local --command='SELECT * FROM vod_cache LIMIT 5'"
Write-Host "  - 查看采集任务：访问管理后台"
