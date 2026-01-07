# 拾光影视 - 快速启动指南 🚀

## 项目架构

```
┌─────────────────────────────────────────────────────────┐
│                    拾光影视全栈项目                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📱 Flutter APP          🌐 React Admin    ☁️ CF Workers │
│  ├─ 移动端应用           ├─ 管理后台       ├─ API 服务   │
│  ├─ 动态布局渲染         ├─ 布局编辑器     ├─ D1 数据库  │
│  ├─ 视频播放             ├─ 内容管理       ├─ KV 缓存    │
│  └─ 用户系统             └─ 数据统计       └─ 边缘计算   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 🎯 核心特性

### 半动态布局系统
- ✅ **组件固定**：前端预定义组件类型
- ✅ **配置动态**：后端控制顺序、数据、开关
- ✅ **实时生效**：无需发版，立即更新
- ✅ **运营友好**：可视化配置，拖拽排序

### Cloudflare 架构优势
- ⚡ **零冷启动**：毫秒级响应
- 🌍 **全球部署**：300+ 边缘节点
- 💰 **成本极低**：免费额度足够中小项目
- 🔒 **安全可靠**：DDoS 防护，自动扩展

## 📦 快速开始

### 1️⃣ 后端部署（Cloudflare Workers）

```powershell
# 进入后端目录
cd backend

# 安装依赖
npm install

# 运行部署脚本（Windows）
.\deploy.ps1

# 选择：1) 初始化本地开发环境
# 然后：npm run dev
```

**详细文档：** [backend/CLOUDFLARE_DEPLOY.md](backend/CLOUDFLARE_DEPLOY.md)

### 2️⃣ 管理后台（React）

```powershell
# 进入管理后台目录
cd admin

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问：http://localhost:3000
```

**默认登录：**
- 管理员密钥：在后端 `.dev.vars` 中配置

### 3️⃣ 移动端 APP（Flutter）

```powershell
# 进入 APP 目录
cd app

# 安装依赖
flutter pub get

# 运行 APP
flutter run

# 或构建 APK
flutter build apk --release
```

**构建指南：** [app/快速构建指南.md](app/快速构建指南.md)

## 🔧 开发流程

### 典型工作流

```
1. 后端开发
   ├─ 修改代码
   ├─ 本地测试：npm run dev
   └─ 部署：wrangler deploy

2. 管理后台配置
   ├─ 登录管理后台
   ├─ 配置首页布局
   ├─ 添加/编辑模块
   └─ 保存发布

3. APP 测试
   ├─ 更新 API 地址
   ├─ 运行 APP
   └─ 验证布局和数据
```

## 📊 项目状态

### ✅ 已完成
- [x] 数据库设计（30+ 张表）
- [x] 后端 API（布局、视频、用户、广告）
- [x] 管理后台（布局编辑器、内容管理）
- [x] APP 框架（动态渲染引擎）
- [x] 半动态布局优化
- [x] 模块开关功能
- [x] 部署脚本

### 🔨 进行中
- [ ] APP 构建（网络问题）
- [ ] 视频源配置
- [ ] 短剧引擎测试

### 📝 待完成
- [ ] 自定义域名配置
- [ ] 生产环境部署
- [ ] 性能优化测试
- [ ] 用户测试

## 🎨 管理后台功能

### 布局编辑器
```
┌─────────────────────────────────────────────┐
│  频道选择  │    模块画布    │   属性编辑器  │
│            │                │               │
│  ☑ 精选    │  ┌──────────┐ │  模块类型：   │
│  ☐ 电影    │  │ 轮播图   │ │  轮播图       │
│  ☐ Netflix │  │ [开关]   │ │               │
│  ☐ 短剧    │  └──────────┘ │  标题：       │
│  ☐ 动漫    │  ┌──────────┐ │  今日推荐     │
│            │  │ 金刚区   │ │               │
│            │  │ [开关]   │ │  API 参数：   │
│            │  └──────────┘ │  {...}        │
│            │  ┌──────────┐ │               │
│            │  │ 热门电影 │ │  广告配置：   │
│            │  │ [开关]   │ │  {...}        │
│            │  └──────────┘ │               │
│            │                │  [保存发布]   │
└─────────────────────────────────────────────┘
```

### 核心功能
- 🎯 **拖拽排序**：调整模块顺序
- 🔘 **一键开关**：启用/禁用模块
- ✏️ **属性编辑**：修改标题、参数、广告
- 💾 **实时保存**：配置立即生效

## 🌐 API 端点

### 布局 API
```
GET /home_layout?tab=featured
返回：首页布局配置（模块列表 + 数据）

GET /home_tabs
返回：频道列表
```

### 视频 API
```
GET /api/vod?t=1&pg=1
返回：视频列表

GET /api/vod/detail?ids=123
返回：视频详情

GET /api/search?wd=关键词
返回：搜索结果
```

### 短剧 API
```
GET /api/shorts/random
返回：随机短剧流

GET /api/shorts/series?id=123
返回：短剧选集
```

## 🔐 环境变量

### 后端（Cloudflare Workers）
```bash
JWT_SECRET=robin_commercial_key_2025_safe
ADMIN_SECRET_KEY=你的管理员密钥
DINGTALK_WEBHOOK=钉钉机器人地址（可选）
TMDB_API_KEY=TMDB密钥（可选）
DOUBAN_API_KEY=豆瓣密钥（可选）
```

### 管理后台（React）
```bash
VITE_API_URL=http://localhost:8787  # 开发环境
VITE_API_URL=https://api.yourdomain.com  # 生产环境
```

### APP（Flutter）
```dart
// lib/config/api_config.dart
static const String baseUrl = 'http://localhost:8787';  // 开发
static const String baseUrl = 'https://api.yourdomain.com';  // 生产
```

## 📚 文档索引

### 核心文档
- [优化指南](OPTIMIZATION_GUIDE.md) - 半动态布局优化说明
- [Cloudflare 部署](backend/CLOUDFLARE_DEPLOY.md) - CF Workers 部署详解
- [APP 构建指南](app/快速构建指南.md) - Flutter APP 构建

### 设计文档
- [后端架构白皮书](拾光影视%20(Fetch)%20后端开发架构白皮书%20V3.0.txt)
- [商业版开发手册](拾光影视%20(Fetch)%20商业版%20APP%20全案开发手册.txt)
- [全栈补丁手册](拾光影视%20(Robin)%20全栈补丁手册%20V3.2.txt)

### 技术文档
- [数据库结构](backend/schema.sql)
- [API 路由](backend/src/routes/)
- [前端组件](app/lib/modules/)

## 🐛 常见问题

### Q1: 后端部署失败？
**A:** 检查 `wrangler.toml` 中的 `database_id` 和 KV `id` 是否正确。

### Q2: 管理后台无法连接后端？
**A:** 检查 `.env.development` 中的 `VITE_API_URL` 是否正确。

### Q3: APP 构建卡住？
**A:** 参考 [app/快速构建指南.md](app/快速构建指南.md) 解决网络问题。

### Q4: 布局配置不生效？
**A:** 
1. 检查模块是否启用（`is_enabled = 1`）
2. 清除 KV 缓存
3. 查看后端日志：`wrangler tail`

## 💡 最佳实践

### 1. 开发环境
- 后端：使用本地 D1 和 KV
- 管理后台：连接本地后端
- APP：连接本地后端

### 2. 测试环境
- 后端：部署到 Cloudflare（使用测试域名）
- 管理后台：构建并部署
- APP：使用测试 API 地址

### 3. 生产环境
- 后端：部署到 Cloudflare（自定义域名）
- 管理后台：部署到 Cloudflare Pages
- APP：发布到应用商店

## 🎉 下一步

1. ✅ **完成后端部署** - 运行 `.\deploy.ps1`
2. ✅ **配置管理后台** - 登录并配置首页布局
3. ✅ **测试 APP** - 运行 `flutter run` 验证
4. 🚀 **上线发布** - 部署到生产环境

---

**需要帮助？** 查看详细文档或提交 Issue 🙋‍♂️
