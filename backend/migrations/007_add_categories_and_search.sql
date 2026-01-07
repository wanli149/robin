-- Migration 007: 添加分类管理、搜索历史、系统公告表
-- 替换硬编码的分类数据，支持动态管理

-- ============================================
-- 分类管理表 (Categories)
-- ============================================

-- 主分类表
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                   -- 分类名称（中文）
    name_en TEXT,                         -- 英文名称
    icon TEXT,                            -- 图标（emoji或图片URL）
    sort_order INTEGER DEFAULT 0,         -- 排序
    is_active BOOLEAN DEFAULT 1,          -- 是否启用
    collect_enabled BOOLEAN DEFAULT 1,    -- 是否启用采集
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

-- 子分类表
CREATE TABLE IF NOT EXISTS sub_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL,           -- 父分类ID
    name TEXT NOT NULL,                   -- 子分类名称
    name_en TEXT,                         -- 英文名称
    keywords TEXT,                        -- 关键词（用于智能分类，逗号分隔）
    sort_order INTEGER DEFAULT 0,         -- 排序
    is_active BOOLEAN DEFAULT 1,          -- 是否启用
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_categories_parent ON sub_categories(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sub_categories_active ON sub_categories(parent_id, is_active);

-- ============================================
-- 搜索历史表 (Search History)
-- ============================================

-- 用户搜索历史
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,                         -- 用户ID（可为空，支持匿名）
    device_id TEXT,                       -- 设备ID
    keyword TEXT NOT NULL,                -- 搜索关键词
    search_count INTEGER DEFAULT 1,       -- 搜索次数
    last_search_at INTEGER DEFAULT (strftime('%s', 'now')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(user_id, device_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, last_search_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_device ON search_history(device_id, last_search_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_keyword ON search_history(keyword, search_count DESC);

-- 热搜统计表（全局热搜）
CREATE TABLE IF NOT EXISTS hot_search_stats (
    keyword TEXT PRIMARY KEY,             -- 搜索关键词
    search_count INTEGER DEFAULT 1,       -- 总搜索次数
    search_count_day INTEGER DEFAULT 0,   -- 日搜索次数
    search_count_week INTEGER DEFAULT 0,  -- 周搜索次数
    last_search_at INTEGER DEFAULT (strftime('%s', 'now')),
    is_pinned BOOLEAN DEFAULT 0,          -- 是否置顶（手动设置的热搜）
    is_hidden BOOLEAN DEFAULT 0,          -- 是否隐藏（屏蔽敏感词）
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hot_search_count ON hot_search_stats(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_hot_search_day ON hot_search_stats(search_count_day DESC);
CREATE INDEX IF NOT EXISTS idx_hot_search_pinned ON hot_search_stats(is_pinned DESC, search_count DESC);

-- ============================================
-- 系统公告表 (Announcements)
-- ============================================

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,                  -- 公告标题
    content TEXT,                         -- 公告内容
    type TEXT DEFAULT 'info',             -- 类型：info, warning, success, error
    target TEXT DEFAULT 'all',            -- 目标：all, vip, guest
    action_url TEXT,                      -- 点击跳转链接
    action_type TEXT DEFAULT 'none',      -- 跳转类型：none, browser, webview, deeplink
    start_time INTEGER,                   -- 开始时间（时间戳）
    end_time INTEGER,                     -- 结束时间（时间戳）
    sort_order INTEGER DEFAULT 0,         -- 排序
    is_active BOOLEAN DEFAULT 1,          -- 是否启用
    view_count INTEGER DEFAULT 0,         -- 查看次数
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_announcements_sort ON announcements(sort_order, created_at DESC);

-- ============================================
-- 插入默认分类数据
-- ============================================

-- 主分类
INSERT OR IGNORE INTO categories (id, name, name_en, icon, sort_order, is_active, collect_enabled) VALUES
(1, '电影', 'movie', '🎬', 1, 1, 1),
(2, '电视剧', 'series', '📺', 2, 1, 1),
(3, '综艺', 'variety', '🎤', 3, 1, 1),
(4, '动漫', 'anime', '🎌', 4, 1, 1),
(5, '短剧', 'shorts', '📱', 5, 1, 1),
(6, '体育', 'sports', '⚽', 6, 1, 0),
(7, '纪录片', 'documentary', '🎥', 7, 1, 1),
(8, '预告片', 'trailer', '🎞️', 8, 1, 0);

-- 电影子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(1, '动作', 'action', '动作,打斗,武打,功夫,枪战,格斗', 1),
(1, '喜剧', 'comedy', '喜剧,搞笑,幽默,爆笑', 2),
(1, '爱情', 'romance', '爱情,浪漫,言情,恋爱', 3),
(1, '科幻', 'scifi', '科幻,未来,太空,机器人,外星', 4),
(1, '恐怖', 'horror', '恐怖,惊悚,鬼片,灵异', 5),
(1, '悬疑', 'mystery', '悬疑,推理,侦探,破案', 6),
(1, '战争', 'war', '战争,军事,抗战,历史', 7),
(1, '剧情', 'drama', '剧情,文艺,人生', 8),
(1, '动画', 'animation', '动画,卡通', 9);

-- 电视剧子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(2, '国产剧', 'chinese', '国产,大陆,内地', 1),
(2, '韩剧', 'korean', '韩国,韩剧,欧巴', 2),
(2, '日剧', 'japanese', '日本,日剧', 3),
(2, '美剧', 'american', '美国,美剧,欧美', 4),
(2, '港台剧', 'hktw', '香港,台湾,港剧,台剧', 5),
(2, '泰剧', 'thai', '泰国,泰剧', 6);

-- 综艺子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(3, '真人秀', 'reality', '真人秀,综艺,娱乐', 1),
(3, '访谈', 'talk', '访谈,脱口秀,对话', 2),
(3, '选秀', 'talent', '选秀,比赛,竞技', 3),
(3, '晚会', 'gala', '晚会,春晚,演唱会', 4);

-- 动漫子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(4, '国产动漫', 'chinese', '国漫,国产动漫,中国动漫', 1),
(4, '日本动漫', 'japanese', '日漫,日本动漫,番剧', 2),
(4, '欧美动漫', 'western', '欧美动漫,美漫,迪士尼', 3);

-- 短剧子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(5, '霸总', 'ceo', '霸总,总裁,豪门', 1),
(5, '战神', 'warrior', '战神,兵王,特种兵,退伍', 2),
(5, '古装', 'costume', '古装,穿越,宫廷,仙侠', 3),
(5, '甜宠', 'sweet', '甜宠,恋爱,甜蜜', 4),
(5, '逆袭', 'comeback', '逆袭,打脸,复仇', 5);

-- 体育子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(6, '足球', 'football', '足球,世界杯,欧冠', 1),
(6, '篮球', 'basketball', '篮球,NBA,CBA', 2),
(6, '电竞', 'esports', '电竞,游戏,LOL,王者', 3);

-- 纪录片子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(7, '历史', 'history', '历史,人文,考古', 1),
(7, '自然', 'nature', '自然,动物,地理', 2),
(7, '科技', 'technology', '科技,科学,探索', 3);

-- 预告片子分类
INSERT OR IGNORE INTO sub_categories (parent_id, name, name_en, keywords, sort_order) VALUES
(8, '电影预告', 'movie', '电影预告,即将上映', 1),
(8, '剧集预告', 'series', '剧集预告,新剧', 2);

-- ============================================
-- 插入默认热搜词（从 system_config 迁移）
-- ============================================

INSERT OR IGNORE INTO hot_search_stats (keyword, search_count, is_pinned) VALUES
('三体', 10000, 1),
('繁花', 9000, 1),
('狂飙', 8000, 1),
('漫长的季节', 7000, 1),
('庆余年', 6000, 0),
('斗罗大陆', 5000, 0);

-- ============================================
-- 添加系统配置项
-- ============================================

INSERT OR IGNORE INTO system_config (key, value) VALUES
('hot_search_enabled', 'true'),
('hot_search_source', 'auto'),        -- 'auto'(自动统计), 'manual'(手动设置), 'mixed'(混合)
('hot_search_limit', '10'),           -- 热搜显示数量
('search_history_enabled', 'true'),   -- 是否记录搜索历史
('search_history_limit', '20');       -- 搜索历史保留数量
