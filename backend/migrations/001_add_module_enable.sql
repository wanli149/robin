-- Migration: Add is_enabled field to page_modules table
-- Date: 2024-12-08
-- Description: 添加模块开关字段，用于快速启用/禁用模块

-- 添加 is_enabled 字段（默认启用）
ALTER TABLE page_modules ADD COLUMN is_enabled BOOLEAN DEFAULT 1;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_modules_enabled ON page_modules(tab_id, is_enabled, sort_order);

-- 更新说明
-- 使用方法：
-- 1. 禁用某个模块：UPDATE page_modules SET is_enabled = 0 WHERE id = ?
-- 2. 启用某个模块：UPDATE page_modules SET is_enabled = 1 WHERE id = ?
-- 3. 查询启用的模块：SELECT * FROM page_modules WHERE is_enabled = 1
