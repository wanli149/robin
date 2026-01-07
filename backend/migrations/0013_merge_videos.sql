-- 视频合并迁移脚本
-- 将多源视频合并为单条记录

-- 1. 创建新的vod_cache表（带自增ID）
CREATE TABLE IF NOT EXISTS vod_cache_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vod_name TEXT NOT NULL,
    vod_pic TEXT,
    vod_pic_thumb TEXT,
    vod_pic_slide TEXT,
    vod_remarks TEXT,
    vod_year TEXT,
    vod_area TEXT,
    vod_lang TEXT,
    vod_actor TEXT,
    vod_director TEXT,
    vod_writer TEXT,
    vod_content TEXT,
    vod_play_url TEXT,                -- JSON格式：{"资源站-线路": "播放地址"}
    
    -- 评分系统
    vod_score REAL DEFAULT 0,
    vod_score_num INTEGER DEFAULT 0,
    vod_douban_score REAL DEFAULT 0,
    vod_tmdb_score REAL DEFAULT 0,
    vod_score_source TEXT,
    
    -- 统计数据
    vod_hits INTEGER DEFAULT 0,
    vod_hits_day INTEGER DEFAULT 0,
    vod_hits_week INTEGER DEFAULT 0,
    vod_hits_month INTEGER DEFAULT 0,
    
    -- 扩展字段
    vod_tag TEXT,
    vod_duration TEXT,
    vod_total INTEGER DEFAULT 0,
    vod_serial TEXT,
    vod_sub TEXT,
    
    type_id INTEGER,
    type_name TEXT,
    source_names TEXT,                -- 所有来源资源站（逗号分隔）
    source_priority INTEGER DEFAULT 50,
    is_valid BOOLEAN DEFAULT 1,
    last_check INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    
    -- 唯一约束：同一视频名称+年份只能有一条记录
    UNIQUE(vod_name, vod_year)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_vod_new_type ON vod_cache_new(type_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_new_area ON vod_cache_new(vod_area, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_new_year ON vod_cache_new(vod_year, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_new_score ON vod_cache_new(vod_score DESC);
CREATE INDEX IF NOT EXISTS idx_vod_new_name ON vod_cache_new(vod_name);

-- 3. 迁移数据（合并重复视频）
-- 注意：这个脚本需要手动执行，因为涉及复杂的数据合并逻辑
-- 建议使用后端脚本来处理数据迁移

-- 4. 重命名表（迁移完成后执行）
-- DROP TABLE vod_cache;
-- ALTER TABLE vod_cache_new RENAME TO vod_cache;
