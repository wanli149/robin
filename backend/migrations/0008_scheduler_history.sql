-- 定时任务执行历史表
CREATE TABLE IF NOT EXISTS scheduler_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',  -- success, failed
  message TEXT,
  duration INTEGER,  -- 执行时长（毫秒）
  executed_at TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_scheduler_history_task_id ON scheduler_history(task_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_history_executed_at ON scheduler_history(executed_at);
