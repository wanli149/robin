-- 定时任务配置表（支持自定义任务和修改内置任务的 Cron）
CREATE TABLE IF NOT EXISTS scheduler_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cron TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  enabled INTEGER DEFAULT 1,
  is_builtin INTEGER DEFAULT 0,  -- 是否为内置任务
  task_type TEXT,  -- 任务类型：collect_incremental, collect_full, warmup, validate, cleanup, custom
  task_params TEXT,  -- JSON 格式的任务参数
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_scheduler_tasks_enabled ON scheduler_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduler_tasks_category ON scheduler_tasks(category);
