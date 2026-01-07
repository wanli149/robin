# Robin Admin Panel - 开发指南

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

### 3. 启动前端开发服务器

```bash
npm run dev
```

访问：http://localhost:3000

## 登录说明

1. 访问 http://localhost:3000
2. 自动跳转到登录页
3. 输入管理员密钥（在后端 `.dev.vars` 中配置的 `ADMIN_SECRET_KEY`）
4. 登录成功后跳转到仪表板

## 项目结构

```
src/
├── pages/              # 页面组件
│   ├── Login.tsx       # 登录页
│   └── Dashboard.tsx   # 仪表板
├── components/         # 可复用组件
│   └── ProtectedRoute.tsx  # 路由保护组件
├── services/           # API服务层
│   ├── api.ts          # Axios配置和拦截器
│   ├── auth.ts         # 认证工具函数
│   └── adminApi.ts     # 管理后台API
├── App.tsx             # 主应用组件（路由配置）
└── main.tsx            # 应用入口
```

## 认证机制

### 存储方式
- 管理员密钥存储在 `localStorage` 中
- Key: `admin_key`

### 请求拦截
- 所有API请求自动添加 `x-admin-key` header
- 从 `localStorage` 读取密钥

### 响应拦截
- 401/403 错误自动清除密钥并跳转登录页
- 其他错误正常抛出

### 路由保护
- 使用 `ProtectedRoute` 组件包裹需要认证的路由
- 未登录自动重定向到 `/login`

## API配置

### 开发环境
- 配置文件：`.env.development`
- API地址：`http://localhost:8787`

### 生产环境
- 配置文件：`.env.production`
- API地址：需要在部署时配置

## 常用命令

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

## 技术栈

- **React 19** - UI框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Ant Design 5** - UI组件库
- **Refine** - 管理后台框架
- **Axios** - HTTP客户端
- **React Router 7** - 路由管理

## 下一步

- [ ] 实现完整的仪表板页面
- [ ] 实现布局编辑器
- [ ] 实现广告管理
- [ ] 实现专题管理
- [ ] 实现系统配置页面
