-- 模块使用统计表
CREATE TABLE IF NOT EXISTS module_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_id TEXT NOT NULL,
  module_id INTEGER,
  module_type TEXT NOT NULL,
  module_title TEXT,
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  date TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(tab_id, module_id, date)
);

CREATE INDEX IF NOT EXISTS idx_module_stats_tab ON module_stats(tab_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_module_stats_date ON module_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_module_stats_module ON module_stats(module_id, date DESC);

-- 模块点击明细表（可选，用于详细分析）
CREATE TABLE IF NOT EXISTS module_click_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_id TEXT NOT NULL,
  module_id INTEGER,
  module_type TEXT NOT NULL,
  item_id TEXT,
  user_id INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_click_log_date ON module_click_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_log_module ON module_click_log(module_id, created_at DESC);
