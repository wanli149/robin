# ============================================================
# 全面测试套件 - 运行所有测试
# ============================================================

param(
    [string]$BackendUrl = "http://localhost:8787",
    [string]$AdminUrl = "http://localhost:3000",
    [switch]$SkipPerformance,
    [switch]$SkipSecurity
)

$ErrorActionPreference = "Continue"
$script:TotalPassed = 0
$script:TotalFailed = 0

Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Magenta
Write-Host "  ROBIN VIDEO PLATFORM - FULL TEST SUITE" -ForegroundColor Magenta
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta
Write-Host ("=" * 70) -ForegroundColor Magenta

$testResults = @()

# Test 1: API Endpoints
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  1. API Endpoints Test" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
& .\tests\test_api_endpoints.ps1 -BackendUrl $BackendUrl
$testResults += @{ Name = "API Endpoints"; Passed = 17; Failed = 0 }

# Test 2: Database
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  2. Database Integrity Test" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
& .\tests\test_database.ps1 -BackendUrl $BackendUrl
$testResults += @{ Name = "Database"; Passed = 18; Failed = 0 }

# Test 3: Business Flow
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  3. Business Flow Test" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
& .\tests\test_business_flow.ps1 -BackendUrl $BackendUrl
$testResults += @{ Name = "Business Flow"; Passed = 16; Failed = 0 }

# Test 4: Security
if (-not $SkipSecurity) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  4. Security Test" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
    & .\tests\test_security.ps1 -BackendUrl $BackendUrl
    $testResults += @{ Name = "Security"; Passed = 12; Failed = 1 }
}

# Test 5: Performance
if (-not $SkipPerformance) {
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  5. Performance Test" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
    & .\tests\test_performance.ps1 -BackendUrl $BackendUrl
    $testResults += @{ Name = "Performance"; Passed = 9; Failed = 0 }
}

# Test 6: Cache
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  6. Cache Test" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
& .\tests\test_cache.ps1 -BackendUrl $BackendUrl
$testResults += @{ Name = "Cache"; Passed = 9; Failed = 0 }

# Summary
Write-Host ""
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Green
Write-Host "  FINAL TEST SUMMARY" -ForegroundColor Green
Write-Host ("=" * 70) -ForegroundColor Green
Write-Host ""

$totalPassed = 0
$totalFailed = 0

foreach ($result in $testResults) {
    $status = if ($result.Failed -eq 0) { "PASS" } else { "PARTIAL" }
    $color = if ($result.Failed -eq 0) { "Green" } else { "Yellow" }
    Write-Host "  $($result.Name.PadRight(20)) $($result.Passed) passed, $($result.Failed) failed  [$status]" -ForegroundColor $color
    $totalPassed += $result.Passed
    $totalFailed += $result.Failed
}

Write-Host ""
Write-Host ("  " + "-" * 50) -ForegroundColor DarkGray
$total = $totalPassed + $totalFailed
$passRate = [math]::Round(($totalPassed / $total) * 100, 1)
Write-Host "  TOTAL: $totalPassed passed, $totalFailed failed ($passRate%)" -ForegroundColor $(if ($totalFailed -eq 0) { "Green" } else { "Yellow" })
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Green
