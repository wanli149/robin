-- Migration: Add source_type field to video_sources
-- 添加资源站类型字段，用于区分苹果CMS资源站和TVBox接口

-- 1. 添加 source_type 字段
ALTER TABLE video_sources ADD COLUMN source_type TEXT DEFAULT 'cms';

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_sources_type ON video_sources(source_type, is_active);

-- 3. 更新现有数据（默认都是CMS类型）
UPDATE video_sources SET source_type = 'cms' WHERE source_type IS NULL;

-- 字段说明：
-- source_type 可选值：
-- - 'cms': 苹果CMS资源站（用于采集）
-- - 'tvbox': TVBox接口（用于采集）
