# 拾光影视 - 分布式数据库架构设计方案

## 一、项目现状分析

### 1.1 当前架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
│                      (Hono API)                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    单一 D1 数据库                            │
│  • 50+ 张表全部在一个库                                      │
│  • 用户数据、视频数据、配置数据混合存储                       │
│  • 代码直接调用 env.DB，强耦合                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 现有数据表分类

| 类别 | 表名 | 数据量预估 | 读写频率 |
|------|------|-----------|----------|
| **用户数据** | users, history, favorites, appointments | 中等 | 高读高写 |
| **视频数据** | vod_cache, vod_ratings | 大 | 高读低写 |
| **搜索索引** | vod_search (FTS5) | 中等 | 高读低写 |
| **配置数据** | system_config, page_modules, home_tabs | 小 | 高读低写 |
| **采集数据** | collect_tasks_v2, collect_logs, video_sources | 中等 | 中读中写 |
| **统计数据** | daily_stats, vod_access_log, hot_search_stats | 中等 | 低读高写 |

### 1.3 免费额度对比

| 指标 | Cloudflare D1 | Turso |
|------|---------------|-------|
| 存储 | 5GB | 9GB (免费) |
| 读取 | 500万行/天 | 5亿行/月 (~1600万/天) |
| 写入 | 10万行/天 | 1000万行/月 (~33万/天) |
| 数据库数量 | 10个 | 500个 |
| 延迟 | 最低 (内部调用) | +20-50ms (HTTP) |

### 1.4 当前搜索流程分析

APP 端搜索采用**缓存优先**策略：

```
APP 搜索请求
     ↓
1. 优先调用 /api/search/cache
   └─ 使用 FTS5 全文索引搜索 vod_cache 表
   └─ 响应时间：~50ms
     ↓
2. 如果缓存无结果，降级到 /api/search
   └─ 实时搜索资源站 API
   └─ 响应时间：1-5秒
```

**关键结论**：搜索主要依赖本地 FTS5 索引，实时搜索资源站是降级方案。


---

## 二、目标架构设计

### 2.1 推荐方案：CF D1 + Turso（搜索索引在 D1）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Workers                            │
│                          (robin-api)                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      DatabaseRouter                             │ │
│  │  • env.DB (D1)     → 用户/配置/搜索索引 (高频、低延迟)          │ │
│  │  • Turso Client    → 视频数据 (大容量、高读取额度)              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                ↓                                    ↓
         ┌─────────────┐                    ┌─────────────────┐
         │   CF D1     │                    │     Turso       │
         │  (robin-db) │                    │  (robin-vod)    │
         ├─────────────┤                    ├─────────────────┤
         │ users       │                    │ vod_cache       │
         │ history     │                    │ vod_ratings     │
         │ favorites   │                    │ vod_recommendations │
         │ config      │                    │ actors          │
         │ vod_search  │ ← FTS5搜索索引     │ vod_actor_relation │
         │ tasks       │                    │ vod_access_log  │
         │ sources     │                    │ anime_timeline  │
         │ stats       │                    └─────────────────┘
         └─────────────┘                    libsql://robin-vod.turso.io
```

### 2.2 为什么这样分？

| 数据类型 | 存储位置 | 原因 |
|----------|----------|------|
| 用户数据 | CF D1 | 高频读写，需要最低延迟 |
| 配置数据 | CF D1 | 启动时加载，需要快 |
| **搜索索引** | **CF D1** | **搜索是高频操作，FTS5 需要最低延迟** |
| 采集任务 | CF D1 | 与 Worker 紧密集成 |
| **视频数据** | **Turso** | 数据量大，读多写少，Turso 额度更大 |
| 演员/评分 | Turso | 与视频数据关联，同库便于 JOIN |

### 2.3 搜索架构设计

**核心思路**：FTS5 索引在 D1（快速匹配），视频详情在 Turso（大容量存储）

```
搜索请求 "三体"
     ↓
┌─────────────────────────────────────────┐
│ 1. D1: FTS5 搜索获取 vod_id 列表        │
│    SELECT vod_id FROM vod_search        │
│    WHERE vod_search MATCH '三体'        │
│    → 返回: ['abc123', 'def456', ...]    │
│    延迟: ~10ms                          │
└─────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────┐
│ 2. Turso: 用 vod_id 获取完整数据        │
│    SELECT * FROM vod_cache              │
│    WHERE vod_id IN ('abc123', 'def456') │
│    延迟: ~30ms                          │
└─────────────────────────────────────────┘
     ↓
总延迟: ~40ms (可接受)
```

### 2.4 数据写入流程（双写）

采集器写入时需要同时更新两个库：

```
采集到新视频
     ↓
┌─────────────────────────────────────────┐
│ 1. Turso: 写入视频主数据                │
│    INSERT INTO vod_cache (...)          │
└─────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────┐
│ 2. D1: 写入搜索索引                     │
│    INSERT INTO vod_search               │
│    (vod_id, vod_name, vod_actor, ...)   │
└─────────────────────────────────────────┘
```

### 2.5 搜索索引同步策略（重要）

**当前代码问题**：`scheduler.ts` 中搜索索引重建使用了跨表 SELECT：
```sql
INSERT INTO vod_search SELECT ... FROM vod_cache
```

**分库后需要改为应用层同步**：

```typescript
// services/scheduler.ts 改造后

async function rebuildSearchIndex(router: DatabaseRouter): Promise<void> {
  // 1. 从 Turso 查询所有有效视频
  const videos = await router.vod.query(`
    SELECT vod_id, vod_name, vod_actor, vod_director, vod_content
    FROM vod_cache WHERE is_valid = 1
  `);
  
  // 2. 清空 D1 搜索索引
  await router.main.execute('DELETE FROM vod_search');
  
  // 3. 分批写入 D1
  const batchSize = 100;
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    const statements = batch.map(v => ({
      sql: `INSERT INTO vod_search (vod_id, vod_name, vod_actor, vod_director, vod_content)
            VALUES (?, ?, ?, ?, ?)`,
      params: [v.vod_id, v.vod_name, v.vod_actor, v.vod_director, v.vod_content]
    }));
    await router.main.batch(statements);
  }
}
```

---

## 三、技术实现方案

### 3.1 数据库抽象层

#### 3.1.1 统一接口定义

```typescript
// core/database/types.ts
export interface IDatabase {
  // 查询
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  
  // 执行
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number }>;
  
  // 批量执行
  batch(statements: { sql: string; params?: any[] }[]): Promise<void>;
  
  // 事务（单库内）
  transaction<T>(fn: (db: IDatabase) => Promise<T>): Promise<T>;
}

export interface DatabaseConfig {
  type: 'cloudflare-d1' | 'turso';
  binding?: string;           // D1 binding name
  url?: string;               // Turso connection URL
  token?: string;             // Turso auth token
}
```

#### 3.1.2 D1 适配器

```typescript
// core/database/adapters/d1.ts
export class D1Adapter implements IDatabase {
  constructor(private db: D1Database) {}
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    const result = await stmt.all();
    return result.results as T[];
  }
  
  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    return await stmt.first() as T | null;
  }
  
  async execute(sql: string, params?: any[]): Promise<{ rowsAffected: number }> {
    const stmt = params ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    const result = await stmt.run();
    return { rowsAffected: result.meta.changes || 0 };
  }
  
  async batch(statements: { sql: string; params?: any[] }[]): Promise<void> {
    const stmts = statements.map(s => 
      s.params ? this.db.prepare(s.sql).bind(...s.params) : this.db.prepare(s.sql)
    );
    await this.db.batch(stmts);
  }
  
  async transaction<T>(fn: (db: IDatabase) => Promise<T>): Promise<T> {
    // D1 的 batch 本身就是事务
    return await fn(this);
  }
}
```

#### 3.1.3 Turso 适配器

```typescript
// core/database/adapters/turso.ts
import { createClient, Client } from '@libsql/client/web';

export class TursoAdapter implements IDatabase {
  private client: Client;
  
  constructor(url: string, authToken: string) {
    this.client = createClient({ url, authToken });
  }
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.client.execute({ sql, args: params || [] });
    return result.rows as unknown as T[];
  }
  
  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const result = await this.client.execute({ sql, args: params || [] });
    return (result.rows[0] as unknown as T) || null;
  }
  
  async execute(sql: string, params?: any[]): Promise<{ rowsAffected: number }> {
    const result = await this.client.execute({ sql, args: params || [] });
    return { rowsAffected: result.rowsAffected };
  }
  
  async batch(statements: { sql: string; params?: any[] }[]): Promise<void> {
    await this.client.batch(
      statements.map(s => ({ sql: s.sql, args: s.params || [] })),
      'write'
    );
  }
  
  async transaction<T>(fn: (db: IDatabase) => Promise<T>): Promise<T> {
    const tx = await this.client.transaction('write');
    try {
      const result = await fn(this);
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }
}
```


#### 3.1.4 数据库路由器

```typescript
// core/database/router.ts
import { D1Adapter } from './adapters/d1';
import { TursoAdapter } from './adapters/turso';
import { IDatabase } from './types';

export type Bindings = {
  DB: D1Database;              // CF D1
  ROBIN_CACHE: KVNamespace;
  TURSO_URL: string;           // libsql://robin-vod.turso.io
  TURSO_TOKEN: string;         // Turso auth token
};

// D1 表（用户/配置/搜索/统计）
const D1_TABLES = [
  // 用户相关
  'users', 'history', 'favorites', 'appointments', 'user_behavior', 'user_progress',
  // 配置相关
  'system_config', 'page_modules', 'home_tabs', 'video_categories', 'video_sub_categories',
  // 采集相关
  'video_sources', 'source_health', 'collect_tasks_v2', 'collect_logs', 'category_mappings',
  // 系统相关
  'feedback', 'crash_reports', 'announcements', 'ads_inventory',
  // 统计相关（高频写入）
  'daily_stats', 'module_stats', 'module_click_log', 'search_history', 'hot_search_stats',
  'vod_access_log',  // 点击日志，定时同步到 Turso
  // 存储相关
  'storage_config', 'sync_logs', 'app_wall', 'topics', 'topic_items',
  // 搜索索引
  'vod_search',  // FTS5 搜索索引保留在 D1
];

// Turso 表（视频数据）
const TURSO_TABLES = [
  'vod_cache',           // 视频主表
  'vod_ratings',         // 评分
  'vod_recommendations', // 推荐
  'vod_invalid_urls',    // 失效地址
  'actors',              // 演员
  'vod_actor_relation',  // 演员关联
  'anime_timeline',      // 动漫时间线
];

export class DatabaseRouter {
  private d1Adapter: IDatabase;
  private tursoAdapter: IDatabase;

  constructor(private env: Bindings) {
    this.d1Adapter = new D1Adapter(env.DB);
    this.tursoAdapter = new TursoAdapter(env.TURSO_URL, env.TURSO_TOKEN);
  }

  // 获取 D1（用户/配置/搜索）
  get main(): IDatabase {
    return this.d1Adapter;
  }

  // 获取 Turso（视频数据）
  get vod(): IDatabase {
    return this.tursoAdapter;
  }

  // 根据表名自动路由
  getByTable(table: string): IDatabase {
    if (TURSO_TABLES.includes(table)) {
      return this.tursoAdapter;
    }
    return this.d1Adapter;
  }

  // 搜索：FTS5 在 D1，详情在 Turso
  async search(keyword: string, limit: number = 20): Promise<any[]> {
    // 1. D1: FTS5 搜索获取 vod_id 列表
    const ids = await this.d1Adapter.query<{ vod_id: string }>(
      `SELECT vod_id FROM vod_search WHERE vod_search MATCH ? LIMIT ?`,
      [keyword, limit]
    );

    if (ids.length === 0) {
      // 降级到 LIKE 搜索
      return await this.tursoAdapter.query(
        `SELECT * FROM vod_cache WHERE vod_name LIKE ? AND is_valid = 1 ORDER BY vod_score DESC LIMIT ?`,
        [`%${keyword}%`, limit]
      );
    }

    // 2. Turso: 用 vod_id 获取完整数据
    const idList = ids.map(r => `'${r.vod_id}'`).join(',');
    return await this.tursoAdapter.query(
      `SELECT * FROM vod_cache WHERE vod_id IN (${idList}) AND is_valid = 1`
    );
  }
}
```

### 3.2 配置管理

```typescript
// core/database/config.ts

export interface ShardConfig {
  mode: 'single' | 'd1-turso';
  version: number;
  updatedAt: number;
}

const SHARD_CONFIG_KEY = 'shard:config';

// 获取配置
export async function getShardConfig(env: Bindings): Promise<ShardConfig> {
  const cached = await env.ROBIN_CACHE.get(SHARD_CONFIG_KEY, 'json');
  if (cached) return cached as ShardConfig;
  
  // 默认单库模式（向后兼容）
  return {
    mode: 'single',
    version: 1,
    updatedAt: Date.now(),
  };
}

// 保存配置
export async function saveShardConfig(env: Bindings, config: ShardConfig): Promise<void> {
  config.updatedAt = Date.now();
  config.version++;
  await env.ROBIN_CACHE.put(SHARD_CONFIG_KEY, JSON.stringify(config));
}
```


---

## 四、表分配明细

### 4.1 CF D1 (robin-db) - 用户/配置/搜索/统计

```sql
-- 用户相关
users, history, favorites, appointments, user_behavior, user_progress

-- 配置相关
system_config, page_modules, home_tabs, video_categories, video_sub_categories

-- 采集相关
video_sources, source_health, collect_tasks_v2, collect_logs, category_mappings

-- 系统相关
feedback, crash_reports, announcements, ads_inventory

-- 统计相关（高频写入，保留在 D1）
daily_stats, module_stats, module_click_log, search_history, hot_search_stats
vod_access_log  -- 点击日志，定时同步到 Turso

-- 存储相关
storage_config, sync_logs, app_wall, topics, topic_items

-- 搜索索引（关键：保留在 D1 以获得最低延迟）
vod_search (FTS5)
```

### 4.2 Turso (robin-vod) - 视频数据

```sql
-- 视频主表（所有分类，包括短剧）
vod_cache

-- 视频扩展
vod_ratings, vod_recommendations, vod_invalid_urls

-- 演员
actors, vod_actor_relation

-- 时间线
anime_timeline
```

**注意**：`vod_access_log` 保留在 D1（高频写入），通过定时任务同步点击量到 Turso 的 `vod_cache`。

### 4.3 数据同步关系

| D1 表 | Turso 表 | 关系 | 处理方式 |
|-------|----------|------|----------|
| vod_search.vod_id | vod_cache.vod_id | 1:1 索引 | 两步查询（先 D1 后 Turso） |
| history.vod_id | vod_cache.vod_id | 引用 | 冗余存储 vod_name/pic ✓ |
| favorites.vod_id | vod_cache.vod_id | 引用 | 冗余存储 vod_name/pic ✓ |

### 4.4 Turso 内部 JOIN（无需改造）

以下 JOIN 都在 Turso 内部，无需改造：

| 表1 | 表2 | 场景 |
|-----|-----|------|
| vod_ratings | vod_cache | 评分获取 |
| vod_actor_relation | vod_cache | 演员作品查询 |
| actors | vod_actor_relation | 演员人气计算 |

### 4.5 需要改造的跨库查询

| 原 SQL | 改造方式 |
|--------|----------|
| `vod_search JOIN vod_cache` | 两步查询：D1 获取 ID → Turso 获取详情 |
| `INSERT INTO vod_search SELECT FROM vod_cache` | 应用层同步（见 2.5 节） |
| `UPDATE vod_cache SET ... FROM vod_access_log` | 应用层更新（见下方） |

### 4.6 点击量统计改造（重要）

**当前代码问题**：`hits_tracker.ts` 使用子查询更新点击量：
```sql
UPDATE vod_cache SET vod_hits_day = (
  SELECT SUM(hits) FROM vod_access_log WHERE vod_access_log.vod_id = vod_cache.vod_id
)
```

**分库后需要改为应用层更新**：

```typescript
// services/hits_tracker.ts 改造后

async function syncHitsToVodCache(router: DatabaseRouter): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  // 1. 从 D1 查询各视频的点击统计
  const stats = await router.main.query(`
    SELECT 
      vod_id,
      SUM(CASE WHEN access_date = ? THEN hits ELSE 0 END) as hits_day,
      SUM(CASE WHEN access_date >= ? THEN hits ELSE 0 END) as hits_week,
      SUM(CASE WHEN access_date >= ? THEN hits ELSE 0 END) as hits_month,
      SUM(hits) as hits_total
    FROM vod_access_log
    GROUP BY vod_id
  `, [today, weekAgo, monthAgo]);

  // 2. 批量更新 Turso 中的 vod_cache
  const batchSize = 100;
  for (let i = 0; i < stats.length; i += batchSize) {
    const batch = stats.slice(i, i + batchSize);
    const statements = batch.map(s => ({
      sql: `UPDATE vod_cache SET vod_hits_day = ?, vod_hits_week = ?, 
            vod_hits_month = ?, vod_hits = ? WHERE vod_id = ?`,
      params: [s.hits_day, s.hits_week, s.hits_month, s.hits_total, s.vod_id]
    }));
    await router.vod.batch(statements);
  }
}
```

**注意**：`vod_access_log` 保留在 D1（高频写入，低延迟），定时任务同步到 Turso。

---

## 五、代码改造示例

### 5.1 采集器双写

```typescript
// services/collector_v2.ts

async function saveVideo(
  router: DatabaseRouter,
  video: ParsedVideo,
  source: SourceInfo,
  classification: ClassificationResult
): Promise<'new' | 'updated' | 'skipped'> {
  const typeId = classification.typeId;
  const vodId = generateVodId(video.vod_name, video.vod_year, video.vod_area);
  const now = Math.floor(Date.now() / 1000);

  // 1. 查找是否已存在（在 Turso）
  const existing = await router.vod.queryOne<{ vod_id: string; vod_play_url: string }>(
    `SELECT vod_id, vod_play_url, source_name FROM vod_cache WHERE vod_name = ? AND vod_year = ?`,
    [video.vod_name, video.vod_year]
  );

  if (!existing) {
    // 2a. 新增：写入 Turso
    await router.vod.execute(`
      INSERT INTO vod_cache (vod_id, vod_name, vod_pic, type_id, type_name, vod_year, vod_area, 
        vod_actor, vod_director, vod_content, vod_play_url, vod_score, source_name, 
        is_valid, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      vodId, video.vod_name, video.vod_pic, typeId, classification.typeName,
      video.vod_year, video.vod_area, video.vod_actor, video.vod_director,
      video.vod_content, JSON.stringify(playUrls), video.vod_score || 0,
      source.name, now, now
    ]);

    // 2b. 新增：写入 D1 搜索索引
    await router.main.execute(`
      INSERT INTO vod_search (vod_id, vod_name, vod_actor, vod_director, vod_content)
      VALUES (?, ?, ?, ?, ?)
    `, [vodId, video.vod_name, video.vod_actor, video.vod_director, video.vod_content]);

    return 'new';
  } else {
    // 3. 更新：只更新 Turso（搜索索引通常不需要更新）
    const mergedUrls = mergePlayUrls(existing.vod_play_url, playUrls);
    await router.vod.execute(`
      UPDATE vod_cache SET vod_play_url = ?, source_name = ?, updated_at = ? WHERE vod_id = ?
    `, [JSON.stringify(mergedUrls), source.name, now, existing.vod_id]);

    return 'updated';
  }
}
```

### 5.2 搜索接口

```typescript
// routes/vod.ts

vod.get('/api/search_cache', async (c) => {
  const keyword = c.req.query('wd');
  const limit = parseInt(c.req.query('limit') || '20');

  if (!keyword) {
    return c.json({ code: 0, msg: 'Missing keyword' }, 400);
  }

  const router = new DatabaseRouter(c.env);
  
  try {
    // 使用 Router 的搜索方法（FTS5 + Turso 详情）
    const results = await router.search(keyword, limit);
    
    return c.json({
      code: 1,
      msg: 'success',
      keyword,
      total: results.length,
      list: results,
    });
  } catch (error) {
    console.error('[Search] Error:', error);
    return c.json({ code: 0, msg: 'Search failed' }, 500);
  }
});
```

### 5.3 视频详情

```typescript
// routes/vod.ts

vod.get('/api/vod/detail', async (c) => {
  const ids = c.req.query('ids');
  if (!ids) {
    return c.json({ code: 0, msg: 'Missing ids' }, 400);
  }

  const router = new DatabaseRouter(c.env);

  // 从 Turso 获取视频详情
  const video = await router.vod.queryOne(
    `SELECT * FROM vod_cache WHERE vod_id = ? AND is_valid = 1`,
    [ids]
  );

  if (!video) {
    return c.json({ code: 0, msg: 'Video not found' }, 404);
  }

  // 获取推荐（同样从 Turso）
  const recommendations = await router.vod.query(
    `SELECT * FROM vod_cache WHERE type_id = ? AND vod_id != ? AND is_valid = 1 
     ORDER BY vod_score DESC LIMIT 10`,
    [video.type_id, ids]
  );

  return c.json({
    code: 1,
    msg: 'success',
    data: video,
    recommendations,
  });
});
```


---

## 六、数据迁移方案

### 6.1 支持双向迁移

本方案支持在 CF D1 和 Turso 之间双向迁移数据：

```
┌─────────────┐                    ┌─────────────┐
│   CF D1     │  ←───迁移工具───→  │   Turso     │
│  (当前单库)  │                    │  (视频库)   │
└─────────────┘                    └─────────────┘
```

### 6.2 迁移步骤

#### 阶段一：准备工作

```bash
# 1. 创建 Turso 数据库
turso db create robin-vod

# 2. 获取连接信息
turso db show robin-vod --url
# 输出: libsql://robin-vod-xxx.turso.io

turso db tokens create robin-vod
# 输出: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...

# 3. 设置 Cloudflare Secrets
wrangler secret put TURSO_URL
# 输入: libsql://robin-vod-xxx.turso.io

wrangler secret put TURSO_TOKEN
# 输入: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

#### 阶段二：初始化 Turso 表结构

```sql
-- schema_turso.sql (在 Turso 中执行)

-- 视频主表
CREATE TABLE IF NOT EXISTS vod_cache (
    vod_id TEXT PRIMARY KEY,
    vod_name TEXT NOT NULL,
    vod_pic TEXT,
    vod_pic_thumb TEXT,
    vod_remarks TEXT,
    vod_year TEXT,
    vod_area TEXT,
    vod_lang TEXT,
    vod_actor TEXT,
    vod_director TEXT,
    vod_content TEXT,
    vod_play_url TEXT,
    vod_score REAL DEFAULT 0,
    vod_hits INTEGER DEFAULT 0,
    vod_tag TEXT,
    type_id INTEGER,
    type_name TEXT,
    sub_type_id INTEGER,
    sub_type_name TEXT,
    source_name TEXT,
    quality_score INTEGER DEFAULT 0,
    is_valid INTEGER DEFAULT 1,
    shorts_preview_episode INTEGER,
    shorts_preview_url TEXT,
    shorts_category TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE INDEX idx_vod_type ON vod_cache(type_id, updated_at DESC);
CREATE INDEX idx_vod_valid ON vod_cache(is_valid, updated_at DESC);

-- 其他 Turso 表...
```

#### 阶段三：数据迁移

```typescript
// services/migration.ts

export interface MigrationTask {
  id: string;
  direction: 'd1-to-turso' | 'turso-to-d1';
  tables: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    total: number;
    migrated: number;
    currentTable: string;
    percentage: number;
  };
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

/**
 * 从 D1 迁移视频数据到 Turso
 */
export async function migrateVodToTurso(
  router: DatabaseRouter,
  onProgress?: (progress: MigrationTask['progress']) => void
): Promise<void> {
  const batchSize = 100;
  
  // 1. 获取总数
  const countResult = await router.main.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM vod_cache'
  );
  const total = countResult?.count || 0;
  
  let offset = 0;
  let migrated = 0;
  
  while (offset < total) {
    // 2. 分批读取 D1 数据
    const batch = await router.main.query(
      'SELECT * FROM vod_cache LIMIT ? OFFSET ?',
      [batchSize, offset]
    );
    
    if (batch.length === 0) break;
    
    // 3. 批量写入 Turso
    const statements = batch.map(video => ({
      sql: `INSERT OR REPLACE INTO vod_cache (
        vod_id, vod_name, vod_pic, vod_remarks, vod_year, vod_area,
        vod_actor, vod_director, vod_content, vod_play_url, vod_score,
        type_id, type_name, source_name, is_valid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        video.vod_id, video.vod_name, video.vod_pic, video.vod_remarks,
        video.vod_year, video.vod_area, video.vod_actor, video.vod_director,
        video.vod_content, video.vod_play_url, video.vod_score,
        video.type_id, video.type_name, video.source_name, video.is_valid,
        video.created_at, video.updated_at
      ],
    }));
    
    await router.vod.batch(statements);
    
    migrated += batch.length;
    offset += batchSize;
    
    onProgress?.({
      total,
      migrated,
      currentTable: 'vod_cache',
      percentage: Math.round((migrated / total) * 100),
    });
    
    // 避免请求过快
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`[Migration] Completed: ${migrated}/${total} videos migrated to Turso`);
}

/**
 * 从 Turso 迁移回 D1（回滚用）
 */
export async function migrateVodToD1(
  router: DatabaseRouter,
  onProgress?: (progress: MigrationTask['progress']) => void
): Promise<void> {
  // 类似逻辑，方向相反
  // ...
}
```


---

## 七、配置示例

### 7.1 wrangler.toml

```toml
name = "robin-backend"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# CF D1 - 用户数据、配置、搜索索引
[[d1_databases]]
binding = "DB"
database_name = "robin-db"
database_id = "your-d1-database-id"

# KV - 缓存
[[kv_namespaces]]
binding = "ROBIN_CACHE"
id = "your-kv-namespace-id"

# Turso 配置通过 Secret 设置（不要写在 toml 中）
# wrangler secret put TURSO_URL
# wrangler secret put TURSO_TOKEN

[triggers]
crons = [
  "0 */6 * * *",   # 增量采集
  "0 3 * * *",     # 全量采集
  "0 */2 * * *"    # URL检测
]
```

### 7.2 Bindings 类型定义

```typescript
// src/index.ts

export type Bindings = {
  DB: D1Database;              // CF D1
  ROBIN_CACHE: KVNamespace;    // KV 缓存
  TURSO_URL: string;           // Turso URL (Secret)
  TURSO_TOKEN: string;         // Turso Token (Secret)
  JWT_SECRET: string;
  ADMIN_SECRET_KEY: string;
  DINGTALK_WEBHOOK?: string;
  TMDB_API_KEY?: string;
};
```

### 7.3 package.json 依赖

```json
{
  "dependencies": {
    "@libsql/client": "^0.14.0",
    "hono": "^4.0.0"
  }
}
```

---

## 八、实施计划

### 8.1 开发任务清单

#### 第一阶段：基础架构（3-5 天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 | `src/core/database/types.ts` | IDatabase 接口定义 |
| 1.2 | `src/core/database/adapters/d1.ts` | D1 适配器 |
| 1.3 | `src/core/database/adapters/turso.ts` | Turso 适配器 |
| 1.4 | `src/core/database/router.ts` | DatabaseRouter |
| 1.5 | `src/core/database/config.ts` | 配置管理 |

#### 第二阶段：代码改造（5-7 天）

| 任务 | 文件 | 改造内容 |
|------|------|----------|
| 2.1 | `src/index.ts` | 初始化 Router |
| 2.2 | `src/routes/vod.ts` | 视频查询改用 router.vod |
| 2.3 | `src/routes/shorts.ts` | 短剧查询改用 router.vod |
| 2.4 | `src/services/collector_v2.ts` | 采集双写逻辑 |
| 2.5 | `src/services/scheduler.ts` | 定时任务改造 |
| 2.6 | 其他 routes/services | 按表归属改造 |

#### 第三阶段：迁移和验证（3-5 天）

| 任务 | 说明 |
|------|------|
| 3.1 | 创建 Turso 数据库 |
| 3.2 | 初始化表结构 |
| 3.3 | 执行数据迁移 |
| 3.4 | 功能验证测试 |
| 3.5 | 性能对比测试 |

### 8.2 需要改造的文件清单

#### Routes（路由层）
| 文件 | 涉及表 | 改造说明 |
|------|--------|----------|
| `routes/vod.ts` | vod_cache, vod_search | vod_cache → Turso, vod_search → D1 |
| `routes/shorts.ts` | vod_cache | → Turso |
| `routes/admin.ts` | 多表 | 按表归属路由 |
| `routes/auth.ts` | users, history, favorites | → D1 |
| `routes/layout.ts` | page_modules, home_tabs | → D1 |
| `routes/system.ts` | system_config, feedback | → D1 |
| `routes/cms.ts` | vod_cache | → Turso |

#### Services（服务层）
| 文件 | 涉及表 | 改造说明 |
|------|--------|----------|
| `services/collector_v2.ts` | vod_cache, vod_search | **双写**：Turso + D1 |
| `services/video_merger.ts` | vod_cache | → Turso |
| `services/recommendation_engine.ts` | vod_cache | → Turso |
| `services/scheduler.ts` | vod_cache, vod_search | 按表路由 |
| `services/task_manager.ts` | collect_tasks_v2 | → D1 |
| `services/source_health.ts` | video_sources | → D1 |


---

## 九、风险评估与缓解

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Turso 延迟增加 | 视频列表加载变慢 20-50ms | 可接受；使用 KV 缓存热门数据 |
| 双写一致性 | 搜索索引与视频数据不同步 | 采集失败时重试；定期同步检查 |
| Turso 服务不可用 | 视频功能不可用 | 健康检查；降级到 D1 单库模式 |
| FTS5 索引膨胀 | D1 存储占用增加 | 定期清理无效索引 |

### 9.2 运维风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 配置错误 | 数据写入错误的库 | 配置验证；灰度发布 |
| 迁移失败 | 数据丢失 | 迁移前备份；断点续传 |
| 额度超限 | 服务降级 | 监控用量；预警告警 |

### 9.3 回滚方案

1. **配置回滚**：将 `mode` 切换回 `single`，所有请求走 D1
2. **数据回滚**：使用 `migrateVodToD1()` 将数据迁回 D1
3. **代码回滚**：保留旧代码分支，紧急情况可快速回滚

---

## 十、总结

### 10.1 方案优势

1. **搜索延迟最优**：FTS5 索引保留在 D1，搜索延迟 ~10ms
2. **容量大幅提升**：Turso 提供 9GB 存储 + 5亿行/月读取
3. **双向迁移**：支持在 D1 和 Turso 之间灵活迁移
4. **向后兼容**：默认单库模式，无缝升级
5. **无需多账号**：单个 CF 账号 + Turso 即可

### 10.2 额度规划

| 数据类型 | 存储位置 | 预估用量 | 免费额度 |
|----------|----------|----------|----------|
| 用户/配置 | D1 | ~100MB | 5GB ✓ |
| 搜索索引 | D1 | ~500MB | 5GB ✓ |
| 视频数据 | Turso | ~3GB | 9GB ✓ |
| 视频读取 | Turso | ~1000万/天 | ~1600万/天 ✓ |

### 10.3 推荐路径

```
阶段 0：当前状态
└── 单库 D1，所有数据混合存储

阶段 1：代码改造（本方案）
├── 实现 DatabaseRouter 抽象层
├── 默认单库模式，行为不变
└── 验证功能正常

阶段 2：分库部署
├── 创建 Turso 数据库
├── 迁移视频数据到 Turso
├── 搜索索引保留在 D1
└── 验证性能和功能

阶段 3：持续优化
├── 监控额度使用
├── 优化热门数据缓存
└── 按需调整分库策略
```

### 10.4 关键改造点总结

| 改造项 | 原实现 | 新实现 |
|--------|--------|--------|
| 搜索 | `vod_search JOIN vod_cache` | 两步查询：D1 获取 ID → Turso 获取详情 |
| 搜索索引重建 | `INSERT INTO vod_search SELECT FROM vod_cache` | 应用层同步（Turso → D1） |
| 点击量统计 | `UPDATE vod_cache FROM vod_access_log` | 应用层同步（D1 → Turso） |
| 采集写入 | 单库写入 | 双写：Turso (vod_cache) + D1 (vod_search) |

---

**文档版本**: v2.1  
**创建日期**: 2024-12-16  
**更新日期**: 2024-12-16  
**更新内容**: 
- 采用 CF D1 + Turso 方案（移除多账号桥接）
- 搜索索引保留在 D1 以获得最低延迟
- 支持 D1 ↔ Turso 双向迁移
- 简化架构，降低复杂度
- 补充搜索索引同步策略（2.5 节）
- 补充点击量统计改造方案（4.6 节）
- 明确 vod_access_log 保留在 D1
- 补充关键改造点总结（10.4 节）
