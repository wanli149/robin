# Robin Video Platform

一个现代化的视频聚合平台，支持多端同步和智能推荐。

## 项目架构

```
robin-video-platform/
├── backend/    # Cloudflare Workers 后端 API
├── admin/      # Vue 3 管理后台
└── app/        # Flutter 移动应用
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 后端 | Cloudflare Workers + Hono + D1 + KV |
| 管理后台 | React 19 + TypeScript + Ant Design 5 + Vite |
| 移动端 | Flutter 3.x + GetX + Dio |

## 快速开始

### 1. 后端

```bash
cd backend
npm install
npm run db:init          # 初始化本地数据库
npm run dev              # 启动开发服务器 http://localhost:8787
```

### 2. 管理后台

```bash
cd admin
npm install
npm run dev              # 启动开发服务器 http://localhost:5173
```

### 3. 移动端

```bash
cd app
flutter pub get
flutter run
```

## 核心功能

- 多源视频聚合
- 动态首页布局系统
- 短剧引擎
- 用户系统（登录、收藏、历史）
- 管理后台（布局编辑、广告管理、专题管理）

## 文档

- [API 接口规范](API_REQUIREMENTS.md)
- [部署检查清单](DEPLOYMENT_CHECKLIST.md)
- [后端开发指南](backend/README.md)
- [管理后台指南](admin/README_CN.md)
- [APP 构建指南](app/快速构建指南.md)

## 许可证

MIT License
