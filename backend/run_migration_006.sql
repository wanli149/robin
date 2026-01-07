-- Migration 006: Storage Configuration System
-- 运行此文件以添加存储配置相关表
-- 执行命令: wrangler d1 execute robin-db --local --file=./run_migration_006.sql

-- 外部存储配置
CREATE TABLE IF NOT EXISTS storage_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_type TEXT NOT NULL DEFAULT 'local',
    connection_url TEXT,
    api_key TEXT,
    is_enabled BOOLEAN DEFAULT 0,
    sync_strategy TEXT DEFAULT 'local_only',
    sync_interval INTEGER DEFAULT 30,
    last_sync_at INTEGER,
    last_sync_status TEXT,
    last_sync_error TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 用户播放进度表
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    episode_index INTEGER DEFAULT 1,
    position_seconds INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    progress_percent REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    synced_at INTEGER,
    UNIQUE(user_id, content_type, content_id, episode_index)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_content ON user_progress(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_progress_sync ON user_progress(synced_at);

-- 同步日志表
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,
    records_count INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(created_at DESC);

-- 插入默认存储配置
INSERT OR IGNORE INTO storage_config (id, storage_type, sync_strategy, is_enabled) 
VALUES (1, 'local', 'local_only', 0);

-- 完成
SELECT 'Migration 006 completed successfully!' as message;
