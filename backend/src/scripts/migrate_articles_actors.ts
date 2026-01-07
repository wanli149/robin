/**
 * 文章和演员扩展迁移脚本
 * 
 * 功能：
 * 1. 创建文章表 (articles)
 * 2. 扩展演员表字段 (actors)
 * 3. 创建文章分类表
 */

import type { TableColumnInfo } from '../types/database';
import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

/**
 * 执行迁移
 */
export async function migrateArticlesActors(env: Env): Promise<{
  success: boolean;
  message: string;
  tables: string[];
  columns: string[];
}> {
  const tables: string[] = [];
  const columns: string[] = [];
  
  logger.migration.info('Starting articles/actors migration...');
  
  try {
    // 1. 创建文章表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        art_id TEXT UNIQUE NOT NULL,           -- 资源站文章ID
        title TEXT NOT NULL,                   -- 标题
        title_en TEXT,                         -- 英文标题/拼音
        type_id INTEGER DEFAULT 0,             -- 分类ID
        type_name TEXT,                        -- 分类名称
        cover TEXT,                            -- 封面图
        author TEXT,                           -- 作者
        source TEXT,                           -- 来源
        summary TEXT,                          -- 摘要
        content TEXT,                          -- 正文内容
        tags TEXT,                             -- 标签
        hits INTEGER DEFAULT 0,                -- 点击量
        hits_day INTEGER DEFAULT 0,
        hits_week INTEGER DEFAULT 0,
        hits_month INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,           -- 是否启用
        source_name TEXT,                      -- 采集来源站名称
        published_at INTEGER,                  -- 发布时间
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_articles_type ON articles(type_id, is_active)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_articles_time ON articles(published_at DESC)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_articles_hits ON articles(hits_day DESC)
    `).run();
    
    tables.push('articles');
    logger.migration.info('Created articles table');
    
    // 2. 创建文章分类表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS article_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_en TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();
    
    // 插入默认文章分类
    await env.DB.prepare(`
      INSERT OR IGNORE INTO article_categories (id, name, name_en, sort_order) VALUES
      (1, '电影资讯', 'movie_news', 1),
      (2, '娱乐新闻', 'entertainment', 2),
      (3, '明星动态', 'celebrity', 3),
      (4, '影评', 'review', 4)
    `).run();
    
    tables.push('article_categories');
    logger.migration.info('Created article_categories table');
    
    // 3. 扩展演员表字段
    const actorTableInfo = await env.DB.prepare(`PRAGMA table_info(actors)`).all();
    const existingColumns = (actorTableInfo.results as unknown as TableColumnInfo[]).map(col => col.name);
    
    const newActorColumns = [
      { name: 'actor_id', type: 'TEXT', comment: '资源站演员ID' },
      { name: 'avatar', type: 'TEXT', comment: '头像' },
      { name: 'name_en', type: 'TEXT', comment: '英文名/拼音' },
      { name: 'alias', type: 'TEXT', comment: '别名' },
      { name: 'sex', type: 'TEXT', comment: '性别' },
      { name: 'area', type: 'TEXT', comment: '地区' },
      { name: 'birthday', type: 'TEXT', comment: '生日' },
      { name: 'birthplace', type: 'TEXT', comment: '出生地' },
      { name: 'height', type: 'TEXT', comment: '身高' },
      { name: 'weight', type: 'TEXT', comment: '体重' },
      { name: 'blood_type', type: 'TEXT', comment: '血型' },
      { name: 'constellation', type: 'TEXT', comment: '星座' },
      { name: 'profession', type: 'TEXT', comment: '职业' },
      { name: 'representative_works', type: 'TEXT', comment: '代表作品' },
      { name: 'bio', type: 'TEXT', comment: '简介' },
      { name: 'source_name', type: 'TEXT', comment: '数据来源' },
      { name: 'updated_at', type: 'INTEGER', comment: '更新时间' },
    ];
    
    for (const col of newActorColumns) {
      if (!existingColumns.includes(col.name)) {
        try {
          await env.DB.prepare(`
            ALTER TABLE actors ADD COLUMN ${col.name} ${col.type}
          `).run();
          columns.push(`actors.${col.name}`);
          logger.migration.info('Added column', { column: `actors.${col.name}` });
        } catch {
          // 列可能已存在
          logger.migration.debug('Column may already exist', { column: `actors.${col.name}` });
        }
      }
    }
    
    // 4. 创建演员ID索引
    try {
      await env.DB.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_actor_id ON actors(actor_id)
      `).run();
    } catch {
      // 索引可能已存在
    }
    
    logger.migration.info('Articles/actors migration completed successfully');
    
    return {
      success: true,
      message: 'Migration completed',
      tables,
      columns,
    };
    
  } catch (error) {
    logger.migration.error('Articles/actors migration failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      tables,
      columns,
    };
  }
}

/**
 * 文章分类映射（资源站分类ID -> 本地分类ID）
 */
export const ARTICLE_TYPE_MAPPING: Record<number, number> = {
  42: 1,  // 新闻资讯 -> 电影资讯
  43: 1,  // 电影资讯 -> 电影资讯
  44: 2,  // 娱乐新闻 -> 娱乐新闻
};
