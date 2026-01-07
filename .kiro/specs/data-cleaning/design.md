# 数据清洗方案设计文档

## 一、背景与目标

### 1.1 当前问题

| 问题 | 现状 | 影响 |
|------|------|------|
| 播放地址未格式化 | 存储原始字符串 `第1集$url#第2集$url` | APP 每次都要解析，增加 CPU 消耗 |
| HTTP 未升级 | 图片/视频可能是 `http://` | iOS/Android 默认阻止不安全连接 |
| 字段名不统一 | 使用 `vod_xxx` 格式 | APP 代码冗余，不够简洁 |
| 清洗时机错误 | 部分在 API 请求时处理 | 每次请求都消耗 CF CPU |

### 1.2 目标

1. **采集时清洗**：一次处理，永久受益
2. **保留换源功能**：多播放源结构化存储
3. **降低 CF 消耗**：API 直接返回干净数据
4. **简化 APP 代码**：减少客户端解析逻辑

---

## 二、数据结构设计

### 2.1 当前 `vod_play_url` 格式

```json
{
  "质子资源": "第1集$http://a.com/1.m3u8#第2集$http://a.com/2.m3u8",
  "量子资源": "第1集$http://b.com/1.m3u8#第2集$http://b.com/2.m3u8"
}
```

**问题**：
- 每个播放源的值仍是原始字符串
- APP 需要自己切割 `#` 和 `$`
- 没有 HTTP 升级

### 2.2 清洗后的 `vod_play_url` 格式

```json
{
  "质子资源": [
    { "name": "第1集", "url": "https://a.com/1.m3u8" },
    { "name": "第2集", "url": "https://a.com/2.m3u8" }
  ],
  "量子资源": [
    { "name": "第1集", "url": "https://b.com/1.m3u8" },
    { "name": "第2集", "url": "https://b.com/2.m3u8" }
  ]
}
```

**优点**：
- ✅ 保留换源功能（多个 key）
- ✅ 选集已格式化（数组）
- ✅ HTTP 已升级为 HTTPS
- ✅ APP 直接使用，无需解析

### 2.3 API 输出格式（给 APP）

```json
{
  "code": 1,
  "data": {
    "vod_id": "abc123",
    "vod_name": "流浪地球",
    "vod_pic": "https://...",
    "vod_year": "2019",
    "play_sources": [
      {
        "name": "质子资源",
        "episodes": [
          { "name": "正片", "url": "https://..." }
        ]
      },
      {
        "name": "量子资源",
        "episodes": [
          { "name": "正片", "url": "https://..." }
        ]
      }
    ]
  }
}
```

---

## 三、清洗规则

### 3.1 播放地址清洗

| 步骤 | 输入 | 输出 |
|------|------|------|
| 1. 分割播放源 | `"第1集$url#第2集$url"` | `["第1集$url", "第2集$url"]` |
| 2. 解析选集 | `"第1集$url"` | `{ name: "第1集", url: "url" }` |
| 3. HTTP 升级 | `http://xxx` | `https://xxx` |
| 4. 过滤无效 | 空 URL、非 http(s) | 移除 |

### 3.2 图片地址清洗

| 步骤 | 说明 |
|------|------|
| HTTP 升级 | `http://` → `https://` |
| 空值处理 | 空字符串保持不变 |
| 相对路径 | 保持不变（APP 端处理） |

### 3.3 清洗时机

```
采集流程：
资源站 API → 解析响应 → 【清洗】 → 存入数据库

API 流程：
数据库 → 直接返回（无需处理）
```

---

## 四、修改清单

### 4.1 后端修改

| 文件 | 修改内容 | 优先级 |
|------|----------|--------|
| `backend/src/services/data_cleaner.ts` | 新建清洗服务模块 | P0 |
| `backend/src/services/collector_v2.ts` | 在 `saveVideo()` 中调用清洗函数 | P0 |
| `backend/src/services/response_parser.ts` | 添加 `cleanImageUrl()` 函数 | P0 |
| `backend/src/routes/vod.ts` | 修改 `/api/vod/detail` 返回格式化的 `play_sources` | P1 |
| `backend/src/services/url_validator.ts` | 修改 `extractFirstPlayUrl()` 支持新格式 | P1 |
| `backend/src/services/video_merger.ts` | 修改 `mergePlayUrls()` 支持新格式 | P1 |
| `backend/src/routes/shorts.ts` | 修改 `parseEpisodes()` 支持新格式 | P1 |
| `backend/src/routes/cms.ts` | 修改 `convertToCMSFormat()` 支持新格式 | P1 |
| `backend/src/routes/admin.ts` | 修改视频编辑/修复相关逻辑支持新格式 | P1 |
| `backend/src/routes/admin/videos.ts` | 修改播放源解析支持新格式 | P1 |
| `backend/src/routes/admin/shorts.ts` | 修改短剧预览选集逻辑支持新格式 | P1 |
| `backend/src/scripts/merge_duplicates.ts` | 修改合并逻辑支持新格式 | P2 |
| `backend/src/scripts/migrate_merge_videos.ts` | 修改迁移逻辑支持新格式 | P2 |

### 4.2 数据库修改

| 操作 | 说明 |
|------|------|
| 无需修改表结构 | `vod_play_url` 仍是 TEXT，存 JSON |
| 数据迁移 | 可选：批量清洗已有数据 |

### 4.3 APP 修改

| 文件 | 修改内容 | 优先级 |
|------|----------|--------|
| `app/lib/modules/detail/detail_controller.dart` | 简化 `_parseAllSources()`，直接使用 `play_sources` | P1 |
| `app/lib/core/player/global_player_manager.dart` | 修改 `_parsePlayUrlFromCMS()` 支持新格式 | P1 |
| `app/lib/widgets/episode_selector.dart` | 无需修改，已支持结构化数据 | - |
| `app/lib/widgets/net_image.dart` | 无需修改，已有代理逻辑 | - |

### 4.4 管理后台修改

| 文件 | 修改内容 | 优先级 |
|------|----------|--------|
| `admin/src/pages/VideoManagement.tsx` | 可选：显示清洗后的播放源列表 | P2 |

---

## 五、实现细节

### 5.1 核心清洗函数

```typescript
// backend/src/services/data_cleaner.ts

/**
 * 清洗播放地址
 * 输入: { "资源站": "第1集$url#第2集$url" }
 * 输出: { "资源站": [{ name: "第1集", url: "https://..." }] }
 */
export function cleanPlayUrls(
  rawUrls: Record<string, string>
): Record<string, Array<{ name: string; url: string }>> {
  const result: Record<string, Array<{ name: string; url: string }>> = {};
  
  for (const [sourceName, rawUrl] of Object.entries(rawUrls)) {
    const episodes = parseEpisodes(rawUrl);
    if (episodes.length > 0) {
      result[sourceName] = episodes;
    }
  }
  
  return result;
}

/**
 * 解析选集字符串
 */
function parseEpisodes(raw: string): Array<{ name: string; url: string }> {
  if (!raw) return [];
  
  const episodes: Array<{ name: string; url: string }> = [];
  const parts = raw.split('#');
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    
    const dollarIndex = part.indexOf('$');
    let name: string;
    let url: string;
    
    if (dollarIndex > 0) {
      name = part.substring(0, dollarIndex).trim() || `第${i + 1}集`;
      url = part.substring(dollarIndex + 1).trim();
    } else {
      name = `第${i + 1}集`;
      url = part;
    }
    
    // HTTP 升级
    url = upgradeToHttps(url);
    
    // 过滤无效 URL
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      episodes.push({ name, url });
    }
  }
  
  return episodes;
}

/**
 * HTTP 升级为 HTTPS
 */
export function upgradeToHttps(url: string): string {
  if (!url) return url;
  
  // 大多数资源站都支持 HTTPS，直接替换
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  return url;
}

/**
 * 清洗图片地址
 */
export function cleanImageUrl(url: string): string {
  if (!url) return url;
  return upgradeToHttps(url);
}
```

### 5.2 修改 saveVideo 函数

```typescript
// backend/src/services/collector_v2.ts

import { cleanPlayUrls, cleanImageUrl } from './data_cleaner';

async function saveVideo(...) {
  // ... 现有代码 ...
  
  // 清洗播放地址
  const rawPlayUrls = parsePlayUrls(video, source.name);
  const cleanedPlayUrls = cleanPlayUrls(rawPlayUrls);
  
  // 清洗图片地址
  const cleanedPic = cleanImageUrl(video.vod_pic || '');
  const cleanedPicThumb = cleanImageUrl(video.vod_pic_thumb || video.vod_pic || '');
  
  // 存入数据库
  await env.DB.prepare(`
    INSERT INTO vod_cache (..., vod_play_url, vod_pic, vod_pic_thumb, ...)
    VALUES (..., ?, ?, ?, ...)
  `).bind(
    ...,
    JSON.stringify(cleanedPlayUrls),  // 清洗后的 JSON
    cleanedPic,
    cleanedPicThumb,
    ...
  ).run();
}
```

### 5.3 修改 API 输出

```typescript
// backend/src/routes/vod.ts

vod.get('/api/vod/detail', async (c) => {
  // ... 获取 video ...
  
  // 解析播放源（已清洗，直接使用）
  let playSources: Array<{ name: string; episodes: any[] }> = [];
  
  try {
    const playUrls = JSON.parse(video.vod_play_url || '{}');
    
    // 新格式：已清洗
    if (Array.isArray(Object.values(playUrls)[0])) {
      playSources = Object.entries(playUrls).map(([name, episodes]) => ({
        name,
        episodes: episodes as any[],
      }));
    } 
    // 旧格式：兼容处理
    else {
      const { cleanPlayUrls } = await import('../services/data_cleaner');
      const cleaned = cleanPlayUrls(playUrls);
      playSources = Object.entries(cleaned).map(([name, episodes]) => ({
        name,
        episodes,
      }));
    }
  } catch (e) {}
  
  return c.json({
    code: 1,
    data: {
      ...video,
      play_sources: playSources,  // 新增字段
    },
  });
});
```

### 5.4 修改 APP 端

```dart
// app/lib/modules/detail/detail_controller.dart

void _parseAllSources(Map<String, dynamic> vod) {
  // 优先使用新格式 play_sources
  final playSources = vod['play_sources'] as List?;
  
  if (playSources != null && playSources.isNotEmpty) {
    // 新格式：直接使用
    this.playSources.value = playSources
        .map((s) => Map<String, dynamic>.from(s as Map))
        .toList();
    
    if (this.playSources.isNotEmpty) {
      currentSourceIndex.value = 0;
      _updateEpisodesFromSource(0);
    }
    return;
  }
  
  // 旧格式：兼容处理（保留现有逻辑）
  final vodPlayFrom = vod['vod_play_from'] as String? ?? '';
  final vodPlayUrl = vod['vod_play_url'] as String? ?? '';
  // ... 现有解析逻辑 ...
}
```

---

## 六、兼容性策略

### 6.1 数据库兼容

| 场景 | 处理方式 |
|------|----------|
| 新采集的数据 | 直接存储清洗后的格式 |
| 已有的旧数据 | API 层做兼容处理 |
| 数据迁移 | 可选：批量脚本清洗 |

### 6.2 API 兼容

```typescript
// 检测数据格式
const isNewFormat = Array.isArray(Object.values(playUrls)[0]);

if (isNewFormat) {
  // 新格式：直接使用
} else {
  // 旧格式：运行时清洗（兼容）
}
```

### 6.3 APP 兼容

```dart
// 优先使用新字段
if (vod['play_sources'] != null) {
  // 新格式
} else {
  // 旧格式（保留现有解析逻辑）
}
```

---

## 七、性能对比

### 7.1 CPU 消耗对比

| 场景 | 清洗前 | 清洗后 |
|------|--------|--------|
| 采集 1 个视频 | 5ms | 6ms (+1ms 清洗) |
| API 请求 1 次 | 3ms (解析) | 0ms (直接返回) |
| 1000 次 API 请求 | 3000ms | 0ms |

### 7.2 总结

- **采集时**：增加约 1ms/视频（可忽略）
- **API 时**：减少约 3ms/请求（显著）
- **总体**：大幅降低 CF CPU 消耗

---

## 八、实施计划

### 阶段一：核心清洗（P0）

1. 创建 `data_cleaner.ts` 服务
2. 修改 `collector_v2.ts` 的 `saveVideo()` 函数
3. 测试新采集的数据格式

### 阶段二：API 适配（P1）

1. 修改 `/api/vod/detail` 返回 `play_sources`
2. 修改 `url_validator.ts` 的 `extractFirstPlayUrl()` 支持新格式
3. 修改 `video_merger.ts` 的 `mergePlayUrls()` 支持新格式
4. 添加旧数据兼容逻辑
5. 测试 API 输出

### 阶段三：APP 适配（P1）

1. 修改 `detail_controller.dart` 优先使用新格式
2. 保留旧格式兼容
3. 测试播放功能

### 阶段四：数据迁移与脚本更新（P2，可选）

1. 修改 `merge_duplicates.ts` 支持新格式
2. 修改 `migrate_merge_videos.ts` 支持新格式
3. 编写批量清洗脚本
4. 迁移已有数据
5. 移除兼容代码

---

## 九、风险与回滚

### 9.1 风险点

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| HTTP 升级失败 | 部分资源站不支持 HTTPS | 保留原始 URL 作为备选 |
| 解析错误 | 特殊格式无法解析 | 添加异常处理，保留原始数据 |
| APP 兼容问题 | 旧版 APP 无法播放 | 保留 `vod_play_url` 字段 |

### 9.2 回滚方案

1. 数据库：`vod_play_url` 字段不变，可随时回滚
2. API：添加开关，可切换新旧格式
3. APP：保留旧解析逻辑，可随时启用

---

## 十、验收标准

- [ ] 新采集的视频 `vod_play_url` 是清洗后的 JSON 格式
- [ ] API `/api/vod/detail` 返回 `play_sources` 字段
- [ ] APP 能正常播放新格式数据
- [ ] APP 能兼容播放旧格式数据
- [ ] 换源功能正常工作
- [ ] 图片地址已升级为 HTTPS
