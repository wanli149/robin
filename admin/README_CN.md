# Robin Admin Panel

拾光影视管理后台 - 基于 React 19 + TypeScript + Ant Design 5

## 技术栈

- React 19
- TypeScript
- Vite
- Ant Design 5
- React Router 7
- React DnD（拖拽）
- Axios

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务

确保后端服务已启动在 `http://localhost:8787`

```bash
cd ../backend
npm run dev
```

### 3. 启动前端

```bash
npm run dev
```

访问：http://localhost:5173

### 4. 登录

输入管理员密钥（后端 `.dev.vars` 中的 `ADMIN_SECRET_KEY`）

## 常用命令

```bash
npm run dev       # 开发
npm run build     # 构建
npm run preview   # 预览构建结果
npm run lint      # 代码检查
```

## 项目结构

```
admin/src/
├── pages/          # 页面组件
├── components/     # 可复用组件
├── services/       # API 服务层
├── utils/          # 工具函数
├── App.tsx         # 路由配置
└── main.tsx        # 应用入口
```

## 核心功能

- 仪表板：实时统计、趋势图表
- 布局编辑器：拖拽排序、模块配置
- 广告管理：CRUD、全局开关
- 专题管理：创建、编辑、删除
- 系统配置：跑马灯、热搜、联系方式

## 环境变量

开发环境 `.env.development`：

```env
VITE_API_BASE_URL=http://localhost:8787
```

生产环境 `.env.production`：

```env
VITE_API_BASE_URL=https://your-api-domain.workers.dev
```

## 部署

### Cloudflare Pages

1. 构建：`npm run build`
2. 上传 `dist` 目录到 Cloudflare Pages
3. 配置环境变量 `VITE_API_BASE_URL`
