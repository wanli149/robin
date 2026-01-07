-- 拆分短剧集数存储
-- Migration: 003_split_shorts_episodes.sql
-- 将多集短剧拆分成独立记录，便于随机推荐

-- 添加新字段到 shorts_cache 表
ALTER TABLE shorts_cache ADD COLUMN series_id TEXT;      -- 系列ID（原vod_id）
ALTER TABLE shorts_cache ADD COLUMN episode_index INTEGER; -- 集数索引
ALTER TABLE shorts_cache ADD COLUMN episode_name TEXT;    -- 集名（第1集）
ALTER TABLE shorts_cache ADD COLUMN total_episodes INTEGER; -- 总集数

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_shorts_series ON shorts_cache(series_id);
CREATE INDEX IF NOT EXISTS idx_shorts_episode ON shorts_cache(series_id, episode_index);
