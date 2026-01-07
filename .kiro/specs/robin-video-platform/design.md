# Design Document

## Overview

拾光影视 (Project Robin) 采用三层架构设计：Backend API (Cloudflare Workers)、Admin Panel (React SPA)、Mobile APP (Flutter)。系统核心设计理念是"后端驱动、动态配置"，通过将 UI 布局配置存储在数据库中，实现 APP 界面的实时控制，无需发版即可调整内容展示和广告策略。

### Design Principles

1. **Serverless-First**: 使用 Cloudflare Workers 实现零运维的无服务器架构
2. **Configuration-Driven**: APP 界面完全由后端配置驱动，支持热更新
3. **Resilience by Design**: 多源聚合、失败降级、缓存优先策略确保高可用性
4. **Performance Optimized**: KV 缓存、CDN 加速、虚拟滚动等技术保证流畅体验
5. **Security Hardened**: API Key 鉴权、JWT 认证、输入验证防止攻击

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Workers    │───▶│  D1 Database │    │   KV Cache   │     │
│  │   (Backend)  │◀───│   (SQLite)   │◀───│  (Key-Value) │     │
│  └──────┬───────┘    └──────────────┘    └──────────────┘     │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ├──────────────────┬──────────────────┐
          │                  │                  │
    ┌─────▼─────┐      ┌────▼────┐      ┌─────▼─────┐
    │  Mobile   │      │  Admin  │      │  External │
    │    APP    │      │  Panel  │      │    APIs   │
    │ (Flutter) │      │ (React) │      │ TMDB/资源站│
    └───────────┘      └─────────┘      └───────────┘
```

### Technology Stack

**Backend (Cloudflare Workers)**
- Runtime: Cloudflare Workers (V8 Isolates)
- Framework: Hono (轻量级 Web 框架)
- Database: D1 (SQLite)
- Cache: KV (Key-Value Store)
- Cron: Cloudflare Cron Triggers

**Admin Panel**
- Framework: React 18
- UI Library: Ant Design Pro
- Data Layer: Refine (Admin Framework)
- State Management: React Query
- Build Tool: Vite

**Mobile APP**
- Framework: Flutter 3.x
- State Management: GetX
- HTTP Client: Dio
- Video Player: MediaKit
- Image Cache: CachedNetworkImage
- Cast: DLNA Support


## Components and Interfaces

### Backend Components

#### 1. API Router (src/index.ts)

主入口文件，负责路由分发和中间件配置。

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import layoutRouter from './routes/layout'
import vodRouter from './routes/vod'
import shortsRouter from './routes/shorts'
import authRouter from './routes/auth'
import systemRouter from './routes/system'
import adminRouter from './routes/admin'
import proxyRouter from './routes/proxy'

const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use('*', cors())

// Public Routes
app.route('/home_layout', layoutRouter)
app.route('/api/vod', vodRouter)
app.route('/api/shorts', shortsRouter)
app.route('/api/search', vodRouter)
app.route('/auth', authRouter)
app.route('/api/system', systemRouter)
app.route('/api/version', systemRouter)
app.route('/api/config', systemRouter)
app.route('/img', proxyRouter)

// Admin Routes (Protected)
app.route('/admin', adminRouter)

export default app
```

#### 2. Dynamic Layout Service (src/routes/layout.ts)

核心服务，负责下发 APP 首页布局配置。

**Interface:**
```typescript
interface LayoutModule {
  id: number
  module_type: 'carousel' | 'grid_icons' | 'grid_3x2_ad' | 'timeline' | 'week_timeline'
  title: string
  api_params: Record<string, any>
  ad_config: {
    insert_index?: number
    ad_id?: number
    enable?: boolean
  }
  sort_order: number
}

interface LayoutResponse {
  tab_id: string
  modules: LayoutModule[]
  marquee_text?: string
}
```

**Flow:**
1. 接收 `tab` 参数（如 "featured", "movie", "netflix"）
2. 检查 KV 缓存是否存在该频道布局（key: `layout:${tab}`）
3. 若缓存未命中，查询 D1 数据库 `page_modules` 表
4. 按 `sort_order` 排序模块列表
5. 异步记录访问统计到 `daily_stats` 表
6. 将结果缓存到 KV（TTL: 300秒）
7. 返回 JSON 响应

#### 3. Spider Aggregator (src/services/spider_aggregator.ts)

聚合爬虫服务，并发请求多个资源站。

**Interface:**
```typescript
interface VideoSource {
  name: string
  api_url: string
  weight: number
  is_active: boolean
}

interface AggregateOptions {
  sources: VideoSource[]
  timeout: number // 单个源站超时时间（毫秒）
  maxRetries: number
}

async function aggregateVideos(
  endpoint: string,
  params: Record<string, any>,
  options: AggregateOptions
): Promise<VideoItem[]>
```

**Strategy:**
- 使用 `Promise.allSettled` 并发请求所有激活的资源站
- 按 `weight` 权重排序结果
- 若所有请求失败，返回空数组而非抛出错误
- 对结果进行去重（基于 `vod_id`）
- 记录失败的资源站到日志

#### 4. Shorts Engine (src/services/spider_shorts.ts)

短剧引擎，包含定时抓取和随机流服务。

**Cron Job (每12小时执行):**
```typescript
export async function fetchShorts(env: Env) {
  const sourceUrl = env.SHORTS_SOURCE_API
  const response = await fetch(sourceUrl)
  const data = await response.json()
  
  for (const item of data.list) {
    // 验证竖屏封面存在
    if (!item.vod_pic_vertical) continue
    
    // 清洗数据
    const cleaned = {
      vod_id: item.vod_id,
      vod_name: item.vod_name,
      vod_pic_vertical: item.vod_pic_vertical,
      play_url: item.vod_play_url,
      category: item.type_name,
      fetched_at: Date.now()
    }
    
    // INSERT OR IGNORE
    await env.DB.prepare(`
      INSERT OR IGNORE INTO shorts_cache 
      (vod_id, vod_name, vod_pic_vertical, play_url, category, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(...Object.values(cleaned)).run()
  }
}
```

**Random API:**
```typescript
GET /api/shorts/random
Response: {
  list: Array<{
    vod_id: string
    vod_name: string
    vod_pic_vertical: string
    play_url: string
    category: string
  }>
}
```


#### 5. Ad Injector (src/services/ad_injector.ts)

广告注入器，在内容列表中按策略插入广告。

**Interface:**
```typescript
interface AdConfig {
  insert_index: number // 插入位置（如 4 表示第5个位置）
  ad_id?: number // 指定广告ID
  location: string // 广告位置标识
}

interface AdItem {
  id: number
  media_url: string
  action_type: 'browser' | 'webview' | 'deeplink'
  action_url: string
  is_ad: true // 标记为广告
}

async function injectAds(
  items: any[],
  config: AdConfig,
  env: Env
): Promise<any[]>
```

**Logic:**
1. 检查全局广告开关（`system_config.ads_enabled`）
2. 检查用户是否为 VIP（若是则跳过注入）
3. 从 `ads_inventory` 表根据 `location` 和 `weight` 随机选择广告
4. 在指定 `insert_index` 位置插入广告对象
5. 返回混合后的列表

#### 6. Image Proxy (src/routes/proxy.ts)

图片代理服务，解决防盗链问题。

**Implementation:**
```typescript
proxy.get('/', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.text('Missing URL', 400)
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': '' // 清空 Referer
      }
    })
    
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000', // 缓存1年
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (e) {
    return c.text('Proxy Error', 500)
  }
})
```

#### 7. Admin Guard Middleware (src/middleware/admin_guard.ts)

管理后台鉴权中间件。

```typescript
export async function adminGuard(c: Context, next: Next) {
  const adminKey = c.req.header('x-admin-key')
  
  if (!adminKey || adminKey !== c.env.ADMIN_SECRET_KEY) {
    return c.json({ 
      code: 403, 
      msg: 'Access Denied' 
    }, 403)
  }
  
  await next()
}
```

### Admin Panel Components

#### 1. Layout Editor (src/pages/LayoutEditor)

可视化布局编辑器，三栏布局。

**Structure:**
```
┌────────────┬──────────────────────┬────────────┐
│  Channel   │      Canvas          │ Inspector  │
│  Selector  │   (Drag & Drop)      │ (Props)    │
│            │                      │            │
│ - 精选     │  ┌────────────────┐  │ Module:    │
│ - 电影     │  │  Carousel      │  │ Carousel   │
│ - 剧集     │  └────────────────┘  │            │
│ - Netflix  │  ┌────────────────┐  │ Images: 5  │
│ - 短剧     │  │  Grid Icons    │  │ [Add]      │
│ - 动漫     │  └────────────────┘  │            │
│ - 综艺     │  ┌────────────────┐  │ Jump:      │
│ - 福利     │  │  Mixed Grid    │  │ video://   │
│            │  └────────────────┘  │            │
└────────────┴──────────────────────┴────────────┘
```

**Key Features:**
- React DnD 实现拖拽排序
- 点击模块显示右侧属性编辑器
- 实时预览（可选）
- 保存时调用 `POST /admin/layout` API

#### 2. Ad Management (src/pages/AdManagement)

广告管理界面。

**Features:**
- 广告列表（Table）
- 添加/编辑广告（Modal Form）
- 图片 URL 输入后实时预览
- 一键熔断按钮（红色醒目）
- 投放策略配置（开屏、横幅、插入、短剧插播、暂停贴片）

#### 3. Dashboard (src/pages/Dashboard)

运营数据仪表盘。

**Metrics:**
- 总用户数（Card）
- 今日活跃（Card）
- API 健康度（Status Badge）
- 7天趋势图（Line Chart - Ant Design Charts）

### Mobile APP Components

#### 1. Dynamic Renderer (lib/modules/home/dynamic_renderer.dart)

动态渲染引擎，根据 `module_type` 渲染对应组件。

```dart
Widget buildModule(LayoutModule module) {
  switch (module.moduleType) {
    case 'carousel':
      return HeroCarousel(data: module.data);
    case 'grid_icons':
      return GridMenu(icons: module.data);
    case 'grid_3x2_ad':
      return MixedGrid(
        items: module.data,
        adConfig: module.adConfig,
      );
    case 'timeline':
      return TimeTree(items: module.data);
    case 'week_timeline':
      return WeekTimeline(schedule: module.data);
    default:
      return SizedBox.shrink();
  }
}
```

#### 2. Shorts Player (lib/modules/shorts/shorts_player.dart)

短剧播放器，支持双模式切换。

**Modes:**
- **Random Mode**: 全屏竖屏，上下滑切换，无限流
- **Detail Mode**: 16:9 播放器，显示选集和推荐
- **Locked Mode**: 全屏竖屏，锁定当前剧，上下滑切换集数

**State Machine:**
```
Random Mode ──[点击"观看完整版"]──> Detail Mode
Detail Mode ──[点击全屏按钮]──> Locked Mode
Locked Mode ──[点击返回]──> Detail Mode
```

#### 3. NetImage Widget (lib/widgets/net_image.dart)

图片代理组件，自动转换 URL。

```dart
class NetImage extends StatelessWidget {
  final String url;
  
  @override
  Widget build(BuildContext context) {
    final proxyUrl = url.startsWith('http')
        ? 'https://api.robin.com/img?url=${Uri.encodeComponent(url)}'
        : url;
    
    return CachedNetworkImage(
      imageUrl: proxyUrl,
      placeholder: (context, url) => Skeleton(),
      errorWidget: (context, url, error) => Icon(Icons.error),
    );
  }
}
```


## Data Models

### Database Schema (D1)

#### Core Tables

**users** - 用户账号表
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,           -- bcrypt hash
    is_vip BOOLEAN DEFAULT 0,
    device_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_device ON users(device_id);
```

**history** - 观看历史表
```sql
CREATE TABLE history (
    user_id INTEGER,
    vod_id TEXT NOT NULL,
    vod_name TEXT,
    vod_pic TEXT,
    progress INTEGER DEFAULT 0,       -- 秒
    duration INTEGER DEFAULT 0,       -- 秒
    updated_at INTEGER,
    PRIMARY KEY (user_id, vod_id)
);
CREATE INDEX idx_history_user ON history(user_id, updated_at DESC);
```

**favorites** - 收藏表
```sql
CREATE TABLE favorites (
    user_id INTEGER,
    vod_id TEXT NOT NULL,
    vod_name TEXT,
    vod_pic TEXT,
    created_at INTEGER,
    PRIMARY KEY (user_id, vod_id)
);
CREATE INDEX idx_favorites_user ON favorites(user_id, created_at DESC);
```

#### Layout Configuration Tables

**home_tabs** - 频道配置表
```sql
CREATE TABLE home_tabs (
    id TEXT PRIMARY KEY,              -- 'featured', 'movie', 'netflix', etc.
    title TEXT NOT NULL,              -- '精选', '电影', 'Netflix'
    sort_order INTEGER,
    is_visible BOOLEAN DEFAULT 1,
    is_locked BOOLEAN DEFAULT 0       -- 需要密码/VIP
);
```

**page_modules** - 页面模块表（核心）
```sql
CREATE TABLE page_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tab_id TEXT,                      -- 关联 home_tabs.id
    module_type TEXT NOT NULL,        -- 'carousel', 'grid_icons', etc.
    title TEXT,
    api_params JSON,                  -- {"t":1, "sort":"hot"}
    ad_config JSON,                   -- {"insert_index": 4, "ad_id": 101}
    sort_order INTEGER
);
CREATE INDEX idx_modules_tab ON page_modules(tab_id, sort_order);
```

#### Content Tables

**topics** - 专题表
```sql
CREATE TABLE topics (
    id TEXT PRIMARY KEY,              -- 'oscar_2025'
    title TEXT,
    cover_img TEXT,
    description TEXT
);
```

**topic_items** - 专题内容表
```sql
CREATE TABLE topic_items (
    topic_id TEXT,
    vod_id TEXT,
    vod_name TEXT,
    vod_pic TEXT,
    sort_order INTEGER,
    PRIMARY KEY (topic_id, vod_id)
);
CREATE INDEX idx_topic_items ON topic_items(topic_id, sort_order);
```

**shorts_cache** - 短剧缓存表
```sql
CREATE TABLE shorts_cache (
    vod_id TEXT PRIMARY KEY,
    vod_name TEXT,
    vod_pic_vertical TEXT,
    play_url TEXT,
    category TEXT,                    -- '霸总', '战神', '古装'
    fetched_at INTEGER
);
CREATE INDEX idx_shorts_category ON shorts_cache(category);
```

**anime_timeline** - 番剧时间表
```sql
CREATE TABLE anime_timeline (
    vod_id TEXT PRIMARY KEY,
    day_of_week INTEGER,              -- 1-7 (周一到周日)
    vod_name TEXT
);
CREATE INDEX idx_anime_day ON anime_timeline(day_of_week);
```

#### Advertisement Tables

**ads_inventory** - 广告库存表
```sql
CREATE TABLE ads_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT,                    -- 'splash', 'banner_home', 'insert_grid', 'shorts_insert', 'pause_overlay'
    content_type TEXT,                -- 'image', 'video'
    media_url TEXT,
    action_type TEXT,                 -- 'browser', 'webview', 'deeplink'
    action_url TEXT,
    weight INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT 1
);
CREATE INDEX idx_ads_location ON ads_inventory(location, is_active, weight);
```

#### System Tables

**system_config** - 系统配置表
```sql
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 预置配置项
INSERT INTO system_config (key, value) VALUES
('app_version', '1.0.0'),
('force_update_min_ver', '1.0.0'),
('welfare_enabled', 'false'),
('welfare_password', ''),
('ads_enabled', 'true'),
('marquee_text', ''),
('permanent_urls', '[]');
```

**daily_stats** - 日活统计表
```sql
CREATE TABLE daily_stats (
    date TEXT PRIMARY KEY,            -- '2025-12-05'
    api_calls INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0
);
CREATE INDEX idx_stats_date ON daily_stats(date DESC);
```

**feedback** - 用户反馈表
```sql
CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT NOT NULL,
    contact TEXT,
    status TEXT DEFAULT 'pending',    -- 'pending', 'processed'
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_feedback_status ON feedback(status, created_at DESC);
```

**app_wall** - 应用墙表
```sql
CREATE TABLE app_wall (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    icon_url TEXT,
    download_url TEXT,
    commission REAL,                  -- 佣金单价（备注用）
    sort_order INTEGER,
    is_active BOOLEAN DEFAULT 1
);
CREATE INDEX idx_app_wall ON app_wall(is_active, sort_order);
```

**appointments** - 预约表
```sql
CREATE TABLE appointments (
    user_id INTEGER,
    vod_id TEXT,
    vod_name TEXT,
    release_date TEXT,                -- 上映日期
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (user_id, vod_id)
);
CREATE INDEX idx_appointments_user ON appointments(user_id, created_at DESC);
```

### API Response Models

#### Layout Response
```typescript
{
  tab_id: "featured",
  marquee_text: "欢迎使用拾光影视！",
  modules: [
    {
      id: 1,
      module_type: "carousel",
      title: "热门推荐",
      data: [
        {
          image_url: "https://...",
          title: "三体",
          jump_action: "video://12345"
        }
      ],
      sort_order: 1
    },
    {
      id: 2,
      module_type: "grid_3x2_ad",
      title: "国内新剧",
      api_params: { t: 13, sort: "time" },
      ad_config: { insert_index: 4, ad_id: 101 },
      sort_order: 2
    }
  ]
}
```

#### Video Detail Response
```typescript
{
  vod_id: "12345",
  vod_name: "三体",
  vod_pic: "https://...",
  vod_year: "2023",
  vod_area: "中国大陆",
  vod_director: "杨磊",
  vod_actor: "张鲁一,于和伟",
  vod_content: "剧情简介...",
  vod_play_list: [
    {
      name: "第1集",
      url: "https://..."
    }
  ],
  vod_recommend: [
    // 推荐列表
  ]
}
```


## Error Handling

### Backend Error Handling Strategy

#### 1. Graceful Degradation

**Spider Aggregator 降级策略:**
```typescript
async function aggregateVideos(sources: VideoSource[]) {
  const results = await Promise.allSettled(
    sources.map(source => fetchFromSource(source))
  )
  
  const successResults = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
  
  if (successResults.length === 0) {
    // 所有源站失败，返回空数组而非抛出错误
    console.error('All sources failed')
    return []
  }
  
  return successResults.flat()
}
```

#### 2. Error Response Format

统一错误响应格式：
```typescript
{
  code: number,        // HTTP 状态码
  msg: string,         // 错误消息
  error?: string,      // 详细错误（仅开发环境）
  timestamp: number    // 时间戳
}
```

#### 3. Error Logging

使用 DingTalk Webhook 记录关键错误：
```typescript
async function logCriticalError(error: Error, context: any) {
  await sendDingTalk(
    env,
    '系统错误',
    `错误: ${error.message}\n上下文: ${JSON.stringify(context)}`
  )
}
```

#### 4. Database Error Handling

```typescript
try {
  const result = await env.DB.prepare(query).bind(...params).run()
  return result
} catch (error) {
  console.error('Database error:', error)
  
  // 记录到日志但不阻塞主流程
  c.executionCtx.waitUntil(
    logCriticalError(error, { query, params })
  )
  
  // 返回友好错误消息
  return c.json({
    code: 500,
    msg: '数据库操作失败，请稍后重试'
  }, 500)
}
```

### Mobile APP Error Handling

#### 1. Network Error Handling

```dart
class HttpClient {
  Future<Response> request(String url) async {
    try {
      return await dio.get(url);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout) {
        throw NetworkException('连接超时，请检查网络');
      } else if (e.type == DioExceptionType.receiveTimeout) {
        throw NetworkException('请求超时，请稍后重试');
      } else {
        throw NetworkException('网络错误: ${e.message}');
      }
    }
  }
}
```

#### 2. UI Error Display

```dart
Widget buildErrorWidget(String message) {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.error_outline, size: 64, color: Colors.grey),
        SizedBox(height: 16),
        Text(message, style: TextStyle(color: Colors.grey)),
        SizedBox(height: 16),
        ElevatedButton(
          onPressed: () => retry(),
          child: Text('重试'),
        ),
      ],
    ),
  );
}
```

#### 3. Global Exception Handling

```dart
void main() {
  runZonedGuarded(() {
    WidgetsFlutterBinding.ensureInitialized();
    runApp(MyApp());
  }, (error, stack) {
    // 仅在 Release 模式上报
    if (kReleaseMode) {
      reportCrash(error, stack);
    } else {
      print('Debug Crash: $error\n$stack');
    }
  });
}
```

### Admin Panel Error Handling

#### 1. API Error Interceptor

```typescript
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 403) {
      // 鉴权失败，清除 token 并跳转登录
      localStorage.removeItem('admin_key')
      window.location.href = '/login'
    } else if (error.response?.status === 500) {
      message.error('服务器错误，请稍后重试')
    } else {
      message.error(error.response?.data?.msg || '请求失败')
    }
    return Promise.reject(error)
  }
)
```

#### 2. Form Validation

```typescript
const formRules = {
  app_name: [
    { required: true, message: '请输入应用名称' },
    { max: 50, message: '名称不能超过50个字符' }
  ],
  icon_url: [
    { required: true, message: '请输入图标URL' },
    { type: 'url', message: '请输入有效的URL' }
  ]
}
```

## Testing Strategy

### Backend Testing

#### 1. Unit Tests

使用 Vitest 进行单元测试。

**测试覆盖范围:**
- Spider Aggregator 聚合逻辑
- Ad Injector 广告注入逻辑
- Image Proxy URL 转换
- JWT Token 生成和验证

**示例测试:**
```typescript
import { describe, it, expect } from 'vitest'
import { injectAds } from './ad_injector'

describe('Ad Injector', () => {
  it('should inject ad at correct position', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const config = { insert_index: 3 }
    const result = injectAds(items, config, mockAd)
    
    expect(result[3]).toHaveProperty('is_ad', true)
    expect(result.length).toBe(7)
  })
  
  it('should skip injection for VIP users', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const config = { insert_index: 3 }
    const result = injectAds(items, config, mockAd, { isVip: true })
    
    expect(result.length).toBe(6)
    expect(result.every(item => !item.is_ad)).toBe(true)
  })
})
```

#### 2. Integration Tests

测试 API 端到端流程。

```typescript
describe('Layout API', () => {
  it('should return layout for featured tab', async () => {
    const response = await fetch('http://localhost:8787/home_layout?tab=featured')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('modules')
    expect(Array.isArray(data.modules)).toBe(true)
  })
})
```

#### 3. Load Testing

使用 k6 进行压力测试。

```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 },  // 1分钟内增加到100用户
    { duration: '3m', target: 100 },  // 保持100用户3分钟
    { duration: '1m', target: 0 },    // 1分钟内降到0
  ],
};

export default function () {
  let res = http.get('https://api.robin.com/home_layout?tab=featured');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### Mobile APP Testing

#### 1. Widget Tests

```dart
testWidgets('NetImage should display image', (WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      home: NetImage('https://example.com/image.jpg'),
    ),
  );
  
  expect(find.byType(CachedNetworkImage), findsOneWidget);
});
```

#### 2. Integration Tests

```dart
testWidgets('Home page should load layout', (WidgetTester tester) async {
  await tester.pumpWidget(MyApp());
  await tester.pumpAndSettle();
  
  expect(find.byType(HeroCarousel), findsOneWidget);
  expect(find.byType(GridMenu), findsOneWidget);
});
```

### Admin Panel Testing

#### 1. Component Tests

使用 React Testing Library。

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { AdForm } from './AdForm'

test('should submit ad form', async () => {
  const onSubmit = jest.fn()
  render(<AdForm onSubmit={onSubmit} />)
  
  fireEvent.change(screen.getByLabelText('广告位置'), {
    target: { value: 'splash' }
  })
  fireEvent.change(screen.getByLabelText('图片URL'), {
    target: { value: 'https://example.com/ad.jpg' }
  })
  
  fireEvent.click(screen.getByText('提交'))
  
  expect(onSubmit).toHaveBeenCalledWith({
    location: 'splash',
    media_url: 'https://example.com/ad.jpg'
  })
})
```

#### 2. E2E Tests

使用 Playwright。

```typescript
import { test, expect } from '@playwright/test'

test('admin should be able to edit layout', async ({ page }) => {
  await page.goto('http://localhost:3000/login')
  await page.fill('input[name="adminKey"]', 'test_key')
  await page.click('button[type="submit"]')
  
  await page.goto('http://localhost:3000/layout-editor')
  await page.click('text=精选')
  
  // 拖拽模块
  await page.dragAndDrop('.module-carousel', '.module-grid')
  
  await page.click('button:has-text("保存")')
  await expect(page.locator('.ant-message-success')).toBeVisible()
})
```

## Performance Optimization

### Backend Optimization

1. **KV Caching Strategy**
   - 布局数据缓存 TTL: 300秒
   - TMDB 查询结果缓存 TTL: 86400秒（1天）
   - 短剧列表缓存 TTL: 3600秒（1小时）

2. **Database Indexing**
   - 所有外键字段创建索引
   - 常用查询字段创建复合索引
   - 定期执行 VACUUM 优化数据库

3. **Async Operations**
   - 使用 `executionCtx.waitUntil` 处理非关键路径操作
   - 统计记录、日志上报等异步执行

### Mobile APP Optimization

1. **Image Caching**
   - 使用 CachedNetworkImage 自动缓存
   - 设置合理的缓存大小限制（500MB）

2. **List Virtualization**
   - 使用 ListView.builder 实现虚拟滚动
   - 仅渲染可见区域的 Widget

3. **State Management**
   - 使用 GetX 的响应式状态管理
   - 避免不必要的 Widget 重建

### Admin Panel Optimization

1. **Code Splitting**
   - 使用 React.lazy 和 Suspense 实现路由级代码分割
   - 减少首屏加载时间

2. **Data Fetching**
   - 使用 React Query 自动缓存和去重请求
   - 实现乐观更新提升用户体验

---

## Security Considerations

### Authentication & Authorization

1. **Admin Panel**: API Key 鉴权（x-admin-key header）
2. **Mobile APP**: JWT Token 认证
3. **Password Storage**: bcrypt 哈希（cost factor: 10）

### Input Validation

1. **SQL Injection Prevention**: 使用参数化查询
2. **XSS Prevention**: 前端输出转义
3. **CSRF Protection**: Admin Panel 使用 CSRF Token

### Rate Limiting

使用 Cloudflare Rate Limiting 规则：
- API 请求: 100 req/min per IP
- Admin 登录: 5 req/min per IP

---

## Deployment Strategy

### Backend Deployment

1. 本地开发: `wrangler dev`
2. 测试环境: `wrangler publish --env staging`
3. 生产环境: `wrangler publish --env production`

### Database Migration

```bash
# 本地测试
npx wrangler d1 execute robin-db --local --file=./schema.sql

# 生产部署
npx wrangler d1 execute robin-db --remote --file=./schema.sql
```

### Admin Panel Deployment

使用 Cloudflare Pages 自动部署：
- 连接 GitHub 仓库
- 设置构建命令: `npm run build`
- 设置输出目录: `dist`

### Mobile APP Deployment

1. Android: Google Play Store / 自有渠道
2. iOS: App Store
3. 热更新: 使用 CodePush 或自建方案

---

## Monitoring & Observability

### Metrics Collection

1. **Backend Metrics**
   - API 响应时间
   - 错误率
   - 数据库查询性能

2. **Business Metrics**
   - DAU/MAU
   - 视频播放量
   - 广告点击率

### Alerting

通过钉钉 Webhook 发送告警：
- API 错误率 > 5%
- 数据库查询超时
- APP 崩溃率 > 1%

### Logging

1. **Structured Logging**: JSON 格式日志
2. **Log Levels**: ERROR, WARN, INFO, DEBUG
3. **Log Retention**: 30 天

---

## Summary

本设计文档详细描述了拾光影视平台的技术架构、组件设计、数据模型、错误处理、测试策略和性能优化方案。系统采用 Serverless 架构，通过动态配置实现灵活的内容管理，确保高可用性、高性能和良好的用户体验。所有设计决策均基于需求文档，确保可追溯性和可实现性。
