-- Seed Layout Configuration
-- 初始化首页布局配置示例数据

-- 清空现有数据（可选）
-- DELETE FROM page_modules;

-- ============================================
-- 精选频道 (featured)
-- ============================================

-- 1. 轮播图
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('featured', 'carousel', '今日推荐', 
 '{"t": "1", "sort": "hot", "limit": 8}',
 NULL,
 1, 1);

-- 2. 金刚区
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('featured', 'grid_icons', '快速入口',
 '{"items": [
   {"name": "Netflix", "icon": "https://example.com/netflix.png", "link": "tab://netflix"},
   {"name": "豆瓣250", "icon": "https://example.com/douban.png", "link": "topic://douban250"},
   {"name": "排行榜", "icon": "https://example.com/rank.png", "link": "webview://rank"},
   {"name": "精彩应用", "icon": "https://example.com/apps.png", "link": "webview://apps"},
   {"name": "娱乐", "icon": "https://example.com/fun.png", "link": "webview://fun"}
 ]}',
 NULL,
 2, 1);

-- 3. 热门电影（3x2 + 广告）
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('featured', 'grid_3x2_ad', '热门电影',
 '{"t": "1", "sort": "hot", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 101}',
 3, 1);

-- 4. 最新剧集（3x2 + 广告）
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('featured', 'grid_3x2_ad', '最新剧集',
 '{"t": "2", "sort": "time", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 102}',
 4, 1);

-- 5. 热门动漫（3x2 + 广告）
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('featured', 'grid_3x2_ad', '热门动漫',
 '{"t": "4", "sort": "hot", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 103}',
 5, 1);

-- ============================================
-- 电影频道 (movie)
-- ============================================

-- 1. 轮播图
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('movie', 'carousel', '院线大片',
 '{"t": "1", "sort": "hot", "limit": 8}',
 NULL,
 1, 1);

-- 2. 金刚区
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('movie', 'grid_icons', '电影分类',
 '{"items": [
   {"name": "动作", "icon": "https://example.com/action.png", "link": "filter://movie?class=动作"},
   {"name": "喜剧", "icon": "https://example.com/comedy.png", "link": "filter://movie?class=喜剧"},
   {"name": "爱情", "icon": "https://example.com/romance.png", "link": "filter://movie?class=爱情"},
   {"name": "科幻", "icon": "https://example.com/scifi.png", "link": "filter://movie?class=科幻"},
   {"name": "恐怖", "icon": "https://example.com/horror.png", "link": "filter://movie?class=恐怖"}
 ]}',
 NULL,
 2, 1);

-- 3. 票房冠军
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('movie', 'grid_3x2_ad', '票房冠军',
 '{"t": "1", "sort": "hot", "area": "中国大陆", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 104}',
 3, 1);

-- 4. 欧美大片
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('movie', 'grid_3x2_ad', '欧美大片',
 '{"t": "1", "area": "美国", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 105}',
 4, 1);

-- ============================================
-- Netflix 频道 (netflix)
-- ============================================

-- 1. 轮播图
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('netflix', 'carousel', 'Netflix 精选',
 '{"t": "2", "sort": "hot", "limit": 8}',
 NULL,
 1, 1);

-- 2. 金刚区
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('netflix', 'grid_icons', '分类浏览',
 '{"items": [
   {"name": "美剧", "icon": "https://example.com/us.png", "link": "filter://series?area=美国"},
   {"name": "韩剧", "icon": "https://example.com/kr.png", "link": "filter://series?area=韩国"},
   {"name": "日剧", "icon": "https://example.com/jp.png", "link": "filter://series?area=日本"},
   {"name": "英剧", "icon": "https://example.com/uk.png", "link": "filter://series?area=英国"},
   {"name": "泰剧", "icon": "https://example.com/th.png", "link": "filter://series?area=泰国"}
 ]}',
 NULL,
 2, 1);

-- 3. 新片速递（时间轴）
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('netflix', 'timeline', '新片速递',
 '{"t": "2", "sort": "time", "limit": 10}',
 NULL,
 3, 1);

-- 4. 每周更新（周时间轴）
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('netflix', 'week_timeline', '每周更新',
 '{"source": "anime_timeline"}',
 NULL,
 4, 1);

-- ============================================
-- 动漫频道 (anime)
-- ============================================

-- 1. 轮播图
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('anime', 'carousel', '热门番剧',
 '{"t": "4", "sort": "hot", "limit": 8}',
 NULL,
 1, 1);

-- 2. 金刚区
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('anime', 'grid_icons', '动漫分类',
 '{"items": [
   {"name": "国漫", "icon": "https://example.com/cn_anime.png", "link": "filter://anime?area=中国"},
   {"name": "日漫", "icon": "https://example.com/jp_anime.png", "link": "filter://anime?area=日本"},
   {"name": "新番", "icon": "https://example.com/new_anime.png", "link": "filter://anime?sort=time"},
   {"name": "完结", "icon": "https://example.com/end_anime.png", "link": "filter://anime?status=完结"},
   {"name": "剧场版", "icon": "https://example.com/movie_anime.png", "link": "filter://anime?class=剧场版"}
 ]}',
 NULL,
 2, 1);

-- 3. 新番推荐
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('anime', 'grid_3x2_ad', '新番推荐',
 '{"t": "4", "sort": "time", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 106}',
 3, 1);

-- 4. 每周更新
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('anime', 'week_timeline', '每周更新',
 '{"source": "anime_timeline"}',
 NULL,
 4, 1);

-- ============================================
-- 短剧频道 (shorts)
-- ============================================

-- 1. 轮播图
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('shorts', 'carousel', '热播短剧',
 '{"source": "shorts_hot", "limit": 8}',
 NULL,
 1, 1);

-- 2. 金刚区
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('shorts', 'grid_icons', '短剧分类',
 '{"items": [
   {"name": "霸总", "icon": "https://example.com/boss.png", "link": "shorts://category?type=霸总"},
   {"name": "战神", "icon": "https://example.com/war.png", "link": "shorts://category?type=战神"},
   {"name": "赘婿", "icon": "https://example.com/son.png", "link": "shorts://category?type=赘婿"},
   {"name": "古装", "icon": "https://example.com/ancient.png", "link": "shorts://category?type=古装"},
   {"name": "现代", "icon": "https://example.com/modern.png", "link": "shorts://category?type=现代"}
 ]}',
 NULL,
 2, 1);

-- 3. 热播短剧
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('shorts', 'grid_3x2_ad', '热播短剧',
 '{"source": "shorts_hot", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 107}',
 3, 1);

-- 4. 霸道总裁
INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled) VALUES
('shorts', 'grid_3x2_ad', '霸道总裁',
 '{"source": "shorts_category", "category": "霸总", "limit": 6}',
 '{"enable": true, "insert_index": 4, "ad_id": 108}',
 4, 1);

-- 完成
SELECT '✅ Layout seed data inserted successfully!' as message;
