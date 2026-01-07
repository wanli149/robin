# Implementation Plan

本实现计划将拾光影视 (Project Robin) 的开发分解为可执行的编码任务。任务按照"后端优先、Admin次之、APP最后"的顺序组织，确保数据层和API层稳定后再开发消费层。

**标记说明:**
- `*` 可选任务（如单元测试）

---

## Phase 1: Backend Infrastructure & Core APIs

- [x] 1. Initialize backend project structure



  - 在 `I:\ProjectRobin\backend` 创建项目目录
  - 初始化 `package.json` 并安装依赖：`hono`, `@cloudflare/workers-types`, `lodash`（可选）
  - 创建 `wrangler.toml` 配置文件，设置 `name`, `main`, `compatibility_date`, `compatibility_flags`
  - 创建基础目录结构：src/routes, src/services, src/utils, src/middleware
  - _Requirements: 1.1, 1.3, 1.5_

- [x] 2. Create complete database schema



  - 创建 `schema.sql` 文件
  - 编写所有13个核心表的 CREATE TABLE 语句（users, history, favorites, home_tabs, page_modules, topics, topic_items, shorts_cache, anime_timeline, ads_inventory, system_config, daily_stats, feedback, app_wall, appointments）
  - 为所有表添加必要的索引
  - 插入 system_config 表的预置配置项：app_version, force_update_min_ver, welfare_enabled, welfare_password, ads_enabled, marquee_text, marquee_link, permanent_urls, hot_search_keywords, customer_service, official_group
  - _Requirements: 2.1-2.9, 38.1-38.3_

- [x] 3. Setup Cloudflare D1 and KV









  - 执行 `npx wrangler d1 create robin-db` 创建 D1 数据库
  - 执行 `npx wrangler kv:namespace create "ROBIN_CACHE"` 创建 KV 命名空间
  - 在 `wrangler.toml` 中配置 D1 和 KV 绑定
  - 配置环境变量：JWT_SECRET, DINGTALK_WEBHOOK, ADMIN_SECRET_KEY
  - 执行 `npx wrangler d1 execute robin-db --local --file=./schema.sql` 应用表结构
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 4. Implement DingTalk notification service



  - 创建 `src/utils/notify.ts`
  - 实现 `sendDingTalk(env, title, content)` 函数
  - 支持 Markdown 格式消息
  - 添加错误处理（发送失败不影响主流程）
  - _Requirements: 8.2, 8.3_

- [x] 5. Implement statistics tracking service


  - 创建 `src/utils/stats.ts`
  - 实现 `recordVisit(env)` 函数
  - 使用 INSERT ... ON CONFLICT DO UPDATE 语法
  - 异步执行，不阻塞主请求
  - _Requirements: 26.1, 26.2, 26.3_

- [x] 6. Implement JWT authentication utilities



  - 创建 `src/utils/jwt.ts`
  - 实现 `generateToken(payload, secret)` 函数
  - 实现 `verifyToken(token, secret)` 函数
  - 使用环境变量中的 JWT_SECRET
  - _Requirements: 19.4, 32.2_

- [x] 7. Implement Spider Aggregator service



  - 创建 `src/services/spider_aggregator.ts`
  - 实现 `aggregateVideos(endpoint, params, options)` 函数
  - 使用 Promise.allSettled 并发请求多个资源站
  - 实现失败降级逻辑（某源超时则使用其他源）
  - 实现结果去重（基于 vod_id）
  - 添加福利源隔离逻辑（检查 type=welfare 参数和数据库开关）
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8. Implement Shorts Engine service


  - 创建 `src/services/spider_shorts.ts`
  - 实现 `fetchShorts(env)` Cron Job 函数
  - 从短剧源站抓取数据并验证竖屏封面存在性
  - 使用 INSERT OR IGNORE 存入 shorts_cache 表
  - 实现 `getRandomShorts(env, limit)` 函数（执行 ORDER BY RANDOM()）
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Implement Ad Injector service



  - 创建 `src/services/ad_injector.ts`
  - 实现 `injectAds(items, config, env, user)` 函数
  - 检查全局广告开关和用户 VIP 状态
  - 从 ads_inventory 表根据 location 和 weight 随机选择广告
  - 在指定 insert_index 位置插入广告对象
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Implement Metadata Enhancement service



  - 创建 `src/services/metadata.ts`
  - 实现 `fetchTMDBImage(movieName, env)` 函数调用 TMDB API
  - 实现 `fetchDoubanImage(movieName, env)` 函数作为备用
  - 实现降级逻辑（TMDB 失败则尝试豆瓣，都失败则使用原始图片）
  - 缓存查询结果到 KV（TTL: 86400秒）
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_


- [x] 11. Implement Dynamic Layout API



  - 创建 `src/routes/layout.ts`
  - 实现 GET `/home_layout` 接口，接收 `tab` 查询参数
  - 检查 KV 缓存（key: `layout:${tab}`）
  - 查询 page_modules 表并按 sort_order 排序
  - 异步记录访问统计（使用 recordVisit）
  - 将结果缓存到 KV（TTL: 300秒）
  - 返回包含 modules 数组和 marquee_text 的 JSON
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 35.3_

- [x] 12. Implement Video API (VOD)


  - 创建 `src/routes/vod.ts`
  - 实现 GET `/api/vod` 接口（列表/筛选），接收参数：ac, t, area, year, sort, pg
  - 调用 Spider Aggregator 聚合多源数据
  - 实现 GET `/api/vod/detail` 接口（详情），接收参数：ids
  - 返回包含选集列表和推荐内容的详情数据
  - _Requirements: 4.5, 22.2_


- [x] 13. Implement Search API

  - 在 `src/routes/vod.ts` 中实现 GET `/api/search` 接口
  - 接收参数：wd (关键词)
  - 调用 Spider Aggregator 并发搜索多个资源站
  - 聚合结果并去重
  - _Requirements: 21.3, 21.4, 21.5_

- [x] 14. Implement Shorts API


  - 创建 `src/routes/shorts.ts`
  - 实现 GET `/api/shorts/random` 接口，调用 Shorts Engine 的 getRandomShorts 函数
  - 返回 10 条随机短剧数据
  - 实现 GET `/api/shorts/series` 接口，接收参数：id
  - 返回该短剧的所有集数和播放地址
  - _Requirements: 5.3, 5.4_


- [x] 15. Implement Image Proxy API


  - 创建 `src/routes/proxy.ts`
  - 实现 GET `/img` 接口，接收参数：url
  - 伪造浏览器 User-Agent 和清空 Referer
  - 代理请求图片 URL
  - 设置 Cache-Control 为 1 年，保持原始 Content-Type
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 16. Implement Authentication API



  - 创建 `src/routes/auth.ts`
  - 实现 POST `/auth/register` 接口，接收 username 和 password
  - 使用 bcrypt 哈希密码并存储到 users 表
  - 实现 POST `/auth/login` 接口，验证用户名密码
  - 生成 JWT token 并返回
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 32.1_

- [x] 17. Implement System API



  - 创建 `src/routes/system.ts`
  - 实现 GET `/api/version` 接口，从 system_config 表读取版本信息
  - 返回 { force: boolean, url: string, changelog: string }
  - 实现 GET `/api/config` 接口，返回金刚区配置、福利开关、永久网址等全局配置
  - 实现 POST `/api/system/crash_report` 接口，接收崩溃报告并异步发送钉钉通知
  - _Requirements: 15.3, 15.4, 8.1, 8.2, 36.3_

- [x] 18. Implement User Sync and History API


  - 在 `src/routes/auth.ts` 中实现 POST `/user/sync` 接口
  - 接收 vod_id, progress, duration，更新 history 表
  - 使用 INSERT ... ON CONFLICT DO UPDATE 语法
  - 实现 GET `/api/user/history` 接口，查询 history 表返回用户观看历史
  - 实现 GET `/api/user/favorites` 接口，查询 favorites 表返回用户收藏列表
  - 实现 POST `/api/user/favorite` 接口（添加收藏）
  - 实现 DELETE `/api/user/favorite/:vod_id` 接口（取消收藏）
  - _Requirements: 19.6, 19.7, 23.3_


- [x] 19. Implement Feedback and App Wall API

  - 在 `src/routes/system.ts` 中实现 POST `/api/feedback` 接口
  - 接收 user_id, content, contact，存储到 feedback 表并异步发送钉钉通知
  - 实现 GET `/api/app_wall` 接口，查询 app_wall 表返回所有激活的推广应用
  - 按 sort_order 排序
  - _Requirements: 28.1, 28.2, 29.4_


- [x] 20. Implement Appointment API

  - 在 `src/routes/auth.ts` 中实现 POST `/api/appointment` 接口
  - 接收 vod_id, vod_name, release_date，存储到 appointments 表
  - 实现 GET `/api/user/appointments` 接口，查询 appointments 表返回用户预约列表
  - 实现 DELETE `/api/appointment/:vod_id` 接口（取消预约）
  - _Requirements: 37.2, 37.3, 37.4_


- [x] 21. Implement Admin Guard middleware


  - 创建 `src/middleware/admin_guard.ts`
  - 实现 `adminGuard(c, next)` 中间件函数
  - 验证请求头 x-admin-key 是否匹配环境变量 ADMIN_SECRET_KEY
  - 验证失败返回 403 状态码
  - _Requirements: 9.2, 9.3_


- [x] 22. Implement Admin Dashboard API

  - 创建 `src/routes/admin.ts`
  - 应用 adminGuard 中间件到所有 /admin 路由
  - 实现 GET `/admin/dashboard` 接口
  - 查询 daily_stats 表最近 7 天数据，统计 users 表总用户数
  - 返回 { stats, total_users, server_status }
  - _Requirements: 10.1, 10.2, 10.3_



- [x] 23. Implement Admin Layout Management API

  - 在 `src/routes/admin.ts` 中实现 GET `/admin/layout` 接口
  - 接收参数：tab，查询 page_modules 表返回该频道的模块列表
  - 实现 POST `/admin/layout` 接口，接收 { tab_id, modules } 数据
  - 更新 page_modules 表并清除对应的 KV 缓存
  - _Requirements: 11.2, 11.5_



- [x] 24. Implement Admin Advertisement API

  - 在 `src/routes/admin.ts` 中实现 GET `/admin/ads` 接口
  - 查询 ads_inventory 表返回所有广告记录
  - 实现 POST `/admin/ads` 接口，接收广告数据并存储
  - 实现 DELETE `/admin/ads/:id` 接口，删除指定 ID 的广告记录
  - 实现 POST `/admin/config/ads_global_switch` 接口，更新 system_config 表的 ads_enabled 键值

  - _Requirements: 12.1, 12.2, 12.3, 12.4_


- [x] 25. Implement Admin Topic Management API

  - 在 `src/routes/admin.ts` 中实现 POST `/admin/topic` 接口
  - 接收 { id, title, cover_img, description } 数据，存储到 topics 表
  - 实现 POST `/admin/topic/items` 接口，接收 { topic_id, vod_ids } 数据

  - 批量插入到 topic_items 表并设置 sort_order

  - _Requirements: 13.1, 13.2, 13.3_

- [x] 26. Implement Admin System Configuration API

  - 在 `src/routes/admin.ts` 中实现 POST `/admin/config/welfare` 接口
  - 更新 system_config 表的 welfare_enabled 键值
  - 实现 POST `/admin/release` 接口，接收 { version, url, force, changelog } 数据

  - 更新 system_config 表的 app_version 和 force_update_min_ver 键值
  - 实现 POST `/admin/cache/purge` 接口，删除 KV 中所有布局和短剧相关的缓存键

  - _Requirements: 27.1, 27.2, 15.1, 15.2, 16.1, 16.2_

- [x] 27. Implement Admin Feedback, App Wall and Shorts API

  - 在 `src/routes/admin.ts` 中实现 GET `/admin/feedback` 接口
  - 查询 feedback 表返回所有未处理的反馈
  - 实现 PATCH `/admin/feedback/:id` 接口，更新反馈状态为 processed
  - 实现 GET `/admin/app_wall` 接口，查询 app_wall 表返回所有推广应用
  - 实现 POST `/admin/app_wall` 接口，接收应用数据并存储
  - 实现 DELETE `/admin/app_wall/:id` 接口，删除指定推广应用

  - 实现 GET `/admin/shorts` 接口，查询 shorts_cache 表返回所有短剧列表
  - 实现 DELETE `/admin/shorts/:id` 接口（下架功能）
  - 实现 PATCH `/admin/shorts/:id/pin` 接口（置顶功能）
  - _Requirements: 28.3, 28.4, 29.1, 29.2, 29.3_

- [x] 28. Implement Admin Hot Search and System Settings API

  - 在 `src/routes/admin.ts` 中实现 GET `/admin/hot_search` 接口
  - 从 system_config 表读取 hot_search_keywords 键值（JSON 数组）
  - 实现 POST `/admin/hot_search` 接口，接收热搜词数组并更新 system_config 表
  - 实现 POST `/admin/config/contact` 接口，接收客服联系方式、官方群组链接
  - 更新 system_config 表的 customer_service 和 official_group 键值
  - 实现 POST `/admin/config/marquee` 接口，接收通告文本和跳转链接
  - 更新 system_config 表的 marquee_text 和 marquee_link 键值
  - 实现 GET `/admin/config/permanent_urls` 接口，读取永久网址列表
  - 实现 POST `/admin/config/permanent_urls` 接口，接收网址数组并更新 system_config 表
  - _Requirements: 21.2, 35.1, 35.2, 36.1, 36.2_

- [x] 29. Configure Cron triggers and implement handler


  - 在 `wrangler.toml` 中添加 `[triggers]` 配置
  - 设置短剧抓取任务每 12 小时执行一次（cron: "0 */12 * * *"）
  - 在 `src/index.ts` 中实现 `scheduled(event, env, ctx)` 导出函数
  - 根据 event.cron 判断任务类型，调用 Shorts Engine 的 fetchShorts 函数
  - 记录执行日志
  - _Requirements: 5.1, 5.2_





- [x] 30. Implement main entry point and routing


  - 在 `src/index.ts` 中创建 Hono app 实例
  - 配置 CORS 中间件
  - 注册所有路由（layout, vod, shorts, auth, system, admin, proxy）
  - 导出 default 和 scheduled 函数
  - 创建 `src/config.ts` 定义资源站 API 地址、TMDB/豆瓣 API Key、短剧源站、福利源站地址
  - _Requirements: 所有 API 需求_

- [ ]* 31. Write backend tests and deploy
  - 为 Spider Aggregator、Ad Injector、JWT 工具编写单元测试（使用 Vitest）
  - 为 Layout API、Shorts API、Admin API 编写集成测试
  - 执行 `npx wrangler d1 execute robin-db --remote --file=./schema.sql` 应用生产数据库表结构
  - 在 Cloudflare Dashboard 配置环境变量
  - 执行 `npx wrangler publish` 部署到生产环境
  - 验证所有 API 端点可访问
  - _Requirements: 1.1-1.5, 所有测试需求_

---

## Phase 2: Admin Panel Development

- [x] 32. Initialize Admin Panel project



  - 在 `I:\ProjectRobin\admin` 创建 React 项目（使用 Vite）
  - 安装依赖：`react`, `react-dom`, `@refinedev/core`, `@refinedev/antd`, `antd`, `axios`
  - 配置 `vite.config.ts`
  - 创建基础目录结构（src/pages, src/components, src/services）
  - _Requirements: Admin Panel 相关需求_

- [x] 33. Implement authentication and API client



  - 创建 `src/services/api.ts`，配置 axios 实例
  - 实现请求拦截器（自动添加 x-admin-key header）
  - 实现响应拦截器（处理 403 错误跳转登录）
  - 创建 `src/pages/Login.tsx` 登录页面
  - 实现密钥输入和 LocalStorage 存储
  - _Requirements: 9.1, 9.4, 9.5_



- [x] 34. Implement Dashboard page

  - 创建 `src/pages/Dashboard.tsx`
  - 实现数据获取（调用 GET /admin/dashboard）
  - 使用 Ant Design Card 组件显示总用户数、今日活跃
  - 使用 Badge 组件显示 API 健康状态（绿色/红色）
  - 使用 Ant Design Charts 绘制 7 天趋势折线图
  - 添加快捷入口按钮（发布新版、清空缓存、切换备用源）
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 35. Implement Layout Editor page


- [x] 35.1 Create Layout Editor structure


  - 创建 `src/pages/LayoutEditor.tsx`
  - 实现三栏布局（左侧频道选择器、中间画布、右侧属性编辑器）
  - 使用 Ant Design Layout 组件
  - _Requirements: 11.1_
- [x] 35.2 Implement channel selector and canvas


  - 在左侧实现频道列表（精选、电影、剧集、Netflix、短剧、动漫、综艺、福利）
  - 点击频道时调用 GET /admin/layout?tab={id} 获取模块列表
  - 在中间画布显示模块列表
  - 使用 React DnD 实现拖拽排序功能
  - 拖拽后更新模块的 sort_order 值
  - _Requirements: 11.2, 11.3_
- [x] 35.3 Implement module inspector


  - 在右侧实现属性编辑器
  - 点击模块时显示该模块的属性表单
  - 根据 module_type 动态渲染不同的表单字段
  - 实现跳转指令下拉框（跳转视频/跳转网页）自动生成前缀
  - _Requirements: 11.4_
- [x] 35.4 Implement save and publish


  - 添加"保存发布"按钮
  - 点击时调用 POST /admin/layout 接口
  - 发送 { tab_id, modules } 数据
  - 保存成功后显示提示消息
  - _Requirements: 11.5, 11.6_


- [x] 36. Implement Ad Management page


- [x] 36.1 Create Ad Management interface



  - 创建 `src/pages/AdManagement.tsx`
  - 实现广告列表（使用 Ant Design Table 组件）
  - 调用 GET /admin/ads 获取广告数据
  - 显示广告位置、类型、素材 URL、跳转地址、权重、状态
  - _Requirements: 12.1_
- [x] 36.2 Implement ad creation and editing


  - 实现"添加广告"按钮，打开 Modal 表单
  - 表单字段：location、content_type、media_url、action_type、action_url、weight
  - 图片 URL 输入后立即显示预览图
  - 提交时调用 POST /admin/ads 接口
  - 实现编辑功能（点击表格行打开 Modal 预填数据）
  - _Requirements: 12.2, 12.5_

- [x] 36.3 Implement ad deletion and global switch

  - 在表格添加"删除"操作列，点击删除时调用 DELETE /admin/ads/:id 接口
  - 在页面顶部添加红色醒目的"一键熔断"按钮
  - 点击时调用 POST /admin/config/ads_global_switch 接口设置 enable=false
  - 显示确认对话框
  - _Requirements: 12.3, 12.4_
- [x] 36.4 Implement advanced ad strategies

  - 添加"投放策略"Tab
  - 配置开屏广告：选择素材、倒计时、每日频次
  - 配置短剧插播：频率、素材列表
  - 配置暂停贴片：上传图片
  - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5_

- [x] 37. Implement Topic and Content Management pages

- [x] 37.1 Create Topic Management page



  - 创建 `src/pages/TopicManagement.tsx`
  - 实现专题列表（使用 Ant Design Table 组件）
  - 添加"新建专题"按钮，打开 Modal 表单
  - 表单字段：id、title、cover_img、description
  - 提交时调用 POST /admin/topic 接口
  - _Requirements: 13.1_
- [x] 37.2 Implement topic content management


  - 为每个专题添加"管理内容"按钮
  - 打开 Modal 显示当前专题的视频列表
  - 实现搜索功能（输入关键词搜索视频）
  - 勾选视频后点击"添加"按钮，调用 POST /admin/topic/items 接口
  - 支持拖拽调整专题内视频的排序
  - _Requirements: 13.2, 13.4, 13.5_


- [x] 37.3 Create Shorts Management page

  - 创建 `src/pages/ShortsManagement.tsx`
  - 实现短剧列表（使用 Ant Design Table 组件）
  - 显示短剧名称、封面、分类、抓取时间
  - 添加操作列：预览、下架、置顶
  - _Requirements: 短剧管理需求_


- [x] 38. Implement System Configuration pages

- [x] 38.1 Create Source Management page


  - 创建 `src/pages/SourceManagement.tsx`
  - 实现资源站列表（使用 Ant Design Table 组件）
  - 显示资源站名称、API 地址、权重、状态开关
  - 支持拖拽调整资源站顺序（更新权重值）
  - 添加状态开关（Switch 组件）控制资源站启用/禁用
  - 添加"福利源配置"区域，输入福利源 API 地址、加密 Key
  - 添加全局开关控制福利频道显示/隐藏
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_


- [x] 38.2 Create Version Management page

  - 创建 `src/pages/VersionManagement.tsx`
  - 实现版本发布表单，字段：version、url、changelog、force（勾选框）
  - 提交时调用 POST /admin/release 接口
  - 显示历史版本列表

  - _Requirements: 15.1, 15.2_



- [x] 38.3 Create Cache Management page
  - 创建 `src/pages/CacheManagement.tsx`
  - 添加"清除 D1 缓存"按钮
  - 添加"清除首页布局缓存"按钮
  - 点击时调用 POST /admin/cache/purge 接口
  - 显示操作成功提示
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 38.4 Create Feedback Inbox page

  - 创建 `src/pages/FeedbackInbox.tsx`
  - 实现反馈列表（使用 Ant Design Table 组件）
  - 调用 GET /admin/feedback 获取未处理的反馈
  - 显示用户 ID、反馈内容、联系方式、提交时间
  - 添加"标记已处理"按钮，点击时调用 PATCH /admin/feedback/:id 接口
  - _Requirements: 28.3, 28.4_



- [x] 38.5 Create App Wall Management page

  - 创建 `src/pages/AppWallManagement.tsx`
  - 实现推广应用列表（使用 Ant Design Table 组件）
  - 调用 GET /admin/app_wall 获取应用数据
  - 添加"新增应用"按钮，打开 Modal 表单
  - 表单字段：app_name、icon_url、download_url、commission、sort_order
  - 提交时调用 POST /admin/app_wall 接口
  - 支持编辑和删除操作
  - _Requirements: 29.1, 29.2, 29.3_

- [x] 38.6 Create Hot Search and System Settings pages

  - 创建 `src/pages/HotSearchConfig.tsx`
  - 实现热搜词列表管理，支持添加、编辑、删除、排序热搜词
  - 调用 GET /admin/hot_search 和 POST /admin/hot_search 接口
  - 在系统配置页面添加"联系方式"配置区域
  - 输入客服联系方式、官方群组链接，调用 POST /admin/config/contact 接口
  - 完善"滚动通告"配置，添加跳转链接字段，调用 POST /admin/config/marquee 接口
  - 添加"永久网址"配置区域，支持添加、编辑、删除多个备用域名
  - 调用 GET /admin/config/permanent_urls 和 POST /admin/config/permanent_urls 接口
  - _Requirements: 21.2, 35.1, 35.2, 36.1, 36.2_


- [x] 39. Implement Admin Panel routing and deploy


  - 创建 `src/App.tsx`，使用 React Router 配置路由
  - 实现侧边栏导航菜单（Dashboard、布局编辑器、广告管理、专题管理、系统配置等）
  - 使用 Ant Design Pro Layout 组件
  - 实现顶部用户信息显示（显示管理员标识）
  - 执行 `npm run build` 构建生产版本
  - 在 Cloudflare Pages 创建项目并部署
  - 配置构建命令：`npm run build`，输出目录：`dist`
  - _Requirements: Admin Panel 所有页面需求_

---

## Phase 3: Mobile APP Development

- [x] 40. Initialize Flutter project and core infrastructure





  - 在 `I:\ProjectRobin\app` 创建 Flutter 项目
  - 配置 `pubspec.yaml` 添加依赖：GetX, Dio, MediaKit, CachedNetworkImage, DLNA
  - 创建基础目录结构：lib/config, lib/core, lib/modules, lib/widgets
  - 配置 assets 文件夹存放 Logo、默认头像、占位图
  - 设置 Android 和 iOS 最低版本要求
  - _Requirements: 17.1, 34.1_


- [x] 41. Implement core services and utilities



- [x] 41.1 Create HTTP client service


  - 创建 `lib/core/http_client.dart`
  - 使用 Dio 配置 HTTP 客户端
  - 实现请求拦截器（自动添加 token）
  - 实现响应拦截器（统一错误处理）
  - 配置超时时间和重试策略
  - _Requirements: 31.3_

- [x] 41.2 Implement universal router


  - 创建 `lib/core/router.dart`
  - 实现 `video://` 协议跳转到视频详情
  - 实现 `browser://` 协议打开系统浏览器
  - 实现 `webview://` 协议打开内部 WebView
  - 实现 `deeplink://` 协议处理深链接
  - _Requirements: 17.3_

- [x] 41.3 Create user state management


  - 创建 `lib/core/user_store.dart`
  - 使用 GetX 管理用户登录状态
  - 实现 token 本地存储和读取
  - 实现自动登录逻辑
  - _Requirements: 19.5_

- [x] 41.4 Implement force update checker


  - 创建 `lib/core/updater.dart`
  - 在 APP 启动时请求 `/api/version` 接口
  - 解析 force 字段判断是否强制更新
  - 显示不可关闭的更新弹窗
  - 实现跳转浏览器下载功能
  - _Requirements: 15.3, 15.4_

- [x] 42. Implement splash screen and startup flow



  - 创建 `lib/modules/splash/splash_page.dart`
  - 显示 Logo 启动页持续 1-2 秒
  - 请求开屏广告接口
  - 显示开屏广告 3-5 秒带倒计时和跳过按钮
  - 检查每日频次限制
  - 完成后跳转到首页
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [x] 43. Create bottom navigation and root container




  - 创建 `lib/modules/root/root_page.dart`
  - 实现底部导航栏包含 4 个 Tab：首页、片库、短剧、我的
  - 使用 GetX 管理 Tab 切换状态
  - 配置每个 Tab 对应的页面路由
  - 实现磨砂玻璃效果的底部导航栏
  - _Requirements: 17.1, 34.4_

- [x] 44. Implement home page dynamic rendering






- [x] 44.1 Create home page structure



  - 创建 `lib/modules/home/home_page.dart`
  - 实现顶部结构：Logo + 搜索框
  - 搜索框点击跳转到搜索页面
  - 实现频道栏（Tab切换）
  - 实现下拉刷新功能
  - _Requirements: 17.1, 21.1_

- [x] 44.2 Create dynamic renderer engine



  - 创建 `lib/modules/home/dynamic_renderer.dart`
  - 实现根据 `module_type` 渲染对应组件的逻辑
  - 支持 carousel、grid_icons、grid_3x2_ad、timeline、week_timeline 类型
  - 实现模块数据解析和验证
  - _Requirements: 17.2_

- [x] 44.3 Implement hero carousel component



  - 创建 `lib/modules/home/widgets/hero_carousel.dart`
  - 使用 PageView 实现轮播图
  - 支持自动播放和手动滑动
  - 实现点击跳转逻辑（解析 jump_action）
  - 添加指示器显示当前页
  - _Requirements: 17.3_

- [x] 44.4 Implement marquee announcement bar



  - 创建 `lib/modules/home/widgets/marquee_bar.dart`
  - 实现跑马灯滚动效果
  - 支持点击跳转
  - 从布局数据中读取通告文本
  - _Requirements: 35.4_

- [x] 44.5 Implement grid menu (金刚区)



  - 创建 `lib/modules/home/widgets/grid_menu.dart`
  - 实现 5xN 网格布局
  - 显示图标和文字
  - 实现点击跳转逻辑
  - _Requirements: 17.4_

- [x] 44.6 Implement mixed grid with ads



  - 创建 `lib/modules/home/widgets/mixed_grid.dart`
  - 实现 3x2 或 3x3 网格布局
  - 在指定位置插入广告卡片
  - 标记广告卡片（is_ad 字段）
  - 实现广告点击跳转
  - _Requirements: 17.5, 6.1_

- [x] 44.7 Implement time tree component



  - 创建 `lib/modules/home/widgets/time_tree.dart`
  - 实现时间在下、内容在上的横滑列表
  - 显示上映时间和视频信息
  - _Requirements: 17.6_

- [x] 44.8 Implement week timeline component



  - 创建 `lib/modules/home/widgets/week_timeline.dart`
  - 实现周一至周日标签切换
  - 点击或滑动切换下方内容
  - 显示每周更新的番剧列表
  - _Requirements: 17.7_

- [x] 44.9 Implement channel switcher
  - 在首页顶部实现频道切换 Tab
  - 支持左右滑动切换频道
  - 切换时请求对应 tab_id 的布局数据
  - 实现频道缓存避免重复请求
  - _Requirements: 17.8_

- [x] 44.10 Implement continue watching section
  - 在首页精选频道添加"继续观看"横滑列表
  - 仅在用户登录时显示
  - 从观看历史中获取数据
  - 显示观看进度条
  - 点击继续播放
  - _Requirements: 19.7, 23.3_

- [x] 45. Implement shorts dual-mode player

- [x] 45.1 Create shorts random flow mode
  - 创建 `lib/modules/shorts/shorts_player.dart`
  - 实现全屏竖屏播放器
  - 使用 PageView 实现上下滑动切换
  - 请求 `/api/shorts/random` 接口获取随机流
  - 实现无限滚动加载更多
  - _Requirements: 18.1, 18.2_

- [x] 45.2 Implement shorts detail mode
  - 创建 `lib/modules/shorts/shorts_detail_page.dart`
  - 顶部显示 16:9 播放器
  - 中间显示剧名、简介、选集列表
  - 底部显示推荐短剧
  - 进入时自动播放
  - _Requirements: 18.5, 18.6_

- [x] 45.3 Implement shorts locked mode
  - 在详情页播放器添加全屏按钮
  - 点击全屏切换到竖屏锁定模式
  - 锁定当前短剧，上下滑切换集数
  - 右侧显示选集抽屉
  - 点击返回切回详情页
  - _Requirements: 18.7, 18.8_

- [x] 45.4 Implement shorts guidance
  - 在随机流模式播放到 30% 时显示引导
  - 显示"观看完整版"按钮
  - 点击跳转到短剧详情页
  - _Requirements: 18.3, 18.4_

- [x] 46. Implement video player with DLNA

- [x] 46.1 Create video player component
  - 创建 `lib/widgets/player/video_player.dart`
  - 使用 MediaKit 实现视频播放
  - 实现播放、暂停、进度条控制
  - 实现倍速播放（0.5x, 1.0x, 1.25x, 1.5x, 2.0x）
  - 记录播放进度到本地
  - _Requirements: 20.1, 20.2, 20.6_

- [x] 46.2 Implement DLNA casting
  - 在播放器控制栏添加投屏按钮
  - 扫描局域网内的 DLNA 设备
  - 实现设备选择界面
  - 推送视频流到选中设备
  - 显示投屏状态
  - _Requirements: 20.3, 20.4, 20.5_

- [x] 46.3 Implement pause overlay ad
  - 在播放器暂停时显示贴片广告
  - 从后端获取暂停广告配置
  - 实现广告点击跳转
  - _Requirements: 33.3, 33.4_

- [x] 47. Implement video detail page

  - 创建 `lib/modules/detail/detail_page.dart`
  - 顶部显示视频播放器
  - 显示视频标题、年份、地区、导演、演员
  - 显示剧情简介
  - 显示选集列表（横排滚动）
  - 底部显示推荐视频
  - 实现收藏和预约按钮
  - 实现英雄动画过渡效果
  - _Requirements: 22.2, 34.2, 37.1_

- [x] 48. Implement library page with filters

  - 创建 `lib/modules/library/library_page.dart`
  - 顶部实现胶囊筛选器（类型、地区、年份、排序）
  - 使用双列瀑布流布局显示视频列表
  - 实现下拉刷新和上拉加载更多
  - 在列表中间随机插入原生大图广告
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

- [x] 49. Implement search functionality

- [x] 49.1 Create search page
  - 创建 `lib/modules/search/search_page.dart`
  - 显示搜索输入框
  - 默认显示热搜词列表
  - 显示本地搜索历史
  - _Requirements: 21.1, 21.2_

- [x] 49.2 Implement search results
  - 提交搜索时请求 `/api/search` 接口
  - 显示搜索结果列表
  - 在首位插入伪装广告
  - 保存搜索关键词到本地历史
  - _Requirements: 21.3, 21.4, 21.5, 21.6_

- [x] 50. Implement user authentication



- [x] 50.1 Create login and register pages



  - 创建 `lib/modules/auth/login_page.dart`
  - 创建 `lib/modules/auth/register_page.dart`
  - 实现用户名密码输入表单
  - 实现表单验证
  - _Requirements: 19.1, 19.3_

- [x] 50.2 Implement authentication logic


  - 注册时发送 POST `/auth/register` 请求
  - 登录时发送 POST `/auth/login` 请求
  - 接收并存储 JWT token
  - 在后续请求中自动携带 token
  - _Requirements: 19.2, 19.4, 19.5_

- [x] 50.3 Implement watch history sync


  - 在视频播放时定期发送同步请求
  - 发送 POST `/user/sync` 包含进度信息
  - 实现断点续播功能
  - _Requirements: 19.6, 19.7_

- [x] 51. Implement profile page



- [x] 51.1 Create profile page structure



  - 创建 `lib/modules/profile/profile_page.dart`
  - 未登录时显示默认头像和登录提示
  - 已登录时显示用户头像、昵称、ID
  - _Requirements: 23.1, 23.2_

- [x] 51.2 Implement profile menu items



  - 添加观看历史入口
  - 添加我的预约入口
  - 添加我的收藏入口
  - 添加应用中心入口（WebView）
  - 添加分享 APP 入口
  - 添加换源设置入口
  - 添加求片/反馈入口
  - 添加清除缓存入口
  - 添加联系客服和官方群组入口
  - 添加永久网址入口
  - _Requirements: 23.3, 23.4, 23.5, 23.6, 23.7, 23.8_

- [x] 51.3 Create watch history page



  - 创建 `lib/modules/profile/history_page.dart`
  - 请求 GET `/api/user/history` 接口
  - 显示观看历史列表（视频封面、标题、观看进度）
  - 实现点击继续播放功能
  - 实现删除历史记录功能
  - _Requirements: 19.7, 23.3_

- [x] 51.4 Create favorites page



  - 创建 `lib/modules/profile/favorites_page.dart`
  - 请求 GET `/api/user/favorites` 接口
  - 显示收藏列表（视频封面、标题）
  - 实现点击跳转到详情页
  - 实现取消收藏功能（DELETE `/api/user/favorite/:vod_id`）
  - _Requirements: 19.7, 23.3_

- [x] 51.5 Create permanent URLs page

  - 创建 `lib/modules/profile/permanent_urls_page.dart`
  - 从 `/api/config` 接口获取 permanent_urls 列表
  - 显示永久网址列表
  - 实现一键复制功能
  - _Requirements: 36.3, 36.4, 36.5_

- [x] 51.6 Implement source switching settings

  - 创建 `lib/modules/profile/source_settings_page.dart`
  - 显示可用资源站列表
  - 允许用户选择首选资源站
  - 保存用户选择到本地存储
  - 在视频请求时优先使用用户选择的资源站
  - _Requirements: 23.6_


- [x] 51.7 Implement cache clearing

  - 在个人中心添加清除缓存功能
  - 清除 CachedNetworkImage 的图片缓存
  - 清除视频播放缓存
  - 清除本地搜索历史
  - 显示缓存大小和清除成功提示
  - _Requirements: 23.8_



- [x] 51.8 Implement contact and support

  - 从 `/api/config` 接口获取 customer_service 和 official_group
  - 在个人中心显示联系客服入口（显示联系方式或打开聊天）
  - 在个人中心显示官方群组入口（打开群组链接）
  - 实现一键复制联系方式功能
  - _Requirements: 28.5_



- [x] 51.10 Implement app update checker

  - 在个人中心添加"APP更新"入口
  - 点击时请求 `/api/version` 接口
  - 显示当前版本和最新版本
  - 如果有新版本，显示更新按钮
  - 点击更新跳转浏览器下载
  - _Requirements: 15.3, 15.4_


- [x] 51.9 Implement share poster generator

  - 创建 `lib/widgets/share_poster.dart`
  - 生成带二维码的精美海报
  - 实现保存到相册功能
  - 实现分享到社交平台功能
  - _Requirements: 23.5_

- [x] 52. Implement feedback and appointment



- [x] 52.1 Create feedback page


  - 创建 `lib/modules/profile/feedback_page.dart`
  - 实现反馈内容输入框
  - 实现联系方式输入框
  - 发送 POST `/api/feedback` 请求
  - _Requirements: 28.1_


- [-] 52.2 Implement appointment system

  - 在视频详情页添加预约按钮
  - 发送 POST `/api/appointment` 请求
  - 创建 `lib/modules/profile/appointments_page.dart`
  - 请求 GET `/api/user/appointments` 接口
  - 显示预约的作品列表（封面、标题、上映时间）
  - 实现取消预约功能（DELETE `/api/appointment/:vod_id`）
  - _Requirements: 37.2, 37.3, 37.4_

- [x] 53. Implement app wall (应用中心)




  - 创建 `lib/modules/profile/app_wall_page.dart`
  - 使用 WebView 加载应用列表
  - 请求 `/api/app_wall` 接口
  - 显示应用图标、名称、下载链接
  - 实现点击跳转下载
  - _Requirements: 29.4, 29.5_

- [x] 54. Implement common widgets




- [x] 54.1 Implement image proxy widget


  - 创建 `lib/widgets/net_image.dart`
  - 自动将图片 URL 转换为代理 URL
  - 使用 CachedNetworkImage 实现缓存
  - 显示加载占位符和错误图标
  - _Requirements: 7.1, 30.3_

- [x] 54.2 Implement banner ad widget


  - 创建 `lib/widgets/ad_banner.dart`
  - 显示横幅广告
  - 支持图片和视频广告
  - 实现点击跳转逻辑
  - 在首页各频道中使用
  - _Requirements: 6.1, 6.2_

- [x] 54.3 Implement WebView component


  - 创建 `lib/modules/webview/webview_page.dart`
  - 使用 WebView 加载网页
  - 支持前进后退和刷新
  - 显示加载进度条
  - 用于广告落地页和应用中心
  - _Requirements: 29.4_

- [x] 55. Implement configuration files




- [x] 55.1 Create theme configuration


  - 创建 `lib/config/theme.dart`
  - 定义暗黑主题（背景色 #121212）
  - 定义主色调（琥珀金 #FFC107）
  - 配置全局字体和文字样式
  - 实现磨砂玻璃效果样式
  - _Requirements: 34.1, 34.4_



- [ ] 55.2 Create API configuration
  - 创建 `lib/config/api_config.dart`
  - 定义后端API基础URL
  - 支持动态切换API地址
  - 配置超时时间和重试策略


  - _Requirements: 1.1_

- [ ] 55.3 Create ad configuration
  - 创建 `lib/config/ad_config.dart`
  - 定义各个广告位的ID
  - 配置广告展示策略
  - 配置广告频次限制
  - _Requirements: 6.1, 33.1_

- [x] 56. Implement global error handling




- [x] 56.1 Create error handling utilities


  - 创建 `lib/core/error_handler.dart`
  - 实现网络错误处理
  - 实现 UI 错误显示组件
  - 实现重试逻辑
  - _Requirements: 31.3_

- [x] 56.2 Implement crash reporting


  - 在 main.dart 中使用 runZonedGuarded
  - 捕获未处理的异常
  - Release 模式发送到 `/api/system/crash_report`
  - Debug 模式仅打印日志
  - _Requirements: 8.1_

- [x] 57. Implement performance optimizations



  - 使用 ListView.builder 实现虚拟滚动
  - 配置 CachedNetworkImage 缓存大小（500MB）
  - 使用 GetX 响应式状态管理避免不必要的重建
  - 实现图片懒加载
  - 优化首屏加载时间
  - _Requirements: 30.2, 30.3, 30.4_

- [x] 58. Implement skeleton loading screens




  - 创建 `lib/widgets/skeleton.dart`
  - 实现骨架屏组件
  - 添加流光动画效果
  - 在各个页面加载时显示骨架屏
  - _Requirements: 34.3_

- [x] 59. Configure Android and iOS builds





  - 配置 Android 应用图标和启动页
  - 配置 iOS 应用图标和启动页
  - 设置应用名称和包名
  - 配置权限（网络、存储、相机等）
  - 配置签名和证书
  - _Requirements: 40.1_

- [ ] 60. Testing and optimization

- [ ]* 60.1 Write widget tests
  - 为核心组件编写 Widget 测试
  - 测试动态渲染引擎
  - 测试播放器组件
  - 测试路由跳转逻辑
  - _Requirements: 所有 Mobile APP 需求_

- [ ]* 60.2 Write integration tests
  - 测试完整的用户流程
  - 测试登录注册流程
  - 测试视频播放流程
  - 测试搜索和筛选流程
  - _Requirements: 所有 Mobile APP 需求_

- [ ]* 60.3 Performance testing
  - 测试首屏加载时间
  - 测试列表滚动性能
  - 测试内存占用
  - 优化性能瓶颈
  - _Requirements: 30.1-30.6_

- [ ] 60.4 Build and package
  - 执行 `flutter build apk --release` 构建 Android APK
  - 执行 `flutter build ios --release` 构建 iOS IPA
  - 测试安装包在真机上的运行
  - 准备上架应用商店
  - _Requirements: 所有 Mobile APP 需求_

---

## Summary

本实现计划包含 39 个主要任务（Backend: 31个，Admin Panel: 8个），覆盖了拾光影视平台后端和管理后台的完整开发流程。

**当前优先级：**
1. **Phase 1 (Backend)**: 任务 1-31，预计 2-3 周
2. **Phase 2 (Admin Panel)**: 任务 32-39，预计 1-2 周
3. **Phase 3 (Mobile APP)**: 待 Phase 1-2 完成后开始

**开发建议：**
- 先完成任务 1-3（项目初始化和数据库）
- 然后完成任务 4-10（核心服务）
- 接着完成任务 11-20（公共 API）
- 再完成任务 21-28（Admin API）
- 最后完成任务 29-31（Cron、路由、部署）
