-- Migration 006: Storage Configuration System
-- 存储配置系统 - 支持外部数据库同步播放进度

-- ============================================
-- 存储配置表
-- ============================================

-- 外部存储配置
CREATE TABLE IF NOT EXISTS storage_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_type TEXT NOT NULL,           -- 'local', 'supabase', 'firebase', 'custom'
    connection_url TEXT,                  -- 数据库连接URL
    api_key TEXT,                         -- API密钥（加密存储）
    is_enabled BOOLEAN DEFAULT 0,         -- 是否启用
    sync_strategy TEXT DEFAULT 'local_only', -- 'local_only', 'local_cloud', 'cloud_only'
    sync_interval INTEGER DEFAULT 30,     -- 同步间隔（秒）
    last_sync_at INTEGER,                 -- 上次同步时间
    last_sync_status TEXT,                -- 'success', 'failed'
    last_sync_error TEXT,                 -- 错误信息
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 用户播放进度表（云端同步用）
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                -- 用户ID或设备ID
    content_type TEXT NOT NULL,           -- 'tv', 'movie', 'shorts'
    content_id TEXT NOT NULL,             -- 视频ID
    episode_index INTEGER DEFAULT 1,      -- 集数
    position_seconds INTEGER DEFAULT 0,   -- 播放位置（秒）
    duration_seconds INTEGER DEFAULT 0,   -- 总时长（秒）
    progress_percent REAL DEFAULT 0,      -- 进度百分比
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    synced_at INTEGER,                    -- 同步到云端的时间
    UNIQUE(user_id, content_type, content_id, episode_index)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_content ON user_progress(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_progress_sync ON user_progress(synced_at);

-- 同步日志表
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,              -- 'upload', 'download', 'full'
    records_count INTEGER DEFAULT 0,      -- 同步记录数
    status TEXT NOT NULL,                 -- 'success', 'failed', 'partial'
    error_message TEXT,
    duration_ms INTEGER,                  -- 耗时（毫秒）
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(created_at DESC);

-- 插入默认存储配置
INSERT OR IGNORE INTO storage_config (id, storage_type, sync_strategy, is_enabled) 
VALUES (1, 'local', 'local_only', 0);
