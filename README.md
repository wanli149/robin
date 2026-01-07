# Robin Video Platform

一个现代化的视频聚合平台，支持多端同步和智能推荐。

## 🏗️ 项目架构

```
robin-video-platform/
├── backend/          # Cloudflare Workers 后端 API
├── admin/           # Vue 3 管理后台
├── app/             # Flutter 移动应用
└── docs/            # 项目文档
```

## ✨ 核心特性

- **🎬 多源聚合**: 整合多个视频资源站点
- **📱 跨平台**: Flutter 应用支持 Android/iOS
- **🎯 智能推荐**: 基于用户行为的个性化推荐
- **🔄 动态布局**: 后端驱动的首页布局系统
- **📺 短剧引擎**: 抖音模式的竖屏无限流播放
- **⚡ 高性能**: Cloudflare Workers + D1 + KV 架构

## 🚀 快速开始

详细的部署和开发指南请参考：

- [快速启动指南](QUICK_START.md)
- [部署检查清单](DEPLOYMENT_CHECKLIST.md)
- [分布式数据库架构](DISTRIBUTED_DATABASE_ARCHITECTURE.md)

## 📁 子项目说明

### Backend (Cloudflare Workers)
- 基于 Hono 框架的高性能 API
- 支持多数据源聚合和智能缓存
- 完整的用户认证和权限管理

### Admin (Vue 3)
- 现代化的管理后台界面
- 支持内容管理、用户管理、系统配置
- 响应式设计，支持移动端访问

### App (Flutter)
- 跨平台移动应用
- 支持视频播放、用户中心、离线缓存
- 原生性能，流畅的用户体验

## 🛠️ 技术栈

- **后端**: Cloudflare Workers, Hono, D1, KV
- **前端**: Vue 3, TypeScript, Vite
- **移动端**: Flutter, Dart
- **数据库**: Cloudflare D1 (SQLite)
- **缓存**: Cloudflare KV
- **部署**: Cloudflare Pages, Workers

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系

如有问题或建议，请通过 GitHub Issues 联系我们。