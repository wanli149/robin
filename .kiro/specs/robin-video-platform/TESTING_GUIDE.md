# 拾光影视 (Fetch) 测试指南

本文档提供完整的本地测试流程，确保所有功能正常运行后再进行生产部署。

---

## 📋 测试前准备

### 1. 环境检查

#### 后端环境
```bash
cd backend
node --version  # 需要 Node.js 18+
npx wrangler --version  # 需要 Wrangler CLI
```

#### 管理后台环境
```bash
cd admin
node --version
npm --version
```

#### 移动应用环境
```bash
cd app
flutter --version  # 需要 Flutter 3.10+
flutter doctor  # 检查环境配置
```

### 2. 依赖安装

#### 后端
```bash
cd backend
npm install
```

#### 管理后台
```bash
cd admin
npm install
```

#### 移动应用
```bash
cd app
flutter pub get
```

---

## 🧪 Phase 1: 后端测试

### 1.1 数据库初始化

```bash
cd backend

# 创建本地数据库
npx wrangler d1 create robin-db --local

# 应用数据库 Schema
npx wrangler d1 execute robin-db --local --file=./schema.sql

# 验证表结构
npx wrangler d1 execute robin-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**预期结果**：应该看到所有 13 个表：
- users
- history
- favorites
- home_tabs
- page_modules
- topics
- topic_items
- shorts_cache
- anime_timeline
- ads_inventory
- system_config
- daily_stats
- feedback
- app_wall
- appointments

### 1.2 启动本地开发服务器

```bash
npx wrangler dev
```

**预期结果**：
- 服务器启动在 `http://localhost:8787`
- 无错误信息
- 显示 "Ready on http://localhost:8787"

### 1.3 测试核心 API

#### 测试系统配置 API
```bash
curl http://localhost:8787/api/config
```

**预期结果**：返回系统配置 JSON

#### 测试版本 API
```bash
curl http://localhost:8787/api/version
```

**预期结果**：返回版本信息

#### 测试首页布局 API
```bash
curl "http://localhost:8787/home_layout?tab=featured"
```

**预期结果**：返回布局模块列表

#### 测试图片代理 API
```bash
curl "http://localhost:8787/img?url=https://example.com/image.jpg"
```

**预期结果**：返回代理后的图片

### 1.4 测试认证 API

#### 注册用户
```bash
curl -X POST http://localhost:8787/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'
```

**预期结果**：返回成功消息

#### 登录用户
```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'
```

**预期结果**：返回 JWT token

### 1.5 测试 Admin API

#### 测试 Dashboard（需要 Admin Key）
```bash
curl http://localhost:8787/admin/dashboard \
  -H "x-admin-key: YOUR_ADMIN_SECRET_KEY"
```

**预期结果**：返回仪表盘数据

---

## 🎨 Phase 2: 管理后台测试

### 2.1 启动开发服务器

```bash
cd admin
npm run dev
```

**预期结果**：
- 服务器启动在 `http://localhost:5173`（或其他端口）
- 浏览器自动打开

### 2.2 功能测试清单

#### 登录功能
- [ ] 输入 Admin Key
- [ ] 成功登录进入 Dashboard
- [ ] 错误的 Key 显示错误提示

#### Dashboard
- [ ] 显示总用户数
- [ ] 显示今日活跃用户
- [ ] 显示 7 天趋势图
- [ ] 显示服务器状态

#### 布局编辑器
- [ ] 左侧显示频道列表
- [ ] 点击频道加载模块列表
- [ ] 拖拽模块可以排序
- [ ] 点击模块显示属性编辑器
- [ ] 修改模块属性
- [ ] 保存布局成功

#### 广告管理
- [ ] 显示广告列表
- [ ] 添加新广告
- [ ] 编辑广告
- [ ] 删除广告
- [ ] 一键熔断功能

#### 专题管理
- [ ] 创建新专题
- [ ] 添加视频到专题
- [ ] 拖拽调整视频顺序
- [ ] 删除专题

#### 短剧管理
- [ ] 显示短剧列表
- [ ] 预览短剧
- [ ] 下架短剧
- [ ] 置顶短剧

#### 系统配置
- [ ] 资源站管理
- [ ] 版本发布
- [ ] 缓存管理
- [ ] 热搜配置
- [ ] 联系方式配置
- [ ] 永久网址配置

#### 反馈管理
- [ ] 显示反馈列表
- [ ] 标记已处理

#### 应用墙管理
- [ ] 添加推广应用
- [ ] 编辑应用信息
- [ ] 删除应用

---

## 📱 Phase 3: 移动应用测试

### 3.1 构建 Debug 版本

```bash
cd app
flutter build apk --debug
```

**预期结果**：
- 构建成功
- APK 位于 `build/app/outputs/flutter-apk/app-debug.apk`

### 3.2 安装到设备

```bash
# 连接 Android 设备或启动模拟器
flutter devices

# 安装应用
flutter install
```

或手动安装：
```bash
adb install build/app/outputs/flutter-apk/app-debug.apk
```

### 3.3 功能测试清单

#### 启动流程
- [ ] 显示 Logo 启动页
- [ ] 显示开屏广告（如果配置）
- [ ] 进入首页

#### 首页功能
- [ ] 显示顶部 Logo 和搜索框
- [ ] 显示频道 Tab
- [ ] 切换频道加载对应内容
- [ ] 下拉刷新
- [ ] 跑马灯通告显示
- [ ] 轮播图自动播放
- [ ] 金刚区图标点击跳转
- [ ] 视频列表显示
- [ ] 点击视频进入详情页

#### 短剧功能
- [ ] 点击底部"短剧"Tab
- [ ] 全屏竖屏播放
- [ ] 上下滑动切换视频
- [ ] 显示"观看完整版"引导
- [ ] 点击进入短剧详情页
- [ ] 详情页显示选集列表
- [ ] 点击全屏切换到锁定模式

#### 视频播放
- [ ] 视频正常播放
- [ ] 播放/暂停控制
- [ ] 进度条拖动
- [ ] 倍速播放（0.5x, 1.0x, 1.5x, 2.0x）
- [ ] 全屏播放
- [ ] 暂停显示贴片广告
- [ ] DLNA 投屏（如果有设备）

#### 视频详情页
- [ ] 显示视频信息
- [ ] 显示选集列表
- [ ] 点击选集播放
- [ ] 收藏功能
- [ ] 预约功能（未上映）
- [ ] 推荐视频列表

#### 片库功能
- [ ] 显示筛选器（类型、地区、年份、排序）
- [ ] 选择筛选条件
- [ ] 双列瀑布流显示
- [ ] 上拉加载更多
- [ ] 广告插入

#### 搜索功能
- [ ] 显示热搜词
- [ ] 显示搜索历史
- [ ] 输入关键词搜索
- [ ] 显示搜索结果
- [ ] 点击结果进入详情

#### 用户认证
- [ ] 点击"点击登录"
- [ ] 注册新用户
- [ ] 登录用户
- [ ] 显示用户信息
- [ ] VIP 标识显示

#### 个人中心
- [ ] 显示用户头像和昵称
- [ ] 观看历史列表
- [ ] 我的收藏列表
- [ ] 我的预约列表
- [ ] 应用中心（WebView）
- [ ] 分享 APP（生成海报）
- [ ] 换源设置
- [ ] 求片/反馈
- [ ] 清除缓存
- [ ] 联系客服
- [ ] 官方群组
- [ ] 永久网址
- [ ] APP 更新检查
- [ ] 退出登录

#### 反馈功能
- [ ] 输入反馈内容
- [ ] 输入联系方式
- [ ] 提交反馈成功

#### 预约功能
- [ ] 预约未上映作品
- [ ] 查看预约列表
- [ ] 取消预约

#### 应用中心
- [ ] 显示推广应用列表
- [ ] 点击下载跳转

#### WebView 功能
- [ ] 加载网页
- [ ] 显示加载进度
- [ ] 前进/后退按钮
- [ ] 刷新按钮
- [ ] 关闭按钮

---

## 🔍 Phase 4: 集成测试

### 4.1 端到端流程测试

#### 用户注册到观看流程
1. [ ] 启动应用
2. [ ] 浏览首页内容
3. [ ] 点击登录
4. [ ] 注册新用户
5. [ ] 登录成功
6. [ ] 搜索视频
7. [ ] 点击视频详情
8. [ ] 播放视频
9. [ ] 收藏视频
10. [ ] 查看观看历史
11. [ ] 退出登录

#### 管理员配置到用户查看流程
1. [ ] Admin 登录管理后台
2. [ ] 编辑首页布局
3. [ ] 添加轮播图
4. [ ] 保存发布
5. [ ] APP 下拉刷新
6. [ ] 查看新布局生效

---

## ⚡ Phase 5: 性能测试

### 5.1 首屏加载时间
- [ ] 冷启动时间 < 3 秒
- [ ] 热启动时间 < 1 秒
- [ ] 首页数据加载 < 2 秒

### 5.2 列表滚动性能
- [ ] 滚动流畅，无卡顿
- [ ] 图片懒加载正常
- [ ] 内存占用合理（< 200MB）

### 5.3 网络性能
- [ ] API 响应时间 < 500ms
- [ ] 图片加载使用缓存
- [ ] 离线时显示缓存内容

---

## 🐛 Phase 6: 错误处理测试

### 6.1 网络错误
- [ ] 断网时显示错误提示
- [ ] 网络恢复后可重试
- [ ] 超时显示友好提示

### 6.2 数据错误
- [ ] 空数据显示空状态
- [ ] 错误数据不崩溃
- [ ] 显示错误提示

### 6.3 崩溃处理
- [ ] 崩溃自动上报（Release 模式）
- [ ] 崩溃后可恢复

---

## 📊 测试结果记录

### 后端测试结果
| 测试项 | 状态 | 备注 |
|--------|------|------|
| 数据库初始化 | ⬜ |  |
| API 服务启动 | ⬜ |  |
| 系统配置 API | ⬜ |  |
| 版本 API | ⬜ |  |
| 布局 API | ⬜ |  |
| 认证 API | ⬜ |  |
| Admin API | ⬜ |  |

### 管理后台测试结果
| 测试项 | 状态 | 备注 |
|--------|------|------|
| 登录功能 | ⬜ |  |
| Dashboard | ⬜ |  |
| 布局编辑器 | ⬜ |  |
| 广告管理 | ⬜ |  |
| 专题管理 | ⬜ |  |
| 系统配置 | ⬜ |  |

### 移动应用测试结果
| 测试项 | 状态 | 备注 |
|--------|------|------|
| 启动流程 | ⬜ |  |
| 首页功能 | ⬜ |  |
| 短剧功能 | ⬜ |  |
| 视频播放 | ⬜ |  |
| 搜索功能 | ⬜ |  |
| 用户认证 | ⬜ |  |
| 个人中心 | ⬜ |  |

---

## ✅ 测试通过标准

### 必须通过的测试
- ✅ 所有核心 API 正常响应
- ✅ 管理后台所有功能可用
- ✅ APP 可以正常安装和启动
- ✅ 用户可以注册、登录
- ✅ 视频可以正常播放
- ✅ 搜索功能正常
- ✅ 无严重 Bug 或崩溃

### 可选通过的测试
- ⚪ 性能达到预期指标
- ⚪ 所有边缘情况处理正确
- ⚪ 错误提示友好

---

## 🚀 测试通过后的部署流程

测试全部通过后，参考 `DEPLOYMENT_GUIDE.md` 进行生产部署。

---

**测试负责人**: ___________  
**测试日期**: ___________  
**测试版本**: 1.0.0  
**测试环境**: 本地开发环境
