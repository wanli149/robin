# 数据清洗实施任务清单

## 任务概览

| 阶段 | 任务数 | 预计时间 |
|------|--------|----------|
| 阶段一：核心清洗 | 3 | 30 分钟 |
| 阶段二：API 适配 | 8 | 40 分钟 |
| 阶段三：APP 适配 | 3 | 25 分钟 |
| 阶段四：数据迁移 | 4 | 可选 |

---

## 阶段一：核心清洗（后端）

### Task 1.1: 创建数据清洗服务

**文件**: `backend/src/services/data_cleaner.ts`

**内容**:
- `cleanPlayUrls()` - 清洗播放地址
- `parseEpisodes()` - 解析选集字符串
- `upgradeToHttps()` - HTTP 升级
- `cleanImageUrl()` - 清洗图片地址

**状态**: [x] ✅ 已完成

---

### Task 1.2: 修改采集器 saveVideo 函数

**文件**: `backend/src/services/collector_v2.ts`

**修改点**:
1. 导入 `data_cleaner` 模块
2. 在 `saveVideo()` 中调用 `cleanPlayUrls()`
3. 在 `saveVideo()` 中调用 `cleanImageUrl()`
4. 存储清洗后的数据

**关键代码位置**:
- 第 480-550 行：`saveVideo()` 函数
- 第 720-740 行：`parsePlayUrls()` 函数

**状态**: [x] ✅ 已完成

---

### Task 1.3: 测试新采集数据

**验证项**:
- [x] 新采集的视频 `vod_play_url` 是 JSON 数组格式
- [x] 每个播放源的 episodes 是数组
- [x] URL 已升级为 HTTPS
- [x] 图片地址已升级为 HTTPS

**状态**: [x] ✅ 已完成（2024-12-17 验证通过）

---

## 阶段二：API 适配（后端）

### Task 2.1: 修改视频详情 API

**文件**: `backend/src/routes/vod.ts`

**修改点**:
1. 在 `/api/vod/detail` 接口中解析 `vod_play_url`
2. 添加 `play_sources` 字段到返回数据
3. 添加新旧格式兼容逻辑

**关键代码位置**:
- 第 75-180 行：`/api/vod/detail` 路由

**返回格式**:
```json
{
  "code": 1,
  "data": {
    "vod_id": "...",
    "vod_name": "...",
    "vod_play_url": "...",  // 保留原字段（兼容）
    "play_sources": [       // 新增字段
      {
        "name": "质子资源",
        "episodes": [
          { "name": "第1集", "url": "https://..." }
        ]
      }
    ]
  }
}
```

**状态**: [x] ✅ 已完成

---

### Task 2.2: 修改 URL 验证器

**文件**: `backend/src/services/url_validator.ts`

**修改点**:
1. 修改 `extractFirstPlayUrl()` 函数支持新格式
2. 新格式：直接从数组中取第一个 URL
3. 旧格式：保留现有解析逻辑（兼容）

**当前代码**:
```typescript
function extractFirstPlayUrl(playUrlStr: string): string | null {
  // 格式：第1集$url1#第2集$url2
  const parts = playUrlStr.split('#');
  const [, url] = parts[0].split('$');
  return url?.trim() || null;
}
```

**修改后**:
```typescript
function extractFirstPlayUrl(playUrlStr: string): string | null {
  try {
    const parsed = JSON.parse(playUrlStr);
    // 新格式：{ "资源站": [{ name, url }] }
    const firstSource = Object.values(parsed)[0];
    if (Array.isArray(firstSource) && firstSource[0]?.url) {
      return firstSource[0].url;
    }
    // 旧格式：{ "资源站": "第1集$url#第2集$url" }
    if (typeof firstSource === 'string') {
      const parts = firstSource.split('#');
      const [, url] = parts[0].split('$');
      return url?.trim() || null;
    }
  } catch (e) {}
  return null;
}
```

**状态**: [x] ✅ 已完成

---

### Task 2.3: 修改视频合并器

**文件**: `backend/src/services/video_merger.ts`

**修改点**:
1. 修改 `mergePlayUrls()` 函数支持新格式
2. 合并时保持数组格式
3. 兼容旧格式数据

**状态**: [x] ✅ 已完成

---

### Task 2.4: 修改短剧 API

**文件**: `backend/src/routes/shorts.ts`

**修改点**:
1. 修改 `parseEpisodes()` 函数支持新格式
2. 新格式：直接使用数组
3. 旧格式：保留现有解析逻辑

**状态**: [x] ✅ 已完成

---

### Task 2.5: 修改 CMS 兼容 API

**文件**: `backend/src/routes/cms.ts`

**修改点**:
1. 修改 `convertToCMSFormat()` 函数支持新格式
2. 新格式：将数组转换回 CMS 字符串格式
3. 旧格式：保留现有逻辑

**状态**: [x] ✅ 已完成

---

### Task 2.6: 修改管理后台 API

**文件**: `backend/src/routes/admin.ts`

**修改点**:
1. 修改视频编辑相关逻辑支持新格式
2. 修改视频修复逻辑支持新格式
3. 修改短剧预览选集逻辑支持新格式

**状态**: [ ] 跳过（admin.ts 中的相关逻辑已在 admin/videos.ts 中处理）

---

### Task 2.7: 修改管理后台视频 API

**文件**: `backend/src/routes/admin/videos.ts`

**修改点**:
1. 修改播放源解析逻辑支持新格式
2. 兼容旧格式数据

**状态**: [x] ✅ 已完成

---

### Task 2.8: 测试 API 输出

**验证项**:
- [x] 新数据返回 `play_sources` 字段
- [x] 旧数据也能返回 `play_sources`（兼容处理）
- [x] `vod_play_url` 字段仍然存在（向后兼容）
- [x] URL 验证器能正确提取新格式的 URL

**状态**: [x] ✅ 已完成（2024-12-17 验证通过）

---

## 阶段三：APP 适配

### Task 3.1: 修改视频详情控制器

**文件**: `app/lib/modules/detail/detail_controller.dart`

**修改点**:
1. 修改 `_parseAllSources()` 方法
2. 优先使用 `play_sources` 字段
3. 保留旧格式解析逻辑作为兜底

**关键代码位置**:
- 第 90-150 行：`_parseAllSources()` 方法

**新逻辑**:
```dart
void _parseAllSources(Map<String, dynamic> vod) {
  // 1. 优先使用新格式
  final playSources = vod['play_sources'] as List?;
  if (playSources != null && playSources.isNotEmpty) {
    this.playSources.value = playSources
        .map((s) => Map<String, dynamic>.from(s as Map))
        .toList();
    // ... 设置默认播放源 ...
    return;
  }
  
  // 2. 兜底：使用旧格式
  // ... 保留现有解析逻辑 ...
}
```

**状态**: [x] ✅ 已完成

---

### Task 3.2: 修改全局播放器管理器

**文件**: `app/lib/core/player/global_player_manager.dart`

**修改点**:
1. 修改 `_parsePlayUrlFromCMS()` 方法支持新格式
2. 优先使用 `play_sources` 字段
3. 保留旧格式解析逻辑作为兜底

**状态**: [x] ✅ 已完成

---

### Task 3.3: 测试 APP 播放功能

**验证项**:
- [ ] 新格式数据能正常播放
- [ ] 旧格式数据能正常播放（兼容）
- [ ] 换源功能正常
- [ ] 选集切换正常
- [ ] 继续播放功能正常

**状态**: [ ] 待测试

---

## 阶段四：数据迁移与脚本更新（可选）

### Task 4.1: 修改去重脚本

**文件**: `backend/src/scripts/merge_duplicates.ts`

**修改点**:
1. 修改 `mergeGroup()` 函数中的播放地址合并逻辑
2. 支持新格式数组的合并
3. 兼容旧格式字符串

**状态**: [ ] 可选

---

### Task 4.2: 修改迁移脚本

**文件**: `backend/src/scripts/migrate_merge_videos.ts`

**修改点**:
1. 修改播放地址合并逻辑支持新格式
2. 迁移时自动清洗旧格式数据

**状态**: [ ] 可选

---

### Task 4.3: 编写批量清洗脚本

**文件**: `backend/src/scripts/clean_play_urls.ts`

**功能**:
- 遍历所有 `vod_cache` 记录
- 检测旧格式数据
- 清洗并更新

**状态**: [ ] 可选

---

### Task 4.4: 执行数据迁移

**步骤**:
1. 备份数据库
2. 运行清洗脚本
3. 验证数据完整性
4. 移除兼容代码（可选）

**状态**: [ ] 可选

---

## 文件修改汇总

| 文件 | 操作 | 优先级 |
|------|------|--------|
| `backend/src/services/data_cleaner.ts` | 新建 | P0 |
| `backend/src/services/collector_v2.ts` | 修改 | P0 |
| `backend/src/routes/vod.ts` | 修改 | P1 |
| `backend/src/services/url_validator.ts` | 修改 | P1 |
| `backend/src/services/video_merger.ts` | 修改 | P1 |
| `backend/src/routes/shorts.ts` | 修改 | P1 |
| `backend/src/routes/cms.ts` | 修改 | P1 |
| `backend/src/routes/admin.ts` | 修改 | P1 |
| `backend/src/routes/admin/videos.ts` | 修改 | P1 |
| `app/lib/modules/detail/detail_controller.dart` | 修改 | P1 |
| `app/lib/core/player/global_player_manager.dart` | 修改 | P1 |
| `backend/src/scripts/merge_duplicates.ts` | 修改 | P2 |
| `backend/src/scripts/migrate_merge_videos.ts` | 修改 | P2 |
| `backend/src/scripts/clean_play_urls.ts` | 新建 | P2 |

---

## 回滚检查点

每个阶段完成后，确认以下内容：

### 阶段一完成后
- [x] 旧数据仍可正常读取（兼容处理）
- [x] 新采集的数据格式正确

### 阶段二完成后
- [x] API 返回新旧格式都正常
- [x] 不影响现有 APP 功能

### 阶段三完成后
- [ ] APP 能播放新旧格式数据（待 APP 测试）
- [ ] 所有播放功能正常（待 APP 测试）
