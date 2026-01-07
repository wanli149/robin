#!/bin/bash

# 采集引擎测试脚本
# 用于测试优化后的采集功能

echo "🚀 采集引擎测试脚本"
echo "===================="
echo ""

# 配置
API_URL="http://localhost:8787"
ADMIN_KEY="your_admin_secret_key"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查服务状态
echo "📡 检查服务状态..."
if curl -s "$API_URL/api/health" > /dev/null; then
    echo -e "${GREEN}✓ 服务运行正常${NC}"
else
    echo -e "${RED}✗ 服务未启动${NC}"
    exit 1
fi
echo ""

# 2. 查看采集统计
echo "📊 查看采集统计..."
curl -s "$API_URL/admin/collect/stats" \
    -H "Authorization: Bearer $ADMIN_KEY" | jq '.'
echo ""

# 3. 触发增量采集（测试）
echo "🔄 触发增量采集（限制10条）..."
TASK_RESPONSE=$(curl -s -X POST "$API_URL/admin/collect/trigger" \
    -H "Authorization: Bearer $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d '{"taskType": "incremental", "limit": 10}')

echo "$TASK_RESPONSE" | jq '.'

if echo "$TASK_RESPONSE" | jq -e '.code == 1' > /dev/null; then
    echo -e "${GREEN}✓ 采集任务已触发${NC}"
else
    echo -e "${RED}✗ 采集任务触发失败${NC}"
    exit 1
fi
echo ""

# 4. 等待任务完成
echo "⏳ 等待任务完成（10秒）..."
sleep 10
echo ""

# 5. 查看任务历史
echo "📜 查看最近的采集任务..."
curl -s "$API_URL/admin/collect/tasks?page=1" \
    -H "Authorization: Bearer $ADMIN_KEY" | jq '.list[0]'
echo ""

# 6. 测试搜索功能
echo "🔍 测试搜索功能..."
curl -s "$API_URL/api/search_cache?wd=三体&limit=5" | jq '.list | length'
echo ""

# 7. 查看数据质量
echo "📈 查看数据质量分布..."
echo "（需要手动在数据库中查询）"
echo "SELECT "
echo "  CASE "
echo "    WHEN quality_score >= 80 THEN '优秀(80+)'"
echo "    WHEN quality_score >= 60 THEN '良好(60-79)'"
echo "    WHEN quality_score >= 40 THEN '一般(40-59)'"
echo "    ELSE '较差(<40)'"
echo "  END as quality_level,"
echo "  COUNT(*) as count"
echo "FROM vod_cache"
echo "GROUP BY quality_level;"
echo ""

echo -e "${GREEN}✅ 测试完成！${NC}"
echo ""
echo "💡 提示："
echo "  - 查看完整日志：wrangler tail"
echo "  - 查看数据库：wrangler d1 execute robin-db --local --command='SELECT * FROM vod_cache LIMIT 5'"
echo "  - 查看采集任务：访问管理后台"
