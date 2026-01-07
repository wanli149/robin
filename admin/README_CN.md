# Robin Admin Panel

拾光影视管理后台 - 基于React 19 + TypeScript + Ant Design的现代化管理系统

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问: http://localhost:3000

### 构建生产版本

```bash
npm run build
```

## 📖 功能特性

### ✅ 已实现功能

- **认证系统**: 密钥登录、路由保护、自动登出
- **仪表板**: 实时统计、趋势图表、快捷操作
- **布局编辑器**: 拖拽排序、模块配置、实时保存
- **广告管理**: CRUD操作、全局开关、一键熔断
- **专题管理**: 专题创建、编辑、删除

### 🎨 技术栈

- **React 19** - 最新的React版本
- **TypeScript** - 类型安全
- **Vite** - 快速的构建工具
- **Ant Design 5** - 企业级UI组件库
- **@ant-design/charts** - 数据可视化
- **React Router 7** - 路由管理
- **React DnD** - 拖拽功能
- **Axios** - HTTP客户端

## 📁 项目结构

```
src/
├── pages/              # 页面组件
├── components/         # 可复用组件
├── services/           # API服务层
├── App.tsx            # 路由配置
└── main.tsx           # 应用入口
```

## 🔧 配置说明

### 环境变量

创建 `.env.development` 文件：

```env
VITE_API_BASE_URL=http://localhost:8787
```

### API代理

开发环境下，所有 `/admin` 和 `/api` 请求会被代理到后端服务器。

配置位置: `vite.config.ts`

## 📚 文档

- [开发指南](./DEVELOPMENT.md) - 详细的开发文档
- [项目结构](./PROJECT_STRUCTURE.md) - 项目结构说明
- [开发进度](./PROGRESS.md) - 功能开发进度
- [最终总结](./FINAL_SUMMARY.md) - 项目完整总结

## 🎯 核心页面

### 1. 登录页 (`/login`)
- 管理员密钥验证
- LocalStorage存储
- 自动跳转

### 2. 仪表板 (`/dashboard`)
- 统计数据展示
- 7天趋势图表
- 快捷操作

### 3. 布局编辑器 (`/layout-editor`)
- 8个频道切换
- 拖拽排序
- 属性编辑

### 4. 广告管理 (`/ad-management`)
- 广告列表
- 创建/编辑
- 全局控制

### 5. 专题管理 (`/topic-management`)
- 专题列表
- 创建/编辑
- 内容管理

## 🔐 登录说明

1. 访问 http://localhost:3000
2. 输入管理员密钥（后端配置的 `ADMIN_SECRET_KEY`）
3. 登录成功后跳转到仪表板

## 🛠️ 开发命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 预览构建结果
npm run preview

# 代码检查
npm run lint
```

## 📦 部署

### Cloudflare Pages

1. 构建项目：`npm run build`
2. 上传 `dist` 目录到Cloudflare Pages
3. 配置环境变量：`VITE_API_BASE_URL`

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 👨‍💻 开发者

Kiro AI Assistant

---

**项目状态**: ✅ 核心功能完成，可投入使用  
**最后更新**: 2024年12月
