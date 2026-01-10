-- Migration 0018: Image Storage System
-- 图片云存储系统数据库表

-- ============================================
-- 图片存储配置表（多配置支持）
-- ============================================
CREATE TABLE IF NOT EXISTS image_storage_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 基础配置
    name TEXT NOT NULL,                        -- 配置名称
    provider TEXT NOT NULL DEFAULT 'r2',       -- 'r2', 'qiniu', 'aliyun', 'tencent'
    bucket TEXT NOT NULL,                      -- 存储桶名称
    region TEXT,                               -- 区域
    endpoint TEXT,                             -- 自定义端点
    access_key TEXT,                           -- Access Key
    secret_key TEXT,                           -- Secret Key (加密存储)
    custom_domain TEXT,                        -- 自定义域名 (CDN)
    path_prefix TEXT DEFAULT 'images',         -- 路径前缀
    
    -- 状态
    is_enabled BOOLEAN DEFAULT 0,              -- 是否启用
    is_default BOOLEAN DEFAULT 0,              -- 是否为默认配置
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- ============================================
-- 图片映射表
-- ============================================
CREATE TABLE IF NOT EXISTS image_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 原始信息
    original_url TEXT NOT NULL,                -- 原始URL
    original_hash TEXT NOT NULL,               -- URL的MD5哈希 (用于快速查找)
    
    -- 云存储信息
    storage_key TEXT,                          -- 云存储中的key/路径
    storage_url TEXT,                          -- 云存储完整URL (CDN URL)
    config_id INTEGER,                         -- 关联的存储配置ID
    
    -- 图片信息
    image_type TEXT DEFAULT 'cover',           -- 'cover', 'thumb', 'slide', 'actor'
    content_type TEXT,                         -- MIME类型
    original_size INTEGER,                     -- 原始大小 (bytes)
    stored_size INTEGER,                       -- 存储后大小 (bytes)
    width INTEGER,                             -- 宽度
    height INTEGER,                            -- 高度
    
    -- 状态
    status TEXT DEFAULT 'pending',             -- 'pending', 'uploading', 'success', 'failed'
    retry_count INTEGER DEFAULT 0,             -- 重试次数
    error_message TEXT,                        -- 错误信息
    
    -- 关联
    vod_id TEXT,                               -- 关联的视频ID
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    
    UNIQUE(original_hash),
    FOREIGN KEY (config_id) REFERENCES image_storage_config(id)
);

CREATE INDEX IF NOT EXISTS idx_image_mappings_hash ON image_mappings(original_hash);
CREATE INDEX IF NOT EXISTS idx_image_mappings_status ON image_mappings(status);
CREATE INDEX IF NOT EXISTS idx_image_mappings_vod ON image_mappings(vod_id);
CREATE INDEX IF NOT EXISTS idx_image_mappings_type ON image_mappings(image_type, status);
CREATE INDEX IF NOT EXISTS idx_image_mappings_config ON image_mappings(config_id);

-- ============================================
-- 同步任务队列表
-- ============================================
CREATE TABLE IF NOT EXISTS image_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    original_url TEXT NOT NULL,
    original_hash TEXT NOT NULL,
    image_type TEXT DEFAULT 'cover',
    vod_id TEXT,
    
    priority INTEGER DEFAULT 0,                -- 优先级 (越大越优先)
    status TEXT DEFAULT 'pending',             -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    processed_at INTEGER,
    
    UNIQUE(original_hash)
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON image_sync_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_hash ON image_sync_queue(original_hash);
