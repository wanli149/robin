# 拾光影视后端部署脚本 (PowerShell)
# 用于 Windows 环境快速部署到 Cloudflare Workers

Write-Host "🚀 拾光影视 - Cloudflare Workers 部署脚本" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📍 部署目标：Cloudflare 全球边缘网络" -ForegroundColor Gray
Write-Host ""

# 检查环境
function Check-Environment {
    Write-Host "📋 检查环境..." -ForegroundColor Yellow
    
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        Write-Host "❌ 未找到 npx，请先安装 Node.js" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
        Write-Host "⚠️  未找到 wrangler，正在安装..." -ForegroundColor Yellow
        npm install -g wrangler
    }
    
    Write-Host "✅ 环境检查完成" -ForegroundColor Green
}

# 应用数据库迁移
function Apply-Migrations {
    param([string]$Environment)
    
    Write-Host "📦 应用数据库迁移..." -ForegroundColor Yellow
    
    if ($Environment -eq "local") {
        Write-Host "本地环境..." -ForegroundColor Cyan
        npx wrangler d1 execute robin-db --local --file=./migrations/001_add_module_enable.sql
    } else {
        Write-Host "生产环境..." -ForegroundColor Cyan
        npx wrangler d1 execute robin-db --remote --file=./migrations/001_add_module_enable.sql
    }
    
    Write-Host "✅ 数据库迁移完成" -ForegroundColor Green
}

# 导入示例数据
function Seed-Data {
    param([string]$Environment)
    
    Write-Host "🌱 导入示例数据..." -ForegroundColor Yellow
    
    if ($Environment -eq "local") {
        Write-Host "本地环境..." -ForegroundColor Cyan
        npx wrangler d1 execute robin-db --local --file=./seed_layout.sql
    } else {
        Write-Host "生产环境..." -ForegroundColor Cyan
        $confirm = Read-Host "⚠️  这将覆盖生产环境的布局配置，确定继续？(y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            npx wrangler d1 execute robin-db --remote --file=./seed_layout.sql
        } else {
            Write-Host "已取消" -ForegroundColor Yellow
            return
        }
    }
    
    Write-Host "✅ 示例数据导入完成" -ForegroundColor Green
}

# 部署到 Cloudflare
function Deploy-ToCloudflare {
    Write-Host "🚢 部署到 Cloudflare Workers 全球边缘网络..." -ForegroundColor Yellow
    
    # 检查是否已登录
    $loginCheck = npx wrangler whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  未登录 Cloudflare，正在打开登录页面..." -ForegroundColor Yellow
        npx wrangler login
    }
    
    # 部署
    npx wrangler deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ 部署成功！" -ForegroundColor Green
        Write-Host "🌐 你的 API 已部署到全球 300+ 个边缘节点" -ForegroundColor Cyan
        Write-Host "📊 查看监控：https://dash.cloudflare.com/" -ForegroundColor Gray
        Write-Host "📝 查看日志：wrangler tail" -ForegroundColor Gray
    } else {
        Write-Host "❌ 部署失败，请检查错误信息" -ForegroundColor Red
    }
}

# 主菜单
function Show-MainMenu {
    Write-Host ""
    Write-Host "请选择操作：" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "  本地开发" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "1) 🔧 初始化本地开发环境（首次运行）"
    Write-Host "3) 📦 应用数据库迁移（本地）"
    Write-Host "5) 🌱 导入示例数据（本地）"
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "  Cloudflare 生产环境" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "2) 🚀 部署到 Cloudflare Workers"
    Write-Host "4) 📦 应用数据库迁移（生产 D1）"
    Write-Host "6) 🌱 导入示例数据（生产 D1）"
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "7) 👋 退出"
    Write-Host ""
    
    $choice = Read-Host "请输入选项 (1-7)"
    
    switch ($choice) {
        "1" {
            Write-Host ""
            Write-Host "🔧 初始化本地开发环境" -ForegroundColor Green
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
            Check-Environment
            Apply-Migrations -Environment "local"
            Seed-Data -Environment "local"
            Write-Host ""
            Write-Host "✅ 本地环境初始化完成！" -ForegroundColor Green
            Write-Host "💡 下一步：运行 'npm run dev' 启动开发服务器" -ForegroundColor Yellow
            Write-Host "🌐 访问：http://localhost:8787" -ForegroundColor Cyan
        }
        "2" {
            Write-Host ""
            Write-Host "🚀 部署到 Cloudflare Workers" -ForegroundColor Green
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
            Check-Environment
            
            Write-Host ""
            Write-Host "⚠️  部署前检查清单：" -ForegroundColor Yellow
            Write-Host "  ✓ wrangler.toml 中的 database_id 已更新？"
            Write-Host "  ✓ wrangler.toml 中的 KV id 已更新？"
            Write-Host "  ✓ 已运行数据库迁移？"
            Write-Host ""
            
            $confirm = Read-Host "确认继续部署？(y/N)"
            if ($confirm -eq "y" -or $confirm -eq "Y") {
                Deploy-ToCloudflare
            } else {
                Write-Host "已取消部署" -ForegroundColor Yellow
            }
        }
        "3" {
            Check-Environment
            Apply-Migrations -Environment "local"
        }
        "4" {
            Check-Environment
            Apply-Migrations -Environment "production"
        }
        "5" {
            Check-Environment
            Seed-Data -Environment "local"
        }
        "6" {
            Check-Environment
            Seed-Data -Environment "production"
        }
        "7" {
            Write-Host "👋 再见！" -ForegroundColor Cyan
            exit 0
        }
        default {
            Write-Host "❌ 无效选项" -ForegroundColor Red
            Show-MainMenu
        }
    }
}

# 运行主菜单
Check-Environment
Show-MainMenu
