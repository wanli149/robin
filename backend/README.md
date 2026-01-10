# Robin Video Platform - Backend

基于 Cloudflare Workers + D1 + KV 的视频平台后端 API

## 技术栈

- Runtime: Cloudflare Workers
- Framework: Hono
- Database: Cloudflare D1 (SQLite)
- Cache: Cloudflare KV

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

编辑 `.dev.vars` 文件：

```bash
JWT_SECRET=your-jwt-secret
ADMIN_SECRET_KEY=your-admin-key
DINGTALK_WEBHOOK=your-webhook-url  # 可选
```

### 3. 初始化数据库

```bash
npm run db:init
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:8787` 启动

## 常用命令

```bash
npm run dev           # 启动开发服务器
npm run deploy        # 部署到 Cloudflare
npm run db:init       # 初始化本地数据库
npm run db:reset      # 重置本地数据库
npm run db:query      # 打开 SQL shell
npm run kv:list       # 列出本地 KV keys
```

## 生产部署

### 1. 登录 Cloudflare

```bash
npx wrangler login
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create robin-db
```

将返回的 `database_id` 更新到 `wrangler.toml`

### 3. 创建 KV 命名空间

```bash
npx wrangler kv:namespace create "ROBIN_CACHE"
```

将返回的 `id` 更新到 `wrangler.toml`

### 4. 初始化生产数据库

```bash
npm run db:remote:init
```

### 5. 设置环境变量

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_SECRET_KEY
```

### 6. 部署

```bash
npm run deploy
```

## 项目结构

```
backend/
├── src/
│   ├── index.ts        # 主入口
│   ├── routes/         # API 路由
│   ├── services/       # 业务逻辑
│   └── utils/          # 工具函数
├── migrations/         # 数据库迁移
├── schema.sql          # 数据库表结构
└── wrangler.toml       # Cloudflare 配置
```

## API 端点

| 端点 | 说明 |
|------|------|
| `GET /` | 健康检查 |
| `GET /home_layout?tab=featured` | 首页布局 |
| `GET /home_tabs` | 频道列表 |
| `GET /api/vod?ac=list&pg=1` | 视频列表 |
| `GET /api/search?wd=关键词` | 搜索 |
| `GET /api/shorts/random` | 随机短剧 |
