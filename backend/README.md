# Robin Video Platform - Backend API

基于 Cloudflare Workers + D1 + KV 的视频平台后端 API

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
编辑 `.dev.vars` 文件，设置必要的环境变量：
```bash
JWT_SECRET=your-secret-key
DINGTALK_WEBHOOK=your-webhook-url
ADMIN_SECRET_KEY=your-admin-key
```

### 3. 初始化本地数据库（已完成）
```bash
npm run db:init
```

### 4. 启动开发服务器
```bash
npm run dev
```

服务器将在 `http://localhost:8787` 启动

## 可用命令

### 开发
- `npm run dev` - 启动本地开发服务器
- `npm run test` - 运行测试

### 数据库管理
- `npm run db:init` - 初始化本地数据库
- `npm run db:reset` - 重置本地数据库
- `npm run db:query` - 打开交互式 SQL shell
- `npm run db:remote:init` - 初始化生产数据库

### KV 管理
- `npm run kv:list` - 列出本地 KV 中的所有 keys

### 部署
- `npm run deploy` - 部署到 Cloudflare Workers

## 项目结构

```
backend/
├── src/
│   ├── index.ts           # 主入口文件
│   ├── routes/            # API 路由
│   ├── services/          # 业务逻辑
│   ├── models/            # 数据模型
│   └── utils/             # 工具函数
├── schema.sql             # 数据库表结构
├── wrangler.toml          # Cloudflare Workers 配置
├── .dev.vars              # 本地环境变量（不提交）
└── LOCAL_DEVELOPMENT.md   # 详细的本地开发指南
```

## 技术栈

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Language**: TypeScript

## 更多信息

详细的本地开发配置和生产部署说明，请查看 [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
