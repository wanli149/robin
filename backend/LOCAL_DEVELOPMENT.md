# 本地开发环境配置

## 已完成的配置

### 1. D1 数据库（本地）
- 本地数据库已初始化：`robin-db`
- 数据库表结构已应用（30 条 SQL 命令执行成功）
- 本地数据存储在：`.wrangler/state/v3/d1/`

### 2. KV 命名空间（本地）
- 本地 KV 配置：`ROBIN_CACHE`
- 本地 KV 数据存储在：`.wrangler/state/v3/kv/`

### 3. 环境变量
- 本地环境变量文件：`.dev.vars`
- 包含的变量：
  - `JWT_SECRET`: JWT 令牌密钥
  - `DINGTALK_WEBHOOK`: 钉钉机器人 Webhook
  - `ADMIN_SECRET_KEY`: 管理员密钥
  - `TMDB_API_KEY`: TMDB API 密钥（可选）
  - `DOUBAN_API_KEY`: 豆瓣 API 密钥（可选）

## 本地开发命令

### 启动本地开发服务器
```bash
npm run dev
# 或
npx wrangler dev
```

这将启动本地开发服务器，默认在 `http://localhost:8787`

### 查看本地数据库
```bash
# 执行 SQL 查询
npx wrangler d1 execute robin-db --local --command="SELECT * FROM users LIMIT 10"

# 打开交互式 SQL shell
npx wrangler d1 execute robin-db --local
```

### 重置本地数据库
```bash
# 重新应用 schema
npx wrangler d1 execute robin-db --local --file=./schema.sql
```

### 查看本地 KV 数据
```bash
# 列出所有 keys
npx wrangler kv:key list --binding=ROBIN_CACHE --local

# 获取某个 key 的值
npx wrangler kv:key get <key-name> --binding=ROBIN_CACHE --local

# 设置 key-value
npx wrangler kv:key put <key-name> <value> --binding=ROBIN_CACHE --local
```

## 生产环境部署

当本地测试完成后，需要创建生产环境的资源：

### 1. 登录 Cloudflare
```bash
npx wrangler login
```

### 2. 创建生产 D1 数据库
```bash
npx wrangler d1 create robin-db
```

执行后会返回 database_id，将其更新到 `wrangler.toml` 中的 `database_id` 字段。

### 3. 初始化生产数据库
```bash
npx wrangler d1 execute robin-db --remote --file=./schema.sql
```

### 4. 创建生产 KV 命名空间
```bash
npx wrangler kv:namespace create "ROBIN_CACHE"
```

执行后会返回 namespace id，将其更新到 `wrangler.toml` 中的 `id` 字段。

### 5. 设置生产环境变量
```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put DINGTALK_WEBHOOK
npx wrangler secret put ADMIN_SECRET_KEY
npx wrangler secret put TMDB_API_KEY
npx wrangler secret put DOUBAN_API_KEY
```

### 6. 部署到生产环境
```bash
npm run deploy
# 或
npx wrangler deploy
```

## 注意事项

1. `.dev.vars` 文件包含敏感信息，已添加到 `.gitignore`，不会提交到版本控制
2. 本地开发使用的是 SQLite 数据库，与生产环境的 D1 完全兼容
3. 本地 KV 存储在文件系统中，与生产环境的 Cloudflare KV 行为一致
4. 本地数据存储在 `.wrangler/` 目录中，该目录已添加到 `.gitignore`
5. 生产环境的 database_id 和 KV namespace id 需要在部署前更新到 `wrangler.toml`

## 目录结构

```
backend/
├── .wrangler/              # 本地开发数据（不提交）
│   └── state/
│       └── v3/
│           ├── d1/         # 本地 D1 数据库
│           └── kv/         # 本地 KV 存储
├── .dev.vars               # 本地环境变量（不提交）
├── wrangler.toml           # Wrangler 配置
├── schema.sql              # 数据库表结构
└── src/                    # 源代码
```
