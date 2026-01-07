-- Migration: Add quality_score field to vod_cache
-- 添加数据质量评分字段，用于智能选择最优数据

-- 1. 添加 quality_score 字段
ALTER TABLE vod_cache ADD COLUMN quality_score INTEGER DEFAULT 0;

-- 2. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_vod_quality ON vod_cache(quality_score DESC);

-- 3. 更新现有数据的质量评分
UPDATE vod_cache SET quality_score = (
    CASE WHEN vod_pic IS NOT NULL AND length(vod_pic) > 10 THEN 20 ELSE 0 END +
    CASE WHEN vod_actor IS NOT NULL AND length(vod_actor) > 0 THEN 15 ELSE 0 END +
    CASE WHEN vod_director IS NOT NULL AND length(vod_director) > 0 THEN 10 ELSE 0 END +
    CASE WHEN vod_content IS NOT NULL AND length(vod_content) > 20 THEN 25 ELSE 0 END +
    CASE WHEN vod_play_url IS NOT NULL AND length(vod_play_url) > 10 THEN 30 ELSE 0 END +
    CASE WHEN length(vod_content) > 100 THEN MIN(10, length(vod_content) / 50) ELSE 0 END
) WHERE quality_score = 0;

-- 4. 添加注释说明
-- quality_score 评分规则：
-- - 有封面：20分
-- - 有演员：15分
-- - 有导演：10分
-- - 有简介：25分
-- - 有播放地址：30分
-- - 简介长度加分：最多10分
-- 总分：0-110分
