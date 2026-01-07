# Robin Admin Panel - 项目结构

## 目录说明

```
admin/
├── src/
│   ├── pages/          # 页面组件
│   ├── components/     # 可复用组件
│   ├── services/       # API服务层
│   ├── assets/         # 静态资源
│   ├── App.tsx         # 主应用组件
│   └── main.tsx        # 应用入口
├── public/             # 公共静态文件
├── vite.config.ts      # Vite配置
├── tsconfig.json       # TypeScript配置
└── package.json        # 项目依赖
```

## 技术栈

- **React 19** - UI框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Ant Design** - UI组件库
- **Refine** - 管理后台框架
- **Axios** - HTTP客户端
- **React Router** - 路由管理

## 开发服务器

```bash
npm run dev
```

访问：http://localhost:3000

## 构建生产版本

```bash
npm run build
```

## API代理配置

开发环境下，所有 `/admin` 和 `/api` 请求会被代理到后端服务器 `http://localhost:8787`
