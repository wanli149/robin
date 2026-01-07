# Cloudflare Workers 后端优化方案

## 📊 当前架构分析

### 资源消耗点
1. **D1 数据库查询** - 每次请求多次查询
2. **KV 读写** - 缓存操作
3. **外部 HTTP 请求** - 资源站聚合
4. **CPU 时间** - JSON 解析、数据处理
5. **内存使用** - 大数据集处理

### CF Workers 限制
- **免费版**: 100,000 请求/天, 10ms CPU/请求
- **付费版**: 10M 请求/月, 50ms CPU/请求
- **D1**: 5M 行读取/天(免费), 100K 行写入/天(免费)
- **KV**: 100K 读取/天(免费), 1K 写入/天(免费)

---

## 🚀 优化策略

### 1. 数据库查询优化 (高优先级)

#### 1.1 批量查询替代多次查询
```typescript
// ❌ 之前：多次查询
const config1 = await env.DB.prepare('SELECT value FROM system_config WHERE key = ?').bind('key1').first();
const config2 = await env.DB.prepare('SELECT value FROM system_config WHERE key = ?').bind('key2').first();

// ✅ 优化后：单次批量查询
const configs = await env.DB.prepare(`
  SELECT key, value FROM system_config WHERE key IN (?, ?, ?)
`).bind('key1', 'key2', 'key3').all();
```

#### 1.2 使用 DB.batch() 批量写入
```typescript
// ✅ 批量插入（减少 10-50 倍往返）
const statements = modules.map(m => env.DB.prepare('INSERT INTO ...').bind(...));
await env.DB.batch(statements);
```

#### 1.3 添加复合索引
```sql
-- 高频查询优化索引
CREATE INDEX IF NOT EXISTS idx_vod_type_valid_updated 
ON vod_cache(type_id, is_valid, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_modules_tab_enabled_sort 
ON page_modules(tab_id, is_enabled, sort_order);
```

### 2. KV 缓存优化 (高优先级)

#### 2.1 分层缓存策略
```
L1: 内存缓存 (请求内) - 0ms
L2: KV 缓存 - 1-5ms  
L3: D1 数据库 - 5-20ms
L4: 外部 API - 100-5000ms
```

#### 2.2 智能缓存 TTL
```typescript
const CACHE_TTL = {
  layout: 300,        // 布局 5 分钟
  hotSearch: 600,     // 热搜 10 分钟
  vodList: 180,       // 视频列表 3 分钟
  vodDetail: 3600,    // 视频详情 1 小时
  shorts: 120,        // 短剧 2 分钟
  config: 1800,       // 配置 30 分钟
};
```

#### 2.3 缓存预热
```typescript
// 在 Cron 任务中预热热门数据
async function warmupCache(env) {
  const hotTabs = ['featured', 'movie', 'series'];
  for (const tab of hotTabs) {
    await generateAndCacheLayout(env, tab);
  }
}
```

### 3. 请求合并与延迟加载 (中优先级)

#### 3.1 首页布局懒加载
```typescript
// 首屏只返回前 3 个模块，其余懒加载
const modules = await getModules(env, tabId);
const firstScreen = modules.slice(0, 3);
const lazyModules = modules.slice(3).map(m => ({ id: m.id, type: m.module_type }));

return { modules: firstScreen, lazy: lazyModules };
```

#### 3.2 聚合器请求优化
```typescript
// 使用 Promise.race 快速返回
const results = await Promise.race([
  Promise.all(sources.map(s => fetchWithTimeout(s, 3000))),
  new Promise(resolve => setTimeout(() => resolve([]), 5000))
]);
```

### 4. 代码瘦身 (中优先级)

#### 4.1 动态导入
```typescript
// ❌ 静态导入所有模块
import { searchVideos, runFullCollect } from './collector_v2';

// ✅ 按需动态导入
const { searchVideos } = await import('./collector_v2');
```

#### 4.2 移除未使用代码
- 删除废弃的 shorts_cache 相关代码
- 精简 admin.ts 中的重复逻辑
- 合并相似的路由处理函数

### 5. 响应优化 (低优先级)

#### 5.1 精简响应数据
```typescript
// 列表接口只返回必要字段
const fields = 'vod_id, vod_name, vod_pic, vod_remarks, type_name';
const result = await env.DB.prepare(`SELECT ${fields} FROM vod_cache ...`);
```

#### 5.2 启用压缩
```typescript
// Cloudflare 自动处理 gzip/brotli
// 确保响应头正确
return c.json(data, 200, {
  'Content-Type': 'application/json; charset=utf-8',
});
```

---

## 📁 具体优化文件

### 需要优化的文件清单

| 文件 | 优化项 | 预期收益 |
|------|--------|----------|
| `src/routes/layout.ts` | 批量查询、缓存预热 | D1 读取 -60% |
| `src/routes/vod.ts` | 字段精简、缓存优先 | 响应时间 -40% |
| `src/services/spider_aggregator.ts` | 请求超时、快速失败 | CPU 时间 -30% |
| `src/services/collector_v2.ts` | 批量写入、减少日志 | D1 写入 -50% |
| `src/routes/admin.ts` | 代码拆分、动态导入 | 包大小 -20% |
| `src/utils/db_optimizer.ts` | 增强缓存工具 | 复用性 +100% |

---

## 🔧 实施计划

### Phase 1: 已完成优化 ✅

| 文件 | 优化内容 | 状态 |
|------|----------|------|
| `config.ts` | 统一缓存 TTL 配置，分层策略 | ✅ |
| `layout.ts` | 跑马灯配置增加 KV 缓存，tabs 延长 TTL | ✅ |
| `vod.ts` | 热搜批量查询+缓存，详情 KV 缓存，排行榜缓存 | ✅ |
| `shorts.ts` | 精简查询字段，优化缓存 key，延长 TTL | ✅ |
| `spider_aggregator.ts` | 减少重试次数，快速失败，优化超时 | ✅ |
| `collector_v2.ts` | 减少批量大小，降低进度更新频率 | ✅ |
| `db_optimizer.ts` | 增强缓存包装器，新增配置缓存方法 | ✅ |

### Phase 2: 已完成优化 ✅

| 优化项 | 内容 | 状态 |
|--------|------|------|
| 拆分 admin.ts | 从 5489 行拆分为 8 个子模块 | ✅ |
| Cron 缓存预热 | 每小时预热热搜、跑马灯、tabs、排行榜 | ✅ |
| 请求限流中间件 | 基于 KV 的滑动窗口限流 | ✅ |

#### admin.ts 拆分结构：
```
backend/src/routes/admin/
├── index.ts       # 主入口（聚合所有子模块）
├── types.ts       # 共享类型定义
├── dashboard.ts   # 仪表板和统计（含实时数据、趋势）
├── layout.ts      # 布局管理
├── ads.ts         # 广告管理
├── topics.ts      # 专题管理（含排序、切换）
├── config.ts      # 系统配置
├── videos.ts      # 视频管理（含批量操作、导出、修复）
├── sources.ts     # 资源站管理（含分类探测、测试分类）
├── shorts.ts      # 短剧管理（统计、迁移、分类）
├── categories.ts  # 分类管理（主分类、子分类、映射）
├── collect.ts     # 采集管理（文章、演员）
├── system.ts      # 系统管理（版本、缓存、去重、报告）
└── misc.ts        # 其他（反馈增强、应用墙、热搜）
```

#### 路由统计：
- 原 admin.ts: ~120 个路由，5500+ 行
- 拆分后: 12 个子模块，每个模块 100-300 行

#### 限流中间件配置：
- 默认：60 次/分钟
- 搜索接口：30 次/分钟
- 采集接口：10 次/分钟
- 视频详情：100 次/分钟

---

## 📈 预期效果

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| D1 读取/请求 | 5-10 次 | 2-3 次 | -60% |
| KV 命中率 | 40% | 80% | +100% |
| 平均响应时间 | 200ms | 80ms | -60% |
| CPU 时间/请求 | 15ms | 8ms | -47% |
| 日请求容量 | 50K | 150K | +200% |

---

## 📝 优化详情

### 1. 缓存策略优化

**config.ts** - 统一缓存 TTL 配置：
- 布局相关：5-30 分钟
- 视频数据：3 分钟 - 1 小时
- 搜索相关：5-10 分钟
- 系统配置：30 分钟

### 2. 数据库查询优化

**layout.ts**:
- 跑马灯配置：增加 KV 缓存层（10 分钟）
- tabs 列表：延长缓存到 30 分钟

**vod.ts**:
- 热搜：合并 2 次查询为 1 次，增加 10 分钟缓存
- 视频详情：增加 KV 缓存层（1 小时）
- 排行榜：增加 10 分钟缓存

### 3. 外部请求优化

**spider_aggregator.ts**:
- 重试次数：3 → 1
- 超时后快速失败，不再等待
- 使用 AbortSignal.timeout 简化代码

### 4. 采集器优化

**collector_v2.ts**:
- 批量大小：10 → 5（降低内存压力）
- 请求间隔：200ms → 100ms
- 进度更新频率：10 → 20（减少 D1 写入）

### 5. 短剧接口优化

**shorts.ts**:
- 查询字段精简（移除不必要字段）
- 缓存 key 缩短
- 缓存时间：3 分钟 → 5 分钟
- 限制最大返回数量为 20

