/**
 * 子分类数据库迁移脚本
 * 创建子分类表并为vod_cache添加子分类字段
 */

import type { TableColumnInfo } from '../types/database';
import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

// 默认子分类数据
const DEFAULT_SUB_CATEGORIES = [
  // 电影子分类 (parent_id = 1)
  { parent_id: 1, name: '动作', name_en: 'action', keywords: '动作,打斗,武打,功夫,枪战,格斗' },
  { parent_id: 1, name: '喜剧', name_en: 'comedy', keywords: '喜剧,搞笑,幽默,爆笑,滑稽' },
  { parent_id: 1, name: '爱情', name_en: 'romance', keywords: '爱情,浪漫,恋爱,情侣,爱恋' },
  { parent_id: 1, name: '科幻', name_en: 'scifi', keywords: '科幻,未来,太空,机器人,外星' },
  { parent_id: 1, name: '恐怖', name_en: 'horror', keywords: '恐怖,惊悚,鬼片,丧尸,惊吓' },
  { parent_id: 1, name: '悬疑', name_en: 'mystery', keywords: '悬疑,推理,侦探,破案,谜案' },
  { parent_id: 1, name: '战争', name_en: 'war', keywords: '战争,军事,抗战,二战,战斗' },
  { parent_id: 1, name: '犯罪', name_en: 'crime', keywords: '犯罪,黑帮,毒品,警匪,罪案' },
  { parent_id: 1, name: '冒险', name_en: 'adventure', keywords: '冒险,探险,历险,奇遇' },
  { parent_id: 1, name: '奇幻', name_en: 'fantasy', keywords: '奇幻,魔幻,魔法,神话' },
  { parent_id: 1, name: '剧情', name_en: 'drama', keywords: '剧情,文艺,情感,人生' },
  { parent_id: 1, name: '灾难', name_en: 'disaster', keywords: '灾难,末日,地震,海啸' },
  { parent_id: 1, name: '武侠', name_en: 'wuxia', keywords: '武侠,江湖,侠客,武林' },
  { parent_id: 1, name: '古装', name_en: 'costume', keywords: '古装,古代,宫廷,历史' },
  { parent_id: 1, name: '传记', name_en: 'biography', keywords: '传记,人物,真实,历史人物' },
  { parent_id: 1, name: '家庭', name_en: 'family', keywords: '家庭,亲情,温情,儿童' },
  { parent_id: 1, name: '动画', name_en: 'animation', keywords: '动画,剧场版,卡通' },
  { parent_id: 1, name: '伦理', name_en: 'ethics', keywords: '伦理,情感,人性,道德' },
  
  // 电视剧子分类 (parent_id = 2) - 按题材
  { parent_id: 2, name: '都市', name_en: 'urban', keywords: '都市,现代,职场,白领,城市' },
  { parent_id: 2, name: '古装', name_en: 'costume', keywords: '古装,古代,宫廷,历史' },
  { parent_id: 2, name: '悬疑', name_en: 'mystery', keywords: '悬疑,推理,破案,刑侦,探案' },
  { parent_id: 2, name: '言情', name_en: 'romance', keywords: '言情,爱情,浪漫,甜宠,恋爱' },
  { parent_id: 2, name: '家庭', name_en: 'family', keywords: '家庭,亲情,伦理,生活' },
  { parent_id: 2, name: '军旅', name_en: 'military', keywords: '军旅,军人,部队,当兵' },
  { parent_id: 2, name: '谍战', name_en: 'spy', keywords: '谍战,间谍,特工,卧底' },
  { parent_id: 2, name: '武侠', name_en: 'wuxia', keywords: '武侠,江湖,侠客,武林' },
  // 电视剧子分类 - 按地区
  { parent_id: 2, name: '国产剧', name_en: 'chinese', keywords: '国产,大陆,内地,中国' },
  { parent_id: 2, name: '韩剧', name_en: 'korean', keywords: '韩国,韩剧,韩国剧' },
  { parent_id: 2, name: '日剧', name_en: 'japanese', keywords: '日本,日剧,日本剧' },
  { parent_id: 2, name: '美剧', name_en: 'american', keywords: '美国,美剧,欧美剧,欧美' },
  { parent_id: 2, name: '港台剧', name_en: 'hktw', keywords: '香港,台湾,港剧,台剧,港台' },
  { parent_id: 2, name: '泰剧', name_en: 'thai', keywords: '泰国,泰剧' },
  { parent_id: 2, name: '英剧', name_en: 'british', keywords: '英国,英剧' },
  
  // 综艺子分类 (parent_id = 3)
  { parent_id: 3, name: '真人秀', name_en: 'reality', keywords: '真人秀,真人,实境' },
  { parent_id: 3, name: '访谈', name_en: 'talk', keywords: '访谈,脱口秀,对话,采访' },
  { parent_id: 3, name: '选秀', name_en: 'talent', keywords: '选秀,比赛,竞技,海选' },
  { parent_id: 3, name: '音乐', name_en: 'music', keywords: '音乐,歌唱,演唱,歌手' },
  { parent_id: 3, name: '游戏', name_en: 'game', keywords: '游戏,竞技,挑战,闯关' },
  { parent_id: 3, name: '美食', name_en: 'food', keywords: '美食,烹饪,厨艺,料理' },
  { parent_id: 3, name: '晚会', name_en: 'gala', keywords: '晚会,春晚,跨年,盛典,颁奖' },
  { parent_id: 3, name: '纪实', name_en: 'documentary', keywords: '纪实,纪录,真实,探索' },
  { parent_id: 3, name: '旅游', name_en: 'travel', keywords: '旅游,旅行,探险,户外' },
  { parent_id: 3, name: '少儿', name_en: 'kids', keywords: '少儿,儿童,亲子,动画' },
  // 综艺子分类 - 按地区
  { parent_id: 3, name: '大陆综艺', name_en: 'mainland', keywords: '大陆,内地,国产' },
  { parent_id: 3, name: '港台综艺', name_en: 'hktw', keywords: '香港,台湾,港台' },
  { parent_id: 3, name: '日韩综艺', name_en: 'jpkr', keywords: '日本,韩国,日韩' },
  { parent_id: 3, name: '欧美综艺', name_en: 'western', keywords: '欧美,美国,英国' },
  
  // 动漫子分类 (parent_id = 4) - 按题材
  { parent_id: 4, name: '热血', name_en: 'action', keywords: '热血,战斗,格斗,冒险' },
  { parent_id: 4, name: '搞笑', name_en: 'comedy', keywords: '搞笑,喜剧,幽默,日常' },
  { parent_id: 4, name: '恋爱', name_en: 'romance', keywords: '恋爱,爱情,后宫,少女' },
  { parent_id: 4, name: '奇幻', name_en: 'fantasy', keywords: '奇幻,魔法,异世界,穿越' },
  { parent_id: 4, name: '校园', name_en: 'school', keywords: '校园,学园,学生,青春' },
  { parent_id: 4, name: '治愈', name_en: 'healing', keywords: '治愈,温馨,日常,萌系' },
  { parent_id: 4, name: '机战', name_en: 'mecha', keywords: '机战,机甲,机器人,高达' },
  { parent_id: 4, name: '运动', name_en: 'sports', keywords: '运动,体育,竞技,比赛' },
  // 动漫子分类 - 按地区
  { parent_id: 4, name: '国产动漫', name_en: 'chinese', keywords: '国产,国漫,大陆,中国' },
  { parent_id: 4, name: '日本动漫', name_en: 'japanese', keywords: '日本,日漫,新番,番剧' },
  { parent_id: 4, name: '欧美动漫', name_en: 'western', keywords: '欧美,美国,迪士尼' },
  
  // 短剧子分类 (parent_id = 5)
  { parent_id: 5, name: '霸总', name_en: 'ceo', keywords: '霸总,总裁,CEO,豪门,富豪' },
  { parent_id: 5, name: '战神', name_en: 'warrior', keywords: '战神,兵王,特种兵,退伍,军人' },
  { parent_id: 5, name: '古装', name_en: 'costume', keywords: '古装,穿越,宫斗,古代' },
  { parent_id: 5, name: '甜宠', name_en: 'sweet', keywords: '甜宠,恋爱,浪漫,甜蜜,宠爱' },
  { parent_id: 5, name: '复仇', name_en: 'revenge', keywords: '复仇,报复,逆袭,反击' },
  { parent_id: 5, name: '重生', name_en: 'rebirth', keywords: '重生,穿越,逆袭,重来' },
  { parent_id: 5, name: '玄幻', name_en: 'xuanhuan', keywords: '玄幻,修仙,仙侠,神医' },
  { parent_id: 5, name: '都市', name_en: 'urban', keywords: '都市,现代,职场,逆袭' },
  { parent_id: 5, name: '萌宝', name_en: 'baby', keywords: '萌宝,宝宝,亲子,孩子' },
  { parent_id: 5, name: '虐恋', name_en: 'angst', keywords: '虐恋,虐心,悲情,苦情' },
  
  // 体育子分类 (parent_id = 6)
  { parent_id: 6, name: '足球', name_en: 'football', keywords: '足球,世界杯,欧冠,英超,西甲,德甲,意甲,中超,欧洲杯' },
  { parent_id: 6, name: '篮球', name_en: 'basketball', keywords: '篮球,NBA,CBA,男篮,女篮' },
  { parent_id: 6, name: '网球', name_en: 'tennis', keywords: '网球,温网,法网,美网,澳网' },
  { parent_id: 6, name: '台球', name_en: 'billiards', keywords: '台球,斯诺克,桌球' },
  { parent_id: 6, name: '综合', name_en: 'general', keywords: '体育,赛事,比赛,直播,奥运' },
  { parent_id: 6, name: '格斗', name_en: 'fighting', keywords: '格斗,拳击,UFC,MMA,搏击' },
  { parent_id: 6, name: '电竞', name_en: 'esports', keywords: '电竞,游戏,LOL,DOTA,王者' },
  
  // 纪录片子分类 (parent_id = 7)
  { parent_id: 7, name: '历史', name_en: 'history', keywords: '历史,古代,战争,人物' },
  { parent_id: 7, name: '自然', name_en: 'nature', keywords: '自然,动物,植物,地球,环境' },
  { parent_id: 7, name: '科技', name_en: 'technology', keywords: '科技,科学,探索,宇宙' },
  { parent_id: 7, name: '社会', name_en: 'society', keywords: '社会,人文,文化,生活' },
  { parent_id: 7, name: '美食', name_en: 'food', keywords: '美食,烹饪,饮食,料理' },
  
  // 预告片子分类 (parent_id = 8)
  { parent_id: 8, name: '电影预告', name_en: 'movie', keywords: '电影,影片,大片' },
  { parent_id: 8, name: '剧集预告', name_en: 'series', keywords: '电视剧,剧集,网剧' },
  { parent_id: 8, name: '综艺预告', name_en: 'variety', keywords: '综艺,真人秀' },
];

/**
 * 执行迁移
 */
export async function migrateSubCategories(env: Env): Promise<{
  success: boolean;
  message: string;
  subCategoriesCreated: number;
}> {
  let subCategoriesCreated = 0;
  
  try {
    logger.migration.info('Starting sub-categories migration');
    
    // 1. 创建子分类表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS video_sub_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER NOT NULL,          -- 父分类ID (1=电影, 2=电视剧, etc.)
        name TEXT NOT NULL,                  -- 子分类名称
        name_en TEXT,                        -- 英文名
        icon TEXT,                           -- 图标
        keywords TEXT,                       -- 识别关键词（逗号分隔）
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(parent_id, name)
      )
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sub_cat_parent ON video_sub_categories(parent_id, sort_order)
    `).run();
    
    logger.migration.info('Created video_sub_categories table');
    
    // 2. 为 vod_cache 添加子分类字段
    try {
      const tableInfo = await env.DB.prepare(`PRAGMA table_info(vod_cache)`).all();
      const columns = (tableInfo.results as TableColumnInfo[]).map(col => col.name);
      
      if (!columns.includes('sub_type_id')) {
        await env.DB.prepare(`
          ALTER TABLE vod_cache ADD COLUMN sub_type_id INTEGER
        `).run();
        logger.migration.info('Added sub_type_id column');
      }
      
      if (!columns.includes('sub_type_name')) {
        await env.DB.prepare(`
          ALTER TABLE vod_cache ADD COLUMN sub_type_name TEXT
        `).run();
        logger.migration.info('Added sub_type_name column');
      }
    } catch (error) {
      logger.migration.info('Columns may already exist');
    }
    
    // 3. 创建子分类索引
    try {
      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_vod_sub_type ON vod_cache(type_id, sub_type_id)
      `).run();
    } catch (error) {
      logger.migration.info('Index may already exist');
    }
    
    // 4. 插入默认子分类数据
    for (let i = 0; i < DEFAULT_SUB_CATEGORIES.length; i++) {
      const sub = DEFAULT_SUB_CATEGORIES[i];
      try {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO video_sub_categories (parent_id, name, name_en, keywords, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).bind(sub.parent_id, sub.name, sub.name_en, sub.keywords, i + 1).run();
        subCategoriesCreated++;
      } catch (error) {
        logger.migration.debug('Sub-category may already exist', { name: sub.name, error: error instanceof Error ? error.message : String(error) });
        // 可能已存在，忽略
      }
    }
    
    logger.migration.info('Inserted default sub-categories', { count: subCategoriesCreated });
    
    return {
      success: true,
      message: 'Migration completed successfully',
      subCategoriesCreated,
    };
  } catch (error) {
    logger.migration.error('Migration failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      subCategoriesCreated,
    };
  }
}
