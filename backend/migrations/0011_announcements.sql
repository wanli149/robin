-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info',           -- info, warning, update, urgent
  action_type TEXT DEFAULT 'none',    -- none, url, update, close
  action_url TEXT,
  action_text TEXT,                   -- 按钮文字
  image_url TEXT,                     -- 公告图片
  priority INTEGER DEFAULT 0,         -- 优先级，越大越优先
  is_active INTEGER DEFAULT 1,
  show_once INTEGER DEFAULT 0,        -- 每个用户只显示一次
  force_show INTEGER DEFAULT 0,       -- 强制显示（不可关闭）
  target_version TEXT,                -- 目标版本（如 <2.0.0）
  target_platform TEXT,               -- 目标平台（android/ios/all）
  start_time INTEGER,                 -- 开始时间（时间戳）
  end_time INTEGER,                   -- 结束时间（时间戳）
  view_count INTEGER DEFAULT 0,       -- 查看次数
  click_count INTEGER DEFAULT 0,      -- 点击次数
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);

-- 用户已读公告记录（用于 show_once 功能）
CREATE TABLE IF NOT EXISTS announcement_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  read_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(announcement_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_device ON announcement_reads(device_id);
