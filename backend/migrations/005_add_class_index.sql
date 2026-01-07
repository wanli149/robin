-- Migration: Add index for video classification filtering
-- Date: 2024-12-09
-- Description: 为视频分类筛选功能添加索引，提升查询性能

-- 为 vod_tag 字段添加索引（用于分类筛选）
-- 注意：SQLite 的 LIKE 查询在有索引的情况下，如果是前缀匹配（如 'action%'）会使用索引
-- 但我们使用的是 '%action%' 模式，索引效果有限，但仍然有助于其他查询
CREATE INDEX IF NOT EXISTS idx_vod_tag ON vod_cache(vod_tag);

-- 为 shorts_cache 的 category 字段添加索引（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_shorts_category ON shorts_cache(category);

-- 组合索引：type_id + vod_tag（优化分类筛选查询）
-- 这个索引可以加速 "WHERE type_id = ? AND vod_tag LIKE ?" 查询
CREATE INDEX IF NOT EXISTS idx_vod_type_tag ON vod_cache(type_id, vod_tag);

-- 组合索引：type_id + vod_area + vod_year（优化多条件筛选）
CREATE INDEX IF NOT EXISTS idx_vod_filters ON vod_cache(type_id, vod_area, vod_year);
