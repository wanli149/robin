-- 修复布局配置
-- 1. 更新轮播图配置（移除年份限制）
UPDATE page_modules 
SET api_params = '{"t": 1, "sort": "time", "limit": 10}'
WHERE tab_id = 'featured' AND module_type = 'carousel';

-- 2. 更新金刚区配置（添加默认图标）
UPDATE page_modules 
SET api_params = '{
  "items": [
    {"icon": "🎬", "label": "电影", "action": "navigate", "target": "/category/movie"},
    {"icon": "📺", "label": "剧集", "action": "navigate", "target": "/category/series"},
    {"icon": "🎭", "label": "综艺", "action": "navigate", "target": "/category/variety"},
    {"icon": "🎨", "label": "动漫", "action": "navigate", "target": "/category/anime"},
    {"icon": "⚡", "label": "短剧", "action": "navigate", "target": "/category/shorts"}
  ]
}'
WHERE tab_id = 'featured' AND module_type = 'grid_icons';

-- 3. 更新3x2网格配置（移除年份限制）
UPDATE page_modules 
SET api_params = '{"t": 2, "area": "大陆", "sort": "time", "limit": 6}'
WHERE tab_id = 'featured' AND module_type = 'grid_3x2';
