-- 扩展短剧表，添加年份、地区、演员等字段
-- Migration: 002_extend_shorts.sql

-- 添加新字段到 shorts_cache 表
ALTER TABLE shorts_cache ADD COLUMN vod_year TEXT;
ALTER TABLE shorts_cache ADD COLUMN vod_area TEXT;
ALTER TABLE shorts_cache ADD COLUMN vod_actor TEXT;
ALTER TABLE shorts_cache ADD COLUMN vod_director TEXT;
ALTER TABLE shorts_cache ADD COLUMN vod_score REAL DEFAULT 0;
ALTER TABLE shorts_cache ADD COLUMN vod_remarks TEXT;
ALTER TABLE shorts_cache ADD COLUMN vod_hits INTEGER DEFAULT 0;
ALTER TABLE shorts_cache ADD COLUMN vod_content TEXT;
ALTER TABLE shorts_cache ADD COLUMN vod_tag TEXT;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_shorts_year ON shorts_cache(vod_year);
CREATE INDEX IF NOT EXISTS idx_shorts_area ON shorts_cache(vod_area);
