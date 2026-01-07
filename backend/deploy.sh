#!/bin/bash

# 拾光影视后端部署脚本
# 用于快速部署和更新

set -e

echo "🚀 拾光影视后端部署脚本"
echo "=========================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查环境
check_environment() {
    echo -e "${YELLOW}📋 检查环境...${NC}"
    
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}❌ 未找到 npx，请先安装 Node.js${NC}"
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        echo -e "${YELLOW}⚠️  未找到 wrangler，正在安装...${NC}"
        npm install -g wrangler
    fi
    
    echo -e "${GREEN}✅ 环境检查完成${NC}"
}

# 应用数据库迁移
apply_migrations() {
    echo -e "${YELLOW}📦 应用数据库迁移...${NC}"
    
    if [ "$1" == "local" ]; then
        echo "本地环境..."
        npx wrangler d1 execute robin-db --local --file=./migrations/001_add_module_enable.sql
    else
        echo "生产环境..."
        npx wrangler d1 execute robin-db --remote --file=./migrations/001_add_module_enable.sql
    fi
    
    echo -e "${GREEN}✅ 数据库迁移完成${NC}"
}

# 导入示例数据
seed_data() {
    echo -e "${YELLOW}🌱 导入示例数据...${NC}"
    
    if [ "$1" == "local" ]; then
        echo "本地环境..."
        npx wrangler d1 execute robin-db --local --file=./seed_layout.sql
    else
        echo "生产环境..."
        read -p "⚠️  这将覆盖生产环境的布局配置，确定继续？(y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npx wrangler d1 execute robin-db --remote --file=./seed_layout.sql
        else
            echo "已取消"
            return
        fi
    fi
    
    echo -e "${GREEN}✅ 示例数据导入完成${NC}"
}

# 部署到 Cloudflare
deploy() {
    echo -e "${YELLOW}🚢 部署到 Cloudflare Workers...${NC}"
    
    npx wrangler deploy
    
    echo -e "${GREEN}✅ 部署完成${NC}"
}

# 主菜单
main_menu() {
    echo ""
    echo "请选择操作："
    echo "1) 本地开发环境初始化"
    echo "2) 生产环境部署"
    echo "3) 仅应用数据库迁移（本地）"
    echo "4) 仅应用数据库迁移（生产）"
    echo "5) 仅导入示例数据（本地）"
    echo "6) 仅导入示例数据（生产）"
    echo "7) 退出"
    echo ""
    read -p "请输入选项 (1-7): " choice
    
    case $choice in
        1)
            echo -e "${GREEN}🔧 初始化本地开发环境${NC}"
            check_environment
            apply_migrations "local"
            seed_data "local"
            echo -e "${GREEN}✅ 本地环境初始化完成！${NC}"
            echo -e "${YELLOW}💡 运行 'npm run dev' 启动开发服务器${NC}"
            ;;
        2)
            echo -e "${GREEN}🚀 部署到生产环境${NC}"
            check_environment
            apply_migrations "production"
            deploy
            echo -e "${GREEN}✅ 生产环境部署完成！${NC}"
            ;;
        3)
            check_environment
            apply_migrations "local"
            ;;
        4)
            check_environment
            apply_migrations "production"
            ;;
        5)
            check_environment
            seed_data "local"
            ;;
        6)
            check_environment
            seed_data "production"
            ;;
        7)
            echo "👋 再见！"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ 无效选项${NC}"
            main_menu
            ;;
    esac
}

# 运行主菜单
check_environment
main_menu
