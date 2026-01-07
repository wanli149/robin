# 🚀 采集引擎部署指南

## 快速开始

### 1. 运行数据库迁移

```bash
# 本地环境
wrangler d1 execute robin-db --local --file=./migrations/005_add_quality_score.sql

# 生产环境
wrangler d1 execute robin-db --remote --file=./migrations/005_add_quality_score.sql
```

### 2. 配置环境变量

在 `.dev.vars` 文件中添加（可选）：

```env
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
```

### 3. 启动服务

```bash
npm run dev
```

### 4. 测试采集功能

```powershell
# Windows PowerShell
.\test_collector.ps1

# 或使用 Bash
bash test_collector.sh
```

---

## 配置定时任务

在 `wrangler.toml` 中添加：

```toml
[triggers]
crons = ["0 */6 * * *"]  # 每6小时运行一次
```

定时任务会自动执行：
- **每小时**：增量采集（小批量）
- **每天凌晨2点**：增量采集（大批量）+ URL验证 + 日志清理
- **每周日凌晨3点**：全量采集 + 合并重复 + 清理失效视频 + 重建索引
- **每6小时**：健康检查 + 告警

---

## API 接口

### 手动触发采集

```bash
POST /admin/collect/trigger
Authorization: Bearer YOUR_ADMIN_KEY
Content-Type: application/json

{
  "taskType": "incremental",  # incremental | full | update
  "category": "1",            # 可选：分类ID
  "limit": 100                # 可选：限制数量
}
```

### 查看采集统计

```bash
GET /admin/collect/stats
Authorization: Bearer YOUR_ADMIN_KEY
```

### 查看性能指标

```bash
GET /admin/collect/metrics
Authorization: Bearer YOUR_ADMIN_KEY
```

### 查看采集任务历史

```bash
GET /admin/collect/tasks?page=1
Authorization: Bearer YOUR_ADMIN_KEY
```

### 合并重复视频

```bash
POST /admin/collect/migrate
Authorization: Bearer YOUR_ADMIN_KEY
```

---

## 监控和告警

### 查看实时日志

```bash
wrangler tail
```

### 查看数据库

```bash
# 查看视频数量
wrangler d1 execute robin-db --local --command="SELECT COUNT(*) FROM vod_cache"

# 查看质量分布
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
GROUP BY quality_level
"

# 查看最近采集任务
wrangler d1 execute robin-db --local --command="
SELECT * FROM collect_tasks 
ORDER BY created_at DESC 
LIMIT 5
"
```

### 配置钉钉告警

1. 创建钉钉机器人
2. 获取 Webhook URL
3. 添加到环境变量：`DINGTALK_WEBHOOK`
4. 系统会在以下情况发送告警：
   - 有效视频率 < 80%
   - 平均质量分 < 60
   - 任务成功率 < 80%
   - 今日无新增视频

---

## 性能优化建议

### 1. 调整并发参数

在 `vod_collector.ts` 中：

```typescript
const BATCH_SIZE = 10;        // 批量大小：5-20
const CONCURRENT_LIMIT = 3;   // 并发数：2-5
const DETAIL_INTERVAL = 200;  // 详情间隔：100-300ms
const SAVE_INTERVAL = 100;    // 保存间隔：50-200ms
```

### 2. 调整重试策略

```typescript
const MAX_RETRIES = 3;        // 重试次数：2-5
const TIMEOUT = 10000;        // 超时时间：5000-15000ms
```

### 3. 数据库优化

```sql
-- 定期分析表
ANALYZE vod_cache;

-- 检查索引使用情况
EXPLAIN QUERY PLAN SELECT * FROM vod_cache WHERE type_id = 1;
```

---

## 故障排查

### 采集失败

1. 检查资源站是否可访问
2. 查看错误日志：`wrangler tail`
3. 检查网络超时设置
4. 验证 API 格式是否变化

### 数据质量低

1. 查看质量分布
2. 检查资源站数据完整性
3. 调整质量评分权重
4. 手动修复低质量数据

### 性能问题

1. 减少并发数
2. 增加请求间隔
3. 使用增量采集
4. 清理无效数据

---

## 最佳实践

1. **增量采集为主**：每小时或每天增量采集，减少资源消耗
2. **定期全量采集**：每周一次全量采集，确保数据完整
3. **及时清理**：定期清理失效视频和过期日志
4. **监控告警**：配置钉钉告警，及时发现问题
5. **数据备份**：定期导出重要数据

---

## 升级指南

### 从旧版本升级

1. 备份数据库
2. 运行迁移脚本
3. 更新代码
4. 测试采集功能
5. 部署到生产环境

```bash
# 1. 备份
wrangler d1 backup create robin-db

# 2. 迁移
wrangler d1 execute robin-db --remote --file=./migrations/005_add_quality_score.sql

# 3. 部署
wrangler deploy
```

---

## 常见问题

**Q: 采集速度太慢？**  
A: 增加并发数和批量大小，但注意不要被资源站限流。

**Q: 数据重复？**  
A: 运行合并脚本：`POST /admin/collect/migrate`

**Q: 质量评分不准确？**  
A: 调整评分权重，或手动修正数据。

**Q: 定时任务不执行？**  
A: 检查 `wrangler.toml` 中的 cron 配置，确保格式正确。

---

## 技术支持

- 查看日志：`wrangler tail`
- 查看文档：`COLLECTOR_OPTIMIZATION.md`
- 性能监控：`GET /admin/collect/metrics`
