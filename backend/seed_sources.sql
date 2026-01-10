-- 初始化真实资源站数据
-- 这些是常见的CMS资源站API（请根据实际情况调整）

-- 清空现有数据（可选）
-- DELETE FROM video_sources;

-- 插入主资源站（is_welfare=0 表示普通资源站）
INSERT OR IGNORE INTO video_sources (name, api_url, weight, is_active, sort_order, is_welfare) VALUES
('非凡资源', 'https://cj.ffzyapi.com/api.php/provide/vod', 100, 1, 1, 0),
('光速资源', 'https://api.guangsuapi.com/api.php/provide/vod', 90, 1, 2, 0),
('红牛资源', 'https://www.hongniuzy.com/api.php/provide/vod', 80, 1, 3, 0),
('量子资源', 'https://cj.lziapi.com/api.php/provide/vod', 70, 1, 4, 0),
('新浪资源', 'https://api.xinlangapi.com/xinlangapi.php/provide/vod', 60, 1, 5, 0);

-- 福利资源站示例（is_welfare=1 表示福利资源站，需要特殊权限访问）
-- INSERT OR IGNORE INTO video_sources (name, api_url, weight, is_active, sort_order, is_welfare) VALUES
-- ('乐播资源', 'https://lbapi9.com/api.php/provide/vod', 100, 1, 10, 1);

-- 注意：
-- 1. 这些资源站可能需要授权或有访问限制
-- 2. 建议先测试每个资源站是否可用
-- 3. 可以通过管理后台随时添加/修改/删除资源站
-- 4. 权重越高，优先级越高（聚合时优先请求）
-- 5. is_welfare=1 的资源站为福利资源站，需要启用福利功能才能访问
