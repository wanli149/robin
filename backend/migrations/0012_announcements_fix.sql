-- 修复公告表，添加缺失的列

-- 添加 priority 列
ALTER TABLE announcements ADD COLUMN priority INTEGER DEFAULT 0;

-- 添加 click_count 列
ALTER TABLE announcements ADD COLUMN click_count INTEGER DEFAULT 0;

-- 添加 action_text 列
ALTER TABLE announcements ADD COLUMN action_text TEXT;

-- 添加 image_url 列
ALTER TABLE announcements ADD COLUMN image_url TEXT;

-- 添加 show_once 列
ALTER TABLE announcements ADD COLUMN show_once INTEGER DEFAULT 0;

-- 添加 force_show 列
ALTER TABLE announcements ADD COLUMN force_show INTEGER DEFAULT 0;

-- 添加 target_version 列
ALTER TABLE announcements ADD COLUMN target_version TEXT;

-- 添加 target_platform 列
ALTER TABLE announcements ADD COLUMN target_platform TEXT DEFAULT 'all';

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);

-- 创建用户已读公告记录表（如果不存在）
CREATE TABLE IF NOT EXISTS announcement_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  read_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(announcement_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_device ON announcement_reads(device_id);
