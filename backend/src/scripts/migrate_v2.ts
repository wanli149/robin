/**
 * 采集引擎 V2 数据库迁移脚本
 * 创建新的表结构
 */

import type { TableColumnInfo } from '../types/database';
import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

/**
 * 执行迁移
 */
export async function migrateToV2(env: Env): Promise<{
  success: boolean;
  tables: string[];
  errors: string[];
}> {
  const tables: string[] = [];
  const errors: string[] = [];
  
  logger.migration.info('Starting migration');
  
  // 1. 创建采集任务表 V2
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS collect_tasks_v2 (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        config TEXT,
        current_source TEXT,
        current_source_id INTEGER,
        current_page INTEGER DEFAULT 0,
        total_pages INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        new_count INTEGER DEFAULT 0,
        update_count INTEGER DEFAULT 0,
        skip_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        checkpoint TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        started_at INTEGER,
        paused_at INTEGER,
        completed_at INTEGER,
        last_error TEXT,
        error_details TEXT
      )
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_tasks_v2_status ON collect_tasks_v2(status, priority DESC, created_at DESC)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_tasks_v2_type ON collect_tasks_v2(task_type, status)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_tasks_v2_created ON collect_tasks_v2(created_at DESC)
    `).run();
    
    tables.push('collect_tasks_v2');
    logger.migration.info('Created collect_tasks_v2');
  } catch (error) {
    errors.push(`collect_tasks_v2: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.migration.error('Failed to create collect_tasks_v2', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 2. 创建采集日志表
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS collect_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        source_name TEXT,
        action TEXT,
        message TEXT,
        details TEXT,
        vod_id TEXT,
        vod_name TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_logs_task ON collect_logs(task_id, created_at DESC)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_logs_level ON collect_logs(level, created_at DESC)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_logs_action ON collect_logs(action, created_at DESC)
    `).run();
    
    tables.push('collect_logs');
    logger.migration.info('Created collect_logs');
  } catch (error) {
    errors.push(`collect_logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.migration.error('Failed to create collect_logs', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 3. 创建资源站健康状态表
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS source_health (
        source_id INTEGER PRIMARY KEY,
        source_name TEXT,
        last_check_at INTEGER,
        status TEXT DEFAULT 'unknown',
        response_time INTEGER,
        avg_response_time INTEGER,
        success_rate REAL DEFAULT 100,
        total_checks INTEGER DEFAULT 0,
        success_checks INTEGER DEFAULT 0,
        last_error TEXT,
        last_error_at INTEGER,
        consecutive_failures INTEGER DEFAULT 0,
        video_count INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_health_status ON source_health(status)
    `).run();
    
    tables.push('source_health');
    logger.migration.info('Created source_health');
  } catch (error) {
    errors.push(`source_health: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.migration.error('Failed to create source_health', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 4. 创建采集统计表
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS collect_stats_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        source_id INTEGER,
        source_name TEXT,
        category_id INTEGER,
        category_name TEXT,
        task_count INTEGER DEFAULT 0,
        new_count INTEGER DEFAULT 0,
        update_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        avg_duration INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(date, source_id, category_id)
      )
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_stats_daily_date ON collect_stats_daily(date DESC)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_stats_daily_source ON collect_stats_daily(source_id, date DESC)
    `).run();
    
    tables.push('collect_stats_daily');
    logger.migration.info('Created collect_stats_daily');
  } catch (error) {
    errors.push(`collect_stats_daily: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.migration.error('Failed to create collect_stats_daily', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 5. 创建分类配置表
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS video_categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        name_en TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        collect_enabled BOOLEAN DEFAULT 1,
        collect_priority INTEGER DEFAULT 5,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();
    
    // 插入默认分类
    await env.DB.prepare(`
      INSERT OR IGNORE INTO video_categories (id, name, name_en, sort_order, is_active) VALUES
      (1, '电影', 'movie', 1, 1),
      (2, '电视剧', 'series', 2, 1),
      (3, '综艺', 'variety', 3, 1),
      (4, '动漫', 'anime', 4, 1),
      (5, '短剧', 'shorts', 5, 1),
      (6, '体育', 'sports', 6, 1),
      (7, '纪录片', 'documentary', 7, 1),
      (8, '预告片', 'trailer', 8, 1)
    `).run();
    
    tables.push('video_categories');
    logger.migration.info('Created video_categories');
  } catch (error) {
    errors.push(`video_categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.migration.error('Failed to create video_categories', { error: error instanceof Error ? error.message : String(error) });
  }
  }
  
  // 6. 为 vod_cache 添加 quality_score 字段（如果不存在）
  try {
    // 检查字段是否存在
    const tableInfo = await env.DB.prepare(`PRAGMA table_info(vod_cache)`).all();
    const hasQualityScore = (tableInfo.results as TableColumnInfo[]).some(col => col.name === 'quality_score');
    
    if (!hasQualityScore) {
      await env.DB.prepare(`
        ALTER TABLE vod_cache ADD COLUMN quality_score INTEGER DEFAULT 0
      `).run();
      logger.collector.info('Added quality_score column to vod_cache');
    }
  } catch (error) {
    // 字段可能已存在，忽略错误
    logger.collector.info('quality_score column may already exist');
  }
  
  // 7. 为 video_sources 添加 response_format 字段（如果不存在）
  try {
    const sourceTableInfo = await env.DB.prepare(`PRAGMA table_info(video_sources)`).all();
    const hasResponseFormat = (sourceTableInfo.results as TableColumnInfo[]).some(col => col.name === 'response_format');
    
    if (!hasResponseFormat) {
      await env.DB.prepare(`
        ALTER TABLE video_sources ADD COLUMN response_format TEXT DEFAULT 'auto'
      `).run();
      logger.collector.info('Added response_format column to video_sources');
    }
  } catch (error) {
    logger.collector.info('response_format column may already exist');
  }
  
  const success = errors.length === 0;
  logger.migration.info('Migration completed', { success, tables: tables.join(', '), errors: errors.length > 0 ? errors.join(', ') : 'none' });
  
  return { success, tables, errors };
}
