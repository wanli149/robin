-- ============================================
-- 采集引擎 V2.0 数据库扩展
-- ============================================

-- 采集任务表 V2（增强版）
CREATE TABLE IF NOT EXISTS collect_tasks_v2 (
    id TEXT PRIMARY KEY,                    -- UUID
    task_type TEXT NOT NULL,                -- 'full', 'incremental', 'category', 'source', 'shorts'
    status TEXT DEFAULT 'pending',          -- 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
    priority INTEGER DEFAULT 5,             -- 1-10，数字越大优先级越高
    
    -- 任务配置 (JSON)
    config TEXT,                            -- {"sourceIds": [1,2], "categoryIds": [1], "pageStart": 1, "pageEnd": -1, "maxVideos": 1000}
    
    -- 进度信息
    current_source TEXT,                    -- 当前正在采集的资源站名称
    current_source_id INTEGER,              -- 当前资源站ID
    current_page INTEGER DEFAULT 0,         -- 当前页码
    total_pages INTEGER DEFAULT 0,          -- 总页数
    processed_count INTEGER DEFAULT 0,      -- 已处理视频数
    new_count INTEGER DEFAULT 0,            -- 新增视频数
    update_count INTEGER DEFAULT 0,         -- 更新视频数
    skip_count INTEGER DEFAULT 0,           -- 跳过视频数（重复）
    error_count INTEGER DEFAULT 0,          -- 错误数
    
    -- 断点续传
    checkpoint TEXT,                        -- JSON: {"sourceIndex": 0, "page": 5, "lastVodId": "xxx"}
    
    -- 时间信息
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    started_at INTEGER,
    paused_at INTEGER,
    completed_at INTEGER,
    
    -- 错误信息
    last_error TEXT,
    error_details TEXT                      -- JSON: 详细错误堆栈
);

CREATE INDEX IF NOT EXISTS idx_tasks_v2_status ON collect_tasks_v2(status, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_v2_type ON collect_tasks_v2(task_type, status);
CREATE INDEX IF NOT EXISTS idx_tasks_v2_created ON collect_tasks_v2(created_at DESC);

-- 采集日志表（详细记录每个操作）
CREATE TABLE IF NOT EXISTS collect_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,                  -- 关联任务ID
    level TEXT DEFAULT 'info',              -- 'debug', 'info', 'warn', 'error'
    source_name TEXT,                       -- 资源站名称
    action TEXT,                            -- 'fetch_page', 'save_video', 'skip_duplicate', 'error'
    message TEXT,                           -- 日志消息
    details TEXT,                           -- JSON: 详细信息
    vod_id TEXT,                            -- 相关视频ID
    vod_name TEXT,                          -- 相关视频名称
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_task ON collect_logs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON collect_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action ON collect_logs(action, created_at DESC);

-- 资源站健康状态表
CREATE TABLE IF NOT EXISTS source_health (
    source_id INTEGER PRIMARY KEY,          -- 关联 video_sources.id
    source_name TEXT,                       -- 资源站名称（冗余，方便查询）
    last_check_at INTEGER,                  -- 上次检测时间
    status TEXT DEFAULT 'unknown',          -- 'healthy', 'slow', 'error', 'timeout', 'unknown'
    response_time INTEGER,                  -- 响应时间（毫秒）
    avg_response_time INTEGER,              -- 平均响应时间
    success_rate REAL DEFAULT 100,          -- 成功率百分比
    total_checks INTEGER DEFAULT 0,         -- 总检测次数
    success_checks INTEGER DEFAULT 0,       -- 成功次数
    last_error TEXT,                        -- 最后一次错误信息
    last_error_at INTEGER,                  -- 最后错误时间
    consecutive_failures INTEGER DEFAULT 0, -- 连续失败次数
    video_count INTEGER DEFAULT 0,          -- 最后检测返回的视频数
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_health_status ON source_health(status);

-- 采集统计表（按天/资源站/分类汇总）
CREATE TABLE IF NOT EXISTS collect_stats_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                     -- YYYY-MM-DD
    source_id INTEGER,                      -- 资源站ID（NULL表示汇总）
    source_name TEXT,                       -- 资源站名称
    category_id INTEGER,                    -- 分类ID（NULL表示汇总）
    category_name TEXT,                     -- 分类名称
    
    -- 统计数据
    task_count INTEGER DEFAULT 0,           -- 任务数
    new_count INTEGER DEFAULT 0,            -- 新增数
    update_count INTEGER DEFAULT 0,         -- 更新数
    error_count INTEGER DEFAULT 0,          -- 错误数
    total_duration INTEGER DEFAULT 0,       -- 总耗时（秒）
    avg_duration INTEGER DEFAULT 0,         -- 平均耗时
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(date, source_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_stats_daily_date ON collect_stats_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_stats_daily_source ON collect_stats_daily(source_id, date DESC);

-- 分类配置表（标准分类定义）
CREATE TABLE IF NOT EXISTS video_categories (
    id INTEGER PRIMARY KEY,                 -- 标准分类ID: 1=电影, 2=电视剧, 3=综艺, 4=动漫, 5=短剧
    name TEXT NOT NULL,                     -- 分类名称
    name_en TEXT,                           -- 英文名
    icon TEXT,                              -- 图标
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    collect_enabled BOOLEAN DEFAULT 1,      -- 是否启用采集
    collect_priority INTEGER DEFAULT 5,     -- 采集优先级
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 插入默认分类
INSERT OR IGNORE INTO video_categories (id, name, name_en, sort_order, is_active) VALUES
(1, '电影', 'movie', 1, 1),
(2, '电视剧', 'series', 2, 1),
(3, '综艺', 'variety', 3, 1),
(4, '动漫', 'anime', 4, 1),
(5, '短剧', 'shorts', 5, 1);

-- 为 vod_cache 添加 quality_score 字段（如果不存在）
-- 注意：SQLite 不支持 IF NOT EXISTS 添加列，需要在代码中处理

-- 为 video_sources 添加健康检测相关字段的视图
CREATE VIEW IF NOT EXISTS v_sources_with_health AS
SELECT 
    s.id,
    s.name,
    s.api_url,
    s.weight,
    s.is_active,
    s.sort_order,
    s.created_at,
    h.status as health_status,
    h.response_time,
    h.avg_response_time,
    h.success_rate,
    h.last_check_at,
    h.last_error,
    h.consecutive_failures,
    h.video_count
FROM video_sources s
LEFT JOIN source_health h ON s.id = h.source_id;
