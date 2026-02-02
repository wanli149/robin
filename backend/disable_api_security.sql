-- 禁用 API 安全验证（开发环境）
-- 这将允许客户端在不提供签名的情况下访问 API

INSERT OR REPLACE INTO system_config (key, value, description, updated_at)
VALUES (
  'api_security_config',
  '{"enabled":false,"secretKey":"robin-video-api-secret-2024","timestampTolerance":300,"nonceTtl":600,"allowedPackages":["com.fetch.video"],"protectedPaths":["/api/vod","/api/search","/api/shorts","/api/user","/home_layout","/home_tabs","/api/ads"],"whitelistPaths":["/api/version","/api/config","/api/domains","/api/announcement","/api/ads/splash","/admin/","/auth/","/api.php/"]}',
  'API安全配置（已禁用，用于开发测试）',
  datetime('now')
);
