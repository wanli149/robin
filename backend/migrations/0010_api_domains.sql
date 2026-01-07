-- API 域名配置表
CREATE TABLE IF NOT EXISTS api_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,          -- 域名（如 https://api1.example.com）
  name TEXT,                             -- 备注名称
  priority INTEGER DEFAULT 100,          -- 优先级（越大越优先）
  is_active INTEGER DEFAULT 1,           -- 是否启用
  is_primary INTEGER DEFAULT 0,          -- 是否为主域名
  health_status TEXT DEFAULT 'unknown',  -- 健康状态：healthy, unhealthy, unknown
  last_check_at TEXT,                    -- 上次检测时间
  response_time INTEGER,                 -- 响应时间（毫秒）
  fail_count INTEGER DEFAULT 0,          -- 连续失败次数
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_api_domains_active ON api_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_api_domains_priority ON api_domains(priority DESC);
