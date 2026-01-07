/**
 * 广告系统数据库迁移脚本
 * 扩展广告表字段，添加统计表
 */

import type { TableColumnInfo } from '../types/database';
import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

/**
 * 执行广告系统迁移
 */
export async function migrateAds(env: Env): Promise<{
  success: boolean;
  message: string;
  changes: string[];
}> {
  const changes: string[] = [];
  
  try {
    logger.migration.info('Starting ads migration...');
    
    // 1. 检查并添加新字段到 ads_inventory
    const tableInfo = await env.DB.prepare(`PRAGMA table_info(ads_inventory)`).all();
    const columns = (tableInfo.results as TableColumnInfo[]).map(col => col.name);
    
    // 添加投放时间字段
    if (!columns.includes('start_time')) {
      await env.DB.prepare(`ALTER TABLE ads_inventory ADD COLUMN start_time INTEGER`).run();
      changes.push('Added start_time column');
    }
    
    if (!columns.includes('end_time')) {
      await env.DB.prepare(`ALTER TABLE ads_inventory ADD COLUMN end_time INTEGER`).run();
      changes.push('Added end_time column');
    }
    
    // 添加频次控制字段
    if (!columns.includes('daily_limit')) {
      await env.DB.prepare(`ALTER TABLE ads_inventory ADD COLUMN daily_limit INTEGER DEFAULT 0`).run();
      changes.push('Added daily_limit column');
    }
    
    // 添加广告名称字段
    if (!columns.includes('name')) {
      await env.DB.prepare(`ALTER TABLE ads_inventory ADD COLUMN name TEXT`).run();
      changes.push('Added name column');
    }
    
    // 添加备注字段
    if (!columns.includes('remark')) {
      await env.DB.prepare(`ALTER TABLE ads_inventory ADD COLUMN remark TEXT`).run();
      changes.push('Added remark column');
    }
    
    // 添加创建时间字段
    if (!columns.includes('created_at')) {
      await env.DB.prepare(`ALTER TABLE ads_inventory ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))`).run();
      changes.push('Added created_at column');
    }
    
    // 添加更新时间字段
    if (!columns.includes('updated_at')) {
      await env.DB.prepare(`ALTER TABLE ads_inventory ADD COLUMN updated_at INTEGER DEFAULT (strftime('%s', 'now'))`).run();
      changes.push('Added updated_at column');
    }
    
    // 2. 创建广告统计表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ads_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,  -- impression, click
        user_id TEXT,
        device_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (ad_id) REFERENCES ads_inventory(id) ON DELETE CASCADE
      )
    `).run();
    changes.push('Created ads_stats table');
    
    // 创建统计索引
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_ads_stats_ad_id ON ads_stats(ad_id, event_type)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_ads_stats_date ON ads_stats(created_at)
    `).run();
    changes.push('Created ads_stats indexes');
    
    // 3. 创建每日统计汇总表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ads_stats_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        ctr REAL DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(ad_id, date)
      )
    `).run();
    changes.push('Created ads_stats_daily table');
    
    logger.migration.info('Ads migration completed', { changeCount: changes.length });
    
    return {
      success: true,
      message: 'Migration completed successfully',
      changes,
    };
  } catch (error) {
    logger.migration.error('Ads migration failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      changes,
    };
  }
}
