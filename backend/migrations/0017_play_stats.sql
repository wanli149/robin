-- 播放统计表
-- 记录视频播放行为，用于统计观看次数

CREATE TABLE IF NOT EXISTS play_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vod_id TEXT NOT NULL,                    -- 视频ID
  vod_type TEXT NOT NULL,                  -- 视频类型 (movie, tv, shorts)
  episode_index INTEGER,                   -- 集数（剧集类型时使用）
  event_type TEXT NOT NULL,                -- 事件类型 (play_start, valid_play, play_complete)
  played_seconds INTEGER DEFAULT 0,        -- 已播放秒数
  total_seconds INTEGER DEFAULT 0,         -- 总时长秒数
  date TEXT NOT NULL,                      -- 日期 (YYYY-MM-DD)
  created_at INTEGER NOT NULL              -- 创建时间戳
);

-- 索引：按视频ID和日期查询
CREATE INDEX IF NOT EXISTS idx_play_stats_vod_date ON play_stats(vod_id, date);

-- 索引：按日期查询（用于清理旧数据）
CREATE INDEX IF NOT EXISTS idx_play_stats_date ON play_stats(date);

-- 索引：按事件类型查询
CREATE INDEX IF NOT EXISTS idx_play_stats_event_type ON play_stats(event_type, date);

-- 为 shorts_series 表添加 vod_hits 字段（如果不存在）
-- 注意：SQLite 不支持 IF NOT EXISTS 添加列，需要先检查
-- 这里使用 try-catch 方式，如果列已存在会报错但不影响
ALTER TABLE shorts_series ADD COLUMN vod_hits INTEGER DEFAULT 0;
