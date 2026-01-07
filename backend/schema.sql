-- Robin Video Platform Database Schema
-- Cloudflare D1 (SQLite) Database

-- ============================================
-- Core User Tables
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,           -- bcrypt hash
    is_vip BOOLEAN DEFAULT 0,
    device_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);

-- Watch history table
CREATE TABLE IF NOT EXISTS history (
    user_id INTEGER,
    vod_id TEXT NOT NULL,
    vod_name TEXT,
    vod_pic TEXT,
    progress INTEGER DEFAULT 0,       -- Progress in seconds
    duration INTEGER DEFAULT 0,       -- Total duration in seconds
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (user_id, vod_id)
);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, updated_at DESC);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER,
    vod_id TEXT NOT NULL,
    vod_name TEXT,
    vod_pic TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (user_id, vod_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id, created_at DESC);

-- ============================================
-- Layout Configuration Tables
-- ============================================

-- Home tabs (channels) configuration
CREATE TABLE IF NOT EXISTS home_tabs (
    id TEXT PRIMARY KEY,              -- 'featured', 'movie', 'netflix', etc.
    title TEXT NOT NULL,              -- '精选', '电影', 'Netflix'
    sort_order INTEGER,
    is_visible BOOLEAN DEFAULT 1,
    is_locked BOOLEAN DEFAULT 0       -- Requires password/VIP
);

-- Page modules (core dynamic layout table)
CREATE TABLE IF NOT EXISTS page_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tab_id TEXT,                      -- References home_tabs.id
    module_type TEXT NOT NULL,        -- 'carousel', 'grid_icons', 'grid_3x2_ad', 'timeline', 'week_timeline'
    title TEXT,
    api_params TEXT,                  -- JSON string: {"t":1, "sort":"hot", "limit":10}
    ad_config TEXT,                   -- JSON string: {"enable": true, "insert_index": 4, "ad_id": 101}
    sort_order INTEGER,
    is_enabled BOOLEAN DEFAULT 1      -- 模块开关：1=启用，0=禁用（用于快速隐藏模块）
);
CREATE INDEX IF NOT EXISTS idx_modules_tab ON page_modules(tab_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_modules_enabled ON page_modules(tab_id, is_enabled, sort_order);

-- ============================================
-- Content Tables
-- ============================================

-- Topics (curated collections)
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,              -- 'oscar_2025'
    title TEXT,
    cover_img TEXT,
    description TEXT
);

-- Topic items (videos in topics)
CREATE TABLE IF NOT EXISTS topic_items (
    topic_id TEXT,
    vod_id TEXT,
    vod_name TEXT,
    vod_pic TEXT,
    sort_order INTEGER,
    PRIMARY KEY (topic_id, vod_id)
);
CREATE INDEX IF NOT EXISTS idx_topic_items ON topic_items(topic_id, sort_order);

-- [DEPRECATED] shorts_cache 表已废弃
-- 短剧数据现在存储在 vod_cache 表（type_id=5）
-- 短剧流使用 vod_cache.shorts_preview_episode/url 字段

-- ============================================
-- Video Cache Tables (NEW - 苹果CMS级数据持久化)
-- ============================================

-- Video cache (主视频缓存表 - 类似苹果CMS的mac_vod)
CREATE TABLE IF NOT EXISTS vod_cache (
    vod_id TEXT PRIMARY KEY,
    vod_name TEXT NOT NULL,
    vod_pic TEXT,
    vod_pic_thumb TEXT,               -- 缩略图
    vod_pic_slide TEXT,               -- 轮播图
    vod_remarks TEXT,                 -- 备注（更新至XX集）
    vod_year TEXT,
    vod_area TEXT,
    vod_lang TEXT,
    vod_actor TEXT,
    vod_director TEXT,
    vod_writer TEXT,                  -- 编剧
    vod_content TEXT,                 -- 简介
    vod_play_url TEXT,                -- 播放地址（JSON格式）
    
    -- 评分系统（增强）
    vod_score REAL DEFAULT 0,         -- 主评分（优先显示权威评分）
    vod_score_num INTEGER DEFAULT 0,  -- 评分人数
    vod_douban_score REAL DEFAULT 0,  -- 豆瓣评分
    vod_tmdb_score REAL DEFAULT 0,    -- TMDB评分
    vod_score_source TEXT,            -- 评分来源：'resource', 'douban', 'tmdb'
    
    -- 统计数据
    vod_hits INTEGER DEFAULT 0,       -- 总点击量
    vod_hits_day INTEGER DEFAULT 0,   -- 日点击
    vod_hits_week INTEGER DEFAULT 0,  -- 周点击
    vod_hits_month INTEGER DEFAULT 0, -- 月点击
    
    -- 扩展字段
    vod_tag TEXT,                     -- 标签（逗号分隔）
    vod_duration TEXT,                -- 时长（如：90分钟）
    vod_total INTEGER DEFAULT 0,      -- 总集数
    vod_serial TEXT,                  -- 更新状态（连载中/已完结）
    vod_sub TEXT,                     -- 别名
    
    type_id INTEGER,
    type_name TEXT,
    sub_type_id INTEGER,              -- 子分类ID
    sub_type_name TEXT,               -- 子分类名称
    source_name TEXT,                 -- 来源资源站
    source_priority INTEGER DEFAULT 50, -- 来源优先级（用于数据合并）
    quality_score INTEGER DEFAULT 0,  -- 质量评分
    is_valid BOOLEAN DEFAULT 1,       -- 是否有效（播放地址是否失效）
    last_check INTEGER,               -- 上次检查时间
    
    -- 短剧流预览字段（仅 type_id=5 短剧使用）
    shorts_preview_episode INTEGER,   -- 预选的精彩集数（3-8之间）
    shorts_preview_url TEXT,          -- 预选集的播放地址
    shorts_category TEXT,             -- 短剧分类（霸总/战神/古装等）
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 索引优化（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_vod_type ON vod_cache(type_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_area ON vod_cache(vod_area, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_year ON vod_cache(vod_year, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_score ON vod_cache(vod_score DESC);
CREATE INDEX IF NOT EXISTS idx_vod_hits ON vod_cache(vod_hits DESC);
CREATE INDEX IF NOT EXISTS idx_vod_updated ON vod_cache(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_valid ON vod_cache(is_valid, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vod_shorts ON vod_cache(type_id, shorts_preview_url) WHERE type_id = 5;

-- 全文搜索表（使用FTS5实现快速搜索）
CREATE VIRTUAL TABLE IF NOT EXISTS vod_search USING fts5(
    vod_id UNINDEXED,
    vod_name,
    vod_actor,
    vod_director,
    vod_content,
    tokenize = 'unicode61'            -- 支持中文分词
);

-- 采集任务表（记录采集历史）
CREATE TABLE IF NOT EXISTS collect_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER,                -- 资源站ID
    source_name TEXT,
    task_type TEXT,                   -- 'full'(全量), 'incremental'(增量), 'update'(更新)
    status TEXT DEFAULT 'pending',    -- 'pending', 'running', 'success', 'failed'
    total_count INTEGER DEFAULT 0,    -- 总数
    new_count INTEGER DEFAULT 0,      -- 新增数
    update_count INTEGER DEFAULT 0,   -- 更新数
    error_count INTEGER DEFAULT 0,    -- 失败数
    error_message TEXT,
    started_at INTEGER,
    finished_at INTEGER,
    duration INTEGER,                 -- 耗时（秒）
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_collect_tasks_status ON collect_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collect_tasks_source ON collect_tasks(source_id, created_at DESC);

-- 播放地址失效记录表
CREATE TABLE IF NOT EXISTS vod_invalid_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vod_id TEXT NOT NULL,
    vod_name TEXT,
    play_url TEXT,
    error_type TEXT,                  -- 'timeout', '404', '403', 'parse_error'
    reported_by TEXT,                 -- 'user', 'system'
    reported_at INTEGER DEFAULT (strftime('%s', 'now')),
    is_fixed BOOLEAN DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invalid_urls_vod ON vod_invalid_urls(vod_id, is_fixed);
CREATE INDEX IF NOT EXISTS idx_invalid_urls_time ON vod_invalid_urls(reported_at DESC);

-- 评分缓存表（避免重复请求外部API）
CREATE TABLE IF NOT EXISTS vod_ratings (
    vod_id TEXT PRIMARY KEY,
    douban_score REAL DEFAULT 0,
    douban_votes INTEGER DEFAULT 0,
    tmdb_score REAL DEFAULT 0,
    tmdb_votes INTEGER DEFAULT 0,
    tmdb_id TEXT,                     -- TMDB ID
    fetch_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_ratings_status ON vod_ratings(fetch_status, updated_at);

-- 热度访问日志表（轻量级统计）
CREATE TABLE IF NOT EXISTS vod_access_log (
    vod_id TEXT,
    access_date TEXT,                 -- YYYY-MM-DD
    hits INTEGER DEFAULT 1,
    PRIMARY KEY (vod_id, access_date)
);
CREATE INDEX IF NOT EXISTS idx_access_date ON vod_access_log(access_date DESC);

-- ============================================
-- Actor Management Tables (演员管理)
-- ============================================

-- 演员表
CREATE TABLE IF NOT EXISTS actors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    name_en TEXT,                     -- 英文名
    avatar TEXT,                      -- 头像
    bio TEXT,                         -- 简介
    works_count INTEGER DEFAULT 0,    -- 作品数量
    popularity REAL DEFAULT 0,        -- 人气值
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_actors_name ON actors(name);
CREATE INDEX IF NOT EXISTS idx_actors_popularity ON actors(popularity DESC);

-- 视频-演员关联表
CREATE TABLE IF NOT EXISTS vod_actor_relation (
    vod_id TEXT,
    actor_id INTEGER,
    role_type TEXT,                   -- 'actor', 'director', 'writer'
    role_name TEXT,                   -- 角色名（可选）
    sort_order INTEGER DEFAULT 0,     -- 排序（主演在前）
    PRIMARY KEY (vod_id, actor_id, role_type)
);
CREATE INDEX IF NOT EXISTS idx_relation_vod ON vod_actor_relation(vod_id);
CREATE INDEX IF NOT EXISTS idx_relation_actor ON vod_actor_relation(actor_id, role_type);

-- ============================================
-- Recommendation System (推荐系统)
-- ============================================

-- 推荐缓存表
CREATE TABLE IF NOT EXISTS vod_recommendations (
    vod_id TEXT PRIMARY KEY,
    similar_ids TEXT,                 -- JSON数组：相似视频ID列表
    algorithm TEXT,                   -- 'content', 'collaborative', 'hybrid'
    confidence REAL DEFAULT 0,        -- 置信度
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_recommendations_updated ON vod_recommendations(updated_at);

-- 用户行为表（用于协同过滤，可选）
CREATE TABLE IF NOT EXISTS user_behavior (
    user_id INTEGER,
    vod_id TEXT,
    action_type TEXT,                 -- 'view', 'favorite', 'finish'
    action_value REAL DEFAULT 1,      -- 行为权重
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (user_id, vod_id, action_type)
);
CREATE INDEX IF NOT EXISTS idx_behavior_user ON user_behavior(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_vod ON user_behavior(vod_id);

-- Anime timeline (weekly schedule)
CREATE TABLE IF NOT EXISTS anime_timeline (
    vod_id TEXT PRIMARY KEY,
    day_of_week INTEGER,              -- 1-7 (Monday to Sunday)
    vod_name TEXT,
    vod_pic TEXT
);
CREATE INDEX IF NOT EXISTS idx_anime_day ON anime_timeline(day_of_week);

-- ============================================
-- Advertisement Tables
-- ============================================

-- Advertisement inventory
CREATE TABLE IF NOT EXISTS ads_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT,                    -- 'splash', 'banner_home', 'insert_grid', 'shorts_insert', 'pause_overlay'
    content_type TEXT,                -- 'image', 'video'
    media_url TEXT,
    action_type TEXT,                 -- 'browser', 'webview', 'deeplink'
    action_url TEXT,
    weight INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_ads_location ON ads_inventory(location, is_active, weight);

-- ============================================
-- System Tables
-- ============================================

-- System configuration (key-value store)
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Video sources configuration
CREATE TABLE IF NOT EXISTS video_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_url TEXT NOT NULL,
    weight INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_sources_weight ON video_sources(weight DESC, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_sources_active ON video_sources(is_active, weight DESC);

-- Daily statistics
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,            -- 'YYYY-MM-DD'
    api_calls INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stats_date ON daily_stats(date DESC);

-- User feedback
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT NOT NULL,
    contact TEXT,
    status TEXT DEFAULT 'pending',    -- 'pending', 'processed'
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at DESC);

-- App wall (promoted apps)
CREATE TABLE IF NOT EXISTS app_wall (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    icon_url TEXT,
    download_url TEXT,
    commission REAL,                  -- Commission rate (for reference)
    sort_order INTEGER,
    is_active BOOLEAN DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_app_wall ON app_wall(is_active, sort_order);

-- Appointments (upcoming releases)
CREATE TABLE IF NOT EXISTS appointments (
    user_id INTEGER,
    vod_id TEXT,
    vod_name TEXT,
    release_date TEXT,                -- Release date
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (user_id, vod_id)
);
CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id, created_at DESC);

-- ============================================
-- Initial System Configuration
-- ============================================

-- Insert default system configuration
INSERT OR IGNORE INTO system_config (key, value) VALUES
('app_version', '1.0.0'),
('force_update_min_ver', '1.0.0'),
('welfare_enabled', 'false'),
('welfare_password', ''),
('ads_enabled', 'true'),
('marquee_text', '欢迎使用拾光影视！'),
('marquee_link', ''),
('permanent_urls', '[]'),
('hot_search_keywords', '["三体", "繁花", "狂飙", "漫长的季节"]'),
('customer_service', ''),
('official_group', '');

-- Insert default home tabs
INSERT OR IGNORE INTO home_tabs (id, title, sort_order, is_visible, is_locked) VALUES
('featured', '精选', 1, 1, 0),
('movie', '电影', 2, 1, 0),
('series', '剧集', 3, 1, 0),
('netflix', 'Netflix', 4, 1, 0),
('shorts', '短剧', 5, 1, 0),
('anime', '动漫', 6, 1, 0),
('variety', '综艺', 7, 1, 0),
('welfare', '福利', 8, 0, 1);

-- ============================================
-- Category Management Tables (分类管理)
-- ============================================

-- 主分类表
CREATE TABLE IF NOT EXISTS video_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    collect_enabled BOOLEAN DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_video_categories_sort ON video_categories(sort_order, is_active);
CREATE INDEX IF NOT EXISTS idx_video_categories_active ON video_categories(is_active);

-- 子分类表
CREATE TABLE IF NOT EXISTS video_sub_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    keywords TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (parent_id) REFERENCES video_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_sub_categories_parent ON video_sub_categories(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_video_sub_categories_active ON video_sub_categories(parent_id, is_active);

-- ============================================
-- Search History Tables (搜索历史)
-- ============================================

-- 用户搜索历史
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    device_id TEXT,
    keyword TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    last_search_at INTEGER DEFAULT (strftime('%s', 'now')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(user_id, device_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, last_search_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_device ON search_history(device_id, last_search_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_keyword ON search_history(keyword, search_count DESC);

-- 热搜统计表
CREATE TABLE IF NOT EXISTS hot_search_stats (
    keyword TEXT PRIMARY KEY,
    search_count INTEGER DEFAULT 1,
    search_count_day INTEGER DEFAULT 0,
    search_count_week INTEGER DEFAULT 0,
    last_search_at INTEGER DEFAULT (strftime('%s', 'now')),
    is_pinned BOOLEAN DEFAULT 0,
    is_hidden BOOLEAN DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hot_search_count ON hot_search_stats(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_hot_search_day ON hot_search_stats(search_count_day DESC);
CREATE INDEX IF NOT EXISTS idx_hot_search_pinned ON hot_search_stats(is_pinned DESC, search_count DESC);

-- ============================================
-- Announcements Table (系统公告)
-- ============================================

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'info',
    target TEXT DEFAULT 'all',
    action_url TEXT,
    action_type TEXT DEFAULT 'none',
    start_time INTEGER,
    end_time INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_announcements_sort ON announcements(sort_order, created_at DESC);

-- Insert default categories
INSERT OR IGNORE INTO video_categories (id, name, name_en, icon, sort_order, is_active, collect_enabled) VALUES
(1, '电影', 'movie', '🎬', 1, 1, 1),
(2, '电视剧', 'series', '📺', 2, 1, 1),
(3, '综艺', 'variety', '🎤', 3, 1, 1),
(4, '动漫', 'anime', '🎌', 4, 1, 1),
(5, '短剧', 'shorts', '📱', 5, 1, 1),
(6, '体育', 'sports', '⚽', 6, 1, 0),
(7, '纪录片', 'documentary', '🎥', 7, 1, 1),
(8, '预告片', 'trailer', '🎞️', 8, 1, 0);

-- Insert default sub_categories for movies
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(1, 1, '动作', 'action', '动作,打斗,武打,功夫,枪战,格斗', 1),
(2, 1, '喜剧', 'comedy', '喜剧,搞笑,幽默,爆笑', 2),
(3, 1, '爱情', 'romance', '爱情,浪漫,言情,恋爱', 3),
(4, 1, '科幻', 'scifi', '科幻,未来,太空,机器人,外星', 4),
(5, 1, '恐怖', 'horror', '恐怖,惊悚,鬼片,灵异', 5),
(6, 1, '悬疑', 'mystery', '悬疑,推理,侦探,破案', 6),
(7, 1, '战争', 'war', '战争,军事,抗战,历史', 7),
(8, 1, '剧情', 'drama', '剧情,文艺,人生', 8),
(9, 1, '动画', 'animation', '动画,卡通', 9);

-- Insert default sub_categories for TV series
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(10, 2, '国产剧', 'chinese', '国产,大陆,内地', 1),
(11, 2, '韩剧', 'korean', '韩国,韩剧,欧巴', 2),
(12, 2, '日剧', 'japanese', '日本,日剧', 3),
(13, 2, '美剧', 'american', '美国,美剧,欧美', 4),
(14, 2, '港台剧', 'hktw', '香港,台湾,港剧,台剧', 5),
(15, 2, '泰剧', 'thai', '泰国,泰剧', 6);

-- Insert default sub_categories for variety
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(20, 3, '真人秀', 'reality', '真人秀,综艺,娱乐', 1),
(21, 3, '访谈', 'talk', '访谈,脱口秀,对话', 2),
(22, 3, '选秀', 'talent', '选秀,比赛,竞技', 3),
(23, 3, '晚会', 'gala', '晚会,春晚,演唱会', 4);

-- Insert default sub_categories for anime
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(30, 4, '国产动漫', 'chinese', '国漫,国产动漫,中国动漫', 1),
(31, 4, '日本动漫', 'japanese', '日漫,日本动漫,番剧', 2),
(32, 4, '欧美动漫', 'western', '欧美动漫,美漫,迪士尼', 3);

-- Insert default sub_categories for shorts
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(40, 5, '霸总', 'ceo', '霸总,总裁,豪门', 1),
(41, 5, '战神', 'warrior', '战神,兵王,特种兵,退伍', 2),
(42, 5, '古装', 'costume', '古装,穿越,宫廷,仙侠', 3),
(43, 5, '甜宠', 'sweet', '甜宠,恋爱,甜蜜', 4),
(44, 5, '逆袭', 'comeback', '逆袭,打脸,复仇', 5);

-- Insert default sub_categories for sports
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(50, 6, '足球', 'football', '足球,世界杯,欧冠', 1),
(51, 6, '篮球', 'basketball', '篮球,NBA,CBA', 2),
(52, 6, '电竞', 'esports', '电竞,游戏,LOL,王者', 3);

-- Insert default sub_categories for documentary
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(60, 7, '历史', 'history', '历史,人文,考古', 1),
(61, 7, '自然', 'nature', '自然,动物,地理', 2),
(62, 7, '科技', 'technology', '科技,科学,探索', 3);

-- Insert default sub_categories for trailer
INSERT OR IGNORE INTO video_sub_categories (id, parent_id, name, name_en, keywords, sort_order) VALUES
(70, 8, '电影预告', 'movie', '电影预告,即将上映', 1),
(71, 8, '剧集预告', 'series', '剧集预告,新剧', 2);

-- Insert default hot search keywords
INSERT OR IGNORE INTO hot_search_stats (keyword, search_count, is_pinned) VALUES
('三体', 10000, 1),
('繁花', 9000, 1),
('狂飙', 8000, 1),
('漫长的季节', 7000, 1),
('庆余年', 6000, 0),
('斗罗大陆', 5000, 0);

-- ============================================
-- Storage Configuration System
-- ============================================

-- 外部存储配置
CREATE TABLE IF NOT EXISTS storage_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_type TEXT NOT NULL DEFAULT 'local',  -- 'local', 'supabase', 'firebase', 'custom'
    connection_url TEXT,                          -- 数据库连接URL
    api_key TEXT,                                 -- API密钥
    is_enabled BOOLEAN DEFAULT 0,                 -- 是否启用
    sync_strategy TEXT DEFAULT 'local_only',      -- 'local_only', 'local_cloud', 'cloud_only'
    sync_interval INTEGER DEFAULT 30,             -- 同步间隔（秒）
    last_sync_at INTEGER,                         -- 上次同步时间
    last_sync_status TEXT,                        -- 'success', 'failed'
    last_sync_error TEXT,                         -- 错误信息
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 用户播放进度表（云端同步用）
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                        -- 用户ID或设备ID
    content_type TEXT NOT NULL,                   -- 'tv', 'movie', 'shorts'
    content_id TEXT NOT NULL,                     -- 视频ID
    episode_index INTEGER DEFAULT 1,              -- 集数
    position_seconds INTEGER DEFAULT 0,           -- 播放位置（秒）
    duration_seconds INTEGER DEFAULT 0,           -- 总时长（秒）
    progress_percent REAL DEFAULT 0,              -- 进度百分比
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    synced_at INTEGER,                            -- 同步到云端的时间
    UNIQUE(user_id, content_type, content_id, episode_index)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_content ON user_progress(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_progress_sync ON user_progress(synced_at);

-- 同步日志表
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,                      -- 'upload', 'download', 'full'
    records_count INTEGER DEFAULT 0,              -- 同步记录数
    status TEXT NOT NULL,                         -- 'success', 'failed', 'partial'
    error_message TEXT,
    duration_ms INTEGER,                          -- 耗时（毫秒）
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(created_at DESC);

-- 插入默认存储配置
INSERT OR IGNORE INTO storage_config (id, storage_type, sync_strategy, is_enabled) 
VALUES (1, 'local', 'local_only', 0);
