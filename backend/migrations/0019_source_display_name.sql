-- Migration 0019: Add display_name to video_sources
-- 资源站显示别名功能

-- 添加 display_name 字段
ALTER TABLE video_sources ADD COLUMN display_name TEXT;

-- display_name 为空时使用 name 作为显示名称
