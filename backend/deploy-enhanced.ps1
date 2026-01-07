# 拾光影视 - Cloudflare Workers 增强部署脚本
# 功能：自动化部署、环境检查、数据库管理、监控

param(
    [string]$Action = "menu",
    [switch]$Force,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success { param([string]$msg) Write-ColorOutput "✅ $msg" "Green" }
function Write-Info { param([string]$msg) Write-ColorOutput "ℹ️  $msg" "Cyan" }
function Write-Warning { param([string]$msg) Write-ColorOutput "⚠️  $msg" "Yellow" }
function Write-Error { param([string]$msg) Write-ColorOutput "❌ $msg" "Red" }
function Write-Step { param([string]$msg) Write-ColorOutput "🔹 $msg" "Blue" }

# 显示横幅
function Show-Banner {
    Write-Host ""
    Write-ColorOutput "╔════════════════════════════════════════════════════════╗" "Cyan"
    Write-ColorOutput "║   拾光影视 - Cloudflare Workers 部署工具 v2.0        ║" "Cyan"
    Write-ColorOutput "║   Serverless • 全球边缘网络 • 零冷启动               ║" "Cyan"
    Write-ColorOutput "╚════════════════════════════════════════════════════════╝" "Cyan"
    Write-Host ""
}

# 检查环境
function Test-Environment {
    Write-Step "检查部署环境..."
    
    # 检查 Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "未安装 Node.js"
        return $false
    }
    $nodeVersion = node --version
    Write-Info "Node.js: $nodeVersion"
    
    # 检查 npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "未安装 npm"
        return $false
    }
    
    # 检查 wrangler
    if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
        Write-Warning "未安装 wrangler，正在安装..."
        npm install -g wrangler
    }
    $wranglerVersion = wrangler --version
    Write-Info "Wrangler: $wranglerVersion"
    
    # 检查登录状态
    $loginCheck = wrangler whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "未登录 Cloudflare"
        return $false
    }
    
    Write-Success "环境检查通过"
    return $true
}

# 检查配置文件
function Test-Configuration {
    Write-Step "检查配置文件..."
    
    if (-not (Test-Path "wrangler.toml")) {
        Write-Error "未找到 wrangler.toml"
        return $false
    }
    
    if (-not (Test-Path "schema.sql")) {
        Write-Error "未找到 schema.sql"
        return $false
    }
    
    if (-not (Test-Path ".dev.vars")) {
        Write-Warning "未找到 .dev.vars，将使用默认配置"
    }
    
    Write-Success "配置文件检查通过"
    return $true
}

# 本地开发环境初始化
function Initialize-LocalEnvironment {
    Write-ColorOutput "`n═══════════════════════════════════════" "Cyan"
    Write-ColorOutput "  本地开发环境初始化" "Cyan"
    Write-ColorOutput "═══════════════════════════════════════`n" "Cyan"
    
    # 安装依赖
    Write-Step "安装 npm 依赖..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "依赖安装失败"
        return
    }
    
    # 初始化本地数据库
    Write-Step "初始化本地 D1 数据库..."
    wrangler d1 execute robin-db --local --file=./schema.sql
    if ($LASTEXITCODE -ne 0) {
        Write-Error "数据库初始化失败"
        return
    }
    
    # 应用迁移
    if (Test-Path "migrations") {
        Write-Step "应用数据库迁移..."
        Get-ChildItem "migrations\*.sql" | ForEach-Object {
            Write-Info "应用迁移: $($_.Name)"
            wrangler d1 execute robin-db --local --file=$($_.FullName)
        }
    }
    
    # 导入示例数据（可选）
    if (Test-Path "seed_layout.sql") {
        $importSeed = Read-Host "是否导入示例布局数据？(y/N)"
        if ($importSeed -eq "y" -or $importSeed -eq "Y") {
            Write-Step "导入示例数据..."
            wrangler d1 execute robin-db --local --file=./seed_layout.sql
        }
    }
    
    Write-Success "本地环境初始化完成！"
    Write-Info "运行 'npm run dev' 启动开发服务器"
}

# 生产环境部署
function Deploy-Production {
    Write-ColorOutput "`n═══════════════════════════════════════" "Cyan"
    Write-ColorOutput "  部署到 Cloudflare 生产环境" "Cyan"
    Write-ColorOutput "═══════════════════════════════════════`n" "Cyan"
    
    # 部署前检查
    Write-Step "部署前检查..."
    
    # 检查 wrangler.toml 配置
    $tomlContent = Get-Content "wrangler.toml" -Raw
    if ($tomlContent -match 'database_id\s*=\s*"local-db"') {
        Write-Error "wrangler.toml 中的 database_id 仍为 'local-db'"
        Write-Warning "请先创建生产数据库并更新 database_id"
        Write-Info "运行: wrangler d1 create robin-db"
        return
    }
    
    if ($tomlContent -match 'id\s*=\s*"local-kv"') {
        Write-Error "wrangler.toml 中的 KV id 仍为 'local-kv'"
        Write-Warning "请先创建生产 KV 并更新 id"
        Write-Info "运行: wrangler kv:namespace create ROBIN_CACHE"
        return
    }
    
    # 确认部署
    if (-not $Force) {
        Write-Warning "即将部署到生产环境！"
        Write-Info "这将更新全球 300+ 个边缘节点"
        $confirm = Read-Host "确认继续？(yes/N)"
        if ($confirm -ne "yes") {
            Write-Info "已取消部署"
            return
        }
    }
    
    # 运行测试（可选）
    if (-not $SkipTests -and (Test-Path "package.json")) {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.test) {
            Write-Step "运行测试..."
            npm test
            if ($LASTEXITCODE -ne 0) {
                Write-Error "测试失败，部署已取消"
                return
            }
        }
    }
    
    # 部署
    Write-Step "部署到 Cloudflare Workers..."
    wrangler deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "部署成功！"
        Write-Info "API 已部署到全球边缘网络"
        Write-Info "查看监控：https://dash.cloudflare.com/"
        Write-Info "查看日志：wrangler tail"
    } else {
        Write-Error "部署失败"
    }
}

# 数据库管理
function Manage-Database {
    Write-ColorOutput "`n═══════════════════════════════════════" "Cyan"
    Write-ColorOutput "  数据库管理" "Cyan"
    Write-ColorOutput "═══════════════════════════════════════`n" "Cyan"
    
    Write-Host "1) 查询本地数据库"
    Write-Host "2) 查询生产数据库"
    Write-Host "3) 导出本地数据"
    Write-Host "4) 导出生产数据"
    Write-Host "5) 应用迁移（本地）"
    Write-Host "6) 应用迁移（生产）"
    Write-Host "7) 重置本地数据库"
    Write-Host "8) 返回主菜单"
    Write-Host ""
    
    $choice = Read-Host "请选择"
    
    switch ($choice) {
        "1" {
            $sql = Read-Host "输入 SQL 查询"
            wrangler d1 execute robin-db --local --command="$sql"
        }
        "2" {
            $sql = Read-Host "输入 SQL 查询"
            wrangler d1 execute robin-db --remote --command="$sql"
        }
        "3" {
            $table = Read-Host "输入表名（留空导出所有）"
            if ($table) {
                wrangler d1 execute robin-db --local --command="SELECT * FROM $table"
            } else {
                Write-Info "导出所有表..."
                wrangler d1 execute robin-db --local --command=".dump"
            }
        }
        "4" {
            $table = Read-Host "输入表名（留空导出所有）"
            if ($table) {
                wrangler d1 execute robin-db --remote --command="SELECT * FROM $table"
            } else {
                Write-Info "导出所有表..."
                wrangler d1 execute robin-db --remote --command=".dump"
            }
        }
        "5" {
            if (Test-Path "migrations") {
                Get-ChildItem "migrations\*.sql" | ForEach-Object {
                    Write-Info "应用: $($_.Name)"
                    wrangler d1 execute robin-db --local --file=$($_.FullName)
                }
                Write-Success "迁移完成"
            }
        }
        "6" {
            Write-Warning "即将应用迁移到生产数据库！"
            $confirm = Read-Host "确认继续？(yes/N)"
            if ($confirm -eq "yes") {
                if (Test-Path "migrations") {
                    Get-ChildItem "migrations\*.sql" | ForEach-Object {
                        Write-Info "应用: $($_.Name)"
                        wrangler d1 execute robin-db --remote --file=$($_.FullName)
                    }
                    Write-Success "迁移完成"
                }
            }
        }
        "7" {
            Write-Warning "这将删除所有本地数据！"
            $confirm = Read-Host "确认继续？(yes/N)"
            if ($confirm -eq "yes") {
                wrangler d1 execute robin-db --local --file=./schema.sql
                Write-Success "数据库已重置"
            }
        }
    }
}

# 缓存管理
function Manage-Cache {
    Write-ColorOutput "`n═══════════════════════════════════════" "Cyan"
    Write-ColorOutput "  KV 缓存管理" "Cyan"
    Write-ColorOutput "═══════════════════════════════════════`n" "Cyan"
    
    Write-Host "1) 列出本地 KV keys"
    Write-Host "2) 列出生产 KV keys"
    Write-Host "3) 获取 key 值（本地）"
    Write-Host "4) 获取 key 值（生产）"
    Write-Host "5) 删除 key（本地）"
    Write-Host "6) 删除 key（生产）"
    Write-Host "7) 清空所有缓存（生产）"
    Write-Host "8) 返回主菜单"
    Write-Host ""
    
    $choice = Read-Host "请选择"
    
    switch ($choice) {
        "1" {
            wrangler kv:key list --binding=ROBIN_CACHE --local
        }
        "2" {
            wrangler kv:key list --binding=ROBIN_CACHE
        }
        "3" {
            $key = Read-Host "输入 key"
            wrangler kv:key get $key --binding=ROBIN_CACHE --local
        }
        "4" {
            $key = Read-Host "输入 key"
            wrangler kv:key get $key --binding=ROBIN_CACHE
        }
        "5" {
            $key = Read-Host "输入 key"
            wrangler kv:key delete $key --binding=ROBIN_CACHE --local
            Write-Success "已删除"
        }
        "6" {
            $key = Read-Host "输入 key"
            Write-Warning "即将删除生产环境的 key: $key"
            $confirm = Read-Host "确认？(y/N)"
            if ($confirm -eq "y") {
                wrangler kv:key delete $key --binding=ROBIN_CACHE
                Write-Success "已删除"
            }
        }
        "7" {
            Write-Warning "这将清空所有生产缓存！"
            $confirm = Read-Host "确认继续？(yes/N)"
            if ($confirm -eq "yes") {
                # 清除布局缓存
                $tabs = @("featured", "movie", "series", "netflix", "shorts", "anime", "variety", "welfare")
                foreach ($tab in $tabs) {
                    wrangler kv:key delete "layout:$tab" --binding=ROBIN_CACHE 2>$null
                }
                wrangler kv:key delete "home_tabs" --binding=ROBIN_CACHE 2>$null
                Write-Success "缓存已清空"
            }
        }
    }
}

# 监控和日志
function Show-Monitoring {
    Write-ColorOutput "`n═══════════════════════════════════════" "Cyan"
    Write-ColorOutput "  监控和日志" "Cyan"
    Write-ColorOutput "═══════════════════════════════════════`n" "Cyan"
    
    Write-Host "1) 实时查看日志"
    Write-Host "2) 查看最近错误"
    Write-Host "3) 查看性能指标"
    Write-Host "4) 打开 Cloudflare Dashboard"
    Write-Host "5) 返回主菜单"
    Write-Host ""
    
    $choice = Read-Host "请选择"
    
    switch ($choice) {
        "1" {
            Write-Info "按 Ctrl+C 停止..."
            wrangler tail
        }
        "2" {
            Write-Info "查看最近的错误日志..."
            wrangler tail --format=pretty --status=error
        }
        "3" {
            Write-Info "打开浏览器查看详细指标..."
            Start-Process "https://dash.cloudflare.com/"
        }
        "4" {
            Start-Process "https://dash.cloudflare.com/"
        }
    }
}

# 环境变量管理
function Manage-Secrets {
    Write-ColorOutput "`n═══════════════════════════════════════" "Cyan"
    Write-ColorOutput "  环境变量管理" "Cyan"
    Write-ColorOutput "═══════════════════════════════════════`n" "Cyan"
    
    Write-Host "1) 设置 JWT_SECRET"
    Write-Host "2) 设置 ADMIN_SECRET_KEY"
    Write-Host "3) 设置 DINGTALK_WEBHOOK"
    Write-Host "4) 设置 TMDB_API_KEY"
    Write-Host "5) 设置 DOUBAN_API_KEY"
    Write-Host "6) 列出所有环境变量"
    Write-Host "7) 返回主菜单"
    Write-Host ""
    
    $choice = Read-Host "请选择"
    
    switch ($choice) {
        "1" {
            Write-Info "设置 JWT 密钥..."
            wrangler secret put JWT_SECRET
        }
        "2" {
            Write-Info "设置管理员密钥..."
            wrangler secret put ADMIN_SECRET_KEY
        }
        "3" {
            Write-Info "设置钉钉 Webhook..."
            wrangler secret put DINGTALK_WEBHOOK
        }
        "4" {
            Write-Info "设置 TMDB API Key..."
            wrangler secret put TMDB_API_KEY
        }
        "5" {
            Write-Info "设置豆瓣 API Key..."
            wrangler secret put DOUBAN_API_KEY
        }
        "6" {
            Write-Info "环境变量列表："
            Write-Host "- JWT_SECRET"
            Write-Host "- ADMIN_SECRET_KEY"
            Write-Host "- DINGTALK_WEBHOOK"
            Write-Host "- TMDB_API_KEY"
            Write-Host "- DOUBAN_API_KEY"
            Write-Warning "注意：Cloudflare 不支持列出 secret 的值"
        }
    }
}

# 主菜单
function Show-MainMenu {
    while ($true) {
        Show-Banner
        
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "  本地开发" -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "1) 🔧 初始化本地开发环境"
        Write-Host "2) 🚀 启动本地开发服务器"
        Write-Host "3) 📦 数据库管理（本地/生产）"
        Write-Host "4) 💾 KV 缓存管理"
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "  Cloudflare 生产环境" -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "5) 🌐 部署到 Cloudflare Workers"
        Write-Host "6) 🔑 环境变量管理"
        Write-Host "7) 📊 监控和日志"
        Write-Host "8) ✅ 环境检查"
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "9) 👋 退出"
        Write-Host ""
        
        $choice = Read-Host "请选择"
        
        switch ($choice) {
            "1" { Initialize-LocalEnvironment; Read-Host "按回车继续" }
            "2" { 
                Write-Info "启动开发服务器..."
                Write-Info "访问：http://localhost:8787"
                npm run dev
            }
            "3" { Manage-Database; Read-Host "按回车继续" }
            "4" { Manage-Cache; Read-Host "按回车继续" }
            "5" { Deploy-Production; Read-Host "按回车继续" }
            "6" { Manage-Secrets; Read-Host "按回车继续" }
            "7" { Show-Monitoring; Read-Host "按回车继续" }
            "8" { 
                Test-Environment
                Test-Configuration
                Read-Host "按回车继续"
            }
            "9" { 
                Write-Info "再见！"
                exit 0
            }
            default { Write-Warning "无效选项" }
        }
    }
}

# 主程序入口
if ($Action -eq "menu") {
    Show-MainMenu
} else {
    # 命令行模式
    switch ($Action) {
        "init" { Initialize-LocalEnvironment }
        "deploy" { Deploy-Production }
        "db" { Manage-Database }
        "cache" { Manage-Cache }
        "logs" { wrangler tail }
        "check" { Test-Environment; Test-Configuration }
        default {
            Write-Error "未知操作: $Action"
            Write-Info "可用操作: init, deploy, db, cache, logs, check"
        }
    }
}
