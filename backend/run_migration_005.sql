-- 执行此文件来应用分类索引优化
-- 使用方法：
-- wrangler d1 execute robin-video-db --file=./run_migration_005.sql --local
-- 或
-- wrangler d1 execute robin-video-db --file=./run_migration_005.sql --remote

-- 为 vod_tag 字段添加索引
CREATE INDEX IF NOT EXISTS idx_vod_tag ON vod_cache(vod_tag);

-- 组合索引：type_id + vod_tag
CREATE INDEX IF NOT EXISTS idx_vod_type_tag ON vod_cache(type_id, vod_tag);

-- 组合索引：type_id + vod_area + vod_year
CREATE INDEX IF NOT EXISTS idx_vod_filters ON vod_cache(type_id, vod_area, vod_year);

-- 验证索引创建成功
SELECT name, sql FROM sqlite_master 
WHERE type = 'index' 
AND tbl_name = 'vod_cache'
AND name LIKE 'idx_vod%'
ORDER BY name;
