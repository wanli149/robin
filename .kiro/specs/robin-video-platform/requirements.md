# Requirements Document

## Introduction

拾光影视 (Project Robin) 是一个商业级影视聚合平台，采用 Cloudflare Workers + D1 作为后端基础设施，Flutter 作为移动端，React 作为管理后台。系统核心特点是"后端驱动的动态配置"，通过管理后台可视化编辑器实现 APP 首页布局的实时控制，无需发版即可调整内容展示。项目包含三个主要子系统：Backend API (Cloudflare Workers)、Admin Panel (React SPA)、Mobile APP (Flutter)。

## Glossary

- **Backend_System**: 基于 Cloudflare Workers 的无服务器后端系统，负责 API 服务、数据聚合、定时任务
- **D1_Database**: Cloudflare 的 SQLite 数据库服务，存储用户、配置、布局、广告等核心数据
- **KV_Cache**: Cloudflare 的键值存储服务，用于缓存热点数据
- **Admin_Panel**: 基于 React 的 Web 管理控制台，用于配置 APP 布局、广告、内容
- **Mobile_APP**: 基于 Flutter 的跨平台移动应用，支持 Android/iOS
- **Dynamic_Layout**: 动态布局系统，APP 首页完全由后端 page_modules 表驱动
- **Shorts_Engine**: 短剧引擎，支持抖音模式的竖屏无限流播放
- **Spider_Aggregator**: 聚合爬虫服务，并发请求多个视频资源站
- **Ad_Injector**: 广告注入器，在内容列表中按策略插入广告
- **Cron_Job**: 定时任务，用于定期抓取短剧数据
- **TMDB_API**: The Movie Database API，用于获取高质量电影海报
- **DingTalk_Webhook**: 钉钉机器人 Webhook，用于系统监控告警
- **DLNA**: Digital Living Network Alliance，用于投屏功能
- **VIP_User**: 会员用户，享有免广告等特权
- **Welfare_Channel**: 福利频道，可通过后台开关控制显示/隐藏

## Requirements

### Requirement 1: Backend Infrastructure Setup

**User Story:** 作为系统管理员，我需要建立 Cloudflare Workers 后端基础设施，以便为 APP 和 Admin 提供 API 服务

#### Acceptance Criteria

1. WHEN Backend_System 初始化时，THE Backend_System SHALL 创建 D1_Database 实例并命名为 "robin-db"
2. WHEN Backend_System 配置时，THE Backend_System SHALL 绑定 KV_Cache 命名空间用于数据缓存
3. WHEN Backend_System 部署时，THE Backend_System SHALL 在 wrangler.toml 中配置 JWT_SECRET 和 DingTalk_Webhook 环境变量
4. WHEN Backend_System 启动时，THE Backend_System SHALL 执行 schema.sql 创建所有必需的数据库表
5. WHERE nodejs_compat 兼容性标志启用，THE Backend_System SHALL 支持 Node.js 标准库功能


### Requirement 2: Database Schema Design

**User Story:** 作为后端开发者，我需要设计完整的数据库表结构，以便存储用户、内容、布局、广告等核心数据

#### Acceptance Criteria

1. THE Backend_System SHALL 创建 users 表存储用户账号、密码哈希、VIP 状态和设备指纹
2. THE Backend_System SHALL 创建 history 表和 favorites 表支持多端同步的观看历史和收藏功能
3. THE Backend_System SHALL 创建 home_tabs 表和 page_modules 表实现 Dynamic_Layout 系统
4. THE Backend_System SHALL 创建 topics 表和 topic_items 表支持人工策展的专题内容
5. THE Backend_System SHALL 创建 shorts_cache 表存储预抓取的短剧数据供 Shorts_Engine 使用
6. THE Backend_System SHALL 创建 anime_timeline 表存储每周更新的番剧时间表
7. THE Backend_System SHALL 创建 ads_inventory 表存储广告素材和投放策略
8. THE Backend_System SHALL 创建 system_config 表存储版本号、强制更新标志、福利频道密码等系统配置
9. THE Backend_System SHALL 创建 daily_stats 表记录每日 API 调用量和活跃用户数

### Requirement 3: Dynamic Layout API

**User Story:** 作为 APP 开发者，我需要获取动态布局配置，以便根据后端配置实时渲染首页内容

#### Acceptance Criteria

1. WHEN Mobile_APP 请求 /home_layout 接口并传入 tab 参数时，THE Backend_System SHALL 返回该频道的 modules 数组
2. WHEN Backend_System 处理布局请求时，THE Backend_System SHALL 从 page_modules 表查询指定 tab_id 的所有模块并按 sort_order 排序
3. WHEN Backend_System 返回模块数据时，THE Backend_System SHALL 包含 module_type、title、api_params、ad_config 等完整字段
4. WHEN Backend_System 处理布局请求时，THE Backend_System SHALL 异步记录访问统计到 daily_stats 表
5. WHERE KV_Cache 中存在布局缓存，THE Backend_System SHALL 优先返回缓存数据以提升响应速度

### Requirement 4: Video Aggregation Service

**User Story:** 作为用户，我需要搜索和浏览影视内容，以便找到想看的电影或剧集

#### Acceptance Criteria

1. WHEN Mobile_APP 请求视频列表时，THE Spider_Aggregator SHALL 并发向配置的 3 个资源站发起请求
2. IF 某个资源站响应超时，THEN THE Spider_Aggregator SHALL 使用其他资源站的数据确保内容不为空
3. WHEN Mobile_APP 请求搜索接口时，THE Spider_Aggregator SHALL 聚合多个资源站的搜索结果并去重
4. WHERE 请求参数包含 type=welfare 且 Welfare_Channel 开关开启，THE Spider_Aggregator SHALL 请求成人内容资源站
5. WHEN Backend_System 返回视频详情时，THE Backend_System SHALL 包含选集列表、推荐内容和播放地址


### Requirement 5: Shorts Engine with TikTok-style Experience

**User Story:** 作为用户，我需要刷短剧，以便快速消费碎片化内容

#### Acceptance Criteria

1. WHEN Cron_Job 每 12 小时触发时，THE Backend_System SHALL 从短剧源站抓取最新数据并存入 shorts_cache 表
2. WHEN Backend_System 抓取短剧数据时，THE Backend_System SHALL 验证竖屏封面存在性并清洗无效数据
3. WHEN Mobile_APP 请求 /api/shorts/random 接口时，THE Backend_System SHALL 执行 SQL "SELECT * FROM shorts_cache ORDER BY RANDOM() LIMIT 10"
4. WHEN Mobile_APP 请求短剧选集时，THE Backend_System SHALL 返回该短剧的所有集数和播放地址
5. THE Backend_System SHALL 在 shorts_cache 表中存储 vod_id、vod_name、vod_pic_vertical、play_url、category 字段

### Requirement 6: Advertisement Injection System

**User Story:** 作为运营人员，我需要在内容中插入广告，以便实现商业变现

#### Acceptance Criteria

1. WHEN Ad_Injector 处理 3x2 网格布局时，THE Ad_Injector SHALL 在 index=4 位置插入广告素材
2. WHEN Backend_System 返回广告时，THE Backend_System SHALL 从 ads_inventory 表根据 location 和 weight 随机选择
3. WHEN Backend_System 返回广告数据时，THE Backend_System SHALL 包含 media_url、action_type、action_url 字段
4. WHERE VIP_User 请求内容，THE Ad_Injector SHALL 跳过广告注入逻辑
5. WHERE 广告全局开关关闭，THE Ad_Injector SHALL 不注入任何广告

### Requirement 7: Image Proxy Service

**User Story:** 作为用户，我需要正常加载图片，以便浏览电影海报和剧照

#### Acceptance Criteria

1. WHEN Mobile_APP 请求 /img 接口并传入 url 参数时，THE Backend_System SHALL 代理请求该图片 URL
2. WHEN Backend_System 代理图片请求时，THE Backend_System SHALL 设置 User-Agent 为浏览器标识并清空 Referer 头
3. WHEN Backend_System 返回代理图片时，THE Backend_System SHALL 设置 Cache-Control 为 "public, max-age=31536000"
4. IF 图片 URL 无效或请求失败，THEN THE Backend_System SHALL 返回 500 错误状态码
5. THE Backend_System SHALL 保持原始图片的 Content-Type 响应头

### Requirement 8: Crash Reporting and Monitoring

**User Story:** 作为系统管理员，我需要监控 APP 崩溃和系统异常，以便及时修复问题

#### Acceptance Criteria

1. WHEN Mobile_APP 发生崩溃时，THE Mobile_APP SHALL 捕获错误堆栈并发送到 /api/system/crash_report 接口
2. WHEN Backend_System 接收崩溃报告时，THE Backend_System SHALL 异步发送告警到 DingTalk_Webhook
3. WHEN Backend_System 发送钉钉通知时，THE Backend_System SHALL 格式化为 Markdown 消息包含设备型号、错误信息和堆栈前 200 字符
4. WHERE Mobile_APP 运行在 Debug 模式，THE Mobile_APP SHALL 仅打印崩溃日志不上报
5. WHERE Mobile_APP 运行在 Release 模式，THE Mobile_APP SHALL 上报所有未捕获异常


### Requirement 9: Admin Panel Authentication

**User Story:** 作为系统管理员，我需要安全地访问管理后台，以便配置 APP 内容和广告

#### Acceptance Criteria

1. WHEN Admin_Panel 发送请求时，THE Admin_Panel SHALL 在请求头中携带 x-admin-key 字段
2. WHEN Backend_System 接收 /admin 路由请求时，THE Backend_System SHALL 验证 x-admin-key 是否匹配环境变量 ADMIN_SECRET_KEY
3. IF x-admin-key 验证失败，THEN THE Backend_System SHALL 返回 403 状态码和 "Access Denied" 消息
4. WHEN Admin_Panel 首次访问时，THE Admin_Panel SHALL 显示密钥输入框并将密钥存储到 LocalStorage
5. IF Backend_System 返回 403 错误，THEN THE Admin_Panel SHALL 清除 LocalStorage 并跳转到登录页

### Requirement 10: Admin Dashboard

**User Story:** 作为运营人员，我需要查看系统运营数据，以便了解 APP 使用情况

#### Acceptance Criteria

1. WHEN Admin_Panel 请求 /admin/dashboard 接口时，THE Backend_System SHALL 返回最近 7 天的 daily_stats 数据
2. WHEN Backend_System 查询仪表盘数据时，THE Backend_System SHALL 统计 users 表总用户数
3. WHEN Backend_System 返回仪表盘数据时，THE Backend_System SHALL 包含 stats 数组、total_users 数值和 server_status 字符串
4. THE Admin_Panel SHALL 使用折线图展示 API 调用量趋势
5. WHERE server_status 为 "Healthy"，THE Admin_Panel SHALL 显示绿色状态徽章

### Requirement 11: Visual Layout Editor

**User Story:** 作为运营人员，我需要可视化编辑 APP 首页布局，以便无需开发即可调整内容展示

#### Acceptance Criteria

1. WHEN Admin_Panel 加载布局编辑器时，THE Admin_Panel SHALL 显示左侧频道选择器、中间画布和右侧属性编辑器
2. WHEN 运营人员选择频道时，THE Admin_Panel SHALL 请求 /admin/layout?tab={id} 获取该频道的模块列表
3. WHEN 运营人员拖拽模块时，THE Admin_Panel SHALL 更新模块的 sort_order 值
4. WHEN 运营人员点击模块时，THE Admin_Panel SHALL 在右侧显示该模块的属性编辑表单
5. WHEN 运营人员点击保存时，THE Admin_Panel SHALL 发送 POST /admin/layout 请求更新 page_modules 表
6. WHEN 保存成功后，THE Admin_Panel SHALL 显示提示消息建议在 APP 端下拉刷新查看效果

### Requirement 12: Advertisement Management

**User Story:** 作为运营人员，我需要管理广告素材和投放策略，以便控制广告展示

#### Acceptance Criteria

1. WHEN Admin_Panel 请求 /admin/ads 接口时，THE Backend_System SHALL 返回 ads_inventory 表的所有广告记录
2. WHEN 运营人员创建广告时，THE Admin_Panel SHALL 发送 POST /admin/ads 请求包含 location、content_type、media_url、action_type、action_url 字段
3. WHEN 运营人员删除广告时，THE Admin_Panel SHALL 发送 DELETE /admin/ads/{id} 请求
4. WHEN 运营人员点击一键熔断按钮时，THE Admin_Panel SHALL 发送 POST /admin/config/ads_global_switch 请求设置 enable=false
5. THE Admin_Panel SHALL 在输入图片 URL 后立即显示预览图


### Requirement 13: Topic and Content Curation

**User Story:** 作为运营人员，我需要创建和管理专题内容，以便为用户提供精选片单

#### Acceptance Criteria

1. WHEN 运营人员创建专题时，THE Admin_Panel SHALL 发送 POST /admin/topic 请求包含 id、title、cover_img、description 字段
2. WHEN 运营人员添加视频到专题时，THE Admin_Panel SHALL 发送 POST /admin/topic/items 请求包含 topic_id 和 vod_ids 数组
3. WHEN Backend_System 保存专题内容时，THE Backend_System SHALL 在 topic_items 表中为每个视频创建记录并设置 sort_order
4. THE Admin_Panel SHALL 提供搜索功能查找视频并勾选添加到专题
5. THE Admin_Panel SHALL 支持拖拽调整专题内视频的排序

### Requirement 14: Source Management

**User Story:** 作为系统管理员，我需要管理视频资源站配置，以便控制数据来源

#### Acceptance Criteria

1. THE Admin_Panel SHALL 显示所有配置的资源站列表包含名称、API 地址和状态开关
2. WHEN 运营人员调整资源站顺序时，THE Admin_Panel SHALL 更新资源站的权重值
3. WHEN Spider_Aggregator 请求资源站时，THE Spider_Aggregator SHALL 按权重从高到低依次请求
4. WHERE 资源站状态开关关闭，THE Spider_Aggregator SHALL 跳过该资源站
5. THE Admin_Panel SHALL 提供独立的 Welfare_Channel 资源站配置和全局开关

### Requirement 15: Version Management and Force Update

**User Story:** 作为系统管理员，我需要发布 APP 新版本并控制强制更新，以便推送重要更新

#### Acceptance Criteria

1. WHEN 运营人员发布新版本时，THE Admin_Panel SHALL 发送 POST /admin/release 请求包含 version、url、force、changelog 字段
2. WHEN Backend_System 保存版本信息时，THE Backend_System SHALL 更新 system_config 表的 app_version 和 force_update_min_ver 键值
3. WHEN Mobile_APP 启动时，THE Mobile_APP SHALL 请求 /api/version 接口检查更新
4. WHERE Backend_System 返回 force=true，THE Mobile_APP SHALL 显示不可关闭的更新弹窗仅包含"立即更新"按钮
5. WHEN 用户点击立即更新时，THE Mobile_APP SHALL 打开系统浏览器跳转到下载链接

### Requirement 16: Cache Management

**User Story:** 作为系统管理员，我需要清除缓存，以便让配置变更立即生效

#### Acceptance Criteria

1. WHEN 运营人员点击清除缓存时，THE Admin_Panel SHALL 发送 POST /admin/cache/purge 请求
2. WHEN Backend_System 接收清除缓存请求时，THE Backend_System SHALL 删除 KV_Cache 中所有布局和短剧相关的缓存键
3. THE Admin_Panel SHALL 提供"清除 D1 缓存"和"清除首页布局缓存"两个独立按钮
4. WHEN 缓存清除成功后，THE Admin_Panel SHALL 显示操作成功提示
5. THE Backend_System SHALL 在清除缓存后记录操作日志


### Requirement 17: Mobile APP Home Page Dynamic Rendering

**User Story:** 作为用户，我需要浏览首页内容，以便发现感兴趣的影视作品

#### Acceptance Criteria

1. WHEN Mobile_APP 启动时，THE Mobile_APP SHALL 请求 /home_layout?tab=featured 获取精选频道布局
2. WHEN Mobile_APP 接收布局数据时，THE Mobile_APP SHALL 根据 module_type 动态渲染对应组件
3. WHERE module_type 为 "carousel"，THE Mobile_APP SHALL 渲染轮播图组件
4. WHERE module_type 为 "grid_icons"，THE Mobile_APP SHALL 渲染金刚区组件
5. WHERE module_type 为 "grid_3x2_ad"，THE Mobile_APP SHALL 渲染 3x2 混合广告网格组件
6. WHERE module_type 为 "timeline"，THE Mobile_APP SHALL 渲染时间树组件
7. WHERE module_type 为 "week_timeline"，THE Mobile_APP SHALL 渲染周更时间轴组件
8. WHEN 用户切换频道时，THE Mobile_APP SHALL 请求对应 tab_id 的布局数据并重新渲染

### Requirement 18: Shorts Dual-Mode Experience

**User Story:** 作为用户，我需要以不同方式观看短剧，以便根据场景选择合适的观看模式

#### Acceptance Criteria

1. WHEN 用户点击底部"短剧"菜单时，THE Mobile_APP SHALL 进入全屏竖屏模式显示随机短剧流
2. WHEN Mobile_APP 处于短剧随机流模式时，THE Mobile_APP SHALL 支持上下滑动切换视频
3. WHEN 短剧播放到 30% 或结束时，THE Mobile_APP SHALL 显示"观看完整版"引导按钮
4. WHEN 用户点击"观看完整版"时，THE Mobile_APP SHALL 跳转到短剧详情页
5. WHEN 用户从首页点击短剧封面时，THE Mobile_APP SHALL 直接进入短剧详情页
6. WHEN Mobile_APP 显示短剧详情页时，THE Mobile_APP SHALL 在顶部显示 16:9 播放器并自动播放
7. WHEN 用户在详情页点击全屏按钮时，THE Mobile_APP SHALL 切换到全屏竖屏模式锁定当前短剧
8. WHEN Mobile_APP 处于锁定短剧模式时，THE Mobile_APP SHALL 支持上下滑动切换该剧的集数

### Requirement 19: User Authentication and Sync

**User Story:** 作为用户，我需要登录账号，以便同步观看历史和收藏内容

#### Acceptance Criteria

1. WHEN 用户提交注册表单时，THE Mobile_APP SHALL 发送 POST /auth/register 请求包含 username 和 password
2. WHEN Backend_System 处理注册请求时，THE Backend_System SHALL 对密码进行哈希处理并存储到 users 表
3. WHEN 用户提交登录表单时，THE Mobile_APP SHALL 发送 POST /auth/login 请求
4. WHEN Backend_System 验证登录成功时，THE Backend_System SHALL 返回 JWT token
5. WHEN Mobile_APP 接收到 token 时，THE Mobile_APP SHALL 存储到本地并在后续请求中携带
6. WHEN 用户观看视频时，THE Mobile_APP SHALL 定期发送 POST /user/sync 请求同步播放进度
7. WHEN Backend_System 接收同步请求时，THE Backend_System SHALL 更新 history 表的 progress 和 updated_at 字段

### Requirement 20: Video Player with DLNA Support

**User Story:** 作为用户，我需要播放视频并投屏到电视，以便在大屏幕上观看

#### Acceptance Criteria

1. WHEN 用户点击视频时，THE Mobile_APP SHALL 显示播放器并自动开始播放
2. THE Mobile_APP SHALL 支持倍速播放功能包含 0.5x、1.0x、1.25x、1.5x、2.0x 选项
3. THE Mobile_APP SHALL 在播放器控制栏显示投屏按钮
4. WHEN 用户点击投屏按钮时，THE Mobile_APP SHALL 扫描局域网内的 DLNA 设备
5. WHEN 用户选择 DLNA 设备时，THE Mobile_APP SHALL 将视频流推送到该设备播放
6. THE Mobile_APP SHALL 记录播放进度并在退出时保存到本地


### Requirement 21: Search Functionality

**User Story:** 作为用户，我需要搜索影视内容，以便快速找到想看的作品

#### Acceptance Criteria

1. WHEN 用户点击首页搜索框时，THE Mobile_APP SHALL 跳转到搜索页面
2. WHEN 搜索页面加载时，THE Mobile_APP SHALL 显示热搜词列表和本地搜索历史
3. WHEN 用户输入关键词并提交时，THE Mobile_APP SHALL 发送 GET /api/search?wd={keyword} 请求
4. WHEN Backend_System 处理搜索请求时，THE Spider_Aggregator SHALL 并发请求多个资源站并聚合结果
5. WHEN Mobile_APP 显示搜索结果时，THE Mobile_APP SHALL 在首位插入伪装广告
6. THE Mobile_APP SHALL 将搜索关键词保存到本地历史记录

### Requirement 22: Library with Advanced Filters

**User Story:** 作为用户，我需要筛选影视内容，以便按类型、地区、年份查找作品

#### Acceptance Criteria

1. WHEN 用户进入片库页面时，THE Mobile_APP SHALL 显示类型、地区、年份、排序四个筛选器
2. WHEN 用户选择筛选条件时，THE Mobile_APP SHALL 发送 GET /api/vod 请求包含 t、area、year、sort 参数
3. WHEN Mobile_APP 显示片库列表时，THE Mobile_APP SHALL 使用双列瀑布流布局
4. WHEN Mobile_APP 渲染片库列表时，THE Ad_Injector SHALL 在列表中间随机位置插入原生大图广告
5. WHEN 用户滚动到底部时，THE Mobile_APP SHALL 自动加载下一页数据

### Requirement 23: User Profile and Settings

**User Story:** 作为用户，我需要管理个人信息和设置，以便自定义使用体验

#### Acceptance Criteria

1. WHEN 用户未登录时，THE Mobile_APP SHALL 在个人中心显示默认头像和"点击登录"提示
2. WHEN 用户已登录时，THE Mobile_APP SHALL 显示用户头像、昵称和用户 ID
3. THE Mobile_APP SHALL 在个人中心提供观看历史、我的预约、我的收藏入口
4. THE Mobile_APP SHALL 提供应用中心入口跳转到 WebView 显示推广应用列表
5. THE Mobile_APP SHALL 提供分享 APP 功能生成带二维码的精美海报
6. THE Mobile_APP SHALL 提供换源设置允许用户手动选择资源站
7. THE Mobile_APP SHALL 提供求片/反馈功能发送到后端存储
8. THE Mobile_APP SHALL 提供清除缓存功能清理本地图片和视频缓存

### Requirement 24: Splash Screen with Advertisement

**User Story:** 作为用户，我需要看到启动页，作为运营人员，我需要在启动页展示广告

#### Acceptance Criteria

1. WHEN Mobile_APP 启动时，THE Mobile_APP SHALL 显示 Logo 启动页持续 1-2 秒
2. WHEN 启动页结束后，THE Mobile_APP SHALL 请求开屏广告并显示 3-5 秒
3. THE Mobile_APP SHALL 在开屏广告右上角显示倒计时和"跳过"按钮
4. WHEN 用户点击跳过或倒计时结束时，THE Mobile_APP SHALL 进入首页
5. WHERE 开屏广告配置了每日频次限制，THE Mobile_APP SHALL 根据本地记录判断是否展示


### Requirement 25: Metadata Enhancement Service

**User Story:** 作为用户，我需要看到高质量的电影海报，以便获得更好的视觉体验

#### Acceptance Criteria

1. WHEN Admin_Panel 配置轮播图时，THE Admin_Panel SHALL 允许输入电影名称而非直接输入图片 URL
2. WHEN Backend_System 处理轮播图请求时，THE Backend_System SHALL 调用 TMDB_API 搜索电影并获取 backdrop_path
3. WHEN Backend_System 返回轮播图数据时，THE Backend_System SHALL 包含 TMDB 高清横图 URL
4. WHERE TMDB_API 请求失败，THE Backend_System SHALL 降级使用资源站原始图片
5. THE Backend_System SHALL 缓存 TMDB 查询结果到 KV_Cache 避免重复请求

### Requirement 26: Statistics and Analytics

**User Story:** 作为系统管理员，我需要收集使用数据，以便分析用户行为和系统性能

#### Acceptance Criteria

1. WHEN Backend_System 处理任何 API 请求时，THE Backend_System SHALL 异步增加 daily_stats 表的 api_calls 计数
2. WHEN Backend_System 记录统计时，THE Backend_System SHALL 使用 "INSERT ... ON CONFLICT DO UPDATE" 语法确保原子性
3. THE Backend_System SHALL 按日期分组统计数据使用 YYYY-MM-DD 格式
4. WHEN Admin_Panel 请求仪表盘数据时，THE Backend_System SHALL 返回最近 7 天的统计趋势
5. THE Backend_System SHALL 记录统计失败到日志但不影响主请求响应

### Requirement 27: Welfare Channel Control

**User Story:** 作为系统管理员，我需要控制福利频道的显示，以便应对审核要求

#### Acceptance Criteria

1. WHEN Admin_Panel 切换福利频道开关时，THE Admin_Panel SHALL 发送 POST /admin/config/welfare 请求
2. WHEN Backend_System 更新福利开关时，THE Backend_System SHALL 修改 system_config 表的 welfare_enabled 键值
3. WHEN Mobile_APP 请求首页布局时，THE Backend_System SHALL 检查福利开关状态
4. WHERE 福利开关关闭，THE Backend_System SHALL 过滤掉 tab_id 为 "welfare" 的频道
5. WHERE 福利开关开启且用户请求福利内容，THE Spider_Aggregator SHALL 请求成人内容资源站

### Requirement 28: Feedback and Support System

**User Story:** 作为用户，我需要提交反馈和求片请求，以便改善服务质量

#### Acceptance Criteria

1. WHEN 用户提交反馈时，THE Mobile_APP SHALL 发送 POST /api/feedback 请求包含内容和联系方式
2. WHEN Backend_System 接收反馈时，THE Backend_System SHALL 存储到 feedback 表并发送钉钉通知
3. WHEN Admin_Panel 打开反馈信箱时，THE Admin_Panel SHALL 显示所有未处理的反馈列表
4. THE Admin_Panel SHALL 允许运营人员标记反馈为已处理状态
5. THE Mobile_APP SHALL 在个人中心提供联系客服和官方群组入口


### Requirement 29: App Wall Management

**User Story:** 作为运营人员，我需要管理应用中心的推广应用，以便实现应用分发变现

#### Acceptance Criteria

1. WHEN Admin_Panel 管理应用墙时，THE Admin_Panel SHALL 提供添加、编辑、删除推广应用的功能
2. WHEN 运营人员添加应用时，THE Admin_Panel SHALL 收集应用名称、图标 URL、下载链接、佣金单价字段
3. WHEN Backend_System 保存应用数据时，THE Backend_System SHALL 存储到 app_wall 表
4. WHEN Mobile_APP 打开应用中心时，THE Mobile_APP SHALL 请求 /api/app_wall 接口获取应用列表
5. WHEN Mobile_APP 显示应用列表时，THE Mobile_APP SHALL 在 WebView 中渲染并支持点击跳转下载

### Requirement 30: Performance Optimization

**User Story:** 作为用户，我需要快速的响应速度，以便流畅使用 APP

#### Acceptance Criteria

1. WHEN Backend_System 处理高频请求时，THE Backend_System SHALL 优先从 KV_Cache 读取数据
2. WHEN Backend_System 缓存数据时，THE Backend_System SHALL 设置合理的 TTL 避免数据过期
3. WHEN Mobile_APP 加载图片时，THE Mobile_APP SHALL 使用 CachedNetworkImage 组件实现本地缓存
4. WHEN Mobile_APP 渲染长列表时，THE Mobile_APP SHALL 使用虚拟滚动技术减少内存占用
5. WHEN Backend_System 执行数据库查询时，THE Backend_System SHALL 使用索引优化查询性能
6. THE Backend_System SHALL 对所有异步操作使用 executionCtx.waitUntil 避免阻塞主响应

### Requirement 31: Error Handling and Resilience

**User Story:** 作为用户，我需要系统稳定运行，即使部分服务出错也能继续使用

#### Acceptance Criteria

1. WHEN Spider_Aggregator 请求资源站超时时，THE Spider_Aggregator SHALL 降级到备用资源站
2. WHEN Backend_System 发生数据库错误时，THE Backend_System SHALL 记录错误日志并返回友好错误消息
3. WHEN Mobile_APP 网络请求失败时，THE Mobile_APP SHALL 显示重试按钮而非崩溃
4. WHEN Backend_System 调用外部 API 失败时，THE Backend_System SHALL 使用默认值或缓存数据
5. THE Backend_System SHALL 为所有 try-catch 块添加错误日志记录

### Requirement 32: Security and Privacy

**User Story:** 作为用户，我需要我的数据安全，作为系统管理员，我需要防止恶意攻击

#### Acceptance Criteria

1. WHEN Backend_System 存储用户密码时，THE Backend_System SHALL 使用 bcrypt 或类似算法进行哈希处理
2. WHEN Backend_System 生成 JWT token 时，THE Backend_System SHALL 使用环境变量中的 JWT_SECRET 签名
3. WHEN Backend_System 接收用户输入时，THE Backend_System SHALL 验证和清理输入防止 SQL 注入
4. WHEN Admin_Panel 访问管理接口时，THE Backend_System SHALL 验证 x-admin-key 请求头
5. THE Backend_System SHALL 对敏感配置使用环境变量而非硬编码

---

## Summary

本需求文档定义了拾光影视 (Project Robin) 平台的 32 个核心需求，涵盖后端基础设施、数据库设计、API 接口、管理后台、移动应用等全栈功能。所有需求均遵循 EARS 语法和 INCOSE 质量标准，确保需求的可测试性和可追溯性。系统采用"后端驱动、动态配置"的架构理念，通过管理后台可视化编辑器实现 APP 内容的实时控制，无需发版即可调整布局和广告策略。

### Requirement 33: Advanced Advertisement Strategies

**User Story:** 作为运营人员，我需要配置多种广告展示策略，以便最大化广告收益

#### Acceptance Criteria

1. WHEN 运营人员配置短剧插播广告时，THE Admin_Panel SHALL 允许设置频率参数（例如每滑 5 个视频插一次）
2. WHEN Mobile_APP 播放短剧时，THE Mobile_APP SHALL 根据配置的频率在短剧流中插入广告
3. WHEN 运营人员配置暂停贴片广告时，THE Admin_Panel SHALL 允许上传暂停时显示的图片广告
4. WHEN 用户暂停视频播放时，THE Mobile_APP SHALL 在播放器上方显示暂停贴片广告
5. WHEN 运营人员配置开屏广告频次时，THE Admin_Panel SHALL 支持"每天1次"或"每次启动"选项

### Requirement 34: UI/UX Design System

**User Story:** 作为用户，我需要流畅美观的界面体验，以便享受使用过程

#### Acceptance Criteria

1. THE Mobile_APP SHALL 使用 #121212 作为背景色和 #FFC107 作为主色调
2. WHEN 用户点击视频封面时，THE Mobile_APP SHALL 执行英雄动画平滑放大至详情页
3. WHEN Mobile_APP 加载内容时，THE Mobile_APP SHALL 显示骨架屏流光色块效果
4. THE Mobile_APP SHALL 在顶部 Tab 栏和底部导航栏使用半透明磨砂玻璃效果
5. THE Mobile_APP SHALL 在所有 VIP 相关元素使用琥珀金色高亮显示

### Requirement 35: Marquee Announcement System

**User Story:** 作为运营人员，我需要发布滚动通告，以便向用户传达重要信息

#### Acceptance Criteria

1. WHEN Admin_Panel 配置通告时，THE Admin_Panel SHALL 允许输入通告文本和跳转链接
2. WHEN Backend_System 保存通告时，THE Backend_System SHALL 存储到 system_config 表的 marquee_text 键
3. WHEN Mobile_APP 请求首页布局时，THE Backend_System SHALL 在响应中包含通告文本
4. THE Mobile_APP SHALL 在首页轮播图下方显示跑马灯滚动通告
5. WHEN 用户点击通告时，THE Mobile_APP SHALL 根据配置的跳转指令执行相应操作

### Requirement 36: Permanent URL Management

**User Story:** 作为用户，我需要获取永久访问地址，以便在 APP 被下架后仍能访问

#### Acceptance Criteria

1. WHEN Admin_Panel 配置永久网址时，THE Admin_Panel SHALL 允许输入多个备用域名
2. WHEN Backend_System 保存永久网址时，THE Backend_System SHALL 存储到 system_config 表的 permanent_urls 键
3. WHEN Mobile_APP 请求配置接口时，THE Backend_System SHALL 返回永久网址列表
4. THE Mobile_APP SHALL 在个人中心显示"永久网址"入口
5. WHEN 用户点击永久网址时，THE Mobile_APP SHALL 显示网址列表并支持一键复制

### Requirement 37: Appointment and Reminder System

**User Story:** 作为用户，我需要预约即将上映的影视作品，以便在上映时收到提醒

#### Acceptance Criteria

1. WHEN 用户浏览未上映的影视作品时，THE Mobile_APP SHALL 显示"预约"按钮
2. WHEN 用户点击预约时，THE Mobile_APP SHALL 发送 POST /api/appointment 请求包含 vod_id
3. WHEN Backend_System 保存预约时，THE Backend_System SHALL 在 appointments 表中创建记录
4. THE Mobile_APP SHALL 在个人中心"我的预约"页面显示所有预约的作品
5. WHEN 预约的作品上映时，THE Backend_System SHALL 通过推送通知提醒用户

### Requirement 38: Additional Database Tables

**User Story:** 作为后端开发者，我需要补充遗漏的数据库表，以便支持反馈、应用墙和预约功能

#### Acceptance Criteria

1. THE Backend_System SHALL 创建 feedback 表存储用户反馈包含 id、user_id、content、contact、status、created_at 字段
2. THE Backend_System SHALL 创建 app_wall 表存储推广应用包含 id、app_name、icon_url、download_url、commission、sort_order、is_active 字段
3. THE Backend_System SHALL 创建 appointments 表存储用户预约包含 user_id、vod_id、vod_name、release_date、created_at 字段
4. THE Backend_System SHALL 为 feedback 表的 status 字段创建索引以优化查询性能
5. THE Backend_System SHALL 为 app_wall 表的 is_active 和 sort_order 字段创建复合索引

---

## Updated Summary

本需求文档现已包含 38 个完整需求，新增了高级广告策略（短剧插播、暂停贴片）、UI/UX 设计系统（英雄动画、骨架屏、磨砂玻璃）、滚动通告系统、永久网址管理、预约提醒系统，以及补充的数据库表（feedback、app_wall、appointments）。所有需求均已对照原始文档验证完整性，确保无遗漏。
