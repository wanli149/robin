-- 崩溃日志表
CREATE TABLE IF NOT EXISTS crash_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    error TEXT NOT NULL,
    stack_trace TEXT,
    context TEXT,
    device_info TEXT,                 -- JSON: platform, version, etc.
    app_version TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_crash_reports_time ON crash_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crash_reports_user ON crash_reports(user_id);
