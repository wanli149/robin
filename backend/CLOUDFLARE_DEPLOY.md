# Cloudflare Workers 部署指南

## 🌐 架构说明

本项目采用 **Cloudflare Workers** Serverless 架构：

```
┌─────────────────────────────────────────────────┐
│           Cloudflare 全球边缘网络                │
├─────────────────────────────────────────────────┤
│  Workers (计算)  │  D1 (数据库)  │  KV (缓存)   │
├─────────────────────────────────────────────────┤
│  • 零冷启动      │  • SQLite     │  • 键值存储  │
│  • 全球部署      │  • 关系型     │  • 超低延迟  │
│  • 自动扩展      │  • 事务支持   │  • 高可用    │
└─────────────────────────────────────────────────┘
```

## 📋 前置要求

1. **Cloudflare 账号**（免费版即可）
2. **Node.js** >= 18.0.0
3. **Wrangler CLI** >= 3.0.0

## 🚀 快速开始

### 第一步：安装 Wrangler

```bash
npm install -g wrangler
```

### 第二步：登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器，授权 Wrangler 访问你的 Cloudflare 账号。

### 第三步：创建 D1 数据库

```bash
cd backend

# 创建生产数据库
wrangler d1 create robin-db
```

**重要：** 复制返回的 `database_id`，更新到 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "robin-db"
database_id = "你的-database-id-在这里"  # 替换这里！
```

### 第四步：创建 KV 命名空间

```bash
# 创建生产 KV
wrangler kv:namespace create "ROBIN_CACHE"

# 创建预览 KV（用于测试）
wrangler kv:namespace create "ROBIN_CACHE" --preview
```

**重要：** 复制返回的 `id`，更新到 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "ROBIN_CACHE"
id = "你的-kv-id-在这里"           # 生产环境 ID
preview_id = "你的-preview-id-在这里"  # 预览环境 ID
```

### 第五步：初始化数据库

```bash
# 应用表结构
wrangler d1 execute robin-db --remote --file=./schema.sql

# 应用迁移
wrangler d1 execute robin-db --remote --file=./migrations/001_add_module_enable.sql

# 导入示例数据（可选）
wrangler d1 execute robin-db --remote --file=./seed_layout.sql
```

### 第六步：设置环境变量

```bash
# JWT 密钥（必需）
wrangler secret put JWT_SECRET
# 输入：robin_commercial_key_2025_safe

# 管理员密钥（必需）
wrangler secret put ADMIN_SECRET_KEY
# 输入：你的管理员密钥

# 钉钉 Webhook（可选）
wrangler secret put DINGTALK_WEBHOOK
# 输入：https://oapi.dingtalk.com/robot/send?access_token=xxx

# TMDB API Key（可选）
wrangler secret put TMDB_API_KEY

# 豆瓣 API Key（可选）
wrangler secret put DOUBAN_API_KEY
```

### 第七步：部署！

```bash
# 部署到生产环境
wrangler deploy

# 或使用 npm 脚本
npm run deploy
```

部署成功后，你会看到：

```
✨ Success! Uploaded 1 file (0.5 sec)
✨ Uploaded robin-backend (2.34 sec)
✨ Published robin-backend (0.28 sec)
  https://robin-backend.你的账号.workers.dev
```

## 🧪 本地开发

### 启动本地开发服务器

```bash
# 初始化本地数据库（首次运行）
npm run db:init

# 启动开发服务器
npm run dev
```

本地服务器会在 `http://localhost:8787` 启动。

### 本地数据库操作

```bash
# 查询数据
wrangler d1 execute robin-db --local --command="SELECT * FROM users LIMIT 10"

# 打开交互式 SQL shell
wrangler d1 execute robin-db --local

# 重置数据库
npm run db:reset
```

### 本地 KV 操作

```bash
# 列出所有 keys
npm run kv:list

# 获取某个 key
wrangler kv:key get "layout:featured" --binding=ROBIN_CACHE --local

# 设置 key
wrangler kv:key put "test_key" "test_value" --binding=ROBIN_CACHE --local
```

## 📊 监控和日志

### 实时日志

```bash
# 查看生产环境日志
wrangler tail

# 查看特定 Worker 的日志
wrangler tail robin-backend

# 过滤日志
wrangler tail --format=pretty
```

### Cloudflare Dashboard

访问 [Cloudflare Dashboard](https://dash.cloudflare.com/) 查看：

- 📈 请求统计
- ⚡ 性能指标
- 🐛 错误日志
- 💰 使用量

## 🔄 更新部署

### 代码更新

```bash
# 1. 修改代码
# 2. 测试
npm run dev

# 3. 部署
wrangler deploy
```

### 数据库迁移

```bash
# 1. 创建迁移文件
# migrations/002_your_migration.sql

# 2. 应用迁移
wrangler d1 execute robin-db --remote --file=./migrations/002_your_migration.sql
```

### 配置更新

```bash
# 更新环境变量
wrangler secret put JWT_SECRET

# 更新 wrangler.toml 后重新部署
wrangler deploy
```

## 🎯 性能优化

### 1. KV 缓存策略

```typescript
// 缓存布局配置（5分钟）
await env.ROBIN_CACHE.put(
  cacheKey,
  JSON.stringify(data),
  { expirationTtl: 300 }
);
```

### 2. D1 查询优化

```sql
-- 使用索引
CREATE INDEX idx_modules_enabled ON page_modules(tab_id, is_enabled, sort_order);

-- 限制返回数量
SELECT * FROM page_modules WHERE tab_id = ? LIMIT 20;
```

### 3. 并发请求

```typescript
// 并发请求多个资源站
const results = await Promise.allSettled(
  sites.map(site => fetchFromSite(site))
);
```

## 💰 费用说明

### 免费额度（每天）

- ✅ **Workers**: 100,000 次请求
- ✅ **D1**: 5,000,000 次读取，100,000 次写入
- ✅ **KV**: 100,000 次读取，1,000 次写入

### 付费计划

- **Workers Paid**: $5/月，10,000,000 次请求
- **D1**: 按量计费，$0.001/1000 次读取
- **KV**: 按量计费，$0.50/GB 存储

**对于中小型项目，免费额度完全够用！** 🎉

## 🔒 安全最佳实践

### 1. 环境变量

```bash
# ❌ 不要在代码中硬编码密钥
const JWT_SECRET = "my-secret-key";

# ✅ 使用环境变量
const JWT_SECRET = env.JWT_SECRET;
```

### 2. 管理员认证

```typescript
// 验证管理员密钥
const adminKey = c.req.header('x-admin-key');
if (adminKey !== env.ADMIN_SECRET_KEY) {
  return c.json({ error: 'Unauthorized' }, 401);
}
```

### 3. CORS 配置

```typescript
// 限制允许的域名
app.use('/*', cors({
  origin: ['https://yourdomain.com'],
  allowMethods: ['GET', 'POST'],
}));
```

## 🐛 故障排查

### 问题 1：部署失败

```bash
# 检查 wrangler.toml 配置
wrangler whoami

# 重新登录
wrangler logout
wrangler login
```

### 问题 2：数据库连接失败

```bash
# 检查 D1 绑定
wrangler d1 list

# 验证 database_id
cat wrangler.toml | grep database_id
```

### 问题 3：KV 读写失败

```bash
# 检查 KV 命名空间
wrangler kv:namespace list

# 测试 KV 读写
wrangler kv:key put "test" "value" --binding=ROBIN_CACHE
wrangler kv:key get "test" --binding=ROBIN_CACHE
```

### 问题 4：定时任务不执行

```bash
# 检查 Cron 配置
cat wrangler.toml | grep crons

# 在 Dashboard 中查看 Cron 日志
# https://dash.cloudflare.com/
```

## 📚 相关资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [KV 存储文档](https://developers.cloudflare.com/kv/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

## 🎉 完成！

现在你的后端已经部署在 Cloudflare 的全球边缘网络上了！

**访问你的 API：**
```
https://robin-backend.你的账号.workers.dev/home_layout?tab=featured
```

**下一步：**
1. 配置自定义域名
2. 设置管理后台
3. 配置 APP 的 API 地址

---

**有问题？** 查看日志：`wrangler tail` 🔍
